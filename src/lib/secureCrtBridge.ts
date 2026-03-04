const BRIDGE_URL_STORAGE_KEY = "lvh:securecrt-bridge-url";
const DEFAULT_BRIDGE_URL = "http://127.0.0.1:48365/api/securecrt/execute";

export interface SecureCrtExecutePayload {
  commands: string;
  source: string;
  captureOutput?: boolean;
  captureWaitMs?: number;
  delayMs?: number;
}

export interface SecureCrtExecuteResult {
  ok: boolean;
  message: string;
  output?: string;
}

const normalizeEndpoint = (value: string) => value.trim().replace(/\/+$/, "");

export const getSecureCrtBridgeUrl = () => {
  const fromEnv = (import.meta.env.VITE_SECURECRT_BRIDGE_URL as string | undefined) || "";

  try {
    const stored = localStorage.getItem(BRIDGE_URL_STORAGE_KEY) || "";
    return normalizeEndpoint(stored || fromEnv || DEFAULT_BRIDGE_URL);
  } catch {
    return normalizeEndpoint(fromEnv || DEFAULT_BRIDGE_URL);
  }
};

export const setSecureCrtBridgeUrl = (url: string) => {
  const normalized = normalizeEndpoint(url);
  try {
    localStorage.setItem(BRIDGE_URL_STORAGE_KEY, normalized);
  } catch {
    // ignore storage failures
  }
  return normalized;
};

export const executeSecureCrtCommands = async (
  payload: SecureCrtExecutePayload,
): Promise<SecureCrtExecuteResult> => {
  const endpoint = getSecureCrtBridgeUrl();

  if (!payload.commands.trim()) {
    return { ok: false, message: "Nenhum comando para enviar ao SecureCRT." };
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        ok: false,
        message: String(result?.message || `Falha ao enviar para o SecureCRT (HTTP ${response.status}).`),
      };
    }

    return {
      ok: true,
      message: String(result?.message || "Comandos enviados ao SecureCRT."),
      output: typeof result?.output === "string" ? result.output : undefined,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        "Nao foi possivel conectar ao bridge local do SecureCRT. Inicie o helper em localhost:48365 e tente novamente.",
    };
  }
};
