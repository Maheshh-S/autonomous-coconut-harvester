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
      {/* Desktop rail — wordmark identity, clean nav */}
      <aside className="rail">
        <Link href="/" className="rail-brand" aria-label="Areca — home">
          <span className="rail-brand-mark">ARECA</span>
          <span className="rail-brand-sub">Harvest Intelligence</span>
        </Link>
        <nav className="rail-nav" aria-label="Primary">
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
            <span className="dot dot-live" style={{ background: "var(--color-ok)" }} />
            <span>All systems online</span>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="topbar">
        <Link
          href="/"
          className="topbar-brand"
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            letterSpacing: "0.14em",
            fontSize: 16,
            color: "var(--color-text)",
            textDecoration: "none",
          }}
        >
          ARECA
        </Link>
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
          padding: 22px 16px 18px;
          background: var(--color-bg-elevated);
          border-right: 1px solid var(--color-line);
        }
        .rail-brand {
          display: flex;
          flex-direction: column;
          gap: 2px;
          padding: 6px 14px 20px;
          margin-bottom: 8px;
          text-decoration: none;
          border-bottom: 1px solid var(--color-line);
        }
        .rail-brand-mark {
          font-family: var(--font-display);
          font-weight: 700;
          font-size: 19px;
          letter-spacing: 0.14em;
          color: var(--color-text);
          line-height: 1;
        }
        .rail-brand-sub {
          font-family: var(--font-mono);
          font-size: 9.5px;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: var(--color-text-faint);
        }
        .rail-nav {
          display: flex;
          flex-direction: column;
          gap: 3px;
          margin-top: 6px;
        }
        .rail-link {
          position: relative;
          display: flex;
          align-items: center;
          gap: 13px;
          padding: 12px 14px;
          min-height: 44px;
          border-radius: 10px;
          text-decoration: none;
          color: var(--color-text-dim);
          font-size: 14px;
          font-weight: 500;
          letter-spacing: 0.005em;
          transition: background 0.18s var(--ease-out), color 0.18s var(--ease-out);
        }
        .rail-link:active {
          transform: scale(0.985);
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
        .rail-link.active::before {
          content: "";
          position: absolute;
          left: 4px;
          top: 50%;
          transform: translateY(-50%);
          width: 3px;
          height: 18px;
          border-radius: 99px;
          background: var(--color-accent);
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
          border-top: 1px solid var(--color-line);
        }
        .rail-status {
          display: flex;
          align-items: center;
          gap: 9px;
          font-family: var(--font-mono);
          font-size: 11px;
          letter-spacing: 0.06em;
          color: var(--color-text-dim);
        }
        .dot-live {
          box-shadow: 0 0 0 0 var(--color-accent-glow);
          animation: dot-pulse 2.4s var(--ease-out) infinite;
        }
        @keyframes dot-pulse {
          0% { box-shadow: 0 0 0 0 rgba(79, 138, 61, 0.35); }
          70% { box-shadow: 0 0 0 6px rgba(79, 138, 61, 0); }
          100% { box-shadow: 0 0 0 0 rgba(79, 138, 61, 0); }
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
            letter-spacing: 0.14em;
            font-size: 16px;
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
