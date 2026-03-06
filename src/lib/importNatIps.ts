import { readExcel, sheetToJson } from "@/lib/excelCompat";
import { supabase } from "@/integrations/supabase/client";

const CHUNK_SIZE = 300;

export interface NatImportProgress {
  phase: "reading" | "uploading" | "completed";
  percent: number;
  message: string;
}

export interface NatImportResult {
  updated: number;
  inserted: number;
  errors: number;
  total: number;
}

interface NatRow {
  designation: string;
  ip_nat: string | null;
  ip_wan: string | null;
  ip_lan: string | null;
  cidade: string | null;
  uf: string | null;
}

function normalizeIpCommas(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim().replace(/,/g, ".");
  if (!text) return null;
  const match = text.match(/(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})/);
  if (!match) return null;
  return match.slice(1, 5).map((p) => parseInt(p, 10)).join(".");
}

function asText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const t = String(value).trim();
  return t || null;
}

function pickFirst(row: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(row, key) && row[key] !== null && row[key] !== undefined) {
      const v = String(row[key]).trim();
      if (v) return v;
    }
  }
  // Try normalized (case-insensitive)
  const normalized = new Map<string, unknown>();
  for (const [k, v] of Object.entries(row)) {
    normalized.set(k.toUpperCase().replace(/[^A-Z0-9]/g, ""), v);
  }
  for (const key of keys) {
    const nk = key.toUpperCase().replace(/[^A-Z0-9]/g, "");
    const v = normalized.get(nk);
    if (v !== null && v !== undefined) {
      const s = String(v).trim();
      if (s) return s;
    }
  }
  return undefined;
}

function parseRow(row: Record<string, unknown>): NatRow | null {
  const desig1 = asText(pickFirst(row, ["Designação 1", "Designacao 1", "Designação1", "DESIGNACAO1", "DESIGNAÇÃO 1"]));
  const desig2 = asText(pickFirst(row, ["Designação2", "Designacao2", "DESIGNACAO2", "DESIGNAÇÃO2"]));
  const designation = desig2 || desig1;
  if (!designation) return null;

  const ipNat = normalizeIpCommas(pickFirst(row, ["IP de Gerencia CPE", "IP Gerencia CPE", "IPGERENCIACPE"]));
  const ipWan = normalizeIpCommas(pickFirst(row, ["Ip Wan V4 CPE", "IP WAN V4 CPE", "IPWANV4CPE"]));
  const ipLan = normalizeIpCommas(pickFirst(row, ["IP Lan", "IPLAN"]));
  const cidade = asText(pickFirst(row, ["Nome Localidade", "NOMELOCALIDADE", "Cidade"]));
  const uf = asText(pickFirst(row, ["UF"]));

  if (!ipNat && !ipWan) return null; // Skip rows without any IP

  return { designation, ip_nat: ipNat, ip_wan: ipWan, ip_lan: ipLan, cidade, uf };
}

export async function importNatIpsFile(
  file: File,
  onProgress?: (p: NatImportProgress) => void,
): Promise<NatImportResult> {
  const emit = (p: NatImportProgress) => onProgress?.(p);

  emit({ phase: "reading", percent: 5, message: "Lendo arquivo..." });
  const data = await file.arrayBuffer();
  const wb = await readExcel(data, { type: "array" });

  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error("Planilha vazia.");

  const rawRows = sheetToJson<Record<string, unknown>>(ws, { defval: "", raw: true });
  const natRows = rawRows.map(parseRow).filter(Boolean) as NatRow[];

  if (natRows.length === 0) throw new Error("Nenhum registro válido encontrado na planilha.");

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Sessão inválida. Faça login novamente.");

  emit({ phase: "uploading", percent: 10, message: `Enviando ${natRows.length} registros...` });

  const totalChunks = Math.ceil(natRows.length / CHUNK_SIZE);
  let totalUpdated = 0;
  let totalInserted = 0;
  let totalErrors = 0;

  for (let i = 0; i < totalChunks; i++) {
    const chunk = natRows.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    const res = await supabase.functions.invoke("update-nat-ips", {
      body: { rows: chunk, chunkIndex: i, chunkCount: totalChunks },
      headers: { Authorization: `Bearer ${session.access_token}` },
    });

    if (res.error) throw new Error(res.error.message);

    totalUpdated += Number(res.data?.updated || 0);
    totalInserted += Number(res.data?.inserted || 0);
    totalErrors += Number(res.data?.errors || 0);

    const percent = Math.min(99, Math.round(10 + ((i + 1) / totalChunks) * 89));
    emit({ phase: "uploading", percent, message: `Chunk ${i + 1}/${totalChunks}...` });
  }

  emit({ phase: "completed", percent: 100, message: "Concluído." });
  return { updated: totalUpdated, inserted: totalInserted, errors: totalErrors, total: natRows.length };
}
