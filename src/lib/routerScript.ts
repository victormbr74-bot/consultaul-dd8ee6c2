export type RouterScriptVariant = "completo" | "bgp" | "nqa";

export const ROUTER_SCRIPT_VARIANT_LABELS: Record<RouterScriptVariant, string> = {
  completo: "Completo",
  bgp: "Parcial BGP",
  nqa: "Parcial NQA",
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
  const normalizedScript = normalizeScript(script).trim();
  if (!normalizedScript) return "";
  if (variant === "completo") return normalizedScript;

  const lines = normalizedScript.split("\n");
  const segments: string[] = [];

  for (let index = 0; index < lines.length; ) {
    const line = lines[index];

    if (variant === "bgp") {
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

    if (variant === "nqa") {
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
