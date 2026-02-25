/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from '@/integrations/supabase/client';
import type { Agencia, CodEncerramento, ImportLog, Incidente, MeuCaso, Parceira, Topologia } from '@/agencia-integrador/types';

type DbClient = any;

const db = supabase as DbClient;

const CHUNK_SIZE = 500;

function str(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

function parseDate(value: unknown): Date {
  if (value instanceof Date) return value;
  const d = new Date(str(value));
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function parseNullableDate(value: unknown): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(str(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function isIgnoredIncidenteStatus(status: unknown): boolean {
  const normalized = normalize(str(status));
  return normalized === 'cancelado' || normalized === 'rejeitado';
}

function chunk<T>(items: T[], size = CHUNK_SIZE): T[][] {
  if (items.length <= size) return [items];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function clearTable(table: string) {
  const { error } = await db.from(table).delete().not('id', 'is', null);
  if (error) throw error;
}

async function insertAll(table: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  for (const batch of chunk(rows)) {
    const { error } = await db.from(table).insert(batch);
    if (error) throw error;
  }
}

function mapAgenciaRow(row: any): Agencia {
  return {
    id: str(row.id),
    nomeLogicoPonto: str(row.nome_logico_ponto),
    nomePonto: str(row.nome_ponto),
    nomeRede: str(row.nome_rede),
    unidade: str(row.unidade),
    tipoPonto: str(row.tipo_ponto),
    velocidade: str(row.velocidade),
    velocidadeRealSolicitada: str(row.velocidade_real_solicitada),
    tecnologia: str(row.tecnologia),
    degrau: str(row.degrau),
    cgcUnidade: str(row.cgc_unidade),
    cep: str(row.cep),
    logradouro: str(row.logradouro),
    endereco: str(row.endereco),
    numero: str(row.numero),
    complemento: str(row.complemento),
    bairro: str(row.bairro),
    cidade: str(row.cidade),
    uf: str(row.uf),
    provedorFinal: str(row.provedor_final),
    tipoAtendimento: str(row.tipo_atendimento),
    ipLan: str(row.ip_lan),
    ipWan: str(row.ip_wan),
    designacaoCircuito: str(row.designacao_circuito),
    cpe1: str(row.cpe1),
    eddCpe2: str(row.edd_cpe2),
    ipWanEddCpe2: str(row.ip_wan_edd_cpe2),
    visaoFelix: str(row.visao_felix),
    visaoFreiria: str(row.visao_freiria),
    faturamento: str(row.faturamento),
  };
}

function mapIncidenteRow(row: any): Incidente {
  return {
    id: str(row.id),
    circuito: str(row.circuito),
    chamado: str(row.chamado),
    req: str(row.req),
    uf: str(row.uf),
    dataHoraAbertura: parseDate(row.data_hora_abertura),
    dataHoraAtualizacao: parseDate(row.data_hora_atualizacao),
    oemp: str(row.oemp),
    rede: str(row.rede),
    agenciaNome: str(row.agencia_nome),
    pontoCodigo: str(row.ponto_codigo),
    status: str(row.status) as Incidente['status'],
    reclamacao: str(row.reclamacao),
    massiva: Boolean(row.massiva),
    vulto: str(row.vulto),
    isolado: str(row.isolado),
    descricaoFalha: str(row.descricao_falha),
    causa: str(row.causa),
    normalizacaoDataHora: parseNullableDate(row.normalizacao_data_hora),
    tipoSolicitacao: str(row.tipo_solicitacao),
    sla: str(row.sla),
    tipoPonto: str(row.tipo_ponto),
    tipoCircuito: str(row.tipo_circuito),
    contrato: str(row.contrato),
    gitec: str(row.gitec),
    protocoloPortal: str(row.protocolo_portal),
    descricaoInicial: str(row.descricao_inicial),
    tempoTotal: str(row.tempo_total),
    causaRaiz: str(row.causa_raiz),
    normalizacaoDataHoraFechamento: parseNullableDate(row.normalizacao_data_hora_fechamento),
    periodoUltimaAtualizacao: str(row.periodo_ultima_atualizacao),
    ultimoComentario: str(row.ultimo_comentario),
    responsavelPortal: str(row.responsavel_portal),
  };
}

function mapParceiraRow(row: any): Parceira {
  return {
    id: str(row.id),
    nomeOperadora: str(row.nome_operadora),
    contato: str(row.contato),
    email: str(row.email),
    telefone: str(row.telefone),
    observacoes: str(row.observacoes),
  };
}

function mapTopologiaRow(row: any): Topologia {
  return {
    id: str(row.id),
    ufRegiao: str(row.uf_regiao),
    concentrador: str(row.concentrador),
    ip: str(row.ip),
    descricao: str(row.descricao),
    comandos: str(row.comandos),
    vlan: str(row.vlan),
    wan1: str(row.wan1),
    wan2: str(row.wan2),
    lan: str(row.lan),
    observacoes: str(row.observacoes),
  };
}

function mapCodEncRow(row: any): CodEncerramento {
  return {
    id: str(row.id),
    codigo: str(row.codigo),
    n1: str(row.n1),
    n2: str(row.n2),
    n3: str(row.n3),
    quandoUtilizar: str(row.quando_utilizar),
  };
}

function mapMeuCasoRow(row: any): MeuCaso {
  return {
    id: str(row.id),
    incidenteChamado: str(row.incidente_chamado),
    usuario: str(row.usuario_nome),
    statusCaso: str(row.status_caso) as MeuCaso['statusCaso'],
    notas: Array.isArray(row.notas) ? row.notas.map(str) : [],
    criadoEm: parseDate(row.criado_em),
  };
}

function mapImportLogRow(row: any): ImportLog {
  return {
    id: str(row.id),
    usuario: str(row.usuario),
    tipo: str(row.tipo),
    registros: Number(row.registros ?? 0),
    dataHora: parseDate(row.data_hora),
    arquivo: str(row.arquivo),
  };
}

function agenciaToDb(a: Agencia) {
  return {
    nome_logico_ponto: a.nomeLogicoPonto,
    nome_ponto: a.nomePonto,
    nome_rede: a.nomeRede,
    unidade: a.unidade,
    tipo_ponto: a.tipoPonto,
    velocidade: a.velocidade,
    velocidade_real_solicitada: a.velocidadeRealSolicitada,
    tecnologia: a.tecnologia,
    degrau: a.degrau,
    cgc_unidade: a.cgcUnidade,
    cep: a.cep,
    logradouro: a.logradouro,
    endereco: a.endereco,
    numero: a.numero,
    complemento: a.complemento,
    bairro: a.bairro,
    cidade: a.cidade,
    uf: a.uf,
    provedor_final: a.provedorFinal,
    tipo_atendimento: a.tipoAtendimento,
    ip_lan: a.ipLan,
    ip_wan: a.ipWan,
    designacao_circuito: a.designacaoCircuito,
    cpe1: a.cpe1,
    edd_cpe2: a.eddCpe2,
    ip_wan_edd_cpe2: a.ipWanEddCpe2,
    visao_felix: a.visaoFelix,
    visao_freiria: a.visaoFreiria,
    faturamento: a.faturamento,
  };
}

function incidenteToDb(i: Incidente) {
  return {
    circuito: i.circuito,
    chamado: i.chamado,
    req: i.req,
    uf: i.uf,
    data_hora_abertura: i.dataHoraAbertura?.toISOString?.() ?? new Date().toISOString(),
    data_hora_atualizacao: i.dataHoraAtualizacao?.toISOString?.() ?? new Date().toISOString(),
    oemp: i.oemp,
    rede: i.rede,
    agencia_nome: i.agenciaNome,
    ponto_codigo: i.pontoCodigo,
    status: i.status,
    reclamacao: i.reclamacao,
    massiva: Boolean(i.massiva),
    vulto: i.vulto,
    isolado: i.isolado,
    descricao_falha: i.descricaoFalha,
    causa: i.causa,
    normalizacao_data_hora: i.normalizacaoDataHora ? i.normalizacaoDataHora.toISOString() : null,
    tipo_solicitacao: i.tipoSolicitacao,
    sla: i.sla,
    tipo_ponto: i.tipoPonto,
    tipo_circuito: i.tipoCircuito,
    contrato: i.contrato,
    gitec: i.gitec,
    protocolo_portal: i.protocoloPortal,
    descricao_inicial: i.descricaoInicial,
    tempo_total: i.tempoTotal,
    causa_raiz: i.causaRaiz,
    normalizacao_data_hora_fechamento: i.normalizacaoDataHoraFechamento ? i.normalizacaoDataHoraFechamento.toISOString() : null,
    periodo_ultima_atualizacao: i.periodoUltimaAtualizacao,
    ultimo_comentario: i.ultimoComentario ?? '',
    responsavel_portal: i.responsavelPortal ?? '',
  };
}

function parceiraToDb(p: Parceira) {
  return {
    nome_operadora: p.nomeOperadora,
    contato: p.contato,
    email: p.email,
    telefone: p.telefone,
    observacoes: p.observacoes,
  };
}

function topologiaToDb(t: Topologia) {
  return {
    uf_regiao: t.ufRegiao,
    concentrador: t.concentrador,
    ip: t.ip,
    descricao: t.descricao,
    comandos: t.comandos,
    vlan: t.vlan,
    wan1: t.wan1,
    wan2: t.wan2,
    lan: t.lan,
    observacoes: t.observacoes,
  };
}

function codEncToDb(c: CodEncerramento) {
  return {
    codigo: c.codigo,
    n1: c.n1,
    n2: c.n2,
    n3: c.n3,
    quando_utilizar: c.quandoUtilizar,
  };
}

function meuCasoToDb(caso: MeuCaso) {
  return {
    incidente_chamado: caso.incidenteChamado,
    usuario_nome: caso.usuario,
    status_caso: caso.statusCaso,
    notas: caso.notas,
    criado_em: caso.criadoEm.toISOString(),
  };
}

export type AppDataSnapshot = {
  agencias: Agencia[];
  incidentes: Incidente[];
  parceiras: Parceira[];
  topologia: Topologia[];
  codEncerramento: CodEncerramento[];
  importLogs: ImportLog[];
};

export async function fetchAppDataSnapshot(): Promise<AppDataSnapshot> {
  const [
    agenciasRes,
    incidentesRes,
    parceirasRes,
    topologiaRes,
    codRes,
    logsRes,
  ] = await Promise.all([
    db.from('agencias').select('*').order('nome_logico_ponto', { ascending: true }),
    db.from('incidentes').select('*').order('data_hora_abertura', { ascending: false }),
    db.from('parceiras').select('*').order('nome_operadora', { ascending: true }),
    db.from('topologia').select('*').order('uf_regiao', { ascending: true }),
    db.from('cod_encerramento').select('*').order('codigo', { ascending: true }),
    db.from('import_logs').select('*').order('data_hora', { ascending: false }),
  ]);

  for (const res of [agenciasRes, incidentesRes, parceirasRes, topologiaRes, codRes, logsRes]) {
    if (res.error) throw res.error;
  }

  const incidentes = (incidentesRes.data ?? [])
    .map(mapIncidenteRow)
    .filter((inc) => !isIgnoredIncidenteStatus(inc.status));

  return {
    agencias: (agenciasRes.data ?? []).map(mapAgenciaRow),
    incidentes,
    parceiras: (parceirasRes.data ?? []).map(mapParceiraRow),
    topologia: (topologiaRes.data ?? []).map(mapTopologiaRow),
    codEncerramento: (codRes.data ?? []).map(mapCodEncRow),
    importLogs: (logsRes.data ?? []).map(mapImportLogRow),
  };
}

export async function fetchMeusCasosByUserNames(userNames: string[]): Promise<MeuCaso[]> {
  const { data, error } = await db.from('meus_casos').select('*').order('criado_em', { ascending: false });
  if (error) throw error;

  const normalizedNames = Array.from(new Set(userNames.map(normalize).filter(Boolean)));
  const rows = (data ?? []).map(mapMeuCasoRow);

  if (!normalizedNames.length) return [];

  return rows.filter((row) => {
    const rowUser = normalize(row.usuario);
    if (!rowUser) return false;
    if (normalizedNames.includes(rowUser)) return true;
    return normalizedNames.some((name) => name.length >= 3 && (rowUser.includes(name) || name.includes(rowUser)));
  });
}

export async function replaceAgencias(data: Agencia[]) {
  await clearTable('agencias');
  await insertAll('agencias', data.map(agenciaToDb));
}

export async function replaceIncidentes(data: Incidente[]) {
  const filtered = data.filter((inc) => !isIgnoredIncidenteStatus(inc.status));
  await clearTable('incidentes');
  await insertAll('incidentes', filtered.map(incidenteToDb));
}

export async function replaceParceiras(data: Parceira[]) {
  await clearTable('parceiras');
  await insertAll('parceiras', data.map(parceiraToDb));
}

export async function replaceTopologia(data: Topologia[]) {
  await clearTable('topologia');
  await insertAll('topologia', data.map(topologiaToDb));
}

export async function replaceCodEncerramento(data: CodEncerramento[]) {
  await clearTable('cod_encerramento');
  await insertAll('cod_encerramento', data.map(codEncToDb));
}

export async function addImportLogDb(input: Omit<ImportLog, 'id' | 'dataHora'>) {
  const payload = {
    usuario: input.usuario ?? '',
    tipo: input.tipo ?? '',
    registros: input.registros ?? 0,
    arquivo: input.arquivo ?? '',
  };
  const { data, error } = await db.from('import_logs').insert(payload).select('*').single();
  if (error) throw error;
  return mapImportLogRow(data);
}

export async function createMeuCasoDb(caso: MeuCaso) {
  const { data, error } = await db.from('meus_casos').insert(meuCasoToDb(caso)).select('*').single();
  if (error) throw error;
  return mapMeuCasoRow(data);
}

export async function updateMeuCasoStatusDb(casoId: string, statusCaso: MeuCaso['statusCaso']) {
  const { data, error } = await db
    .from('meus_casos')
    .update({ status_caso: statusCaso })
    .eq('id', casoId)
    .select('*')
    .single();
  if (error) throw error;
  return mapMeuCasoRow(data);
}

export async function addNotaMeuCasoDb(casoId: string, nota: string) {
  const { data: current, error: currentErr } = await db
    .from('meus_casos')
    .select('id, notas')
    .eq('id', casoId)
    .single();
  if (currentErr) throw currentErr;

  const notas = Array.isArray(current?.notas) ? [...current.notas.map(str), nota] : [nota];

  const { data, error } = await db
    .from('meus_casos')
    .update({ notas })
    .eq('id', casoId)
    .select('*')
    .single();
  if (error) throw error;
  return mapMeuCasoRow(data);
}
