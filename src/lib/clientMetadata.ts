export type DeviceType = "desktop" | "mobile" | "tablet" | "unknown";

export type ClientMetadata = {
  userAgent: string;
  browser: string;
  os: string;
  deviceType: DeviceType;
};

export function detectClientMetadata(userAgent = navigator.userAgent): ClientMetadata {
  const ua = userAgent || "";
  const lower = ua.toLowerCase();

  const browser =
    lower.includes("edg/")
      ? "Microsoft Edge"
      : lower.includes("opr/") || lower.includes("opera")
        ? "Opera"
        : lower.includes("chrome/")
          ? "Chrome"
          : lower.includes("firefox/")
            ? "Firefox"
            : lower.includes("safari/")
              ? "Safari"
              : "Desconhecido";

  const os =
    lower.includes("windows")
      ? "Windows"
      : lower.includes("android")
        ? "Android"
        : lower.includes("iphone") || lower.includes("ipad") || lower.includes("ios")
          ? "iOS"
          : lower.includes("mac os") || lower.includes("macintosh")
            ? "macOS"
            : lower.includes("linux")
              ? "Linux"
              : "Desconhecido";

  const deviceType: DeviceType =
    lower.includes("ipad") || lower.includes("tablet")
      ? "tablet"
      : lower.includes("mobi") || lower.includes("iphone") || lower.includes("android")
        ? "mobile"
        : ua
          ? "desktop"
          : "unknown";

  return { userAgent: ua, browser, os, deviceType };
}
