import { useMemo, useState } from "react";
import { Download, FileText } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { exportOwnPersonalData } from "@/lib/audit";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type TermsVersion = {
  id: string;
  type: "terms_of_use" | "privacy_policy";
  version: string;
  content: string;
  active: boolean;
  created_at: string;
};

type UserConsent = {
  id: string;
  accepted_at: string;
  terms_version_id: string;
  privacy_policy_version_id: string;
  browser: string | null;
  os: string | null;
  device_type: string | null;
};

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function TermsPrivacy() {
  const { user } = useAuth();
  const [exporting, setExporting] = useState(false);

  const versionsQuery = useQuery({
    queryKey: ["terms-privacy-versions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("terms_versions" as never)
        .select("id,type,version,content,active,created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as TermsVersion[];
    },
  });

  const consentsQuery = useQuery({
    queryKey: ["my-consents", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_consents" as never)
        .select("id,accepted_at,terms_version_id,privacy_policy_version_id,browser,os,device_type")
        .eq("user_id", user?.id)
        .order("accepted_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as UserConsent[];
    },
  });

  const latestConsent = consentsQuery.data?.[0] ?? null;
  const latestDocs = useMemo(() => {
    const versions = versionsQuery.data ?? [];
    const termsId = latestConsent?.terms_version_id;
    const privacyId = latestConsent?.privacy_policy_version_id;
    return {
      terms: versions.find((version) => version.id === termsId) ?? versions.find((version) => version.type === "terms_of_use" && version.active),
      privacy: versions.find((version) => version.id === privacyId) ?? versions.find((version) => version.type === "privacy_policy" && version.active),
    };
  }, [latestConsent, versionsQuery.data]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const data = await exportOwnPersonalData();
      downloadJson(data, `dados-pessoais-${new Date().toISOString().slice(0, 10)}.json`);
      toast.success("Dados pessoais exportados.");
    } catch (error) {
      console.error("Failed to export personal data", error);
      toast.error("Nao foi possivel exportar os dados pessoais.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-6">
      <header className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-xl font-semibold">Termos e Privacidade</h1>
          <p className="text-sm text-muted-foreground">Consulte documentos aceitos e exporte seus dados pessoais.</p>
        </div>
        <Button className="ml-auto" variant="outline" onClick={handleExport} disabled={exporting}>
          <Download className="h-4 w-4" />
          {exporting ? "Exportando..." : "Exportar meus dados"}
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" />
            Ultimo aceite registrado
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {latestConsent ? (
            <>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{new Date(latestConsent.accepted_at).toLocaleString("pt-BR")}</Badge>
                <Badge variant="outline">{latestConsent.browser || "Navegador desconhecido"}</Badge>
                <Badge variant="outline">{latestConsent.os || "SO desconhecido"}</Badge>
                <Badge variant="outline">{latestConsent.device_type || "Dispositivo desconhecido"}</Badge>
              </div>
              <p className="text-muted-foreground">
                O registro de IP e User-Agent fica armazenado para auditoria e seguranca conforme politica vigente.
              </p>
            </>
          ) : (
            <p className="text-muted-foreground">Nenhum aceite encontrado para este usuario.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Termos de Uso</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Badge>{latestDocs.terms?.version ?? "sem versao"}</Badge>
            <p className="whitespace-pre-wrap leading-6">{latestDocs.terms?.content ?? "Documento indisponivel."}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Politica de Privacidade</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Badge>{latestDocs.privacy?.version ?? "sem versao"}</Badge>
            <p className="whitespace-pre-wrap leading-6">{latestDocs.privacy?.content ?? "Documento indisponivel."}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
