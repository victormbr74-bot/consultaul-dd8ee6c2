import { useCallback, useState } from 'react';
import type ExcelJS from 'exceljs';
import { readExcel, sheetToJson } from '@/lib/excelCompat';
import { Upload, FileSpreadsheet, CheckCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useData } from '@/agencia-integrador/contexts/DataContext';
import { useAuth } from '@/agencia-integrador/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Agencia, CodEncerramento, Incidente, Parceira, Topologia } from '@/agencia-integrador/types';

type ImportEntityType = 'agencias' | 'incidentes' | 'parceiras' | 'topologia' | 'codEncerramento';

type SheetConfig = {
  entityType: ImportEntityType;
  label: string;
  aliases: string[];
  required?: boolean;
};

type ImportResult = { sheet: string; count: number; status: 'ok' | 'error'; msg?: string };

const SHEET_MAPPING: SheetConfig[] = [
  { entityType: 'agencias', label: 'Base', aliases: ['Base', 'Base Consolidada', 'BASE CONSOLIDADA', 'base_consolidada'], required: true },
  { entityType: 'incidentes', label: 'Incidentes', aliases: ['Incidentes', 'INCIDENTES', 'Portal', 'Portal Caixa', 'PORTAL CAIXA', 'Alertas'], required: true },
  { entityType: 'parceiras', label: 'PARCEIRAS', aliases: ['PARCEIRAS', 'Parceiras'], required: false },
  { entityType: 'topologia', label: 'Topologia', aliases: ['Topologia', 'TOPOLOGIA'], required: false },
  { entityType: 'codEncerramento', label: 'Cod', aliases: ['Cod', 'Codigos', 'COD'], required: false },
];

const normalizeSheetName = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();

const formatImportError = (err: unknown): string => {
  if (err instanceof Error) {
    return err.message || 'Erro desconhecido';
  }

  if (err && typeof err === 'object') {
    const obj = err as Record<string, unknown>;
    const messageParts = [obj.message, obj.details, obj.hint]
      .filter((v): v is string => typeof v === 'string' && v.trim().length > 0);

    const code = typeof obj.code === 'string' && obj.code ? ` [${obj.code}]` : '';
    let msg = messageParts.join(' | ');

    if (!msg && typeof obj.error === 'string') msg = obj.error;
    if (!msg) {
      try {
        msg = JSON.stringify(obj);
      } catch {
        msg = 'Erro desconhecido';
      }
    }

    const lower = msg.toLowerCase();
    if (
      lower.includes('does not exist') ||
      lower.includes('relation') ||
      lower.includes('permission denied') ||
      lower.includes('rls')
    ) {
      msg += ' | Verifique se a migration `20260225183000_agencia_integrador_schema.sql` foi aplicada no Supabase (`supabase db push`).';
    }

    return `${msg}${code}`;
  }

  return String(err);
};

const findSheetName = (sheetNames: string[], aliases: string[]) => {
  const normalizedAliases = aliases.map(normalizeSheetName);
  return sheetNames.find((sheetName) => normalizedAliases.includes(normalizeSheetName(sheetName)));
};

const normalizeKey = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const get = (row: Record<string, unknown>, ...keys: string[]) => {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return value;
    }
  }

  const normalizedEntries = Object.entries(row).map(([k, v]) => [normalizeKey(k), v] as const);
  for (const key of keys) {
    const normalized = normalizeKey(key);
    const entry = normalizedEntries.find(([k, v]) => k === normalized && v !== undefined && v !== null && String(v).trim() !== '');
    if (entry) return entry[1];
  }

  return '';
};

const parsePortalDate = (val: unknown): Date => {
  if (val instanceof Date) return val;
  const s = String(val || '').trim();
  if (!s || s === 'N/A' || s === 'undefined') return new Date();
  const parts = s.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):?(\d{2})?/);
  if (parts) return new Date(+parts[3], +parts[2] - 1, +parts[1], +parts[4], +parts[5], +(parts[6] || 0));
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? new Date() : d;
};

const parseNullableDate = (val: unknown): Date | null => {
  if (val instanceof Date) return val;
  const s = String(val || '').trim();
  if (!s || s === 'N/A' || s === 'undefined') return null;
  const parts = s.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):?(\d{2})?/);
  if (parts) return new Date(+parts[3], +parts[2] - 1, +parts[1], +parts[4], +parts[5], +(parts[6] || 0));
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};

const text = (value: unknown) => String(value ?? '').replace(/\u00A0/g, ' ').trim();

const isBlankRow = (row: unknown[]) => row.every((cell) => !text(cell));

function parseParceirasSheet(ws: ExcelJS.Worksheet): Parceira[] {
  const rows = sheetToJson<unknown[]>(ws, { header: 1, defval: '' });
  const result: Parceira[] = [];
  let i = 0;

  const isOperatorHeader = (row: unknown[]) => {
    const first = text(row[0]);
    const second = text(row[1]);
    if (!first) return false;
    if (!/atualizado/i.test(second)) return false;
    if (first.includes('@')) return false;
    return true;
  };

  while (i < rows.length) {
    const row = rows[i] || [];
    if (!isOperatorHeader(row)) {
      i += 1;
      continue;
    }

    const operadora = text(row[0]);
    const block: string[][] = [];
    i += 1;
    while (i < rows.length && !isOperatorHeader(rows[i] || [])) {
      const line = (rows[i] || []).map((cell) => text(cell)).filter(Boolean);
      if (line.length) block.push(line);
      i += 1;
    }

    const flat = block.flat();
    const email = flat.find((v) => /@/.test(v)) || '';
    const telefone = flat.find((v) => /\d{3,}/.test(v) || /0800|whats/i.test(v)) || '';
    const contato =
      flat.find((v) => {
        const n = normalizeKey(v);
        if (!n) return false;
        if (/@/.test(v)) return false;
        if (/\d{4,}/.test(v)) return false;
        if (n.includes('atualizado em')) return false;
        return true;
      }) || '';

    const observacoes = block.map((line) => line.join(' | ')).join('\n');

    result.push({
      id: String(result.length + 1),
      nomeOperadora: operadora,
      contato,
      email,
      telefone,
      observacoes,
    });
  }

  return result;
}

function parseTopologiaSheet(ws: ExcelJS.Worksheet): Topologia[] {
  const rows = sheetToJson<unknown[]>(ws, { header: 1, defval: '' });
  const out: Topologia[] = [];
  let currentRegion = '';

  const cell = (row: unknown[] | undefined, idx: number) => text((row || [])[idx]);
  const looksRegion = (value: string) => {
    const v = text(value);
    if (!v) return false;
    if (/\d/.test(v)) return false;
    if (/concentrador/i.test(v)) return false;
    if (/^(g\d+|edd)$/i.test(v)) return false;
    return /^[a-zA-Z\/\-\s]+$/.test(v);
  };

  const findNearestRegion = (rowIndex: number) => {
    for (let j = rowIndex; j >= 0 && j >= rowIndex - 8; j--) {
      const candidate = cell(rows[j], 14);
      if (looksRegion(candidate)) return candidate;
    }
    return currentRegion;
  };

  const collectContextCells = (rowIndex: number) => {
    const values: string[] = [];
    for (let j = Math.max(0, rowIndex - 4); j <= Math.min(rows.length - 1, rowIndex + 4); j++) {
      for (const idx of [3, 4, 5, 14, 15, 16]) {
        const v = cell(rows[j], idx);
        if (v) values.push(v);
      }
    }
    return Array.from(new Set(values));
  };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] || [];
    if (isBlankRow(row)) continue;

    const colO = cell(row, 14);
    const colP = cell(row, 15);
    const colQ = cell(row, 16);

    if (looksRegion(colO)) currentRegion = colO;

    if (!/concentrador/i.test(colQ)) continue;

    const ctx = collectContextCells(i);
    const commandLines = ctx.filter((v) => /^(sh|show|ping|traceroute)\b/i.test(v) || /\badvertised-routes\b/i.test(v));
    const descLines = ctx.filter((v) => /^description\b/i.test(v));
    const vlanLines = ctx.filter((v) => /\bvlan\b/i.test(v));
    const redeLines = ctx.filter((v) => /\brede\b/i.test(v) || /\b\d{1,3}(?:\.\d{1,3}){3}/.test(v));
    const wan1 = descLines.find((v) => /\bwan1\b/i.test(v)) || '';
    const wan2 = descLines.find((v) => /\bwan2\b/i.test(v)) || '';
    const lan = redeLines.find((v) => !/\bwan[12]\b/i.test(v)) || '';
    const ufRegiao = findNearestRegion(i) || '';

    out.push({
      id: String(out.length + 1),
      ufRegiao,
      concentrador: colQ,
      ip: colP,
      descricao: colO ? `${colO} - ${colQ}` : colQ,
      comandos: commandLines.join('\n'),
      vlan: vlanLines.join(' | '),
      wan1,
      wan2,
      lan,
      observacoes: descLines.join(' | '),
    });
  }

  const dedup = new Map<string, Topologia>();
  for (const item of out) {
    const key = `${normalizeKey(item.concentrador)}|${item.ip}`;
    if (!dedup.has(key)) dedup.set(key, item);
  }
  return Array.from(dedup.values()).map((item, idx) => ({ ...item, id: String(idx + 1) }));
}

export default function ImportarExcel() {
  const {
    replaceIncidentes,
    replaceAgencias,
    replaceParceiras,
    replaceTopologia,
    replaceCodEncerramento,
    addImportLog,
    importLogs,
  } = useData();
  const { profile, user } = useAuth();

  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<ImportResult[]>([]);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setResults([]);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const wb = await readExcel(evt.target?.result as ArrayBuffer, { type: 'array', cellDates: true });
        const newResults: ImportResult[] = [];
        const logUser = profile?.full_name || profile?.username || profile?.employee_id || user?.email || 'usuario';

        for (const config of SHEET_MAPPING) {
          const sheetName = findSheetName(wb.SheetNames, config.aliases);
          if (!sheetName) {
            newResults.push({
              sheet: config.label,
              count: 0,
              status: config.required === false ? 'ok' : 'error',
              msg: config.required === false ? 'Aba opcional nao encontrada' : 'Aba nao encontrada',
            });
            continue;
          }

          const ws = wb.Sheets[sheetName];
          if (!ws) {
            newResults.push({ sheet: sheetName, count: 0, status: 'error', msg: 'Aba invalida' });
            continue;
          }

          try {
            const rawData = sheetToJson<Record<string, unknown>>(ws, { defval: '' });
            let count = rawData.length;

            switch (config.entityType) {
              case 'incidentes': {
                const rawDataByColumn = sheetToJson<Record<string, unknown>>(ws, {
                  header: 'A',
                  range: 1,
                  defval: '',
                });

                const mapped: Incidente[] = rawData.map((r, i) => {
                  const byColumn = rawDataByColumn[i] || {};
                  return {
                    id: String(i + 1),
                    circuito: String(get(r, 'Circuito / Linha', 'Circuito', 'circuito')),
                    chamado: String(get(r, 'Chamado OI', 'Chamado', 'chamado')),
                    req: String(get(r, 'No REQ', 'REQ', 'req')),
                    uf: String(get(r, 'UF', 'uf')),
                    dataHoraAbertura: parsePortalDate(get(r, 'Data / Hora Abertura', 'Data/Hora Abertura', 'dataHoraAbertura')),
                    dataHoraAtualizacao: parsePortalDate(get(r, 'Data / Hora Atualizacao', 'Data / Hora AtualizaÃ§Ã£o', 'Data/Hora AtualizaÃ§Ã£o', 'dataHoraAtualizacao')),
                    oemp: String(get(r, 'GITEC', 'OEMP', 'oemp')),
                    rede: String(get(r, 'Tipo Circuito', 'Rede', 'rede')),
                    agenciaNome: String(get(r, 'Nome Ponto', 'Agencia', 'AgÃªncia', 'agenciaNome')),
                    pontoCodigo: String(get(r, 'Cod Ponto', 'CÃ³d Ponto', 'Ponto', 'pontoCodigo')),
                    status: String(get(r, 'Status', 'status') || 'EM ANDAMENTO').toUpperCase() as Incidente['status'],
                    reclamacao: String(get(r, 'Observacao', 'ObservaÃ§Ã£o', 'Reclamacao', 'ReclamaÃ§Ã£o', 'reclamacao')),
                    massiva: get(r, 'Massiva') === true || String(get(r, 'Massiva')).toLowerCase() === 'sim',
                    vulto: String(get(r, 'Vulto', 'vulto')),
                    isolado: String(get(r, 'Isolado', 'isolado')),
                    descricaoFalha: String(get(r, 'Descricao Inicial', 'DescriÃ§Ã£o Inicial', 'Descricao Falha', 'DescriÃ§Ã£o Falha', 'descricaoFalha')),
                    causa: String(get(r, 'Causa Raiz', 'Causa', 'causa')),
                    normalizacaoDataHora: parseNullableDate(get(r, 'Data / Hora Normalizacao', 'Data / Hora NormalizaÃ§Ã£o', 'Normalizacao', 'NormalizaÃ§Ã£o')),
                    tipoSolicitacao: String(get(r, 'Tipo Solicitacao', 'Tipo SolicitaÃ§Ã£o')),
                    sla: String(get(r, 'SLA')),
                    tipoPonto: String(get(r, 'Tipo Ponto')),
                    tipoCircuito: String(get(r, 'Tipo Circuito')),
                    contrato: String(get(r, 'Contrato')),
                    gitec: String(get(r, 'GITEC')),
                    protocoloPortal: String(get(r, 'Protocolo Portal')),
                    descricaoInicial: String(get(r, 'Descricao Inicial', 'DescriÃ§Ã£o Inicial')),
                    tempoTotal: String(get(r, 'Tempo Total')),
                    causaRaiz: String(get(r, 'Causa Raiz')),
                    normalizacaoDataHoraFechamento: parseNullableDate(get(r, 'Data / Hora Fechamento')),
                    periodoUltimaAtualizacao: String(get(r, 'Periodo da Ultima Atualizacao', 'PerÃ­odo da Ãšltima AtualizaÃ§Ã£o', 'Periodo da Ultima AtualizaÃ§Ã£o')),
                    ultimoComentario: String(
                      get(r, 'Historico do Trabalho', 'Histórico do Trabalho', 'Ultimo Comentario', 'Último Comentário', 'ultimoComentario') ||
                        byColumn.AC ||
                        '',
                    ),
                    responsavelPortal: String(
                      get(r, 'Nome Operador', 'Responsavel', 'Responsável', 'Analista', 'Usuario', 'Usuário', 'Nome') ||
                        byColumn.O ||
                        '',
                    ),
                  };
                });

                count = mapped.length;
                await replaceIncidentes(mapped);
                break;
              }
              case 'agencias': {
                const rawDataByColumn = sheetToJson<Record<string, unknown>>(ws, {
                  header: 'A',
                  range: 1,
                  defval: '',
                });

                const mapped: Agencia[] = rawData.map((r, i) => {
                  const byColumn = rawDataByColumn[i] || {};
                  return {
                    id: String(i + 1),
                    nomeLogicoPonto: String(get(r, 'Nome Logico Ponto', 'Nome LÃ³gico Ponto', 'nomeLogicoPonto', 'Cod Ponto', 'CÃ³d Ponto') || byColumn.A || ''),
                    nomePonto: String(get(r, 'Nome do Ponto', 'Nome Ponto', 'Ponto de Atendimento', 'nomePonto') || byColumn.B || ''),
                    nomeRede: String(get(r, 'Nome de rede', 'Nome Rede', 'nomeRede')),
                    unidade: String(get(r, 'Unidade', 'unidade', 'Ponto de Atendimento') || byColumn.X || ''),
                    tipoPonto: String(get(r, 'Tipo de Ponto', 'TIPO ATENDIMENTO', 'Tipo Ponto', 'tipoPonto')),
                    velocidade: String(get(r, 'Velocidade', 'velocidade')),
                    velocidadeRealSolicitada: String(get(r, 'Velocidade Real Solicitada', 'velocidadeRealSolicitada')),
                    tecnologia: String(get(r, 'Tecnologia', 'tecnologia')),
                    degrau: String(get(r, 'Degrau', 'degrau')),
                    cgcUnidade: String(get(r, 'CGC Unidade', 'cgcUnidade')),
                    cep: String(get(r, 'CEP', 'cep')),
                    logradouro: String(get(r, 'Logradouro B', 'Logradouro', 'logradouro')),
                    endereco: String(get(r, 'Endereco Ponto B', 'EndereÃ§o Ponto B', 'Endereco', 'EndereÃ§o', 'endereco')),
                    numero: String(get(r, 'Numero B', 'NÃºmero', 'Numero', 'numero')),
                    complemento: String(get(r, 'Complemento Ponto B', 'Complemento', 'complemento')),
                    bairro: String(get(r, 'Bairro Ponto B', 'Bairro', 'bairro')),
                    cidade: String(get(r, 'Cidade Ponto B', 'Cidade', 'cidade')),
                    uf: String(get(r, 'UF Ponto B', 'UF', 'uf')),
                    provedorFinal: String(get(r, 'Provedor Final')),
                    tipoAtendimento: String(get(r, 'TIPO ATENDIMENTO')),
                    ipLan: String(get(r, 'IP LAN', 'IP LAN ')),
                    ipWan: String(get(r, 'IP Wan', 'IP WAN')),
                    designacaoCircuito: String(get(r, 'Designacao circuito', 'DesignaÃ§Ã£o circuito')),
                    cpe1: String(get(r, 'CPE_1', 'CPE1')),
                    eddCpe2: String(get(r, 'EDD_CPE_2', 'EDD CPE 2')),
                    ipWanEddCpe2: String(get(r, 'ip wan EDD_CPE_2', 'IP WAN EDD_CPE_2')),
                    visaoFelix: String(get(r, 'Visao Felix', 'VisÃ£o Felix')),
                    visaoFreiria: String(get(r, 'VISAO FREIRIA', 'VISÃƒO FREIRIA', 'Visao Freiria')),
                    faturamento: String(get(r, 'Faturamento')),
                  };
                });

                count = mapped.length;
                await replaceAgencias(mapped);
                break;
              }
              case 'parceiras': {
                const mapped: Parceira[] = parseParceirasSheet(ws);
                count = mapped.length;
                await replaceParceiras(mapped);
                break;
              }
              case 'topologia': {
                const mapped: Topologia[] = parseTopologiaSheet(ws);
                count = mapped.length;
                await replaceTopologia(mapped);
                break;
              }
              case 'codEncerramento': {
                const mapped: CodEncerramento[] = rawData.map((r, i) => ({
                  id: String(i + 1),
                  codigo: String(get(r, 'Codigo', 'CÃ³digo', 'codigo')),
                  n1: String(get(r, 'N1', 'n1')),
                  n2: String(get(r, 'N2', 'n2')),
                  n3: String(get(r, 'N3', 'n3')),
                  quandoUtilizar: String(get(r, 'Quando Utilizar', 'quandoUtilizar')),
                }));

                count = mapped.length;
                await replaceCodEncerramento(mapped);
                break;
              }
            }

            let logWarning: string | undefined;
            try {
              await addImportLog({ usuario: logUser, tipo: config.entityType, registros: count, arquivo: file.name });
            } catch (logErr) {
              const msg = formatImportError(logErr);
              console.error(`Falha ao registrar import log (${config.entityType})`, logErr);
              logWarning = `Dados importados, mas falhou ao gravar histórico: ${msg}`;
            }

            newResults.push({ sheet: sheetName, count, status: 'ok', msg: logWarning });
          } catch (err) {
            newResults.push({ sheet: sheetName, count: 0, status: 'error', msg: formatImportError(err) });
          }
        }

        setResults(newResults);
        const errors = newResults.filter((r) => r.status === 'error');
        if (errors.length > 0) {
          toast.error(`Importacao concluida com erros (${errors.length}/${newResults.length} abas)`);
        } else {
          toast.success('Importacao concluida');
        }
      } catch (err) {
        toast.error(`Erro ao ler arquivo: ${formatImportError(err)}`);
      } finally {
        setImporting(false);
      }
    };

    reader.onerror = () => {
      setImporting(false);
      toast.error('Falha ao ler o arquivo');
    };

    reader.readAsArrayBuffer(file);
  }, [
    addImportLog,
    profile?.employee_id,
    profile?.full_name,
    profile?.username,
    replaceAgencias,
    replaceCodEncerramento,
    replaceIncidentes,
    replaceParceiras,
    replaceTopologia,
    user?.email,
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Importar Excel</h1>
      <p className="text-sm text-muted-foreground">
        Upload de arquivo .xlsx/.xlsm com abas Base, Incidentes, PARCEIRAS, Topologia e Cod.
      </p>

      <Card className="border-border border-dashed">
        <CardContent className="p-8 flex flex-col items-center gap-4">
          <FileSpreadsheet className="h-12 w-12 text-primary" />
          <label className="cursor-pointer">
            <input type="file" accept=".xlsx,.xlsm" onChange={handleFile} className="hidden" />
            <Button asChild variant="default" disabled={importing}>
              <span>
                <Upload className="h-4 w-4 mr-2" />
                {importing ? 'Importando...' : 'Selecionar Arquivo'}
              </span>
            </Button>
          </label>
          <p className="text-xs text-muted-foreground">Formatos aceitos: .xlsx, .xlsm</p>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <Card className="border-border">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm">Resultado da Importacao</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {results.map((r) => (
              <div key={r.sheet} className="flex items-center gap-3 text-sm">
                {r.status === 'ok' ? (
                  <CheckCircle className="h-4 w-4 text-success" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                )}
                <span className="font-mono w-28">{r.sheet}</span>
                {r.status === 'ok' ? (
                  <>
                    <Badge variant="outline" className="bg-success/20 text-success border-success/30">
                      {r.count} registros
                    </Badge>
                    {r.msg && <span className="text-xs text-muted-foreground">{r.msg}</span>}
                  </>
                ) : (
                  <span className="text-xs text-destructive">{r.msg}</span>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {importLogs.length > 0 && (
        <Card className="border-border">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm text-muted-foreground">Historico de Importacoes</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-1">
            {importLogs.map((log) => (
              <p key={log.id} className="text-xs text-muted-foreground">
                {log.dataHora.toLocaleString('pt-BR')} Â· {log.usuario} Â· {log.tipo} Â· {log.registros} registros
                {log.arquivo ? ` Â· ${log.arquivo}` : ''}
              </p>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
