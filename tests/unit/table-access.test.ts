import { describe, expect, it } from "vitest";

import { buildTableQrUrl, isQrToken } from "@/lib/qr";
import { createTableSchema, qrTokenSchema } from "@/lib/validation/tables";

describe("QR token validation", () => {
  const valid = "a".repeat(64);

  it("accepts a 64-hex lowercase token", () => {
    expect(isQrToken(valid)).toBe(true);
    expect(qrTokenSchema.safeParse(valid).success).toBe(true);
  });

  it.each([
    ["too short", "a".repeat(63)],
    ["too long", "a".repeat(65)],
    ["uppercase hex", "A".repeat(64)],
    ["non-hex", "g".repeat(64)],
    ["empty", ""],
    ["path traversal attempt", "../../etc/passwd"],
    ["url embedded", `https://evil.example/t/${"a".repeat(64)}`],
  ])("rejects %s", (_label, token) => {
    expect(isQrToken(token)).toBe(false);
    expect(qrTokenSchema.safeParse(token).success).toBe(false);
  });
});

describe("buildTableQrUrl", () => {
  const token = "0123456789abcdef".repeat(4);

  it("builds the /t/<token> URL from the configured app origin", () => {
    expect(buildTableQrUrl({ appUrl: "https://mezo.example.com" }, token)).toBe(
      `https://mezo.example.com/t/${token}`,
    );
  });

  it("tolerates a trailing slash in the app URL", () => {
    expect(buildTableQrUrl({ appUrl: "https://mezo.example.com/" }, token)).toBe(
      `https://mezo.example.com/t/${token}`,
    );
  });

  it("refuses to build a URL for an invalid token", () => {
    expect(() => buildTableQrUrl({ appUrl: "https://mezo.example.com" }, "nope")).toThrow(
      /invalid qr token/i,
    );
  });
});

describe("createTableSchema", () => {
  const restaurantId = crypto.randomUUID();

  it("trims and accepts a normal table name", () => {
    const parsed = createTableSchema.safeParse({ restaurantId, name: "  Table 4  " });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.name).toBe("Table 4");
  });

  it("rejects an empty name", () => {
    expect(createTableSchema.safeParse({ restaurantId, name: "   " }).success).toBe(false);
  });

  it("rejects a name longer than 40 characters", () => {
    expect(createTableSchema.safeParse({ restaurantId, name: "t".repeat(41) }).success).toBe(false);
  });

  it("rejects a newline-injected name", () => {
    expect(
      createTableSchema.safeParse({ restaurantId, name: "Table 4\r\nX-Injected: 1" }).success,
    ).toBe(false);
  });

  it("rejects a missing restaurant id", () => {
    expect(createTableSchema.safeParse({ name: "Table 4" }).success).toBe(false);
  });
});
