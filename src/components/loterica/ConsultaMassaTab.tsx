import { useMemo, useState } from "react";
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
  cctoOi: string;
  cctoOemp: string;
  ipPrimario: string;
  ipSecundario: string;
  statusUl: string;
  matchedBy: string;
  source: TermMatch;
}

const getRawText = (raw: Record<string, unknown> | null | undefined, keys: string[]) => {
  const obj = raw && typeof raw === "object" ? raw : {};
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
    const value = normalizeText((obj as Record<string, unknown>)[key]);
    if (value) return value;
  }
  return "-";
};

const buildSmartitQuickData = (row: LotericaLookupRow) => {
  const raw = row.raw_data && typeof row.raw_data === "object" ? row.raw_data : {};

  return {
    owner: getRawText(raw, ["OWNER"]),
    responsavelBackup: getRawText(raw, ["RESP BACKUP"]),
    tfl: getRawText(raw, ["TFL", "TFLs"]),
    tipoUl: getRawText(raw, ["TIPO LOTERICA", "TIPO UL"]),
    operadora: getRawText(raw, ["OPERADORA 4G", "OPERADORA"]),
    empresaOemp: getRawText(raw, ["EMPRESA OEMP"]),
    tecnologia: getRawText(raw, ["TECNOLOGIA"]),
    perimetro: getRawText(raw, ["PERIMETRO", "PERÍMETRO", "PERIMETRO"]),
    sim4g: getRawText(raw, ["SIM CARD 4G"]),
    ipNat: getRawText(raw, ["IP NAT"]),
    ipWan: getRawText(raw, ["IP WAN"]),
    ipSwitch: getRawText(raw, ["IP SWITCH", "LOOPBACK SWITCH"]),
    endereco: getRawText(raw, ["ENDEREÇO", "ENDERECO"]),
    contato: getRawText(raw, ["CONTATO"]),
  };
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

      if (!match.row) {
        return {
          query: match.query,
          statusType: "not_found",
          statusText: "Nao encontrado",
          codUl: "-",
          nome: "-",
          cctoOi: "-",
          cctoOemp: "-",
          ipPrimario: "",
          ipSecundario: "",
          statusUl: "-",
          matchedBy: "-",
          source: match,
        };
      }

      const row = match.row;
      const ipPrimario = getLookupIp(row, "primario");
      const ipSecundario = getLookupIp(row, "secundario");
      const hasAnyIp = Boolean(ipPrimario || ipSecundario);

      return {
        query: match.query,
        statusType: hasAnyIp ? "ok" : "missing_ip",
        statusText: hasAnyIp ? "Encontrado" : "Sem IP",
        codUl: normalizeText(row.cod_ul) || "-",
        nome: normalizeText(row.nome_loterica) || "-",
        cctoOi: normalizeText(row.ccto_oi || row.designacao_nova) || "-",
        cctoOemp: normalizeText(row.ccto_oemp) || "-",
        ipPrimario,
        ipSecundario,
        statusUl: normalizeText(row.status) || "-",
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

  const smartitData = useMemo(() => {
    if (!selectedRow) return null;
    return buildSmartitQuickData(selectedRow);
  }, [selectedRow]);

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
                Clique em uma linha encontrada para abrir o detalhe estilo SMARTIT.
              </p>

              <div className="rounded-lg border overflow-auto max-h-[420px]">
                <table className="w-full text-xs">
                  <thead className="bg-muted/60 sticky top-0">
                    <tr className="text-left">
                      <th className="p-2 font-medium">Consulta</th>
                      <th className="p-2 font-medium">Status</th>
                      <th className="p-2 font-medium">Codigo UL</th>
                      <th className="p-2 font-medium">Nome</th>
                      <th className="p-2 font-medium">CCTO OI/Designacao</th>
                      <th className="p-2 font-medium">CCTO OEMP</th>
                      <th className="p-2 font-medium">IP Primario</th>
                      <th className="p-2 font-medium">IP Secundario</th>
                      <th className="p-2 font-medium">Status UL</th>
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
                          <td className="p-2 font-mono">{row.cctoOi}</td>
                          <td className="p-2 font-mono">{row.cctoOemp}</td>
                          <td className="p-2 font-mono">{row.ipPrimario || "-"}</td>
                          <td className="p-2 font-mono">{row.ipSecundario || "-"}</td>
                          <td className="p-2">{row.statusUl}</td>
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
        <DialogContent className="max-w-5xl p-0 overflow-hidden">
          {selectedRow && smartitData && (
            <>
              <div className="bg-[#0B5EA8] text-white px-5 py-4 border-b">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-white/80">SMARTIT - Consulta UL</p>
                    <h3 className="text-lg font-semibold mt-1">{normalizeText(selectedRow.nome_loterica) || "Lotérica"}</h3>
                    <p className="text-sm font-mono mt-1">{normalizeText(selectedRow.cod_ul) || "-"}</p>
                  </div>
                  <Badge variant="outline" className="border-white/60 text-white bg-white/10">
                    {normalizeText(selectedRow.status) || "-"}
                  </Badge>
                </div>
              </div>

              <div className="p-5 space-y-4 max-h-[72vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Detalhes da Lotérica</DialogTitle>
                  <DialogDescription>
                    Visualizacao rapida de dados operacionais para tratativa.
                  </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="rounded-lg border p-3 bg-muted/30">
                    <p className="text-xs text-muted-foreground">Codigo UL</p>
                    <p className="font-mono text-sm mt-1">{normalizeText(selectedRow.cod_ul) || "-"}</p>
                  </div>
                  <div className="rounded-lg border p-3 bg-muted/30">
                    <p className="text-xs text-muted-foreground">CCTO OI / Designacao</p>
                    <p className="font-mono text-sm mt-1">{normalizeText(selectedRow.ccto_oi || selectedRow.designacao_nova) || "-"}</p>
                  </div>
                  <div className="rounded-lg border p-3 bg-muted/30">
                    <p className="text-xs text-muted-foreground">CCTO OEMP</p>
                    <p className="font-mono text-sm mt-1">{normalizeText(selectedRow.ccto_oemp) || "-"}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Link Principal</p>
                    <p className="font-mono text-sm mt-1">Loopback: {getLookupIp(selectedRow, "primario") || "-"}</p>
                    <p className="text-xs mt-1">IP NAT: <span className="font-mono">{smartitData.ipNat}</span></p>
                    <p className="text-xs mt-1">IP WAN: <span className="font-mono">{smartitData.ipWan}</span></p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Link Secundario / Backup</p>
                    <p className="font-mono text-sm mt-1">Loopback: {getLookupIp(selectedRow, "secundario") || "-"}</p>
                    <p className="text-xs mt-1">Operadora: <span className="font-medium">{smartitData.operadora}</span></p>
                    <p className="text-xs mt-1">SIM 4G: <span className="font-mono">{smartitData.sim4g}</span></p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Owner</p>
                    <p className="text-sm mt-1">{smartitData.owner}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Resp. Backup</p>
                    <p className="text-sm mt-1">{smartitData.responsavelBackup}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Tipo UL / TFL</p>
                    <p className="text-sm mt-1">{smartitData.tipoUl} / {smartitData.tfl}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Tecnologia / Perimetro</p>
                    <p className="text-sm mt-1">{smartitData.tecnologia} / {smartitData.perimetro}</p>
                  </div>
                </div>

                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Endereco e Contato</p>
                  <p className="text-sm mt-1">{smartitData.endereco}</p>
                  <p className="text-sm mt-1">{smartitData.contato}</p>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ConsultaMassaTab;
