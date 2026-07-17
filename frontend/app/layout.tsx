import type { Metadata } from "next";
import { Space_Grotesk, Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import SmoothScroll from "@/components/SmoothScroll";
import AppShell from "@/components/AppShell";

const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});
const sans = Inter({
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
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body>
        <SmoothScroll>
          <AppShell>{children}</AppShell>
        </SmoothScroll>
      </body>
    </html>
  );
}
