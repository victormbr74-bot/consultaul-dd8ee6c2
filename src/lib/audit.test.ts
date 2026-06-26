import { describe, expect, it } from "vitest";
import { maskSensitiveValues } from "@/lib/audit";
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

  it("detects mobile user agents", () => {
    const metadata = detectClientMetadata(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1",
    );

    expect(metadata.browser).toBe("Safari");
    expect(metadata.os).toBe("iOS");
    expect(metadata.deviceType).toBe("mobile");
  });
});
