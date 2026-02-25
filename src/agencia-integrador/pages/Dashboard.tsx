import { useState, useMemo, type ComponentType } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '@/agencia-integrador/contexts/DataContext';
import { useTimeUpdate } from '@/agencia-integrador/hooks/useTimeUpdate';
import { calcHorasDesde, formatHoras, formatDataHora } from '@/agencia-integrador/utils/calculations';
import IncidentDetail from '@/agencia-integrador/components/IncidentDetail';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, Clock, Pause, Layers, Activity, CheckCircle } from 'lucide-react';
import type { Incidente } from '@/agencia-integrador/types';

const statusColor: Record<string, string> = {
  'EM ANDAMENTO': 'bg-warning/20 text-warning border-warning/30',
  'EM ABERTURA': 'bg-warning/20 text-warning border-warning/30',
  'TRIAGEM MANUAL': 'bg-info/20 text-info border-info/30',
  'TRIAGEM': 'bg-info/20 text-info border-info/30',
  'INTEGRAR': 'bg-info/20 text-info border-info/30',
  'FALHA INTEGRAÇÃO': 'bg-destructive/20 text-destructive border-destructive/30',
  'PENDENTE PARCEIRA': 'bg-destructive/20 text-destructive border-destructive/30',
  'PENDENTE CLIENTE': 'bg-destructive/20 text-destructive border-destructive/30',
  'PENDENTE AGENDAMENTO': 'bg-destructive/20 text-destructive border-destructive/30',
  'PENDENTE MONITORAÇÃO': 'bg-destructive/20 text-destructive border-destructive/30',
  'PENDENTE SEM CONTATO': 'bg-destructive/20 text-destructive border-destructive/30',
  'ENCERRADO': 'bg-muted text-muted-foreground border-border',
  'NORMALIZADO': 'bg-success/20 text-success border-success/30',
};

const normalizeLookup = (v: string) =>
  v
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

const isIncidenteAberto = (inc: Incidente) => inc.status !== 'ENCERRADO' && inc.status !== 'NORMALIZADO';

const isMassivaByPortalObservacao = (inc: Incidente) => {
  const obs = normalizeLookup(inc.reclamacao || '');
  return ['massiva', 'massivo', 'vulto'].some((term) => obs.includes(term));
};

type KpiFilterKey =
  | 'all'
  | 'total_abertos'
  | 'em_andamento'
  | 'pendente'
  | 'massiva'
  | 'triagem'
  | 'em_abertura'
  | 'normalizados';

type TimeRangeFilterKey =
  | 'all'
  | 'ate_100'
  | 'acima_100'
  | 'acima_500'
  | 'acima_1000';

const matchesTimeRangeFilter = (inc: Incidente, filter: TimeRangeFilterKey, now: Date) => {
  if (filter === 'all') return true;
  const hrs = calcHorasDesde(inc.dataHoraAbertura, now);
  if (filter === 'ate_100') return hrs <= 100;
  if (filter === 'acima_100') return hrs > 100;
  if (filter === 'acima_500') return hrs > 500;
  if (filter === 'acima_1000') return hrs > 1000;
  return true;
};

type MetricTone = 'primary' | 'info' | 'success' | 'warning' | 'destructive' | 'muted';

const metricToneClass: Record<MetricTone, string> = {
  primary: 'text-primary',
  info: 'text-info',
  success: 'text-success',
  warning: 'text-warning',
  destructive: 'text-destructive',
  muted: 'text-foreground',
};

const metricToneActiveClass: Record<MetricTone, string> = {
  primary: 'border-primary/60 ring-primary/50',
  info: 'border-info/60 ring-info/50',
  success: 'border-success/60 ring-success/50',
  warning: 'border-warning/60 ring-warning/50',
  destructive: 'border-destructive/60 ring-destructive/50',
  muted: 'border-primary/40 ring-primary/40',
};

type FilterMetricCardProps = {
  label: string;
  value: number;
  tone?: MetricTone;
  icon?: ComponentType<{ className?: string }>;
  active?: boolean;
  onClick: () => void;
  title?: string;
  hint?: string;
};

function FilterMetricCard({
  label,
  value,
  tone = 'muted',
  icon: Icon,
  active = false,
  onClick,
  title,
  hint,
}: FilterMetricCardProps) {
  return (
    <button type="button" className="text-left w-full" onClick={onClick} title={title || label}>
      <Card
        className={[
          'h-full border border-border/80 bg-[linear-gradient(180deg,hsl(var(--card))_0%,hsl(var(--background))_100%)]',
          'shadow-[inset_0_1px_0_hsl(var(--border)/0.15)] transition-all duration-200',
          'hover:border-border hover:bg-[linear-gradient(180deg,hsl(var(--card))_0%,hsl(var(--secondary)/0.18)_100%)] hover:translate-y-[-1px]',
          active ? `ring-1 ${metricToneActiveClass[tone]} bg-[linear-gradient(180deg,hsl(var(--card))_0%,hsl(var(--secondary)/0.22)_100%)]` : '',
        ].join(' ')}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground/90">{label}</p>
              <p className={`text-4xl leading-none font-bold mt-2 ${metricToneClass[tone]}`}>{value}</p>
              {hint && <p className="text-[10px] text-muted-foreground/70 mt-2">{hint}</p>}
            </div>
            {Icon ? <Icon className="h-4 w-4 text-muted-foreground/70 shrink-0 mt-0.5" /> : null}
          </div>
        </CardContent>
      </Card>
    </button>
  );
}

export default function Dashboard() {
  const { incidentes, agencias } = useData();
  const navigate = useNavigate();
  const now = useTimeUpdate(30000);
  const [search, setSearch] = useState('');
  const [filterUf, setFilterUf] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterOemp, setFilterOemp] = useState('all');
  const [kpiFilter, setKpiFilter] = useState<KpiFilterKey>('all');
  const [timeRangeFilter, setTimeRangeFilter] = useState<TimeRangeFilterKey>('all');
  const [selectedInc, setSelectedInc] = useState<Incidente | null>(null);

  const incidentesIntegrador = useMemo(() => {
    const basePontos = new Set(agencias.map(a => normalizeLookup(a.nomeLogicoPonto)).filter(Boolean));
    const baseNomes = new Set(agencias.map(a => normalizeLookup(a.nomePonto)).filter(Boolean));

    if (!basePontos.size && !baseNomes.size) return [] as Incidente[];

    return incidentes.filter((i) => {
      const ponto = normalizeLookup(i.pontoCodigo || '');
      const nome = normalizeLookup(i.agenciaNome || '');
      return (ponto && basePontos.has(ponto)) || (nome && baseNomes.has(nome));
    });
  }, [agencias, incidentes]);

  const ufs = useMemo(() => [...new Set(incidentesIntegrador.map(i => i.uf))].sort(), [incidentesIntegrador]);
  const oemps = useMemo(() => [...new Set(incidentesIntegrador.map(i => i.oemp))].sort(), [incidentesIntegrador]);
  const statuses = useMemo(() => [...new Set(incidentesIntegrador.map(i => i.status))].sort(), [incidentesIntegrador]);

  const matchesKpiFilter = (inc: Incidente) => {
    switch (kpiFilter) {
      case 'all':
        return true;
      case 'total_abertos':
        return isIncidenteAberto(inc);
      case 'em_andamento':
        return isIncidenteAberto(inc) && inc.status === 'EM ANDAMENTO';
      case 'pendente':
        return isIncidenteAberto(inc) && inc.status.startsWith('PENDENTE');
      case 'massiva':
        return isIncidenteAberto(inc) && isMassivaByPortalObservacao(inc);
      case 'triagem':
        return isIncidenteAberto(inc) && (inc.status === 'TRIAGEM MANUAL' || inc.status === 'TRIAGEM');
      case 'em_abertura':
        return isIncidenteAberto(inc) && (inc.status === 'EM ABERTURA' || inc.status === 'INTEGRAR');
      case 'normalizados':
        return inc.status === 'NORMALIZADO';
      default:
        return true;
    }
  };

  const filtered = useMemo(() => {
    return incidentesIntegrador.filter(i => {
      if (filterUf !== 'all' && i.uf !== filterUf) return false;
      if (filterStatus !== 'all' && i.status !== filterStatus) return false;
      if (filterOemp !== 'all' && i.oemp !== filterOemp) return false;
      if (!matchesKpiFilter(i)) return false;
      if (!matchesTimeRangeFilter(i, timeRangeFilter, now)) return false;
      if (search) {
        const s = search.toLowerCase();
        return i.circuito.toLowerCase().includes(s) || i.chamado.toLowerCase().includes(s) || i.req.toLowerCase().includes(s) || i.agenciaNome.toLowerCase().includes(s);
      }
      return true;
    });
  }, [incidentesIntegrador, filterUf, filterStatus, filterOemp, kpiFilter, timeRangeFilter, now, search]);

  const abertos = incidentesIntegrador.filter(isIncidenteAberto);
  const kpis = [
    { key: 'total_abertos' as KpiFilterKey, label: 'Total Alarmes', value: abertos.length, icon: AlertTriangle, tone: 'muted' as MetricTone },
    { key: 'em_andamento' as KpiFilterKey, label: 'Em Andamento', value: abertos.filter(i => i.status === 'EM ANDAMENTO').length, icon: Activity, tone: 'primary' as MetricTone },
    { key: 'pendente' as KpiFilterKey, label: 'Pendentes', value: abertos.filter(i => i.status.startsWith('PENDENTE')).length, icon: Pause, tone: 'warning' as MetricTone },
    { key: 'massiva' as KpiFilterKey, label: 'Massiva', value: abertos.filter(isMassivaByPortalObservacao).length, icon: Layers, tone: 'destructive' as MetricTone },
    { key: 'triagem' as KpiFilterKey, label: 'Triagem', value: abertos.filter(i => i.status === 'TRIAGEM MANUAL' || i.status === 'TRIAGEM').length, icon: Clock, tone: 'info' as MetricTone },
    { key: 'em_abertura' as KpiFilterKey, label: 'Em Abertura', value: abertos.filter(i => i.status === 'EM ABERTURA' || i.status === 'INTEGRAR').length, icon: Activity, tone: 'warning' as MetricTone },
    { key: 'normalizados' as KpiFilterKey, label: 'Normalizados', value: incidentesIntegrador.filter(i => i.status === 'NORMALIZADO').length, icon: CheckCircle, tone: 'success' as MetricTone },
  ];

  const tempoFaixaCards = [
    { key: 'ate_100' as TimeRangeFilterKey, label: 'Ate 100h', value: abertos.filter(i => calcHorasDesde(i.dataHoraAbertura, now) <= 100).length, tone: 'success' as MetricTone },
    { key: 'acima_100' as TimeRangeFilterKey, label: 'Acima de 100h', value: abertos.filter(i => calcHorasDesde(i.dataHoraAbertura, now) > 100).length, tone: 'warning' as MetricTone },
    { key: 'acima_500' as TimeRangeFilterKey, label: 'Acima de 500h', value: abertos.filter(i => calcHorasDesde(i.dataHoraAbertura, now) > 500).length, tone: 'warning' as MetricTone },
    { key: 'acima_1000' as TimeRangeFilterKey, label: 'Acima de 1000h', value: abertos.filter(i => calcHorasDesde(i.dataHoraAbertura, now) > 1000).length, tone: 'destructive' as MetricTone },
  ];

  const timeRangeLabel =
    timeRangeFilter === 'ate_100' ? 'Até 100h' :
    timeRangeFilter === 'acima_100' ? 'Acima de 100h' :
    timeRangeFilter === 'acima_500' ? 'Acima de 500h' :
    timeRangeFilter === 'acima_1000' ? 'Acima de 1000h' :
    'Todos';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard de Operações</h1>
          <p className="text-sm text-muted-foreground">Atualizado: {now.toLocaleTimeString('pt-BR')} · Refresh a cada 30s</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpis.map(kpi => (
          <FilterMetricCard
            key={kpi.label}
            label={kpi.label}
            value={kpi.value}
            icon={kpi.icon}
            tone={kpi.tone}
            hint={(kpi as { hint?: string }).hint}
            active={kpiFilter === kpi.key}
            title={`Filtrar por ${kpi.label}`}
            onClick={() => setKpiFilter(prev => (prev === kpi.key ? 'all' : kpi.key))}
          />
        ))}
      </div>

      {/* Time Range Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-foreground">
            Faixa de Tempo {timeRangeFilter !== 'all' ? `- ${timeRangeLabel}` : '(clique para filtrar)'}
          </p>
          {timeRangeFilter !== 'all' && (
            <button
              type="button"
              onClick={() => setTimeRangeFilter('all')}
              className="text-xs px-2 py-1 rounded border border-border bg-secondary hover:bg-secondary/80"
            >
              Limpar faixa
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {tempoFaixaCards.map(card => (
            <FilterMetricCard
              key={card.key}
              label={card.label}
              value={card.value}
              tone={card.tone}
              active={timeRangeFilter === card.key}
              title={`Filtrar faixa ${card.label}`}
              onClick={() => setTimeRangeFilter(prev => (prev === card.key ? 'all' : card.key))}
            />
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Buscar circuito/chamado/REQ/agência..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-xs bg-secondary border-border"
        />
        <Select value={filterUf} onValueChange={setFilterUf}>
          <SelectTrigger className="w-28 bg-secondary border-border"><SelectValue placeholder="UF" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas UFs</SelectItem>
            {ufs.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-44 bg-secondary border-border"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Status</SelectItem>
            {statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterOemp} onValueChange={setFilterOemp}>
          <SelectTrigger className="w-32 bg-secondary border-border"><SelectValue placeholder="OEMP" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas OEMP</SelectItem>
            {oemps.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
        {(kpiFilter !== 'all' || timeRangeFilter !== 'all') && (
          <button
            type="button"
            onClick={() => {
              setKpiFilter('all');
              setTimeRangeFilter('all');
            }}
            className="text-xs px-3 h-10 rounded-md border border-border bg-secondary hover:bg-secondary/80"
          >
            Limpar filtros rápidos
          </button>
        )}
      </div>

      {/* Incidents Table */}
      <Card className="border-border overflow-hidden">
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm text-muted-foreground">{filtered.length} incidente(s)</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-xs">Circuito</TableHead>
                <TableHead className="text-xs">REQ</TableHead>
                <TableHead className="text-xs">UF</TableHead>
                <TableHead className="text-xs">Abertura</TableHead>
                <TableHead className="text-xs">GITEC</TableHead>
                <TableHead className="text-xs">Agência</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Tipo Falha</TableHead>
                <TableHead className="text-xs">Tempo Falha</TableHead>
                <TableHead className="text-xs">Ult. Comentario</TableHead>
                <TableHead className="text-xs text-right">Hrs Abert.</TableHead>
                <TableHead className="text-xs text-right">Hrs Atual.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(inc => {
                const hrsA = calcHorasDesde(inc.dataHoraAbertura, now);
                const hrsU = calcHorasDesde(inc.dataHoraAtualizacao, now);
                return (
                  <TableRow
                    key={inc.id}
                    className="border-border cursor-pointer hover:bg-secondary/50 transition-colors"
                    onClick={() => setSelectedInc(inc)}
                  >
                    <TableCell className="text-xs font-mono text-primary">{inc.circuito}</TableCell>
                    <TableCell className="text-xs">{inc.req}</TableCell>
                    <TableCell className="text-xs">{inc.uf}</TableCell>
                    <TableCell className="text-xs">{formatDataHora(inc.dataHoraAbertura)}</TableCell>
                    <TableCell className="text-xs">{inc.gitec || inc.oemp}</TableCell>
                    <TableCell className="text-xs max-w-[160px]">
                      <button
                        type="button"
                        className="truncate text-left hover:underline text-primary"
                        title={`Abrir consulta da agencia ${inc.agenciaNome || inc.pontoCodigo}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/agencia-integrador/consulta?search=${encodeURIComponent(inc.pontoCodigo || inc.agenciaNome)}`);
                        }}
                      >
                        {inc.agenciaNome || inc.pontoCodigo || '-'}
                      </button>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] ${statusColor[inc.status] || ''}`}>{inc.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs max-w-[140px] truncate" title={inc.descricaoInicial || inc.descricaoFalha}>
                      {inc.descricaoInicial || inc.descricaoFalha || '-'}
                    </TableCell>
                    <TableCell className="text-xs font-mono">
                      {inc.tempoTotal || '-'}
                    </TableCell>
                    <TableCell className="text-xs max-w-[240px] truncate" title={inc.ultimoComentario || '-'}>
                      {inc.ultimoComentario || '-'}
                    </TableCell>
                    <TableCell className={`text-xs text-right font-mono ${hrsA > 24 ? 'text-destructive font-semibold' : ''}`}>
                      {formatHoras(hrsA)}
                    </TableCell>
                    <TableCell className={`text-xs text-right font-mono ${hrsU > 8 ? 'text-warning font-semibold' : ''}`}>
                      {formatHoras(hrsU)}
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={12} className="text-center text-muted-foreground py-8">
                    Nenhum incidente encontrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <IncidentDetail incidente={selectedInc} onClose={() => setSelectedInc(null)} />
    </div>
  );
}
