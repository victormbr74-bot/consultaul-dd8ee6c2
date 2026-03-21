export const COMPLETE_ROUTER_SCRIPT_VARIANT = "completo" as const;
export const EXTRACTABLE_ROUTER_SCRIPT_PARTIAL_VARIANTS = ["bgp", "nqa"] as const;

export type ExtractableRouterScriptVariant = (typeof EXTRACTABLE_ROUTER_SCRIPT_PARTIAL_VARIANTS)[number];
export type RouterScriptVariant = string;
export type RouterScriptMode = "completo" | "parcial";

const BUILTIN_ROUTER_SCRIPT_VARIANT_LABELS: Record<string, string> = {
  [COMPLETE_ROUTER_SCRIPT_VARIANT]: "Completo",
  bgp: "Parcial BGP",
  nqa: "Parcial NQA",
};

export const normalizeRouterScriptVariantValue = (value: unknown): RouterScriptVariant => {
  const normalized = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || COMPLETE_ROUTER_SCRIPT_VARIANT;
};

export const isCompleteRouterScriptVariant = (value: unknown) =>
  normalizeRouterScriptVariantValue(value) === COMPLETE_ROUTER_SCRIPT_VARIANT;

export const isExtractableRouterScriptVariant = (value: unknown): value is ExtractableRouterScriptVariant => {
  const normalized = normalizeRouterScriptVariantValue(value);
  return EXTRACTABLE_ROUTER_SCRIPT_PARTIAL_VARIANTS.some((variant) => variant === normalized);
};

const toTitleCase = (value: string) =>
  value
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");

export const getRouterScriptVariantLabel = (value: unknown) => {
  const normalized = normalizeRouterScriptVariantValue(value);
  if (BUILTIN_ROUTER_SCRIPT_VARIANT_LABELS[normalized]) {
    return BUILTIN_ROUTER_SCRIPT_VARIANT_LABELS[normalized];
  }

  return `Parcial ${toTitleCase(normalized.replace(/-/g, " "))}`;
};

export const ROUTER_SCRIPT_VARIANT_LABELS: Record<ExtractableRouterScriptVariant | typeof COMPLETE_ROUTER_SCRIPT_VARIANT, string> = {
  [COMPLETE_ROUTER_SCRIPT_VARIANT]: getRouterScriptVariantLabel(COMPLETE_ROUTER_SCRIPT_VARIANT),
  bgp: getRouterScriptVariantLabel("bgp"),
  nqa: getRouterScriptVariantLabel("nqa"),
};

const BGP_PREFIX_PATTERN = /^\s*ip\s+(?:ip-prefix|prefix-list)\s+(?:OUT_TO_BB|LAN_TFL|ROTAS_DC|STATIC_TO_BGP)\b/i;
const BGP_ROUTE_MAP_PATTERN = /^\s*route-map\s+(?:OUT_TO_BB|LAN_TFL|ROTAS_DC)\b/i;
const NQA_ENTRY_PATTERN = /^\s*nqa\s+(?:test-instance|entry)\b/i;
const NQA_SCHEDULE_PATTERN = /^\s*nqa\s+schedule\b/i;
const NQA_SERVER_PATTERN = /^\s*nqa\s+server\s+enable\b/i;
const IP_SLA_BLOCK_PATTERN = /^\s*ip\s+sla\s+\d+\b/i;
const IP_SLA_SCHEDULE_PATTERN = /^\s*ip\s+sla\s+schedule\b/i;
const TRACK_IP_SLA_PATTERN = /^\s*track\s+\d+\s+ip\s+sla\s+\d+\s+reachability\b/i;

const normalizeScript = (script: string) => script.replace(/\r\n/g, "\n");

const trimBlankEdges = (lines: string[]) => {
  let start = 0;
  let end = lines.length;

  while (start < end && !lines[start].trim()) start += 1;
  while (end > start && !lines[end - 1].trim()) end -= 1;

  return lines.slice(start, end);
};

const joinSegments = (segments: string[]) => {
  const sanitized = segments.map((segment) => segment.trim()).filter(Boolean);
  return sanitized.join("\n#\n");
};

const isTopLevelLine = (line: string) => Boolean(line.trim()) && !/^\s/.test(line);

const collectIndentedBlock = (lines: string[], startIndex: number) => {
  const block: string[] = [];
  let index = startIndex;

  while (index < lines.length) {
    const line = lines[index];

    if (index > startIndex && isTopLevelLine(line)) {
      break;
    }

    block.push(line);
    index += 1;
  }

  return {
    nextIndex: index,
    text: trimBlankEdges(block).join("\n"),
  };
};

const collectMatchingRun = (lines: string[], startIndex: number, predicate: (line: string) => boolean) => {
  const block: string[] = [];
  let index = startIndex;

  while (index < lines.length && predicate(lines[index])) {
    block.push(lines[index]);
    index += 1;
  }

  return {
    nextIndex: index,
    text: trimBlankEdges(block).join("\n"),
  };
};

const isBgpBlockStart = (lines: string[], index: number) => {
  const currentLine = lines[index]?.trim() || "";
  const nextLine = lines[index + 1]?.trim() || "";

  if (/^router\s+bgp\s+\d+/i.test(currentLine)) return true;
  if (/^bgp\s+\d+/i.test(currentLine)) return true;
  return /^\d+$/.test(currentLine) && /^router-id\b/i.test(nextLine);
};

export const extractRouterScriptVariant = (script: string, variant: RouterScriptVariant) => {
  const normalizedVariant = normalizeRouterScriptVariantValue(variant);
  const normalizedScript = normalizeScript(script).trim();
  if (!normalizedScript) return "";
  if (normalizedVariant === COMPLETE_ROUTER_SCRIPT_VARIANT) return normalizedScript;
  if (!isExtractableRouterScriptVariant(normalizedVariant)) return "";

  const lines = normalizedScript.split("\n");
  const segments: string[] = [];

  for (let index = 0; index < lines.length; ) {
    const line = lines[index];

    if (normalizedVariant === "bgp") {
      if (isBgpBlockStart(lines, index)) {
        const block = collectIndentedBlock(lines, index);
        if (block.text) segments.push(block.text);
        index = block.nextIndex;
        continue;
      }

      if (BGP_ROUTE_MAP_PATTERN.test(line)) {
        const block = collectIndentedBlock(lines, index);
        if (block.text) segments.push(block.text);
        index = block.nextIndex;
        continue;
      }

      if (/^\s*route-policy\s+OUT_TO_BB\b/i.test(line)) {
        const block = collectIndentedBlock(lines, index);
        if (block.text) segments.push(block.text);
        index = block.nextIndex;
        continue;
      }

      if (BGP_PREFIX_PATTERN.test(line)) {
        const block = collectMatchingRun(lines, index, (candidate) => BGP_PREFIX_PATTERN.test(candidate));
        if (block.text) segments.push(block.text);
        index = block.nextIndex;
        continue;
      }
    }

    if (normalizedVariant === "nqa") {
      if (NQA_ENTRY_PATTERN.test(line)) {
        const block = collectIndentedBlock(lines, index);
        if (block.text) segments.push(block.text);
        index = block.nextIndex;
        continue;
      }

      if (NQA_SCHEDULE_PATTERN.test(line)) {
        const block = collectMatchingRun(lines, index, (candidate) => NQA_SCHEDULE_PATTERN.test(candidate));
        if (block.text) segments.push(block.text);
        index = block.nextIndex;
        continue;
      }

      if (NQA_SERVER_PATTERN.test(line)) {
        segments.push(line.trimEnd());
        index += 1;
        continue;
      }

      if (IP_SLA_BLOCK_PATTERN.test(line)) {
        const block = collectIndentedBlock(lines, index);
        if (block.text) segments.push(block.text);
        index = block.nextIndex;
        continue;
      }

      if (IP_SLA_SCHEDULE_PATTERN.test(line)) {
        const block = collectMatchingRun(lines, index, (candidate) => IP_SLA_SCHEDULE_PATTERN.test(candidate));
        if (block.text) segments.push(block.text);
        index = block.nextIndex;
        continue;
      }

      if (TRACK_IP_SLA_PATTERN.test(line)) {
        const block = collectMatchingRun(lines, index, (candidate) => TRACK_IP_SLA_PATTERN.test(candidate));
        if (block.text) segments.push(block.text);
        index = block.nextIndex;
        continue;
      }
    }

    index += 1;
  }

  return joinSegments(segments);
};
