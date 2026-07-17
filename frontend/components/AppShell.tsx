"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  House,
  Gauge,
  Drone,
  MapTrifold,
  Robot,
  ClockCounterClockwise,
  Tree,
  type Icon,
} from "@phosphor-icons/react";

const NAV: { href: string; label: string; short: string; icon: Icon }[] = [
  { href: "/", label: "Overview", short: "Home", icon: House },
  { href: "/dashboard", label: "Mission Control", short: "Control", icon: Gauge },
  { href: "/survey", label: "Survey & Harvest", short: "Survey", icon: Drone },
  { href: "/map", label: "Digital Twin", short: "Twin", icon: MapTrifold },
  { href: "/robot", label: "Robot Ops", short: "Robot", icon: Robot },
  { href: "/robot/history", label: "Mission History", short: "History", icon: ClockCounterClockwise },
  { href: "/trees", label: "Tree Registry", short: "Trees", icon: Tree },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // close mobile nav on route change
  useEffect(() => setMobileOpen(false), [pathname]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <div className="shell">
      {/* Desktop rail — clean, minimal, no logo */}
      <aside className="rail">
        <nav className="rail-nav" aria-label="Primary">
          <span className="rail-section">Menu</span>
          {NAV.map((item) => {
            const IconCmp = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rail-link ${isActive(item.href) ? "active" : ""}`}
                aria-current={isActive(item.href) ? "page" : undefined}
              >
                <span className="rail-ico" aria-hidden="true">
                  <IconCmp size={20} weight="regular" />
                </span>
                <span className="rail-label">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="rail-foot">
          <div className="rail-status">
            <span className="dot" style={{ background: "var(--color-ok)" }} />
            <span>System Online</span>
          </div>
          <span className="rail-ver">v3.8 · Control Build</span>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="topbar">
        <span className="topbar-brand">Areca</span>
        <button
          className="topbar-burger"
          aria-label="Toggle navigation"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((v) => !v)}
        >
          {mobileOpen ? "✕" : "≡"}
        </button>
      </header>

      {mobileOpen && (
        <nav className="mobnav" aria-label="Primary mobile">
          {NAV.map((item) => {
            const IconCmp = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`mobnav-link ${isActive(item.href) ? "active" : ""}`}
              >
                <span aria-hidden="true"><IconCmp size={20} weight="regular" /></span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      )}

      <main className="content">{children}</main>

      <style jsx>{`
        .shell {
          min-height: 100vh;
        }
        .rail {
          position: fixed;
          top: 0;
          left: 0;
          bottom: 0;
          width: 248px;
          z-index: 60;
          display: flex;
          flex-direction: column;
          padding: 26px 16px 18px;
          background: var(--color-bg-elevated);
          border-right: 1px solid var(--color-line);
        }
        .rail-nav {
          display: flex;
          flex-direction: column;
          gap: 3px;
          margin-top: 6px;
        }
        .rail-section {
          font-family: var(--font-mono);
          font-size: 10px;
          letter-spacing: 0.24em;
          text-transform: uppercase;
          color: var(--color-text-faint);
          padding: 0 14px 12px;
        }
        .rail-link {
          position: relative;
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 12px 14px;
          min-height: 46px;
          border-radius: 12px;
          text-decoration: none;
          color: var(--color-text-dim);
          font-size: 14.5px;
          font-weight: 500;
          letter-spacing: 0.01em;
          transition: background 0.2s, color 0.2s;
        }
        .rail-link:hover {
          background: var(--color-surface-2);
          color: var(--color-text);
        }
        .rail-link.active {
          background: var(--color-accent-weak);
          color: var(--color-accent);
          font-weight: 600;
        }
        .rail-ico {
          width: 20px;
          display: grid;
          place-items: center;
          color: var(--color-text-faint);
          flex: none;
        }
        .rail-link.active .rail-ico {
          color: var(--color-accent);
        }
        .rail-link:hover .rail-ico {
          color: var(--color-text-dim);
        }
        .rail-foot {
          margin-top: auto;
          padding: 14px 12px 4px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .rail-status {
          display: flex;
          align-items: center;
          gap: 9px;
          font-family: var(--font-mono);
          font-size: 11px;
          letter-spacing: 0.08em;
          color: var(--color-text-dim);
        }
        .rail-ver {
          font-family: var(--font-mono);
          font-size: 10px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--color-text-faint);
        }
        .content {
          margin-left: 248px;
          min-height: 100vh;
        }

        .topbar,
        .mobnav {
          display: none;
        }

        @media (max-width: 900px) {
          .rail {
            display: none;
          }
          .content {
            margin-left: 0;
            padding-top: 56px;
          }
          .topbar {
            display: flex;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            height: 56px;
            z-index: 70;
            align-items: center;
            justify-content: space-between;
            padding: 0 18px;
            background: rgba(255, 255, 255, 0.92);
            border-bottom: 1px solid var(--color-line);
            backdrop-filter: blur(10px);
          }
          .topbar-brand {
            font-family: var(--font-display);
            font-weight: 700;
            letter-spacing: 0.04em;
            font-size: 17px;
            color: var(--color-text);
            text-decoration: none;
          }
          .topbar-burger {
            background: none;
            border: none;
            color: var(--color-text);
            font-size: 22px;
            cursor: pointer;
          }
          .mobnav {
            display: flex;
            flex-direction: column;
            position: fixed;
            top: 56px;
            left: 0;
            right: 0;
            z-index: 69;
            background: var(--color-bg-elevated);
            border-bottom: 1px solid var(--color-line);
            padding: 8px;
            gap: 2px;
          }
          .mobnav-link {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 14px 14px;
            border-radius: 10px;
            color: var(--color-text-dim);
            text-decoration: none;
            font-size: 15px;
          }
          .mobnav-link.active {
            background: var(--color-accent-weak);
            color: var(--color-accent);
          }
        }
      `}</style>
    </div>
  );
}
