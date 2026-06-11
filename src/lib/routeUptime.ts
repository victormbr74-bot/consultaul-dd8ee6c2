// Utilities to parse Cisco IOS route uptime (last field of `sh ip route` line)
// and convert it into an absolute date relative to "now".

export interface ParsedUptime {
  raw: string;
  totalSeconds: number;
}

const UNIT_SECONDS: Record<string, number> = {
  y: 365 * 24 * 3600,
  w: 7 * 24 * 3600,
  d: 24 * 3600,
  h: 3600,
  m: 60,
  s: 1,
};

/**
 * Parses Cisco uptime strings:
 *   - "HH:MM:SS"            (e.g. "19:27:32")
 *   - "1w2d", "2d05h"       (composite units)
 *   - "1y10w", "00:00:45"
 * Returns total seconds, or null if not recognized.
 */
export const parseRouteUptime = (raw: string): ParsedUptime | null => {
  const text = String(raw ?? "").trim();
  if (!text) return null;

  const hms = text.match(/^(\d{1,3}):(\d{2}):(\d{2})$/);
  if (hms) {
    const h = Number(hms[1]);
    const m = Number(hms[2]);
    const s = Number(hms[3]);
    return { raw: text, totalSeconds: h * 3600 + m * 60 + s };
  }

  // Composite like "1w2d", "2d05h", "1y10w", "5h12m"
  const composite = text.match(/^(\d+[ywdhms])+$/i);
  if (composite) {
    let total = 0;
    const re = /(\d+)([ywdhms])/gi;
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      const value = Number(match[1]);
      const unit = match[2].toLowerCase();
      total += value * (UNIT_SECONDS[unit] ?? 0);
    }
    if (total > 0) return { raw: text, totalSeconds: total };
  }

  return null;
};

const pad2 = (n: number) => String(n).padStart(2, "0");

export const formatDateTime = (date: Date): string => {
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()} ${pad2(
    date.getHours(),
  )}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
};

/**
 * Given an uptime string and a "now" reference, returns the absolute date
 * when the route was installed.
 */
export const uptimeToDate = (raw: string, now: Date = new Date()): Date | null => {
  const parsed = parseRouteUptime(raw);
  if (!parsed) return null;
  return new Date(now.getTime() - parsed.totalSeconds * 1000);
};
