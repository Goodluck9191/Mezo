/**
 * Shared helpers for the QR table-access feature. Server- and client-safe.
 */

export const QR_TOKEN_PATTERN = /^[0-9a-f]{64}$/;

/** True when `value` is a syntactically valid QR token (two v4 UUIDs hex). */
export function isQrToken(value: string): boolean {
  return QR_TOKEN_PATTERN.test(value);
}

export interface QrBuildConfig {
  /** Canonical application origin, e.g. https://mezo.example.com */
  appUrl: string;
}

/**
 * Builds the absolute customer URL encoded in a table QR code:
 * `${appUrl}/t/<token>`. `appUrl` must not carry a trailing slash.
 */
export function buildTableQrUrl(config: QrBuildConfig, token: string): string {
  if (!isQrToken(token)) {
    throw new Error("Invalid QR token.");
  }

  const origin = config.appUrl.replace(/\/+$/, "");
  return `${origin}/t/${token}`;
}
