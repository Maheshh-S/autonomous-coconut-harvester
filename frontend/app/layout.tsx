import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
    <html lang={locale} className={`${sans.variable} ${mono.variable}`}>
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
