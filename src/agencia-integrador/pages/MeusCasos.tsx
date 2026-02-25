import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useData } from '@/agencia-integrador/contexts/DataContext';
import { useAuth } from '@/agencia-integrador/contexts/AuthContext';
import { useTimeUpdate } from '@/agencia-integrador/hooks/useTimeUpdate';
import { calcHorasDesde, formatDataHora, formatHoras } from '@/agencia-integrador/utils/calculations';
import IncidentDetail from '@/agencia-integrador/components/IncidentDetail';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Incidente, MeuCaso } from '@/agencia-integrador/types';

const statusCasoColor: Record<string, string> = {
  Acompanhando: 'bg-info/20 text-info border-info/30',
  Atualizado: 'bg-warning/20 text-warning border-warning/30',
  Encerrado: 'bg-success/20 text-success border-success/30',
};

const STOPWORDS = new Set(['da', 'de', 'do', 'das', 'dos', 'e']);

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

function splitTokens(value: string) {
  return normalizeLoose(value)
    .split(/\s+/)
    .filter(Boolean);
}

function buildUserNameMatcher(input: {
  fullName?: string | null;
  username?: string | null;
  employeeId?: string | null;
  email?: string | null;
}) {
  const fullName = input.fullName ?? '';
  const username = input.username ?? '';
  const employeeId = input.employeeId ?? '';
  const email = input.email ?? '';
  const emailPrefix = email.includes('@') ? email.split('@')[0] : email;

  const fullTokens = splitTokens(fullName);
  const meaningfulTokens = fullTokens.filter((t) => t.length > 2 && !STOPWORDS.has(t));
  const first = meaningfulTokens[0] || fullTokens[0] || '';
  const last = meaningfulTokens[meaningfulTokens.length - 1] || fullTokens[fullTokens.length - 1] || '';

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

  addPattern(fullName);
  addPattern(username);
  addPattern(emailPrefix);
  addPattern(employeeId);

  if (first && last) {
    addPattern(`${first} ${last}`);
    addPattern(`${first}.${last}`);
    addPattern(`${first}${last}`);
    initials.add(`${first[0] ?? ''}${last[0] ?? ''}`);
  }

  for (const token of meaningfulTokens) {
    tokenSet.add(token);
    addPattern(token);
  }

  const fullInitials = meaningfulTokens.map((t) => t[0]).join('');
  if (fullInitials) initials.add(fullInitials);
  if (username) {
    const usernameTokens = splitTokens(username.replace(/[._-]/g, ' ')).filter((t) => t.length > 1);
    const usernameInitials = usernameTokens.map((t) => t[0]).join('');
    if (usernameInitials) initials.add(usernameInitials);
    for (const token of usernameTokens) {
      if (token.length > 2) tokenSet.add(token);
      addPattern(token);
    }
  }

  return {
    directPatterns: Array.from(directPatterns),
    compactPatterns: Array.from(compactPatterns),
    initials: Array.from(initials).filter(Boolean),
    tokens: Array.from(tokenSet),
    hasData: Boolean(fullName || username || employeeId || email),
  };
}

function matchesPortalResponsavel(responsavelPortal: string, matcher: ReturnType<typeof buildUserNameMatcher>) {
  if (!matcher.hasData) return false;
  const raw = responsavelPortal || '';
  if (!raw.trim()) return false;

  const loose = normalizeLoose(raw);
  const compact = normalizeCompact(raw);
  const tokens = splitTokens(raw);
  const tokenSet = new Set(tokens);
  const respInitials = tokens.filter((t) => t && !STOPWORDS.has(t)).map((t) => t[0]).join('');

  if (matcher.directPatterns.some((p) => p && (p === loose || (p.length >= 3 && loose.includes(p))))) return true;
  if (matcher.compactPatterns.some((p) => p && (p === compact || (p.length >= 3 && compact.includes(p))))) return true;
  if (matcher.initials.some((i) => i && (respInitials === i || compact === i || compact.includes(i)))) return true;

  for (const token of matcher.tokens) {
    if (!token || token.length < 3) continue;
    if (tokenSet.has(token) || loose.includes(token)) return true;
  }

  return false;
}

function isIncidenteEncerrado(status: Incidente['status']) {
  return status === 'ENCERRADO' || status === 'NORMALIZADO';
}

type CasoView = {
  incidente: Incidente;
  meta: MeuCaso | null;
  statusCaso: MeuCaso['statusCaso'];
  notas: string[];
};

export default function MeusCasos() {
  const { profile, user } = useAuth();
  const { meusCasos, createMeuCaso, addNotaMeuCaso, updateMeuCasoStatus, incidentes } = useData();
  const now = useTimeUpdate(30000);
  const [selectedInc, setSelectedInc] = useState<Incidente | null>(null);
  const [nota, setNota] = useState('');
  const [addNotaChamado, setAddNotaChamado] = useState<string | null>(null);
  const [comentariosAbertos, setComentariosAbertos] = useState<Record<string, boolean>>({});

  const matcher = useMemo(
    () =>
      buildUserNameMatcher({
        fullName: profile?.full_name,
        username: profile?.username,
        employeeId: profile?.employee_id,
        email: user?.email ?? null,
      }),
    [profile?.employee_id, profile?.full_name, profile?.username, user?.email],
  );

  const meusCasosMap = useMemo(() => {
    const map = new Map<string, MeuCaso>();
    for (const caso of meusCasos) {
      map.set(normalizeCompact(caso.incidenteChamado), caso);
    }
    return map;
  }, [meusCasos]);

  const casosDoPortal = useMemo<CasoView[]>(() => {
    return incidentes
      .filter((inc) => matchesPortalResponsavel(inc.responsavelPortal, matcher))
      .map((inc) => {
        const meta = meusCasosMap.get(normalizeCompact(inc.chamado)) || null;
        const fallbackStatus: MeuCaso['statusCaso'] = isIncidenteEncerrado(inc.status) ? 'Encerrado' : 'Acompanhando';
        return {
          incidente: inc,
          meta,
          statusCaso: meta?.statusCaso ?? fallbackStatus,
          notas: meta?.notas ?? [],
        };
      });
  }, [incidentes, matcher, meusCasosMap]);

  const usuarioCasoNome = useMemo(() => {
    return (
      profile?.full_name ||
      profile?.username ||
      profile?.employee_id ||
      user?.email?.split('@')[0] ||
      user?.email ||
      'usuario'
    );
  }, [profile?.employee_id, profile?.full_name, profile?.username, user?.email]);

  const ensureMeuCaso = async (incidente: Incidente): Promise<MeuCaso> => {
    const existing = meusCasosMap.get(normalizeCompact(incidente.chamado));
    if (existing) return existing;

    const created = await createMeuCaso({
      id: crypto.randomUUID(),
      incidenteId: incidente.id,
      incidenteChamado: incidente.chamado,
      usuario: usuarioCasoNome,
      statusCaso: isIncidenteEncerrado(incidente.status) ? 'Encerrado' : 'Acompanhando',
      notas: [],
      criadoEm: new Date(),
    });
    return created;
  };

  const addNota = async (incidente: Incidente) => {
    if (!nota.trim()) return;
    try {
      const caso = await ensureMeuCaso(incidente);
      await addNotaMeuCaso(caso.id, nota.trim());
      setNota('');
      setAddNotaChamado(null);
      toast.success('Nota adicionada');
    } catch (error) {
      toast.error(`Erro ao adicionar nota: ${String(error)}`);
    }
  };

  const updateStatus = async (incidente: Incidente, status: 'Atualizado' | 'Encerrado') => {
    try {
      const caso = await ensureMeuCaso(incidente);
      await updateMeuCasoStatus(caso.id, status);
      toast.success(`Caso marcado como ${status}`);
    } catch (error) {
      toast.error(`Erro ao atualizar caso: ${String(error)}`);
    }
  };

  const toggleComentario = (chamado: string) => {
    setComentariosAbertos((prev) => ({ ...prev, [chamado]: !prev[chamado] }));
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Meus Casos</h1>
      <p className="text-sm text-muted-foreground">
        {casosDoPortal.length} chamado(s) encontrados para seu usuario
      </p>

      <div className="space-y-4">
        {casosDoPortal.map(({ incidente: inc, meta, statusCaso, notas }) => {
          const hrsA = calcHorasDesde(inc.dataHoraAbertura, now);
          const notaEditorKey = addNotaChamado === inc.chamado;
          const canChangeStatus = !!inc.chamado;
          const comentarioAberto = !!comentariosAbertos[inc.chamado];
          const tipoFalha = inc.descricaoInicial || inc.descricaoFalha || '-';

          return (
            <Card key={inc.id} className="border-border">
              <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
                <div className="flex items-center gap-3">
                  <CardTitle
                    className="text-sm font-mono text-primary cursor-pointer hover:underline"
                    onClick={() => setSelectedInc(inc)}
                  >
                    {inc.chamado}
                  </CardTitle>
                  <Badge variant="outline" className={statusCasoColor[statusCaso]}>
                    {statusCaso}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {inc.circuito} · {inc.uf} · {formatHoras(hrsA)}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!canChangeStatus}
                    onClick={() => void updateStatus(inc, 'Atualizado')}
                  >
                    Atualizar
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!canChangeStatus}
                    onClick={() => void updateStatus(inc, 'Encerrado')}
                  >
                    Encerrar
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-3 space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <p><span className="text-muted-foreground">Chamado OI: </span><span className="font-mono">{inc.chamado || '-'}</span></p>
                  <p><span className="text-muted-foreground">REQ: </span><span className="font-mono">{inc.req || '-'}</span></p>
                  <p><span className="text-muted-foreground">Status Portal: </span>{inc.status || '-'}</p>
                  <p><span className="text-muted-foreground">Tempo Falha: </span>{inc.tempoTotal || '-'}</p>
                  <p><span className="text-muted-foreground">Agencia: </span>{inc.agenciaNome || '-'}</p>
                  <p><span className="text-muted-foreground">Ponto: </span><span className="font-mono">{inc.pontoCodigo || '-'}</span></p>
                  <p><span className="text-muted-foreground">Abertura: </span>{formatDataHora(inc.dataHoraAbertura)}</p>
                  <p><span className="text-muted-foreground">Ult. atualizacao: </span>{formatDataHora(inc.dataHoraAtualizacao)}</p>
                </div>
                <p className="text-xs text-muted-foreground">{tipoFalha}</p>
                <p className="text-xs bg-secondary/70 px-2 py-1 rounded">
                  <span className="text-muted-foreground">Responsavel: </span>
                  {inc.responsavelPortal || '-'}
                </p>
                {inc.ultimoComentario && (
                  <div className="bg-secondary/70 px-2 py-1 rounded space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">Ultimo comentario</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-[11px]"
                        onClick={() => toggleComentario(inc.chamado)}
                      >
                        {comentarioAberto ? 'Ocultar' : 'Clique para ler'}
                      </Button>
                    </div>
                    {comentarioAberto && (
                      <p className="text-xs whitespace-pre-wrap break-words">{inc.ultimoComentario}</p>
                    )}
                  </div>
                )}
                {notas.length > 0 && (
                  <div className="space-y-1">
                    {notas.map((n, i) => (
                      <p key={`${inc.id}-nota-${i}`} className="text-xs bg-secondary px-2 py-1 rounded">
                        📝 {n}
                      </p>
                    ))}
                  </div>
                )}
                {notaEditorKey ? (
                  <div className="flex gap-2">
                    <Input
                      placeholder="Nova nota..."
                      value={nota}
                      onChange={(e) => setNota(e.target.value)}
                      className="text-xs h-8 bg-secondary"
                    />
                    <Button size="sm" onClick={() => void addNota(inc)}>
                      Salvar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setAddNotaChamado(null)}>
                      Cancelar
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" variant="ghost" className="text-xs" onClick={() => setAddNotaChamado(inc.chamado)}>
                    + Nota
                  </Button>
                )}
                {!meta && (
                  <p className="text-[11px] text-muted-foreground">
                    Status/notas serao salvos ao primeiro update/nota deste chamado.
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}

        {casosDoPortal.length === 0 && (
          <Card className="border-border">
            <CardContent className="p-6 text-sm text-muted-foreground">
              Nenhum chamado encontrado com referencia ao seu nome (completo, iniciais, nome.sobrenome ou partes do nome).
            </CardContent>
          </Card>
        )}
      </div>

      <IncidentDetail incidente={selectedInc} onClose={() => setSelectedInc(null)} />
    </div>
  );
}
