import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ExternalLink, RefreshCw, Search } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { formatMacDisplay, isViableMacSearchTerm, normalizeMacSearchTerm } from "@/lib/lotericaMac";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface MacVendorLookupResult {
  found: boolean;
  status: number;
  mac: string;
  normalized_mac: string;
  formatted_mac: string;
  vendor: string | null;
  message: string;
  source: string;
  lookup_url: string;
}

const SOURCE_WEBSITE_URL = "https://macvendors.com/";

export default function ConsultaMac() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = String(searchParams.get("q") || "").trim();

  const [search, setSearch] = useState(initialQuery);
  const [submittedSearch, setSubmittedSearch] = useState(initialQuery);
  const [result, setResult] = useState<MacVendorLookupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const normalizedSearch = useMemo(() => normalizeMacSearchTerm(submittedSearch), [submittedSearch]);
  const searchTooShort = submittedSearch.length > 0 && !isViableMacSearchTerm(submittedSearch);

  const runLookup = useCallback(async (term: string) => {
    const trimmed = term.trim();

    if (!trimmed) {
      setResult(null);
      setErrorMessage(null);
      setLoading(false);
      return;
    }

    if (!isViableMacSearchTerm(trimmed)) {
      setResult(null);
      setErrorMessage(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    const { data, error } = await supabase.functions.invoke("mac-vendor-lookup", {
      body: { mac: trimmed },
    });

    if (error) {
      console.error("Erro ao consultar MAC Vendors", error);
      setResult(null);
      setErrorMessage("Erro ao consultar o servico web de MAC Address.");
      setLoading(false);
      return;
    }

    setResult((data || null) as MacVendorLookupResult | null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void runLookup(submittedSearch);
  }, [runLookup, submittedSearch]);

  const handleSubmit = (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const nextQuery = search.trim();
    setSearchParams(nextQuery ? { q: nextQuery } : {});

    if (nextQuery !== submittedSearch) {
      setSubmittedSearch(nextQuery);
      return;
    }

    void runLookup(nextQuery);
  };

  return (
    <div className="bg-background">
      <main className="container max-w-6xl px-4 py-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <Card className="overflow-hidden border-primary/15 bg-gradient-to-br from-background via-background to-muted/40">
            <CardHeader className="space-y-4 pb-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-primary/30 text-primary">
                  Consulta web
                </Badge>
                <Badge variant="outline">Fonte externa</Badge>
              </div>
              <div className="space-y-2">
                <CardTitle className="text-3xl sm:text-4xl">Consulta MAC Address</CardTitle>
                <CardDescription className="max-w-2xl text-sm sm:text-base">
                  Busca o fabricante do MAC Address diretamente na web, usando a base do MAC Vendors.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="AA:BB:CC:DD:EE:FF"
                    className="h-14 border-primary/15 bg-background pl-12 font-mono text-base sm:text-lg"
                  />
                </div>
                <Button type="submit" className="h-14 px-8">
                  Consultar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-14 w-14"
                  onClick={() => void runLookup(submittedSearch)}
                  title="Atualizar resultado"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                </Button>
              </form>
              <p className="text-xs text-muted-foreground">
                Aceita formatos com `:` `-` `.` ou sem separador. A consulta usa a web, não a base interna.
              </p>
            </CardContent>
          </Card>

          {!!errorMessage && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {errorMessage}
            </div>
          )}

          {submittedSearch ? searchTooShort ? (
            <Card>
              <CardContent className="pt-6 text-sm text-muted-foreground">
                Informe ao menos 6 caracteres hexadecimais do MAC para pesquisar.
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="outline" className="font-mono">
                {formatMacDisplay(normalizedSearch) || submittedSearch}
              </Badge>
              <span>Fonte: MAC Vendors</span>
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6 text-sm text-muted-foreground">
                Consulta dedicada no estilo de buscador de MAC, usando dados externos da web.
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Resultado</CardTitle>
              <CardDescription>
                O retorno abaixo vem do servico web do MAC Vendors para o MAC informado.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!submittedSearch ? (
                <p className="text-sm text-muted-foreground">Nenhuma consulta realizada.</p>
              ) : searchTooShort ? (
                <p className="text-sm text-muted-foreground">Aguardando um MAC valido para consultar.</p>
              ) : loading ? (
                <p className="text-sm text-muted-foreground">Consultando...</p>
              ) : !result ? (
                <p className="text-sm text-muted-foreground">Sem resposta do servico.</p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">MAC</p>
                    <p className="mt-2 font-mono text-lg">{result.formatted_mac || formatMacDisplay(result.normalized_mac) || "-"}</p>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Fabricante</p>
                    <p className="mt-2 text-lg font-semibold">{result.vendor || "-"}</p>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-4 sm:col-span-2">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
                    <p className="mt-2 text-sm">{result.message}</p>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Origem</p>
                    <p className="mt-2 text-sm">MAC Vendors</p>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Consulta externa</p>
                    <a
                      href={result.lookup_url || SOURCE_WEBSITE_URL}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                    >
                      Abrir fonte
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
