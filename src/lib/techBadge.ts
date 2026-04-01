/**
 * Shared utility for technology-specific badge colors.
 * Used across PingaoTab, ConsultaMassaTab, LotericaDetail, etc.
 */

const normalize = (value: unknown): string =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();

export type TechProfile =
  | "vsat"
  | "4g"
  | "brisanet"
  | "fibra"
  | "radio"
  | "satelite"
  | "primario"
  | "secundario"
  | "unknown";

/**
 * Detect the technology profile from a free-text technology string.
 */
export const detectTechProfile = (tech: unknown): TechProfile => {
  const text = normalize(tech);
  if (!text || text === "-" || text === "N/A") return "unknown";

  if (text.includes("VSAT")) return "vsat";
  if (text.includes("SATELITE") || text.includes("SATELLITE")) return "satelite";
  if (
    text.includes("4G") ||
    text.includes("ARQIA") ||
    text.includes("TIM") ||
    text.includes("VIVO") ||
    text.includes("CLARO")
  )
    return "4g";
  if (text.includes("BRISANET")) return "brisanet";
  if (text.includes("FIBRA") || text.includes("GPON") || text.includes("FTTH") || text.includes("MPLS"))
    return "fibra";
  if (text.includes("RADIO")) return "radio";
  if (text.includes("PRIMARIO")) return "primario";
  if (text.includes("SECUNDARIO")) return "secundario";

  return "unknown";
};

/**
 * Returns Tailwind classes for a technology badge (border + bg + text).
 */
export const techBadgeClass = (tech: unknown): string => {
  const profile = detectTechProfile(tech);

  switch (profile) {
    case "vsat":
      return "border-fuchsia-500/50 bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300";
    case "satelite":
      return "border-purple-500/50 bg-purple-500/15 text-purple-700 dark:text-purple-300";
    case "4g":
      return "border-emerald-500/50 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
    case "brisanet":
      return "border-cyan-500/50 bg-cyan-500/15 text-cyan-700 dark:text-cyan-300";
    case "fibra":
      return "border-sky-500/50 bg-sky-500/15 text-sky-700 dark:text-sky-300";
    case "radio":
      return "border-amber-500/50 bg-amber-500/15 text-amber-700 dark:text-amber-300";
    case "primario":
      return "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300";
    case "secundario":
      return "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300";
    default:
      return "border-muted-foreground/30 bg-muted/20 text-muted-foreground";
  }
};
