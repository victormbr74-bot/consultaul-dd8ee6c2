import { normalizeLotericasExportHeader } from "@/lib/lotericasExport";
import { isLinkBackup, type ControleRow } from "@/modules/controle-reparo/lib/processing";
import { normCodigo } from "@/modules/controle-reparo/lib/parse";

type SyncField = "empresa" | "designacao_parceiro" | "novo_circuito" | "responsavel_backup";

export interface ControleLotericasSyncChange {
  field: SyncField;
  before: string | null;
  after: string;
}

export interface ControleLotericasSyncUpdate {
  id: string;
  codigo_loterica: string;
  patch: Partial<Record<SyncField, string>>;
  changes: ControleLotericasSyncChange[];
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const clean = (value: unknown) => String(value ?? "").trim();

const firstFilled = (...values: unknown[]) => {
  for (const value of values) {
    const text = clean(value);
    if (text) return text;
  }
  return "";
};

function getExportValue(row: Record<string, unknown>, ...aliases: string[]) {
  const byKey = new Map<string, unknown>();
  for (const [key, value] of Object.entries(row)) {
    const normalized = normalizeLotericasExportHeader(key);
    if (normalized && !byKey.has(normalized)) byKey.set(normalized, value);
  }

  for (const alias of aliases) {
    const value = byKey.get(normalizeLotericasExportHeader(alias));
    const text = clean(value);
    if (text) return text;
  }
  return "";
}

function buildLotericaLookup(lotericasRows: Record<string, unknown>[]) {
  const lookup = new Map<string, Record<string, unknown>>();

  for (const row of lotericasRows) {
    const code = firstFilled(
      getExportValue(row, "cod_ul", "Codigo UL", "Codigo da Loterica", "Código da Lotérica"),
      row.cod_ul,
    );
    const key = normCodigo(code);
    if (key && !lookup.has(key)) lookup.set(key, row);
  }

  return lookup;
}

function getLotericaSyncValues(row: Record<string, unknown>) {
  return {
    empresa: firstFilled(
      getExportValue(row, "Empresa CEF"),
      getExportValue(row, "EMPRESA OEMP"),
      getExportValue(row, "Operadora"),
    ),
    designacao_parceiro: getExportValue(row, "Circuito OEMP", "CIRCUITO OEMP", "Designacao OEMP", "Designação OEMP"),
    novo_circuito: getExportValue(row, "Designacao Nova", "Designacao Nova", "DESIGINACAO NOVA", "NOVO CIRCUITO"),
    responsavel_backup: getExportValue(row, "OPERADORA 4G", "RESP BACKUP"),
  };
}

export function buildControleLotericasSyncUpdates(
  controleRows: ControleRow[],
  lotericasRows: Record<string, unknown>[],
): ControleLotericasSyncUpdate[] {
  const lotericasByCode = buildLotericaLookup(lotericasRows.map(asRecord));
  const updates: ControleLotericasSyncUpdate[] = [];

  for (const row of controleRows) {
    const id = clean(row.id);
    const codigo = clean(row.codigo_loterica);
    if (!id || !codigo) continue;

    const loterica = lotericasByCode.get(normCodigo(codigo));
    if (!loterica) continue;

    const syncValues = getLotericaSyncValues(loterica);
    const next: Partial<Record<SyncField, string>> = {};

    if (syncValues.empresa) next.empresa = syncValues.empresa;
    if (syncValues.designacao_parceiro) next.designacao_parceiro = syncValues.designacao_parceiro;
    if (syncValues.novo_circuito) next.novo_circuito = syncValues.novo_circuito;
    if (isLinkBackup(row.tipo_link) && syncValues.responsavel_backup) {
      next.responsavel_backup = syncValues.responsavel_backup;
    }

    const changes: ControleLotericasSyncChange[] = [];
    for (const [field, value] of Object.entries(next) as Array<[SyncField, string]>) {
      const before = clean(row[field]);
      if (before !== value) {
        changes.push({
          field,
          before: before || null,
          after: value,
        });
      }
    }

    if (changes.length > 0) {
      updates.push({
        id,
        codigo_loterica: codigo,
        patch: Object.fromEntries(changes.map((change) => [change.field, change.after])),
        changes,
      });
    }
  }

  return updates;
}
