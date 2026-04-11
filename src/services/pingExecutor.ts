import { supabase } from "@/integrations/supabase/client";

export type PingTestType = "ping99" | "pingao" | "pingao_nat";

export type PingStatusFinal =
  | "ONLINE"
  | "ONLINE COM PERDA"
  | "SEM RESPOSTA"
  | "DESTINO INALCANÇÁVEL"
  | "TIMEOUT"
  | "FALHA DE LOGIN TACACS"
  | "FALHA DE ACESSO AO CONCENTRADOR"
  | "ERRO DE EXECUÇÃO";

export interface PingStepResult {
  etapa: string;
  status: string;
  duracao_ms?: number;
  erro?: string;
}

export interface PingExecutionResult {
  success: boolean;
  provider: string;
  status_final: PingStatusFinal;
  resultado_bruto: string;
  perda_percentual: number | null;
  tempo_medio: string | null;
  etapa_que_falhou: string | null;
  etapas?: PingStepResult[];
  id?: string;
  timestamp?: string;
}

export interface PingHistoryEntry {
  id: string;
  created_at: string;
  input_term: string;
  page_type: string;
  target: string | null;
  status: string;
  raw_log: string;
  summary_json: {
    perda_percentual?: number | null;
    tempo_medio?: string | null;
    etapa_que_falhou?: string | null;
    etapas?: PingStepResult[];
    provider?: string;
  };
}

const FUNCTION_BASE = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/ping-executor`;

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Usuário não autenticado");
  return {
    Authorization: `Bearer ${session.access_token}`,
    "Content-Type": "application/json",
    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  };
}

export async function executePing(
  tipo_teste: PingTestType,
  host_alvo: string
): Promise<PingExecutionResult> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${FUNCTION_BASE}/run`, {
    method: "POST",
    headers,
    body: JSON.stringify({ tipo_teste, host_alvo }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: "Erro desconhecido" }));
    throw new Error(err.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function fetchPingHistory(
  pageType?: PingTestType,
  limit = 50
): Promise<PingHistoryEntry[]> {
  const headers = await getAuthHeaders();
  const params = new URLSearchParams({ limit: String(limit) });
  if (pageType) params.set("page_type", pageType);

  const response = await fetch(`${FUNCTION_BASE}/history?${params}`, {
    headers,
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

export async function checkPingHealth(): Promise<Record<string, unknown>> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${FUNCTION_BASE}/health`, { headers });
  return response.json();
}

export const STATUS_COLORS: Record<string, string> = {
  ONLINE: "border-green-500/50 bg-green-500/15 text-green-700 dark:text-green-400",
  "ONLINE COM PERDA": "border-orange-500/50 bg-orange-500/15 text-orange-700 dark:text-orange-400",
  "SEM RESPOSTA": "border-red-500/50 bg-red-500/15 text-red-700 dark:text-red-400",
  "DESTINO INALCANÇÁVEL": "border-red-500/50 bg-red-500/15 text-red-700 dark:text-red-400",
  TIMEOUT: "border-amber-500/50 bg-amber-500/15 text-amber-700 dark:text-amber-400",
  "FALHA DE LOGIN TACACS": "border-purple-500/50 bg-purple-500/15 text-purple-700 dark:text-purple-400",
  "FALHA DE ACESSO AO CONCENTRADOR": "border-purple-500/50 bg-purple-500/15 text-purple-700 dark:text-purple-400",
  "ERRO DE EXECUÇÃO": "border-red-500/50 bg-red-500/15 text-red-700 dark:text-red-400",
};

export const STEP_LABELS: Record<string, string> = {
  ssh_connect: "Conexão SSH",
  tacacs_login: "Login TACACS",
  telnet_connect: "Conexão Telnet",
  concentrator_login: "Login Concentrador",
  ping_execute: "Execução do Ping",
  session_close: "Encerramento",
  global_timeout: "Timeout Global",
};
