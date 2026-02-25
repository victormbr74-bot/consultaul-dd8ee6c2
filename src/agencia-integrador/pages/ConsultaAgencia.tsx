import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useData } from '@/agencia-integrador/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, AlertTriangle, Wifi, Globe, Shield, Clock } from 'lucide-react';
import { formatDataHora } from '@/agencia-integrador/utils/calculations';
import type { Agencia, Incidente } from '@/agencia-integrador/types';

type CircuitType = 'PRIVATIVO_1' | 'PRIVATIVO_2' | 'PUBLICO' | 'WI-FI CLIENTES';

const STOPWORDS = new Set([
  'da', 'de', 'do', 'das', 'dos', 'e',
  // Prefixos comuns em nomes de agencias/pontos
  'saa', 'agencia', 'ag', 'pab', 'posto',
]);

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function normalizeLoose(value: string) {
  return normalizeText(value).replace(/[^a-z0-9]+/g, ' ').trim();
}

function normalizeCompact(value: string) {
  return normalizeText(value).replace(/[^a-z0-9]/g, '');
}

function normalizeDigits(value: string) {
  return String(value || '').replace(/\D/g, '');
}

function hasLetters(value: string) {
  return /[a-z]/i.test(String(value || ''));
}

function hasDigits(value: string) {
  return /\d/.test(String(value || ''));
}

function splitTokens(value: string) {
  return normalizeLoose(value)
    .split(/\s+/)
    .filter(Boolean);
}

function getMeaningfulAgencyNameTokens(value: string) {
  return splitTokens(value).filter((token) => token.length >= 3 && !STOPWORDS.has(token));
}

function matchesAgencyName(value: string, search: string) {
  const rawValue = value || '';
  const rawSearch = search || '';
  if (!rawValue.trim() || !rawSearch.trim()) return false;

  const valueLoose = normalizeLoose(rawValue);
  const searchLoose = normalizeLoose(rawSearch);
  const valueCompact = normalizeCompact(rawValue);
  const searchCompact = normalizeCompact(rawSearch);

  if (!searchLoose) return false;

  // Full phrase match (ignoring prefixes like SAA/AG because they remain extra tokens in value)
  if (searchLoose.length >= 3 && valueLoose.includes(searchLoose)) return true;
  if (searchCompact.length >= 5 && valueCompact.includes(searchCompact)) return true;

  const searchTokens = getMeaningfulAgencyNameTokens(rawSearch);
  if (!searchTokens.length) return false;

  const valueTokens = new Set(getMeaningfulAgencyNameTokens(rawValue));

  // Multi-word search should match all meaningful tokens to avoid random results.
  if (searchTokens.length > 1) {
    return searchTokens.every((token) => valueTokens.has(token));
  }

  const single = searchTokens[0];
  return valueTokens.has(single);
}

function buildAgencyMatcher(search: string) {
  const tokens = splitTokens(search);
  const meaningfulTokens = tokens.filter((t) => t.length > 2 && !STOPWORDS.has(t));
  const first = meaningfulTokens[0] || tokens[0] || '';
  const last = meaningfulTokens[meaningfulTokens.length - 1] || tokens[tokens.length - 1] || '';

  const directPatterns = new Set<string>();
  const compactPatterns = new Set<string>();
  const initials = new Set<string>();
  const tokenSet = new Set<string>();

  const addPattern = (value?: string | null) => {
    if (!value) return;
    const loose = normalizeLoose(value);
    const compact = normalizeCompact(value);
    if (loose) directPatterns.add(loose);
    if (compact) compactPatterns.add(compact);
  };

  addPattern(search);

  if (first && last) {
    addPattern(`${first} ${last}`);
    addPattern(`${first}.${last}`);
    addPattern(`${first}${last}`);
    if (first[0] && last[0]) initials.add(`${first[0]}${last[0]}`);
  }

  for (const token of meaningfulTokens) {
    tokenSet.add(token);
    addPattern(token);
  }

  const combinedInitials = meaningfulTokens.map((t) => t[0]).join('');
  if (combinedInitials) initials.add(combinedInitials);

  return {
    directPatterns: Array.from(directPatterns),
    compactPatterns: Array.from(compactPatterns),
    initials: Array.from(initials).filter(Boolean),
    tokens: Array.from(tokenSet),
    hasData: Boolean(search.trim()),
  };
}

function matchesFlexibleText(
  value: string,
  matcher: ReturnType<typeof buildAgencyMatcher>,
  options?: { requireAllTokens?: boolean },
) {
  if (!matcher.hasData) return false;
  const raw = value || '';
  if (!raw.trim()) return false;

  const loose = normalizeLoose(raw);
  const compact = normalizeCompact(raw);
  const tokens = splitTokens(raw);
  const tokenSet = new Set(tokens);
  const textInitials = tokens.filter((t) => t && !STOPWORDS.has(t)).map((t) => t[0]).join('');

  if (matcher.directPatterns.some((p) => p && (p === loose || (p.length >= 3 && loose.includes(p))))) return true;
  if (matcher.compactPatterns.some((p) => p && (p === compact || (p.length >= 3 && compact.includes(p))))) return true;
  if (matcher.initials.some((i) => i && (textInitials === i || compact === i || compact.includes(i)))) return true;

  const tokensToMatch = matcher.tokens.filter((token) => token && token.length >= 3);
  if (!tokensToMatch.length) return false;

  const tokenMatches = (token: string) => tokenSet.has(token) || loose.includes(token);

  if (options?.requireAllTokens && tokensToMatch.length > 1) {
    return tokensToMatch.every(tokenMatches);
  }

  return tokensToMatch.some(tokenMatches);
}

const CIRCUIT_LABELS: Record<string, { label: string; icon: typeof Shield }> = {
  'PRIVATIVO_1': { label: 'CIRCUITO PRIVATIVO 1', icon: Shield },
  'PRIVATIVO_2': { label: 'CIRCUITO PRIVATIVO 2', icon: Shield },
  'PUBLICO': { label: 'CIRCUITO PÚBLICO', icon: Globe },
  'WI-FI CLIENTES': { label: 'CIRCUITO WIFI', icon: Wifi },
};

function getStatusColor(visao: string): string {
  const v = visao.toLowerCase();
  if (v.includes('cancelado')) return 'text-destructive';
  if (v.includes('ativo') && v.includes('homologado')) return 'text-success';
  if (v.includes('ativo')) return 'text-success';
  if (v.includes('homologação') || v.includes('homologacao')) return 'text-warning';
  if (v.includes('wifi ativado')) return 'text-success';
  return 'text-muted-foreground';
}

function StatusBadge({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  const color = getStatusColor(value);
  return (
    <div>
      <p className="text-[10px] text-muted-foreground mb-0.5">{label}</p>
      <span className={`text-xs flex items-center gap-1 ${color}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${color === 'text-success' ? 'bg-success' : color === 'text-warning' ? 'bg-warning' : color === 'text-destructive' ? 'bg-destructive' : 'bg-muted-foreground'}`} />
        {value}
      </span>
    </div>
  );
}

export default function ConsultaAgencia() {
  const { agencias, incidentes } = useData();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const searchValue = useMemo(() => deferredSearch.trim(), [deferredSearch]);
  const agencyMatcher = useMemo(() => buildAgencyMatcher(searchValue), [searchValue]);
  const searchCompact = useMemo(() => normalizeCompact(searchValue), [searchValue]);
  const searchLoose = useMemo(() => normalizeLoose(searchValue), [searchValue]);
  const searchDigits = useMemo(() => normalizeDigits(searchValue), [searchValue]);
  const searchHasLetters = useMemo(() => hasLetters(searchValue), [searchValue]);
  const searchHasDigits = useMemo(() => hasDigits(searchValue), [searchValue]);
  const isNumericOnlySearch = searchHasDigits && !searchHasLetters;
  const looksPointCodeSearch = useMemo(
    () => searchHasLetters && searchHasDigits && !/\s/.test(searchValue) && searchCompact.length >= 4,
    [searchCompact.length, searchHasDigits, searchHasLetters, searchValue],
  );
  const looksCircuitSearch = useMemo(
    () => /[/-]/.test(searchValue) || (searchHasLetters && searchHasDigits && searchValue.length >= 6),
    [searchHasDigits, searchHasLetters, searchValue],
  );

  useEffect(() => {
    const query = searchParams.get('search') ?? '';
    setSearch(query);
  }, [searchParams]);

  const handleSearch = () => {
    setSearch((prev) => prev.trim());
  };

  // Group agencias by nomeLogicoPonto
  const agenciasGroup = useMemo(() => {
    if (!searchValue) return null;
    const matched = agencias.filter((a) => {
      const nameMatch = searchHasLetters ? matchesAgencyName(a.nomePonto, searchValue) : false;
      const pointCodeMatch = looksPointCodeSearch ? matchesFlexibleText(a.nomeLogicoPonto, agencyMatcher) : false;

      const agencyNumberValue = a.cgcUnidade || a.unidade || '';
      const agencyNumberDigits = normalizeDigits(agencyNumberValue);
      const agencyNumberMatch = isNumericOnlySearch
        ? (searchDigits.length >= 3 &&
            (agencyNumberDigits === searchDigits || agencyNumberDigits.startsWith(searchDigits)))
        : false;

      const circuitMatch = looksCircuitSearch
        ? ((searchLoose.length >= 3 && normalizeLoose(a.designacaoCircuito).includes(searchLoose)) ||
            (searchCompact.length >= 3 && normalizeCompact(a.designacaoCircuito).includes(searchCompact)))
        : false;

      return nameMatch || pointCodeMatch || agencyNumberMatch || circuitMatch;
    });
    if (matched.length === 0) return null;

    // Group by nomeLogicoPonto
    const groups = new Map<string, Agencia[]>();
    matched.forEach(a => {
      const key = a.nomeLogicoPonto;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(a);
    });
    return groups;
  }, [
    agencias,
    agencyMatcher,
    isNumericOnlySearch,
    looksCircuitSearch,
    looksPointCodeSearch,
    searchCompact,
    searchDigits,
    searchHasLetters,
    searchLoose,
    searchValue,
  ]);

  // Find alarms matching this point (column E = pontoCodigo matches nomeLogicoPonto)
  const alarmsForPoint = useMemo(() => {
    if (!agenciasGroup) return new Map<string, Incidente[]>();
    const pointCodes = [...agenciasGroup.keys()];
    const result = new Map<string, Incidente[]>();
    pointCodes.forEach(code => {
      const matching = incidentes.filter(inc =>
        inc.pontoCodigo.toLowerCase() === code.toLowerCase() &&
        inc.status !== 'ENCERRADO' && inc.status !== 'NORMALIZADO'
      );
      result.set(code, matching);
    });
    return result;
  }, [agenciasGroup, incidentes]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Consulta de Agência</h1>

      {/* Search */}
      <div className="flex gap-3">
        <Input
          placeholder="Buscar por codigo do ponto, nome ou numero da agencia"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          className="bg-secondary border-border font-mono"
        />
        <Button onClick={handleSearch}>
          <Search className="h-4 w-4 mr-2" /> Buscar
        </Button>
      </div>

      {searchValue && !agenciasGroup && (
        <Card className="border-border">
          <CardContent className="p-8 text-center text-muted-foreground">
            Nenhuma agência encontrada para "{searchValue}"
          </CardContent>
        </Card>
      )}

      {agenciasGroup && [...agenciasGroup.entries()].map(([pointCode, circuits]) => {
        const first = circuits[0];
        const alarms = alarmsForPoint.get(pointCode) || [];
        const totalAlarms = alarms.length;
        const provedores = [...new Set(circuits.map(c => c.provedorFinal).filter(Boolean))];
        const mesmoProvedor = provedores.length <= 1;

        // Quality counts from alarms
        const qualityCounts = {
          todos: totalAlarms,
          indisponibilidade: alarms.filter(a => a.descricaoInicial?.toLowerCase().includes('indisponibilidade')).length,
          oscilacao: alarms.filter(a => a.descricaoInicial?.toLowerCase().includes('oscil') || a.descricaoInicial?.toLowerCase().includes('intermit')).length,
          falhaQualidade: alarms.filter(a => a.descricaoInicial?.toLowerCase().includes('qualidade')).length,
        };

        // Find circuit by rede type
        const privativo1 = circuits.find(c => c.nomeRede?.toUpperCase().includes('PRIVATIVO_1') || c.nomeRede?.toUpperCase() === 'PRIVATIVO 1');
        const privativo2 = circuits.find(c => c.nomeRede?.toUpperCase().includes('PRIVATIVO_2') || c.nomeRede?.toUpperCase() === 'PRIVATIVO 2');
        const publico = circuits.find(c => c.nomeRede?.toUpperCase().includes('PUBLICO') || c.nomeRede?.toUpperCase() === 'PÚBLICO');
        const wifi = circuits.find(c => c.nomeRede?.toUpperCase().includes('WI-FI') || c.nomeRede?.toUpperCase().includes('WIFI'));

        const circuitCards: { key: string; circuit: Agencia | undefined; alarm?: Incidente }[] = [
          { key: 'PRIVATIVO_1', circuit: privativo1 },
          { key: 'PRIVATIVO_2', circuit: privativo2 },
          { key: 'PUBLICO', circuit: publico },
          { key: 'WI-FI CLIENTES', circuit: wifi },
        ];

        // Map alarms to circuits by designacao
        circuitCards.forEach(cc => {
          if (cc.circuit) {
            cc.alarm = alarms.find(a =>
              a.circuito && cc.circuit!.designacaoCircuito &&
              a.circuito.toLowerCase() === cc.circuit!.designacaoCircuito.toLowerCase()
            );
          }
        });

        return (
          <Card key={pointCode} className="border-border overflow-hidden">
            <CardContent className="p-6 space-y-5">
              {/* Header */}
              <div>
                <h2 className="text-xl font-bold">
                  {first.nomePonto} - <span className="text-primary">{pointCode}</span>
                </h2>
                <p className="text-xs text-primary font-mono mt-1">{pointCode}</p>
              </div>

              {/* Badges */}
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="border-border">UF: {first.uf}</Badge>
                <Badge
                  variant="outline"
                  className={mesmoProvedor ? 'border-success/40 text-success bg-success/10' : 'border-warning/40 text-warning bg-warning/10'}
                >
                  Mesmo Provedor: {mesmoProvedor ? 'Sim' : 'Não'}
                </Badge>
                {totalAlarms > 0 && (
                  <Badge variant="outline" className="border-destructive/40 text-destructive bg-destructive/10">
                    {totalAlarms} alarme(s) ativo(s)
                  </Badge>
                )}
              </div>

              {/* Status Privativo */}
              <div className="grid grid-cols-2 gap-4">
                <StatusBadge label="Status Privativo 1" value={privativo1?.visaoFelix || ''} />
                <StatusBadge label="Status Privativo 2" value={privativo2?.visaoFelix || ''} />
              </div>

              {/* Quality of Link */}
              <div>
                <p className="text-xs text-muted-foreground mb-2">Qualidade do Link</p>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'Todos', count: qualityCounts.todos, active: true },
                    { label: 'Indisponibilidade Total', count: qualityCounts.indisponibilidade, active: false },
                    { label: 'Oscilação/Intermitência', count: qualityCounts.oscilacao, active: false },
                    { label: 'Falha de Qualidade', count: qualityCounts.falhaQualidade, active: false },
                  ].map(q => (
                    <Card
                      key={q.label}
                      className={`border-border p-3 ${q.active && q.count > 0 ? 'bg-primary/10 border-primary/30' : ''}`}
                    >
                      <p className="text-xs text-muted-foreground">{q.label}</p>
                      <p className="text-lg font-bold">{q.count}</p>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Circuit Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {circuitCards.map(({ key, circuit, alarm }) => {
                  if (!circuit) return null;
                  const cfg = CIRCUIT_LABELS[key] || { label: key, icon: Shield };
                  const Icon = cfg.icon;
                  return (
                    <Card key={key} className="border-border">
                      <CardContent className="p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                            <span className="text-xs font-semibold uppercase text-muted-foreground">{cfg.label}</span>
                          </div>
                          {alarm && (
                            <Badge variant="outline" className="border-destructive/40 text-destructive bg-destructive/10 text-[10px]">
                              <AlertTriangle className="h-3 w-3 mr-1" /> ALARME {alarm.tempoTotal || ''}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm font-mono text-primary">{circuit.designacaoCircuito || '—'}</p>
                        <p className="text-xs text-muted-foreground">
                          Operadora: <span className="text-foreground font-medium">{circuit.provedorFinal || '—'}</span>
                        </p>
                        <StatusBadge label="" value={circuit.visaoFelix} />
                        <div className="text-[10px] text-muted-foreground space-y-0.5 pt-1 border-t border-border mt-2">
                          <p>Velocidade: {circuit.velocidade} | Tipo: {circuit.tipoAtendimento || circuit.tipoPonto}</p>
                          <p>IP LAN: {circuit.ipLan || '—'} | IP WAN: {circuit.ipWan || '—'}</p>
                          {circuit.cpe1 && <p>CPE1: {circuit.cpe1}</p>}
                          {circuit.eddCpe2 && <p>EDD/CPE2: {circuit.eddCpe2} | IP WAN: {circuit.ipWanEddCpe2 || '—'}</p>}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Active Alarms */}
              {alarms.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="h-4 w-4 text-warning" />
                    <span className="text-sm font-semibold text-warning">Alarmes Ativos</span>
                  </div>
                  <div className="space-y-2">
                    {alarms.map(alarm => (
                      <Card key={alarm.id} className="border-warning/20 bg-warning/5">
                        <CardContent className="p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-mono text-primary">{alarm.circuito}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">{alarm.rede}</span>
                              <div className="flex items-center gap-1 text-xs text-warning">
                                <Clock className="h-3 w-3" />
                                {alarm.tempoTotal || '—'}
                              </div>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-[10px] border-destructive/30 text-destructive bg-destructive/10">
                            {alarm.descricaoInicial || alarm.descricaoFalha}
                          </Badge>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 text-[11px] pt-2 border-t border-border">
                            <div>
                              <span className="text-muted-foreground">Chamado OI: </span>
                              <span className="font-mono">{alarm.chamado}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">No REQ: </span>
                              <span className="font-mono">{alarm.req}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Status: </span>
                              <span className="font-semibold">{alarm.status}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">UF: </span>
                              <span>{alarm.uf}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Abertura: </span>
                              <span>{formatDataHora(alarm.dataHoraAbertura)}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Atualização: </span>
                              <span>{formatDataHora(alarm.dataHoraAtualizacao)}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Desc. Inicial: </span>
                              <span>{alarm.descricaoInicial}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Tempo Total: </span>
                              <span className="text-warning font-semibold">{alarm.tempoTotal}</span>
                            </div>
                            {alarm.ultimoComentario && (
                              <div className="col-span-2 md:col-span-4">
                                <span className="text-muted-foreground">Ultimo Comentario: </span>
                                <span>{alarm.ultimoComentario}</span>
                              </div>
                            )}
                            {alarm.periodoUltimaAtualizacao && (
                              <div className="col-span-2 md:col-span-4">
                                <span className="text-muted-foreground">Período Última Atualização: </span>
                                <span>{alarm.periodoUltimaAtualizacao}</span>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Address */}
              <div className="text-xs text-muted-foreground border-t border-border pt-3">
                <p>{first.logradouro} {first.endereco}, {first.numero} {first.complemento} - {first.bairro}</p>
                <p>{first.cidade}/{first.uf} - CEP: {first.cep} - CGC: {first.cgcUnidade}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

