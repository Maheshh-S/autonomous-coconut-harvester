import type { Metadata } from "next";
import {
  Geist,
  Geist_Mono,
  Noto_Sans_Devanagari,
  Noto_Sans_Tamil,
  Noto_Sans_Telugu,
  Noto_Sans_Kannada,
  Noto_Sans_Malayalam,
} from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import "./globals.css";
import SmoothScroll from "@/components/SmoothScroll";
import AppShell from "@/components/AppShell";

// Single precision-instrument family: Geist for display + UI sans, Geist Mono for
// data/coordinates. No serif, no Inter default.
const sans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});
const mono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});
// V5.0 — Indic fallbacks (Geist ships latin only). One Noto Sans per script;
// the browser picks per-glyph automatically, and next/font unicode-range
// subsetting means only the script in use is ever downloaded. Hindi + Marathi
// share Devanagari.
const deva = Noto_Sans_Devanagari({ weight: ["400", "600", "700"], display: "swap", variable: "--font-deva" });
const tamil = Noto_Sans_Tamil({ weight: ["400", "600", "700"], display: "swap", variable: "--font-tamil" });
const telugu = Noto_Sans_Telugu({ weight: ["400", "600", "700"], display: "swap", variable: "--font-telugu" });
const kannada = Noto_Sans_Kannada({ weight: ["400", "600", "700"], display: "swap", variable: "--font-kannada" });
const malayalam = Noto_Sans_Malayalam({ weight: ["400", "600", "700"], display: "swap", variable: "--font-malayalam" });

const indicClass = `${deva.variable} ${tamil.variable} ${telugu.variable} ${kannada.variable} ${malayalam.variable}`;

export const metadata: Metadata = {
  title: "Veraxis — Autonomous Coconut Harvesting Platform",
  description:
    "AI-powered precision agriculture. Drone surveying, digital-twin plantation intelligence, and autonomous robotic coconut harvesting in one control system.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // next-intl (V5.0): locale resolves server-side from the `locale` cookie
  // (i18n/request.ts, fallback en-IN). Passed explicitly so client components
  // share one locale + catalog. Note: reading the cookie opts this layout into
  // dynamic rendering — accepted: every page is live data over Neon polling.
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html lang={locale} className={`${sans.variable} ${mono.variable} ${indicClass}`}>
      <body>
        <NextIntlClientProvider
          locale={locale}
          messages={messages}
          timeZone="Asia/Kolkata"
        >
          <SmoothScroll>
            <AppShell>{children}</AppShell>
          </SmoothScroll>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
