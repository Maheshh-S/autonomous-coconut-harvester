import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import SmoothScroll from "@/components/SmoothScroll";
import AppShell from "@/components/AppShell";

// Single precision-instrument family (docs/design/03 §1.2): Geist for display + UI
// sans, Geist Mono for data/coordinates. No serif, no Inter default.
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
  title: "Areca — Autonomous Coconut Harvesting Platform",
  description:
    "AI-powered precision agriculture. Drone surveying, digital-twin plantation intelligence, and autonomous robotic coconut harvesting in one control system.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <SmoothScroll>
          <AppShell>{children}</AppShell>
        </SmoothScroll>
      </body>
    </html>
  );
}
