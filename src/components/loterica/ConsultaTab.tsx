import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

const FIELDS: Array<{ key: string; label: string; mono?: boolean }> = [
  { key: "nome_loterica", label: "Nome" },
  { key: "ccto_oi", label: "CCTO OI" },
  { key: "ccto_oemp", label: "CCTO OEMP" },
  { key: "designacao_nova", label: "Designa\u00E7\u00E3o Nova" },
  { key: "operadora", label: "Operadora" },
  { key: "ip_nat", label: "IP NAT", mono: true },
  { key: "ip_wan", label: "IP WAN", mono: true },
  { key: "loopback_wan", label: "Loopback Principal", mono: true },
  { key: "loopback_lan", label: "Loopback Secund\u00E1rio", mono: true },
  { key: "endereco", label: "Endere\u00E7o" },
  { key: "contato", label: "Contato" },
  { key: "status", label: "Status" },
  { key: "cidade", label: "Cidade" },
  { key: "uf", label: "UF" },
];

const EXTRA_FIELDS: Array<{ label: string; keys: string[]; mono?: boolean }> = [
  { label: "Rede LAN", keys: ["REDE LAN"], mono: true },
  { label: "IP Switch", keys: ["IP SWITCH", "LOOPBACK SWITCH"], mono: true },
  { label: "TFL", keys: ["TFL", "TFLs"], mono: true },
  { label: "Circuitos Meraki", keys: ["CIRCUITO MERAKI", "CIRCUITOS MERAKI", "MERAKI"] },
  { label: "Empresa OEMP", keys: ["EMPRESA OEMP"] },
  { label: "Tipo UL", keys: ["TIPO LOTERICA", "TIPO UL"] },
  { label: "Per\u00EDmetro", keys: ["PERIMETRO", "PER\u00CDMETRO"] },
  { label: "Tecnologia", keys: ["TECNOLOGIA"] },
  { label: "Modelo Roteador", keys: ["MODELO ROTEADOR"] },
  { label: "SIM Card 4G", keys: ["SIM CARD 4G"], mono: true },
  { label: "Owner", keys: ["OWNER"] },
  { label: "Resp. Backup", keys: ["RESP BACKUP"] },
  { label: "Regi\u00E3o", keys: ["REGIAO", "REGI\u00C3O"] },
  { label: "CEP", keys: ["CEP"], mono: true },
  { label: "Migra\u00E7\u00E3o", keys: ["MIGRACAO", "MIGRA\u00C7\u00C3O"] },
  { label: "Homologado", keys: ["HOMOLOGADO"] },
];

interface ConsultaTabProps {
  form: any;
  setForm: (form: any) => void;
}

const normalizeHoursFromCreated = (value: unknown) => {
  if (!value) return 0;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 36e5));
};

const normalizeHours = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.floor(value));
  const n = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
};

const formatDateTime = (value: unknown) => {
  if (!value) return "-";
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("pt-BR");
};

const ConsultaTab = ({ form, setForm }: ConsultaTabProps) => {
  const raw = (form?.raw_data && typeof form.raw_data === "object") ? form.raw_data : {};
  const codUl = String(form?.cod_ul || "").trim();

  const getRawValue = (keys: string[]) => {
    for (const k of keys) {
      if (Object.prototype.hasOwnProperty.call(raw, k)) return raw[k];
    }
    return undefined;
  };

  const setRawValue = (keys: string[], value: string) => {
    const current = (form?.raw_data && typeof form.raw_data === "object") ? form.raw_data : {};
    const next: Record<string, unknown> = { ...current };
    const targetKey = keys.find((k) => Object.prototype.hasOwnProperty.call(current, k)) || keys[0];
    next[targetKey] = value;
    setForm({ ...form, raw_data: next });
  };

  const { data: atendimentoData, isLoading: atendimentoLoading, error: atendimentoError } = useQuery({
    queryKey: ["consulta-ul-atendimento", codUl],
    enabled: !!codUl,
    queryFn: async () => {
      const [jiraRes, gisRes] = await Promise.all([
        (supabase as any)
          .from("jira_abertos")
          .select("chave,cod_ul,tipo_falha,status,criado,n_incidente_mam,resumo")
          .eq("cod_ul", codUl)
          .order("criado", { ascending: false }),
        (supabase as any)
          .from("falhas_gis")
          .select("record_key,id_alarme,cod_ul,categoria_gis,status,status_secundario,situacao,data_hora_inicial,duracao_horas,designacao,chamado")
          .eq("cod_ul", codUl)
          .order("duracao_horas", { ascending: false }),
      ]);

      if (jiraRes.error) throw jiraRes.error;
      if (gisRes.error) throw gisRes.error;

      const jira = (jiraRes.data || []).map((row: any) => ({
        key: `jira:${row.chave}`,
        fonte: "Jira",
        id: row.chave,
        tipo: row.tipo_falha || "Sem tipo",
        status: row.status || "",
        criado: row.criado,
        horas: normalizeHoursFromCreated(row.criado),
        link: row.resumo || row.chave || codUl,
        extra: row.n_incidente_mam ? `MAM: ${row.n_incidente_mam}` : "",
      }));

      const falhas = (gisRes.data || []).map((row: any) => ({
        key: `gis:${row.record_key || row.id_alarme}`,
        fonte: "GIS",
        id: row.id_alarme || row.chamado || "-",
        tipo: row.categoria_gis || "Alarme GIS",
        status: [row.status, row.status_secundario, row.situacao].filter(Boolean).join(" | "),
        criado: row.data_hora_inicial,
        horas: normalizeHours(row.duracao_horas),
        link: row.designacao || row.chamado || row.id_alarme || codUl,
        extra: row.chamado ? `Chamado: ${row.chamado}` : "",
      }));

      const ofensores200 = [...jira, ...falhas]
        .filter((row) => row.horas > 200)
        .sort((a, b) => b.horas - a.horas);

      return { jira, falhas, ofensores200 };
    },
  });

  const atendimentoErroMsg = useMemo(() => {
    if (!atendimentoError) return "";
    return String((atendimentoError as any)?.message || atendimentoError);
  }, [atendimentoError]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{"Dados Edit\u00E1veis"}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {FIELDS.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{f.label}</Label>
                <Input
                  className={f.mono ? "font-mono text-xs" : ""}
                  value={form?.[f.key] || ""}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Chamados e Alarmes da UL</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {atendimentoLoading && (
            <p className="text-sm text-muted-foreground">Carregando Jira Abertos e Falhas GIS...</p>
          )}

          {!atendimentoLoading && atendimentoError && (
            <div className="space-y-2">
              <p className="text-sm text-destructive">Erro ao consultar Jira Abertos / Falhas GIS.</p>
              <p className="text-xs text-muted-foreground break-words">{atendimentoErroMsg}</p>
            </div>
          )}

          {!atendimentoLoading && !atendimentoError && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Chamado aberto (Jira Abertos)</p>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge variant={atendimentoData?.jira?.length ? "default" : "outline"}>
                      {atendimentoData?.jira?.length ? "SIM" : "NÃO"}
                    </Badge>
                    <span className="text-sm font-medium">{atendimentoData?.jira?.length || 0}</span>
                  </div>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Alarme ativo (Falhas GIS)</p>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge variant={atendimentoData?.falhas?.length ? "default" : "outline"}>
                      {atendimentoData?.falhas?.length ? "SIM" : "NÃO"}
                    </Badge>
                    <span className="text-sm font-medium">{atendimentoData?.falhas?.length || 0}</span>
                  </div>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Ofensores &gt; 200h</p>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge variant={(atendimentoData?.ofensores200?.length || 0) > 0 ? "destructive" : "outline"}>
                      {(atendimentoData?.ofensores200?.length || 0) > 0 ? "ATENÇÃO" : "OK"}
                    </Badge>
                    <span className="text-sm font-medium">{atendimentoData?.ofensores200?.length || 0}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Resumo (Jira + GIS)</p>
                {([...(atendimentoData?.jira || []), ...(atendimentoData?.falhas || [])] as any[])
                  .sort((a, b) => b.horas - a.horas)
                  .slice(0, 10)
                  .map((row) => (
                    <div key={row.key} className="rounded-lg border p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">{row.fonte}</Badge>
                        <span className="text-xs font-mono">{row.id}</span>
                        <Badge variant="outline" className={row.horas > 200 ? "border-red-500/30 text-red-500" : ""}>
                          {row.horas}h
                        </Badge>
                      </div>
                      <p className="text-sm mt-2">{row.tipo || "-"}</p>
                      <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{row.status || "-"}</p>
                      <p className="text-xs text-muted-foreground mt-1">Criado: {formatDateTime(row.criado)}</p>
                      <p className="text-xs font-mono mt-1 break-all">{row.link}</p>
                      {row.extra ? <p className="text-xs text-muted-foreground mt-1">{row.extra}</p> : null}
                    </div>
                  ))}

                {((atendimentoData?.jira?.length || 0) + (atendimentoData?.falhas?.length || 0) === 0) && (
                  <p className="text-sm text-muted-foreground">Nenhum chamado aberto ou alarme GIS encontrado para esta UL.</p>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Links ofensores acima de 200h</p>
                {(atendimentoData?.ofensores200?.length || 0) === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum ofensor acima de 200h para esta UL.</p>
                ) : (
                  atendimentoData?.ofensores200?.slice(0, 10).map((row: any) => (
                    <div key={`ofensor-${row.key}`} className="rounded-lg border p-3 flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">{row.fonte}</Badge>
                        <span className="text-xs font-mono">{row.horas}h</span>
                      </div>
                      <p className="text-xs font-mono break-all">{row.link}</p>
                      <p className="text-xs text-muted-foreground">{row.tipo}</p>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Dados Adicionais</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {EXTRA_FIELDS.map((f) => (
              <div key={f.label} className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{f.label}</Label>
                <Input
                  className={f.mono ? "font-mono text-xs" : ""}
                  value={String(getRawValue(f.keys) ?? "")}
                  placeholder="-"
                  onChange={(e) => setRawValue(f.keys, e.target.value)}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ConsultaTab;
