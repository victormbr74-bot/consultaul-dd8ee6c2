import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search } from "lucide-react";
import {
  buildLookupDisplay,
  dedupeTerms,
  fetchLookupRows,
  getLookupIp,
  parseTerms,
  resolveMatches,
  normalizeText,
  type LotericaLookupRow,
  type TermMatch,
} from "@/components/loterica/lotericaLookup";

interface ConsultaMassaRow {
  query: string;
  statusType: "ok" | "missing_ip" | "not_found";
  statusText: string;
  codUl: string;
  nome: string;
  endereco: string;
  cidade: string;
  uf: string;
  contato: string;
  statusUl: string;
  cctoOi: string;
  designacaoNova: string;
  ipNat: string;
  ipWan: string;
  loopbackWan: string;
  loopbackLan: string;
  cctoOemp: string;
  operadora: string;
  tecnologia: string;
  ipPrimario: string;
  ipSecundario: string;
  matchedBy: string;
  source: TermMatch;
}

interface FieldSpec {
  label: string;
  aliases: string[];
  mono?: boolean;
  fallback?: (row: LotericaLookupRow) => unknown;
}

interface FieldSection {
  title: string;
  description: string;
  fields: FieldSpec[];
}

interface ModalField {
  label: string;
  value: string;
  mono?: boolean;
}

interface RawEntry {
  key: string;
  value: string;
}

interface RawLookup {
  exact: Map<string, string>;
  loose: Map<string, string>;
  entries: RawEntry[];
}

const asText = (value: unknown) => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value).trim();

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toLocaleString("pt-BR");
  }

  if (typeof value === "object") {
    try {
      const json = JSON.stringify(value);
      return json === "{}" ? "" : json;
    } catch {
      return String(value).trim();
    }
  }

  return String(value).trim();
};

const normalizeHeaderLoose = (value: string) => {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
};

const buildRawLookup = (rawData: Record<string, unknown> | null | undefined): RawLookup => {
  const raw = rawData && typeof rawData === "object" ? rawData : {};
  const exact = new Map<string, string>();
  const loose = new Map<string, string>();
  const entries: RawEntry[] = [];

  for (const [key, rawValue] of Object.entries(raw)) {
    const value = asText(rawValue);
    const displayValue = value || "-";
    entries.push({ key, value: displayValue });

    if (!value) continue;

    const exactKey = key.trim().toUpperCase();
    const looseKey = normalizeHeaderLoose(key);

    if (exactKey && !exact.has(exactKey)) exact.set(exactKey, value);
    if (looseKey && !loose.has(looseKey)) loose.set(looseKey, value);
  }

  return { exact, loose, entries };
};

const getByAliases = (lookup: RawLookup, aliases: string[]) => {
  for (const alias of aliases) {
    const exactValue = lookup.exact.get(alias.trim().toUpperCase());
    if (exactValue) return exactValue;

    const looseValue = lookup.loose.get(normalizeHeaderLoose(alias));
    if (looseValue) return looseValue;
  }
  return "";
};

const getFieldValue = (row: LotericaLookupRow, lookup: RawLookup, field: FieldSpec) => {
  const rawValue = getByAliases(lookup, field.aliases);
  if (rawValue) return rawValue;

  const fallback = field.fallback ? asText(field.fallback(row)) : "";
  return fallback || "-";
};

const FIELD_SECTIONS: FieldSection[] = [
  {
    title: "Dados da Lotérica",
    description: "Informações gerais de identificação e operação da UL.",
    fields: [
      {
        label: "Código UL",
        mono: true,
        aliases: ["COD. UL", "CODIGO DA UL", "CODIGO UL", "CÓDIGO UL", "CÓDIGO DA LOTÉRICA_", "cod_ul"],
        fallback: (row) => row.cod_ul,
      },
      {
        label: "Nome da Lotérica",
        aliases: ["NOME DA LOTERICA", "NOME UL", "nome_loterica"],
        fallback: (row) => row.nome_loterica,
      },
      {
        label: "Endereço",
        aliases: ["ENDEREÇO", "ENDERECO", "ENDEREÃ‡O", "endereco"],
        fallback: (row) => row.endereco,
      },
      {
        label: "Município / Cidade",
        aliases: ["MUNICIPIO", "MUNICÍPIO", "CIDADE", "cidade"],
        fallback: (row) => row.cidade,
      },
      {
        label: "UF",
        mono: true,
        aliases: ["UF", "uf"],
        fallback: (row) => row.uf,
      },
      {
        label: "Contato",
        aliases: ["CONTATO", "contato"],
        fallback: (row) => row.contato,
      },
      {
        label: "Status UL",
        aliases: ["STATUS UL", "status"],
        fallback: (row) => row.status,
      },
      {
        label: "Migração",
        aliases: ["MIGRAÇÃO", "MIGRACAO", "MIGRAÃ‡ÃƒO", "MIGRAÃ‡ÃƒO"],
      },
      {
        label: "Homologado",
        aliases: ["HOMOLOGADO"],
      },
      {
        label: "Tipo UL",
        aliases: ["TIPO UL", "TIPO LOTERICA", "TIPO LOTÉRICA"],
      },
      {
        label: "TFL",
        mono: true,
        aliases: ["TFL", "TFLs", "TFLS"],
      },
      {
        label: "Owner",
        aliases: ["OWNER"],
      },
      {
        label: "Resp. Backup",
        aliases: ["RESP BACKUP", "RESPONSAVEL BACKUP", "RESPONSÁVEL BACKUP"],
      },
    ],
  },
  {
    title: "Link Principal",
    description: "Campos do link principal e dados de roteamento principal.",
    fields: [
      {
        label: "CCTO OI",
        mono: true,
        aliases: ["CCTO OI", "ccto_oi"],
        fallback: (row) => row.ccto_oi,
      },
      {
        label: "Designação Nova",
        mono: true,
        aliases: ["DESIGINACAO NOVA", "DESIGINAÇÃO NOVA", "DESIGNAÇÃO NOVA", "designacao_nova"],
        fallback: (row) => row.designacao_nova,
      },
      {
        label: "BASE UN",
        mono: true,
        aliases: ["BASE UN"],
      },
      {
        label: "Ponto Lógico / Designação",
        mono: true,
        aliases: ["Ponto Lógico / Designação", "Ponto Lógico / \nDesignação", "PONTO LOGICO / DESIGNACAO"],
      },
      {
        label: "IP NAT",
        mono: true,
        aliases: ["IP NAT", "ip_nat"],
        fallback: (row) => row.ip_nat,
      },
      {
        label: "IP WAN",
        mono: true,
        aliases: ["IP WAN", "ip_wan"],
        fallback: (row) => row.ip_wan,
      },
      {
        label: "Loopback Principal",
        mono: true,
        aliases: ["LOOPBACK PRINCIPAL", "LOOPBACK PRIMARIO", "LOOTPBACK PRIMARIO", "loopback_wan"],
        fallback: (row) => row.loopback_wan,
      },
      {
        label: "IP / Loopback Switch",
        mono: true,
        aliases: ["IP SWITCH", "LOOPBACK SWITCH"],
      },
      {
        label: "Rede LAN",
        mono: true,
        aliases: ["REDE LAN", "REDE_LAN"],
      },
      {
        label: "Perímetro",
        aliases: ["PERIMETRO", "PERÍMETRO", "PERÃMETRO"],
      },
    ],
  },
  {
    title: "Link Secundário e Backup",
    description: "Campos do circuito OEMP e tecnologias de contingência.",
    fields: [
      {
        label: "CCTO OEMP",
        mono: true,
        aliases: ["CCTO OEMP", "ccto_oemp"],
        fallback: (row) => row.ccto_oemp,
      },
      {
        label: "Empresa OEMP",
        aliases: ["EMPRESA OEMP"],
      },
      {
        label: "Circuito OEMP",
        mono: true,
        aliases: ["CIRCUITO OEMP"],
      },
      {
        label: "Loopback Secundário",
        mono: true,
        aliases: ["LOOPBACK SECUNDARIO", "LOOPBACK SECUNDÁRIO", "LOOPBACK SECUNDÃRIO", "loopback_lan"],
        fallback: (row) => row.loopback_lan,
      },
      {
        label: "Operadora 4G",
        aliases: ["OPERADORA 4G", "OPERADORA", "operadora"],
        fallback: (row) => row.operadora,
      },
      {
        label: "SIM Card 4G",
        mono: true,
        aliases: ["SIM CARD 4G"],
      },
      {
        label: "VSAT",
        aliases: ["VSAT"],
      },
      {
        label: "Meraki / PA Avançado",
        mono: true,
        aliases: ["PA AVANÇADO (MERAKI)", "PA AVANCADO (MERAKI)", "MERAKI", "CIRCUITO MERAKI", "CIRCUITOS MERAKI"],
      },
      {
        label: "Região",
        aliases: ["REGIÃO", "REGIAO", "REGIÃƒO", "REGIÃƒO"],
      },
      {
        label: "CEP",
        mono: true,
        aliases: ["CEP"],
      },
    ],
  },
  {
    title: "Tecnologia e Equipamento",
    description: "Informações técnicas adicionais da infraestrutura da UL.",
    fields: [
      {
        label: "Tecnologia",
        aliases: ["TECNOLOGIA"],
      },
      {
        label: "Modelo Roteador",
        aliases: ["MODELO ROTEADOR"],
      },
      {
        label: "Atualizado em",
        aliases: ["updated_at", "ATUALIZADO EM"],
        fallback: (row) => row.updated_at,
      },
    ],
  },
];

const FieldTile = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => {
  return (
    <div className="rounded-xl border bg-muted/25 p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-sm break-words", mono ? "font-mono text-xs" : "")}>{value || "-"}</p>
    </div>
  );
};

const ConsultaMassaTab = () => {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [matches, setMatches] = useState<TermMatch[]>([]);
  const [selectedRow, setSelectedRow] = useState<LotericaLookupRow | null>(null);

  const rows = useMemo<ConsultaMassaRow[]>(() => {
    return matches.map((match) => {
      const primary = buildLookupDisplay(match, "primario");
      const secondary = buildLookupDisplay(match, "secundario");

      const empty: ConsultaMassaRow = {
        query: match.query,
        statusType: "not_found",
        statusText: "Nao encontrado",
        codUl: "-", nome: "-", endereco: "-", cidade: "-", uf: "-", contato: "-",
        statusUl: "-", cctoOi: "-", designacaoNova: "-", ipNat: "-", ipWan: "-",
        loopbackWan: "-", loopbackLan: "-", cctoOemp: "-", operadora: "-", tecnologia: "-",
        ipPrimario: "", ipSecundario: "", matchedBy: "-", source: match,
      };

      if (!match.row) return empty;

      const row = match.row;
      const rawLookup = buildRawLookup(row.raw_data);
      const ipPrimario = getLookupIp(row, "primario");
      const ipSecundario = getLookupIp(row, "secundario");
      const hasAnyIp = Boolean(ipPrimario || ipSecundario);

      return {
        query: match.query,
        statusType: hasAnyIp ? "ok" : "missing_ip",
        statusText: hasAnyIp ? "Encontrado" : "Sem IP",
        codUl: normalizeText(row.cod_ul) || "-",
        nome: normalizeText(row.nome_loterica) || "-",
        endereco: normalizeText(row.endereco) || "-",
        cidade: normalizeText(row.cidade) || "-",
        uf: normalizeText(row.uf) || "-",
        contato: normalizeText(row.contato) || "-",
        statusUl: normalizeText(row.status) || "-",
        cctoOi: normalizeText(row.ccto_oi) || "-",
        designacaoNova: normalizeText(row.designacao_nova) || "-",
        ipNat: normalizeText(row.ip_nat) || "-",
        ipWan: normalizeText(row.ip_wan) || "-",
        loopbackWan: normalizeText(row.loopback_wan) || "-",
        loopbackLan: normalizeText(row.loopback_lan) || "-",
        cctoOemp: normalizeText(row.ccto_oemp) || "-",
        operadora: normalizeText(row.operadora) || "-",
        tecnologia: getByAliases(rawLookup, ["TECNOLOGIA"]) || "-",
        ipPrimario,
        ipSecundario,
        matchedBy: primary.matchedBy !== "-" ? primary.matchedBy : secondary.matchedBy,
        source: match,
      };
    });
  }, [matches]);

  const summary = useMemo(() => {
    const ok = rows.filter((row) => row.statusType === "ok").length;
    const missingIp = rows.filter((row) => row.statusType === "missing_ip").length;
    const notFound = rows.filter((row) => row.statusType === "not_found").length;

    return {
      total: rows.length,
      ok,
      missingIp,
      notFound,
    };
  }, [rows]);

  const selectedRawLookup = useMemo(() => {
    if (!selectedRow) return null;
    return buildRawLookup(selectedRow.raw_data);
  }, [selectedRow]);

  const selectedTecnologia = useMemo(() => {
    if (!selectedRawLookup) return "-";
    return getByAliases(selectedRawLookup, ["TECNOLOGIA"]) || "-";
  }, [selectedRawLookup]);

  const modalSections = useMemo(() => {
    if (!selectedRow || !selectedRawLookup) return [] as Array<{ title: string; description: string; items: ModalField[] }>;

    return FIELD_SECTIONS.map((section) => ({
      title: section.title,
      description: section.description,
      items: section.fields.map((field) => ({
        label: field.label,
        mono: field.mono,
        value: getFieldValue(selectedRow, selectedRawLookup, field),
      })),
    }));
  }, [selectedRow, selectedRawLookup]);

  const rawEntries = useMemo(() => {
    return selectedRawLookup?.entries || [];
  }, [selectedRawLookup]);

  const runLookup = async () => {
    const terms = dedupeTerms(parseTerms(input));
    if (!terms.length) {
      setError("Informe ao menos um codigo UL ou circuito.");
      setMatches([]);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const lookupRows = await fetchLookupRows(terms);
      const resolved = resolveMatches(terms, lookupRows);
      setMatches(resolved);
    } catch (lookupError) {
      setMatches([]);
      setError(String((lookupError as Error)?.message || lookupError || "Falha na consulta em massa."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Search className="w-5 h-5" /> Consulta em Massa
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="consulta-massa-input">Codigos UL ou circuitos (um por linha)</Label>
            <Textarea
              id="consulta-massa-input"
              placeholder={"21-000666-8\n21-000666-3\n21-000666-5\n21-000666-1"}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="min-h-[120px] font-mono text-xs"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void runLookup()} disabled={loading}>
              {loading ? "Consultando..." : "Consultar"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setInput("");
                setMatches([]);
                setError("");
              }}
            >
              Limpar
            </Button>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          {rows.length > 0 && (
            <>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="outline">Total: {summary.total}</Badge>
                <Badge variant="default">Encontrados: {summary.ok}</Badge>
                <Badge variant="secondary">Sem IP: {summary.missingIp}</Badge>
                <Badge variant="outline">Nao encontrados: {summary.notFound}</Badge>
              </div>

              <p className="text-xs text-muted-foreground">
                Clique em uma linha encontrada para abrir o detalhe completo da lotérica.
              </p>

              <div className="rounded-lg border overflow-auto max-h-[420px]">
                <table className="w-full text-xs whitespace-nowrap">
                  <thead className="bg-muted/60 sticky top-0">
                    <tr className="text-left">
                      <th className="p-2 font-medium">Consulta</th>
                      <th className="p-2 font-medium">Status</th>
                      <th className="p-2 font-medium">Codigo UL</th>
                      <th className="p-2 font-medium">Nome</th>
                      <th className="p-2 font-medium">Endereco</th>
                      <th className="p-2 font-medium">Cidade</th>
                      <th className="p-2 font-medium">UF</th>
                      <th className="p-2 font-medium">Contato</th>
                      <th className="p-2 font-medium">Status UL</th>
                      <th className="p-2 font-medium">CCTO OI</th>
                      <th className="p-2 font-medium">Designacao Nova</th>
                      <th className="p-2 font-medium">IP NAT</th>
                      <th className="p-2 font-medium">IP WAN</th>
                      <th className="p-2 font-medium">Loopback Principal</th>
                      <th className="p-2 font-medium">IP Primario</th>
                      <th className="p-2 font-medium">CCTO OEMP</th>
                      <th className="p-2 font-medium">Loopback Secundario</th>
                      <th className="p-2 font-medium">IP Secundario</th>
                      <th className="p-2 font-medium">Operadora</th>
                      <th className="p-2 font-medium">Tecnologia</th>
                      <th className="p-2 font-medium">Match</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => {
                      const canOpen = Boolean(row.source.row);
                      return (
                        <tr
                          key={`${row.query}-${idx}`}
                          className={`border-t ${canOpen ? "cursor-pointer hover:bg-muted/40" : ""}`}
                          onClick={() => {
                            if (canOpen && row.source.row) setSelectedRow(row.source.row);
                          }}
                        >
                          <td className="p-2 font-mono">{row.query}</td>
                          <td className="p-2">
                            <Badge variant={row.statusType === "ok" ? "default" : row.statusType === "missing_ip" ? "secondary" : "outline"}>
                              {row.statusText}
                            </Badge>
                          </td>
                          <td className="p-2 font-mono">{row.codUl}</td>
                          <td className="p-2">{row.nome}</td>
                          <td className="p-2">{row.endereco}</td>
                          <td className="p-2">{row.cidade}</td>
                          <td className="p-2 font-mono">{row.uf}</td>
                          <td className="p-2">{row.contato}</td>
                          <td className="p-2">{row.statusUl}</td>
                          <td className="p-2 font-mono">{row.cctoOi}</td>
                          <td className="p-2 font-mono">{row.designacaoNova}</td>
                          <td className="p-2 font-mono">{row.ipNat}</td>
                          <td className="p-2 font-mono">{row.ipWan}</td>
                          <td className="p-2 font-mono">{row.loopbackWan}</td>
                          <td className="p-2 font-mono">{row.ipPrimario || "-"}</td>
                          <td className="p-2 font-mono">{row.cctoOemp}</td>
                          <td className="p-2 font-mono">{row.loopbackLan}</td>
                          <td className="p-2 font-mono">{row.ipSecundario || "-"}</td>
                          <td className="p-2">{row.operadora}</td>
                          <td className="p-2">{row.tecnologia}</td>
                          <td className="p-2">{row.matchedBy}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedRow} onOpenChange={(open) => { if (!open) setSelectedRow(null); }}>
        <DialogContent className="max-w-6xl p-0 overflow-hidden">
          {selectedRow && (
            <>
              <div className="bg-gradient-to-r from-[#0B5EA8] to-[#0673B7] text-white px-6 py-5 border-b">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-white/80">SMARTIT - Consulta UL</p>
                    <h3 className="text-xl font-semibold mt-1">{normalizeText(selectedRow.nome_loterica) || "Lotérica"}</h3>
                    <p className="text-sm font-mono mt-1">UL: {normalizeText(selectedRow.cod_ul) || "-"}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="border-white/70 text-white bg-white/10 font-mono">
                      CCTO OI: {normalizeText(selectedRow.ccto_oi) || "-"}
                    </Badge>
                    <Badge variant="outline" className="border-white/70 text-white bg-white/10 font-mono">
                      CCTO OEMP: {normalizeText(selectedRow.ccto_oemp) || "-"}
                    </Badge>
                    <Badge variant="outline" className="border-white/70 text-white bg-white/10">
                      Status: {normalizeText(selectedRow.status) || "-"}
                    </Badge>
                    <Badge variant="outline" className="border-white/70 text-white bg-white/10">
                      Tecnologia: {selectedTecnologia}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-5 max-h-[78vh] overflow-y-auto bg-background">
                <DialogHeader>
                  <DialogTitle className="text-lg">Visão Completa da Planilha</DialogTitle>
                  <DialogDescription>
                    Informações consolidadas da UL conforme a base importada da planilha (incluindo campos adicionais).
                  </DialogDescription>
                </DialogHeader>

                {modalSections.map((section) => (
                  <section key={section.title} className="space-y-3">
                    <div>
                      <h4 className="text-sm font-semibold text-foreground">{section.title}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">{section.description}</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                      {section.items.map((field) => (
                        <FieldTile
                          key={`${section.title}-${field.label}`}
                          label={field.label}
                          value={field.value}
                          mono={field.mono}
                        />
                      ))}
                    </div>
                  </section>
                ))}

                <section className="space-y-3">
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">Campos Brutos da Planilha</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Lista completa dos campos recebidos no `raw_data` da importação.
                    </p>
                  </div>

                  <div className="rounded-xl border overflow-hidden">
                    <div className="max-h-[320px] overflow-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/60 sticky top-0">
                          <tr className="text-left">
                            <th className="p-2 font-medium">Campo da Planilha</th>
                            <th className="p-2 font-medium">Valor</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rawEntries.length === 0 ? (
                            <tr className="border-t">
                              <td colSpan={2} className="p-3 text-muted-foreground">Sem dados brutos disponíveis para esta lotérica.</td>
                            </tr>
                          ) : (
                            rawEntries.map((entry) => (
                              <tr key={entry.key} className="border-t align-top">
                                <td className="p-2 font-mono text-[11px]">{entry.key}</td>
                                <td className="p-2 break-words">{entry.value}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </section>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ConsultaMassaTab;
