import "server-only";

import QRCode from "qrcode";

/**
 * Renders a QR code SVG and wraps it in a data URL so the browser can display
 * it and offer it as a one-click download. SVG keeps the printed code crisp at
 * any size; nothing is uploaded anywhere.
 */
export async function qrSvgDataUrl(url: string): Promise<string> {
  const svg = await QRCode.toString(url, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 2,
    // Colours come from the printed medium (white page), not the theme.
    color: { dark: "#111111", light: "#ffffff" },
  });

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
