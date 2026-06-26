import { useEffect, useMemo, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { detectClientMetadata } from "@/lib/clientMetadata";
import { logAuditEvent } from "@/lib/audit";

type TermsVersion = {
  id: string;
  type: "terms_of_use" | "privacy_policy";
  version: string;
  content: string;
  active: boolean;
};

type ConsentGateProps = {
  children: React.ReactNode;
};

const consentStorageKey = (userId: string, termsId: string, privacyId: string) =>
  `consultaul:lgpd-consent:${userId}:${termsId}:${privacyId}`;

export function ConsentGate({ children }: ConsentGateProps) {
  const { user, loading: authLoading } = useAuth();
  const [terms, setTerms] = useState<TermsVersion | null>(null);
  const [privacy, setPrivacy] = useState<TermsVersion | null>(null);
  const [hasConsent, setHasConsent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");

  const requiresConsent = Boolean(user && terms && privacy && !hasConsent && !loading);

  useEffect(() => {
    let active = true;

    async function loadConsentStatus() {
      if (authLoading || !user) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const { data: versions, error: termsError } = await supabase
          .from("terms_versions" as never)
          .select("id,type,version,content,active")
          .eq("active", true);

        if (termsError) throw termsError;

        const activeTerms = (versions as unknown as TermsVersion[] | null)?.find((row) => row.type === "terms_of_use") ?? null;
        const activePrivacy = (versions as unknown as TermsVersion[] | null)?.find((row) => row.type === "privacy_policy") ?? null;

        if (!active) return;
        setTerms(activeTerms);
        setPrivacy(activePrivacy);

        if (!activeTerms || !activePrivacy) {
          setHasConsent(true);
          return;
        }

        const cacheKey = consentStorageKey(user.id, activeTerms.id, activePrivacy.id);
        if (window.localStorage.getItem(cacheKey) === "accepted") {
          setHasConsent(true);
        }

        const { data: consent, error: consentError } = await supabase
          .from("user_consents" as never)
          .select("id")
          .eq("user_id", user.id)
          .eq("terms_version_id", activeTerms.id)
          .eq("privacy_policy_version_id", activePrivacy.id)
          .maybeSingle();

        if (consentError) throw consentError;
        if (!active) return;
        const accepted = Boolean(consent);
        setHasConsent(accepted);
        if (accepted) {
          window.localStorage.setItem(cacheKey, "accepted");
        }
      } catch (err) {
        console.error("Failed to load LGPD consent status", err);
        if (active) {
          setError("Nao foi possivel validar o aceite LGPD. Tente recarregar a pagina.");
          setHasConsent(false);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadConsentStatus();

    return () => {
      active = false;
    };
  }, [authLoading, user]);

  const versionLabel = useMemo(() => {
    if (!terms || !privacy) return "";
    return `Termos ${terms.version} / Privacidade ${privacy.version}`;
  }, [privacy, terms]);

  const acceptConsent = async () => {
    if (!terms || !privacy || !confirmed) return;
    setAccepting(true);
    setError("");

    try {
      const metadata = detectClientMetadata();
      const { error: fnError } = await supabase.functions.invoke("lgpd-audit", {
        body: {
          action: "accept_consent",
          payload: {
            terms_version_id: terms.id,
            privacy_policy_version_id: privacy.id,
            browser: metadata.browser,
            os: metadata.os,
            device_type: metadata.deviceType,
          },
        },
      });

      if (fnError) {
        const { error: insertError } = await supabase.from("user_consents" as never).upsert({
          user_id: user?.id,
          terms_version_id: terms.id,
          privacy_policy_version_id: privacy.id,
          user_agent: metadata.userAgent,
          browser: metadata.browser,
          os: metadata.os,
          device_type: metadata.deviceType,
        } as never, { onConflict: "user_id,terms_version_id,privacy_policy_version_id" });
        if (insertError) throw insertError;

        await logAuditEvent({
          action: "terms_accepted",
          module: "lgpd",
          entity: "user_consents",
          entityId: user?.id,
          newValues: { terms_version_id: terms.id, privacy_policy_version_id: privacy.id },
          message: "Usuario aceitou Termos de Uso e Politica de Privacidade.",
          observation: "Usuario aceitou os Termos de Uso e a Politica de Privacidade vigentes.",
        });
      }

      setHasConsent(true);
      if (user?.id) {
        window.localStorage.setItem(consentStorageKey(user.id, terms.id, privacy.id), "accepted");
      }
    } catch (err) {
      console.error("Failed to accept LGPD terms", err);
      setError("Nao foi possivel registrar o aceite. Tente novamente.");
    } finally {
      setAccepting(false);
    }
  };

  return (
    <>
      {children}
      {(requiresConsent || error) && user && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 p-4 backdrop-blur-sm">
          <section className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border bg-card shadow-xl">
            <header className="border-b p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold">Termos de Uso e Politica de Privacidade</h1>
                  <p className="text-sm text-muted-foreground">{versionLabel || "Validando versoes ativas..."}</p>
                </div>
              </div>
            </header>

            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-5 p-5 text-sm">
                {error && <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-destructive">{error}</div>}
                {terms && privacy && (
                  <>
                    <div className="rounded-md border bg-muted/30 p-3 text-muted-foreground">
                      Coletamos IP, User-Agent, navegador, sistema operacional, tipo de dispositivo e eventos de uso somente para seguranca,
                      auditoria, rastreabilidade operacional, prevencao de abuso e cumprimento de obrigacoes legais. Senhas, tokens e segredos
                      nao devem ser registrados nos logs.
                    </div>

                    <section className="space-y-2">
                      <h2 className="font-semibold">Termos de Uso</h2>
                      <p className="whitespace-pre-wrap leading-6 text-foreground/90">{terms.content}</p>
                    </section>

                    <section className="space-y-2">
                      <h2 className="font-semibold">Politica de Privacidade</h2>
                      <p className="whitespace-pre-wrap leading-6 text-foreground/90">{privacy.content}</p>
                    </section>
                  </>
                )}
              </div>
            </ScrollArea>

            {terms && privacy && (
              <footer className="space-y-4 border-t p-5">
                <label className="flex items-start gap-3 text-sm">
                  <Checkbox checked={confirmed} onCheckedChange={(checked) => setConfirmed(checked === true)} />
                  <span>
                    Li e aceito os Termos de Uso e a Politica de Privacidade, incluindo o uso de logs de auditoria para seguranca e
                    rastreabilidade.
                  </span>
                </label>
                <div className="flex justify-end">
                  <Button onClick={acceptConsent} disabled={!confirmed || accepting}>
                    {accepting ? "Registrando..." : "Aceitar e continuar"}
                  </Button>
                </div>
              </footer>
            )}
          </section>
        </div>
      )}
    </>
  );
}
