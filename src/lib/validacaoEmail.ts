export type ValidationCircuitTarget = "primario" | "secundario";

export interface ValidationFormSource {
  cod_ul?: string | null;
  nome_loterica?: string | null;
  designacao_nova?: string | null;
  ccto_oi?: string | null;
  ccto_oemp?: string | null;
  raw_data?: Record<string, unknown> | null;
}

export interface ValidationEmailRow {
  unidadeLoterico: string;
  designacao: string;
  circuito: string;
  acaoRealizada: string;
  chamado: string;
  chamadoOperadora: string;
  tipoFalha: string;
  status?: string;
}

interface MailtoOptions {
  body: string;
  subject: string;
  to?: string;
}

const asText = (value: unknown) => String(value ?? "").trim();

const firstFilled = (...values: unknown[]) => {
  for (const value of values) {
    const text = asText(value);
    if (text) return text;
  }
  return "";
};

const normalizeHeader = (value: string) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

const getRawByAliases = (raw: Record<string, unknown>, aliases: string[]) => {
  const exact = new Map<string, unknown>();
  const loose = new Map<string, unknown>();

  for (const [key, value] of Object.entries(raw)) {
    const exactKey = key.trim().toUpperCase();
    const looseKey = normalizeHeader(key);

    if (exactKey && !exact.has(exactKey)) exact.set(exactKey, value);
    if (looseKey && !loose.has(looseKey)) loose.set(looseKey, value);
  }

  for (const alias of aliases) {
    const exactHit = exact.get(alias.trim().toUpperCase());
    if (asText(exactHit)) return asText(exactHit);

    const looseHit = loose.get(normalizeHeader(alias));
    if (asText(looseHit)) return asText(looseHit);
  }

  return "";
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const buildMailtoUrl = ({ body, subject, to = "" }: MailtoOptions) => {
  const params: string[] = [];
  if (subject) params.push(`subject=${encodeURIComponent(subject)}`);
  if (body) params.push(`body=${encodeURIComponent(body)}`);
  const query = params.length ? `?${params.join("&")}` : "";
  return `mailto:${encodeURIComponent(to)}${query}`;
};

export const resolveValidationUnidade = (form: ValidationFormSource) => {
  const code = asText(form.cod_ul);
  const name = asText(form.nome_loterica);

  if (code && name) return `${name} (${code})`;
  return name || code || "NAO INFORMADO";
};

export const resolveValidationDesignacao = (
  form: ValidationFormSource,
  target: ValidationCircuitTarget,
) => {
  const raw = form.raw_data && typeof form.raw_data === "object" ? form.raw_data : {};

  if (target === "primario") {
    return firstFilled(
      form.designacao_nova,
      form.ccto_oi,
      getRawByAliases(raw, [
        "DESIGINACAO NOVA",
        "DESIGNACAO NOVA",
        "DESIGNAÇÃO NOVA",
        "DESIGNACAO",
        "DESIGNAÇÃO",
        "DESIGNACAO 1",
        "DESIGNAÇÃO 1",
      ]),
      "NAO INFORMADO",
    );
  }

  return firstFilled(
    form.ccto_oemp,
    getRawByAliases(raw, [
      "CCTO OEMP",
      "CIRCUITO OEMP",
      "CIRCUITO SECUNDARIO",
      "CIRCUITO SECUNDÁRIO",
      "DESIGNACAO 2",
      "DESIGNAÇÃO 2",
      "DESIGNACAO2",
      "DESIGNAÇÃO2",
      "DESIGNACAO SECUNDARIA",
      "DESIGNAÇÃO SECUNDÁRIA",
    ]),
    "NAO INFORMADO",
  );
};

export const buildValidationEmailText = (rows: ValidationEmailRow[]) => {
  const header =
    "Unidade Loterico | Designacao | Primario/Secundario | Acao realizada / Reparo | Chamado SIGSC (REQ) | Chamado Operadora (interno) | Tipo de falha | Status";
  const bodyRows = rows.map((row) =>
    [
      row.unidadeLoterico,
      row.designacao,
      row.circuito,
      row.acaoRealizada,
      row.chamado,
      row.chamadoOperadora,
      row.tipoFalha,
      row.status || "",
    ].join(" | "),
  );

  return [
    "Bom dia, tudo bem?",
    "",
    "Poderiam validar o circuito abaixo, por gentileza:",
    "",
    header,
    ...bodyRows,
  ].join("\n");
};

export const buildValidationHtmlTable = (rows: ValidationEmailRow[]) => {
  const rowHtml = rows
    .map(
      (row) => `<tr>
<td style="border:1px solid #111827;padding:10px;vertical-align:top;">${escapeHtml(row.unidadeLoterico)}</td>
<td style="border:1px solid #111827;padding:10px;vertical-align:top;font-family:Consolas,monospace;">${escapeHtml(row.designacao)}</td>
<td style="border:1px solid #111827;padding:10px;vertical-align:top;">${escapeHtml(row.circuito)}</td>
<td style="border:1px solid #111827;padding:10px;vertical-align:top;">${escapeHtml(row.acaoRealizada)}</td>
<td style="border:1px solid #111827;padding:10px;vertical-align:top;font-family:Consolas,monospace;">${escapeHtml(row.chamado)}</td>
<td style="border:1px solid #111827;padding:10px;vertical-align:top;font-family:Consolas,monospace;">${escapeHtml(row.chamadoOperadora)}</td>
<td style="border:1px solid #111827;padding:10px;vertical-align:top;">${escapeHtml(row.tipoFalha)}</td>
<td style="border:1px solid #111827;padding:10px;vertical-align:top;">${escapeHtml(row.status || "")}</td>
</tr>`,
    )
    .join("");

  return `<div style="font-family:Segoe UI,Arial,sans-serif;color:#111827;font-size:14px;">
<p>Bom dia, tudo bem?</p>
<p>Poderiam validar o circuito abaixo, por gentileza:</p>
<table style="border-collapse:collapse;width:100%;max-width:1180px;">
<thead>
<tr>
<th style="border:1px solid #111827;padding:10px;background:#f3f4f6;text-align:left;">Unidade Loterico</th>
<th style="border:1px solid #111827;padding:10px;background:#f3f4f6;text-align:left;">Designacao</th>
<th style="border:1px solid #111827;padding:10px;background:#f3f4f6;text-align:left;">Primario/Secundario</th>
<th style="border:1px solid #111827;padding:10px;background:#f3f4f6;text-align:left;">Acao realizada / Reparo</th>
<th style="border:1px solid #111827;padding:10px;background:#f3f4f6;text-align:left;">Chamado SIGSC (REQ)</th>
<th style="border:1px solid #111827;padding:10px;background:#f3f4f6;text-align:left;">Chamado Operadora (interno)</th>
<th style="border:1px solid #111827;padding:10px;background:#f3f4f6;text-align:left;">Tipo de falha</th>
<th style="border:1px solid #111827;padding:10px;background:#d1d5db;text-align:left;">Status</th>
</tr>
</thead>
<tbody>${rowHtml}</tbody>
</table>
</div>`;
};
