import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";
import {
  buildLookupDisplay,
  dedupeTerms,
  fetchLookupRows,
  getLookupIp,
  parseTerms,
  resolveMatches,
  normalizeText,
  type TermMatch,
} from "@/components/loterica/lotericaLookup";

const ConsultaMassaTab = () => {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [matches, setMatches] = useState<TermMatch[]>([]);

  const rows = useMemo(() => {
    return matches.map((match) => {
      const primary = buildLookupDisplay(match, "primario");
      const secondary = buildLookupDisplay(match, "secundario");

      if (!match.row) {
        return {
          query: match.query,
          statusType: "not_found" as const,
          statusText: "Nao encontrado",
          codUl: "-",
          nome: "-",
          cctoOi: "-",
          cctoOemp: "-",
          ipPrimario: "",
          ipSecundario: "",
          statusUl: "-",
          matchedBy: "-",
        };
      }

      const row = match.row;
      const ipPrimario = getLookupIp(row, "primario");
      const ipSecundario = getLookupIp(row, "secundario");
      const hasAnyIp = Boolean(ipPrimario || ipSecundario);

      return {
        query: match.query,
        statusType: hasAnyIp ? "ok" as const : "missing_ip" as const,
        statusText: hasAnyIp ? "Encontrado" : "Sem IP",
        codUl: normalizeText(row.cod_ul) || "-",
        nome: normalizeText(row.nome_loterica) || "-",
        cctoOi: normalizeText(row.ccto_oi || row.designacao_nova) || "-",
        cctoOemp: normalizeText(row.ccto_oemp) || "-",
        ipPrimario,
        ipSecundario,
        statusUl: normalizeText(row.status) || "-",
        matchedBy: primary.matchedBy !== "-" ? primary.matchedBy : secondary.matchedBy,
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
                    {rows.map((row, idx) => (
                      <tr key={`${row.query}-${idx}`} className="border-t">
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
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ConsultaMassaTab;
