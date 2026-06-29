import { describe, expect, it } from "vitest";
import { maskSensitiveValues, shouldPersistAuditEvent } from "@/lib/audit";
import { detectClientMetadata } from "@/lib/clientMetadata";

describe("audit helpers", () => {
  it("masks sensitive keys recursively", () => {
    expect(
      maskSensitiveValues({
        user: "418118",
        password: "secret",
        nested: {
          token: "abc",
          value: "ok",
        },
      }),
    ).toEqual({
      user: "418118",
      password: "[REDACTED]",
      nested: {
        token: "[REDACTED]",
        value: "ok",
      },
    });
  });

  it("persists only download/export audit events from the client logger", () => {
    expect(shouldPersistAuditEvent("export_performed")).toBe(true);
    expect(shouldPersistAuditEvent("audit_logs_exported")).toBe(true);
    expect(shouldPersistAuditEvent("MASCARA_PDF_GERADA")).toBe(true);
    expect(shouldPersistAuditEvent("login_success")).toBe(false);
    expect(shouldPersistAuditEvent("terms_accepted")).toBe(false);
    expect(shouldPersistAuditEvent("navigate")).toBe(false);
  });

  it("detects mobile user agents", () => {
    const metadata = detectClientMetadata(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1",
    );

    expect(metadata.browser).toBe("Safari");
    expect(metadata.os).toBe("iOS");
    expect(metadata.deviceType).toBe("mobile");
  });
});
