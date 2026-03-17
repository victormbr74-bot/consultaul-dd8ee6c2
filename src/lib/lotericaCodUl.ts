const normalizeText = (value: unknown) => String(value ?? "").trim();

export const extractCodUlDigits = (value: unknown) => normalizeText(value).replace(/\D/g, "");

const hasLetters = (value: string) => /[A-Z]/i.test(value);

const isCodUlLike = (value: string) => {
  const digits = extractCodUlDigits(value);
  return !hasLetters(value) && digits.length > 0 && digits.length <= 9;
};

export const formatCodUlFromDigits = (value: unknown) => {
  const digits = extractCodUlDigits(value);
  if (!digits) return "";
  if (digits.length <= 2) return digits;
  if (digits.length <= 8) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 8)}-${digits.slice(8)}`;
};

export const normalizeCodUlTerm = (value: unknown) => {
  const raw = normalizeText(value).toUpperCase();
  if (!raw || !isCodUlLike(raw)) return raw;
  return formatCodUlFromDigits(raw).toUpperCase();
};

export const buildCodUlExactCandidates = (value: unknown) => {
  const raw = normalizeText(value).toUpperCase();
  const digits = extractCodUlDigits(raw);
  const result = new Set<string>();

  if (raw) result.add(raw);
  if (digits.length === 9) {
    const normalized = normalizeCodUlTerm(raw);
    if (normalized) result.add(normalized);
  }

  return [...result];
};

export const buildCodUlSearchVariants = (value: unknown) => {
  const raw = normalizeText(value);
  const normalized = normalizeCodUlTerm(raw);
  const result = new Set<string>();

  if (raw) result.add(raw);
  if (normalized && normalized.toUpperCase() !== raw.toUpperCase()) {
    result.add(normalized);
  }

  return [...result];
};
