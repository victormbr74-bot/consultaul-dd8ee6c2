const normalizeText = (value: unknown) => String(value ?? "").trim();

const compactCircuitTerm = (value: unknown) => normalizeText(value).replace(/\s+/g, "");

export const buildCircuitSearchVariants = (value: unknown) => {
  const raw = normalizeText(value);
  const compact = compactCircuitTerm(raw);
  const result = new Set<string>();

  if (raw) result.add(raw);
  if (compact && compact !== raw) result.add(compact);

  return [...result];
};

export const buildCircuitExactCandidates = (value: unknown) => {
  const result = new Set<string>();

  for (const variant of buildCircuitSearchVariants(value)) {
    if (!variant) continue;
    result.add(variant);
    result.add(variant.toUpperCase());
  }

  return [...result];
};
