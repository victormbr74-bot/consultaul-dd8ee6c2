// DB row shapes (mirror Supabase tables)
export interface DbOperadora {
  id: string;
  designacao: string;
  ip_loopback: string;
  ip_loopback_secundario: string;
  operadora: string;
  tipo_empresa: "VTAL" | "OEMP";
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface DbEscalonamento {
  id: string;
  operadora: string;
  n1_nome: string; n1_telefone: string; n1_email: string;
  n2_nome: string; n2_telefone: string; n2_email: string;
  n3_nome: string; n3_telefone: string; n3_email: string;
  n4_nome: string; n4_telefone: string; n4_email: string;
  observacao: string;
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface DbProfile {
  id: string;
  user_id: string;
  email: string;
  nome: string | null;
  ativo: boolean;
  created_at: string;
}

export type AppRole = "ADMIN" | "OPERADOR";

export interface DbAuditoria {
  id: string;
  user_id: string | null;
  user_email: string | null;
  acao: string;
  entidade: string | null;
  detalhes: Record<string, unknown> | null;
  created_at: string;
}
