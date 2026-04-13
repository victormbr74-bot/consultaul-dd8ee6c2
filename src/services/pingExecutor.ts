import { supabase } from "@/integrations/supabase/client";

export interface PingExecutionRequest {
  tipo_teste: "pingao" | "ping99" | "pingao_nat";
  host_alvo: string;
  tacacs_username: string;
  tacacs_password: string;
  packet_count?: number;
}

export interface PingExecutionResponse {
  success: boolean;
  provider: string;
  status_final: string;
  resultado_bruto: string;
  perda_percentual: number | null;
  tempo_medio: string | null;
  etapa_que_falhou: string | null;
  packets_sent: number | null;
  packets_received: number | null;
}

export type PingFinalStatus =
  | "ONLINE"
  | "ONLINE COM PERDA"
  | "SEM RESPOSTA"
  | "DESTINO INALCANCAVEL"
  | "TIMEOUT"
  | "FALHA DE LOGIN TACACS"
  | "FALHA DE ACESSO AO CONCENTRADOR"
  | "ERRO DE EXECUCAO";

export const STATUS_COLORS: Record<string, string> = {
  ONLINE: "border-green-500/50 bg-green-500/15 text-green-700 dark:text-green-400",
  "ONLINE COM PERDA": "border-orange-500/50 bg-orange-500/15 text-orange-700 dark:text-orange-400",
  "SEM RESPOSTA": "border-red-500/50 bg-red-500/15 text-red-700 dark:text-red-400",
  "DESTINO INALCANCAVEL": "border-red-500/50 bg-red-500/15 text-red-700 dark:text-red-400",
  TIMEOUT: "border-yellow-500/50 bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  "FALHA DE LOGIN TACACS": "border-red-500/50 bg-red-500/15 text-red-700 dark:text-red-400",
  "FALHA DE ACESSO AO CONCENTRADOR": "border-red-500/50 bg-red-500/15 text-red-700 dark:text-red-400",
  "ERRO DE EXECUCAO": "border-red-500/50 bg-red-500/15 text-red-700 dark:text-red-400",
};

export const getStatusColor = (status: string) =>
  STATUS_COLORS[status] ?? "border-muted-foreground/30 bg-muted/20 text-muted-foreground";

export async function executePing(req: PingExecutionRequest): Promise<PingExecutionResponse> {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const url = `https://${projectId}.supabase.co/functions/v1/ping-executor`;

  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Erro ${res.status}: ${text}`);
  }

  return res.json();
}
