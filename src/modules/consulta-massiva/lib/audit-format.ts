// Friendly action labels and descriptions for the auditoria log.
export const ACTION_LABELS: Record<string, string> = {
  LOGIN: "Login",
  LOGOUT: "Logout",
  UPLOAD_GIS: "Upload de GIS",
  EXECUTAR_ANALISE: "Análise executada",
  INSERT_OPERADORA: "Operadora cadastrada",
  UPDATE_OPERADORA: "Operadora alterada",
  DELETE_OPERADORA: "Operadora removida",
  IMPORT_OPERADORAS: "Operadoras importadas",
  INSERT_ESCALONAMENTO: "Escalonamento cadastrado",
  UPDATE_ESCALONAMENTO: "Escalonamento atualizado",
  DELETE_ESCALONAMENTO: "Escalonamento removido",
  IMPORT_ESCALONAMENTOS: "Escalonamentos importados",
  CREATE_USER: "Usuário criado",
  UPDATE_USER: "Usuário atualizado",
  DELETE_USER: "Usuário removido",
};

export function formatAction(acao: string): string {
  return ACTION_LABELS[acao] ?? acao;
}

type Detalhes = Record<string, unknown> | null | undefined;

function n(v: unknown): number | null {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "" && !isNaN(Number(v))) return Number(v);
  return null;
}
function s(v: unknown): string | null {
  if (v == null) return null;
  const str = String(v).trim();
  return str || null;
}

export function formatDetalhes(acao: string, d: Detalhes, entidade?: string | null): string {
  if (!d || typeof d !== "object") {
    // fallback per action
    switch (acao) {
      case "LOGIN": return "Login realizado com sucesso.";
      case "LOGOUT": return "Logout realizado.";
      default: return "—";
    }
  }
  const det = d as Record<string, unknown>;
  switch (acao) {
    case "LOGIN": return "Login realizado com sucesso.";
    case "LOGOUT": return "Logout realizado.";
    case "EXECUTAR_ANALISE": {
      const reg = n(det.registros);
      const mas = n(det.massivas);
      const parts: string[] = ["Análise executada."];
      if (reg != null) parts.push(`${reg.toLocaleString("pt-BR")} registros processados.`);
      if (mas != null) parts.push(`${mas} massivas identificadas.`);
      return parts.join(" ");
    }
    case "UPLOAD_GIS": {
      const arq = s(det.arquivo);
      const ln = n(det.linhas);
      const origem = s(entidade) ?? "";
      const parts: string[] = [];
      parts.push(`Arquivo GIS importado${origem ? ` (${origem})` : ""}.`);
      if (arq) parts.push(arq);
      if (ln != null) parts.push(`${ln.toLocaleString("pt-BR")} registros carregados.`);
      return parts.join(" ");
    }
    case "INSERT_OPERADORA": {
      const op = s(det.operadora);
      return op ? `Operadora cadastrada: ${op}.` : "Operadora cadastrada.";
    }
    case "UPDATE_OPERADORA": return "Operadora alterada.";
    case "DELETE_OPERADORA": return "Operadora removida.";
    case "IMPORT_OPERADORAS": {
      const tot = n(det.total);
      const arq = s(det.arquivo);
      const parts = ["Importação de operadoras concluída."];
      if (tot != null) parts.push(`${tot.toLocaleString("pt-BR")} registros.`);
      if (arq) parts.push(`Arquivo: ${arq}.`);
      return parts.join(" ");
    }
    case "INSERT_ESCALONAMENTO": {
      const op = s(det.operadora);
      return op ? `Escalonamento cadastrado para ${op}.` : "Escalonamento cadastrado.";
    }
    case "UPDATE_ESCALONAMENTO": {
      const op = s(det.operadora);
      return op ? `Escalonamento atualizado para ${op}.` : "Escalonamento atualizado.";
    }
    case "DELETE_ESCALONAMENTO": return "Escalonamento removido.";
    case "CREATE_USER": {
      const em = s(det.email);
      const role = s(det.role);
      return `Usuário ${em ?? ""} criado${role ? ` como ${role}` : ""}.`.replace("  ", " ").trim();
    }
    default: {
      // Generic key=value join
      const parts = Object.entries(det)
        .filter(([, v]) => v != null && v !== "")
        .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`);
      return parts.length ? parts.join(" · ") : "—";
    }
  }
}
