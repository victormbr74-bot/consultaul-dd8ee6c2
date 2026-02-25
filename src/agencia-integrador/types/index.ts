export interface Agencia {
  id: string;
  nomeLogicoPonto: string;
  nomePonto: string;
  nomeRede: string;
  unidade: string;
  tipoPonto: string;
  velocidade: string;
  velocidadeRealSolicitada: string;
  tecnologia: string;
  degrau: string;
  cgcUnidade: string;
  cep: string;
  logradouro: string;
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  provedorFinal: string;
  tipoAtendimento: string;
  ipLan: string;
  ipWan: string;
  designacaoCircuito: string;
  cpe1: string;
  eddCpe2: string;
  ipWanEddCpe2: string;
  visaoFelix: string;
  visaoFreiria: string;
  faturamento: string;
}

export interface Incidente {
  id: string;
  circuito: string;
  chamado: string;
  req: string;
  uf: string;
  dataHoraAbertura: Date;
  dataHoraAtualizacao: Date;
  oemp: string;
  rede: string;
  agenciaNome: string;
  pontoCodigo: string;
  status: StatusIncidente;
  reclamacao: string;
  massiva: boolean;
  vulto: string;
  isolado: string;
  descricaoFalha: string;
  causa: string;
  normalizacaoDataHora: Date | null;
  // Campos complementares
  tipoSolicitacao: string;
  sla: string;
  tipoPonto: string;
  tipoCircuito: string;
  contrato: string;
  gitec: string;
  protocoloPortal: string;
  descricaoInicial: string;    // "Tipo de Falha" (ex: Indisponibilidade Total)
  tempoTotal: string;          // Tempo total de falha
  causaRaiz: string;
  normalizacaoDataHoraFechamento: Date | null;
  periodoUltimaAtualizacao: string;
  ultimoComentario: string;
  responsavelPortal: string;
}

export type StatusIncidente =
  | 'EM ANDAMENTO'
  | 'EM ABERTURA'
  | 'TRIAGEM MANUAL'
  | 'TRIAGEM'
  | 'INTEGRAR'
  | 'FALHA INTEGRAÇÃO'
  | 'PENDENTE PARCEIRA'
  | 'PENDENTE CLIENTE'
  | 'PENDENTE AGENDAMENTO'
  | 'PENDENTE MONITORAÇÃO'
  | 'PENDENTE SEM CONTATO'
  | 'ENCERRADO'
  | 'NORMALIZADO';

export interface MeuCaso {
  id: string;
  incidenteId?: string; // legado (mock)
  incidenteChamado: string;
  usuario: string;
  statusCaso: 'Acompanhando' | 'Atualizado' | 'Encerrado';
  notas: string[];
  criadoEm: Date;
}

export interface Parceira {
  id: string;
  nomeOperadora: string;
  contato: string;
  email: string;
  telefone: string;
  observacoes: string;
}

export interface Topologia {
  id: string;
  ufRegiao: string;
  concentrador: string;
  ip: string;
  descricao: string;
  comandos: string;
  vlan: string;
  wan1: string;
  wan2: string;
  lan: string;
  observacoes: string;
}

export interface CodEncerramento {
  id: string;
  codigo: string;
  n1: string;
  n2: string;
  n3: string;
  quandoUtilizar: string;
}

export interface ImportLog {
  id: string;
  usuario: string;
  dataHora: Date;
  tipo: string;
  registros: number;
  arquivo?: string;
}
