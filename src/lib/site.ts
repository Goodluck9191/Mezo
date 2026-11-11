export const siteConfig = {
  name: "Mezo",
  description:
    "QR ordering for dine-in restaurants in Tanzania — a QR menu for every table, waiter-controlled sessions, and one clear flow from order to bill.",
  tagline: "SMART DINING. SIMPLE SERVICE.",
} as const;

export const marketingNav = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how-it-works" },
  { label: "For restaurants", href: "#for-restaurants" },
] as const;

export type MarketingNavItem = (typeof marketingNav)[number];
