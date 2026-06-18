import type { Sinalizacao60km } from "./geo";

export const GIS_COLUMNS = [
  "Cód. da Lotérica",
  "Lotérica",
  "Tipo de Link",
  "Cidade",
  "UF",
  "Telefone",
  "Designação",
  "IP Loopback",
  "Data e Hora Incial",
  "Duração (h)",
  "Empresa",
  "Mensagem",
  "ID do Alarmes",
  "Chamado",
  "Previsão de Atendimento",
  "Status",
  "Último Comentário",
  "Nº REQ Caixa",
  "Regional",
  "Tecnologia",
  "Site Owner",
  "Pontuação UL",
  "m_durations",
  "_duration",
] as const;

export type GisColumn = (typeof GIS_COLUMNS)[number];

export type TipoMassiva =
  | "PRINCIPAL_VTAL"
  | "PRINCIPAL_OEMP"
  | "SECUNDARIO_UF"
  | "SECUNDARIO_NACIONAL";
export type StatusMassiva = "MASSIVA" | "NAO_MASSIVA";
export type Origem = "1_LINK" | "2_LINKS";
export type Classificacao = "VTAL" | "OEMP" | "NAO_IDENTIFICADO";
export type Situacao = "MASSIVA" | "LOTERICA_ISOLADA" | "ISOLADO";

export interface GisRow {
  [key: string]: string | number | null | undefined;
}

export interface ProcessedRow extends GisRow {
  __rowId: string;
  __origem: Origem;
  __tipoLink: "PRINCIPAL" | "SECUNDARIO" | string;
  __uf: string;
  __ts: number;
  __dataHora: string;
  __operadora: string;
  __classificacao: Classificacao;
  __parceira: string;
  __situacao: Situacao;
  /** Distance from epicenter city in km (geo analysis). Null = no coord. */
  __distanciaEpicentroKm?: number | null;
  /** Geo flag for the 60 km radius. */
  __dentro60km?: "SIM" | "NAO" | "SEM_GEO";

  "ID Massiva"?: string | null;
  "Tipo Massiva"?: TipoMassiva | string | null;
  "Status Massiva": StatusMassiva;
  "Quantidade Janela"?: number | null;
  "Primeiro Alarme"?: string | null;
  "Último Alarme"?: string | null;
}

export interface Massiva {
  id_massiva: string;
  tipo_massiva: TipoMassiva;
  tipo_link: "PRINCIPAL" | "SECUNDARIO";
  uf: string;
  operadora: string;
  parceira: string;
  qtd_circuitos: number;
  primeiro_alarme: string;
  ultimo_alarme: string;
  primeiro_ts: number;
  ultimo_ts: number;
  janela_minutos: number;
  rowIds: string[];
  qtd_lotericas_isoladas?: number;
  lotericas_isoladas?: Array<{ codigo: string; loterica: string }>;

  // ----- 60 km informational geo-analysis (does NOT change status) -----
  sinalizacao_60km?: Sinalizacao60km;
  cidade_epicentro?: string;
  uf_epicentro?: string;
  raio_maximo_km?: number;
  percentual_dentro_60km?: number;
  qtd_circuitos_dentro_60km?: number;
  qtd_circuitos_fora_60km?: number;
  qtd_cidades_afetadas?: number;
  cidades_afetadas?: Array<{ cidade: string; uf: string; qtd: number }>;
}
