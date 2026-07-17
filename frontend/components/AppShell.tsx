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
  DotsThreeOutline,
  X,
  type Icon,
} from "@phosphor-icons/react";

type NavItem = { href: string; label: string; short: string; icon: Icon };

const NAV: NavItem[] = [
  { href: "/", label: "Overview", short: "Home", icon: House },
  { href: "/dashboard", label: "Mission Control", short: "Control", icon: Gauge },
  { href: "/survey", label: "Survey & Harvest", short: "Survey", icon: Drone },
  { href: "/map", label: "Digital Twin", short: "Twin", icon: MapTrifold },
  { href: "/robot", label: "Robot Ops", short: "Robot", icon: Robot },
  { href: "/robot/history", label: "Mission History", short: "History", icon: ClockCounterClockwise },
  { href: "/trees", label: "Tree Registry", short: "Trees", icon: Tree },
];

// Mobile: 5 primary destinations in the bottom bar; the rest live in "More".
const MOBILE_PRIMARY = ["/", "/dashboard", "/map", "/robot", "/trees"];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  // close the mobile "More" sheet on navigation
  useEffect(() => setMoreOpen(false), [pathname]);

  const primary = NAV.filter((n) => MOBILE_PRIMARY.includes(n.href));
  const overflow = NAV.filter((n) => !MOBILE_PRIMARY.includes(n.href));
  const overflowActive = overflow.some((n) => isActive(n.href));

  return (
    <div className="shell">
      {/* ── Desktop rail ─────────────────────────────────────────── */}
      <aside className="rail">
        <Link href="/" className="rail-brand" aria-label="Areca — home">
          <span className="rail-brand-mark">ARECA</span>
          <span className="rail-brand-sub">Harvest Intelligence</span>
        </Link>

        <nav className="rail-nav" aria-label="Primary">
          {NAV.map((item) => {
            const IconCmp = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className="rail-link"
                data-active={active ? "true" : undefined}
                aria-current={active ? "page" : undefined}
              >
                <span className="rail-ico" aria-hidden="true">
                  <IconCmp size={19} weight={active ? "fill" : "regular"} />
                </span>
                <span className="rail-label">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="rail-foot">
          <div className="rail-status">
            <span className="dot" aria-hidden="true" />
            <span>All systems online</span>
          </div>
        </div>
      </aside>

      {/* ── Mobile bottom nav ────────────────────────────────────── */}
      <nav className="botnav" aria-label="Primary">
        {primary.map((item) => {
          const IconCmp = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="botnav-link"
              data-active={active ? "true" : undefined}
              aria-current={active ? "page" : undefined}
            >
              <span className="botnav-ico" aria-hidden="true">
                <IconCmp size={22} weight={active ? "fill" : "regular"} />
              </span>
              <span className="botnav-label">{item.short}</span>
            </Link>
          );
        })}
        <button
          type="button"
          className="botnav-link botnav-more"
          data-active={moreOpen || overflowActive ? "true" : undefined}
          aria-label="More destinations"
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen((v) => !v)}
        >
          <span className="botnav-ico" aria-hidden="true">
            <DotsThreeOutline size={22} weight={moreOpen || overflowActive ? "fill" : "regular"} />
          </span>
          <span className="botnav-label">More</span>
        </button>
      </nav>

      {/* ── Mobile "More" sheet ──────────────────────────────────── */}
      {moreOpen && (
        <>
          <div
            className="sheet-scrim"
            onClick={() => setMoreOpen(false)}
            aria-hidden="true"
          />
          <div className="sheet" role="dialog" aria-label="More destinations">
            <div className="sheet-head">
              <span className="sheet-title">More</span>
              <button
                type="button"
                className="sheet-close"
                aria-label="Close"
                onClick={() => setMoreOpen(false)}
              >
                <X size={18} weight="bold" />
              </button>
            </div>
            <nav className="sheet-nav" aria-label="Secondary">
              {overflow.map((item) => {
                const IconCmp = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="sheet-link"
                    data-active={active ? "true" : undefined}
                    aria-current={active ? "page" : undefined}
                  >
                    <span className="sheet-ico" aria-hidden="true">
                      <IconCmp size={20} weight={active ? "fill" : "regular"} />
                    </span>
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </>
      )}

      <main className="content">{children}</main>

      <style jsx global>{`
        .shell {
          min-height: 100vh;
        }

        /* ── Desktop rail ─────────────────────────────────────── */
        .rail {
          position: fixed;
          inset: 0 auto 0 0;
          width: 240px;
          z-index: 60;
          display: flex;
          flex-direction: column;
          padding: 20px 14px 16px;
          background: var(--color-bg-elevated);
          border-right: 1px solid var(--color-line);
        }
        .rail-brand {
          display: flex;
          flex-direction: column;
          gap: 3px;
          padding: 4px 12px 18px;
          margin-bottom: 10px;
          text-decoration: none;
          border-bottom: 1px solid var(--color-line);
        }
        .rail-brand-mark {
          font-family: var(--font-display);
          font-weight: 700;
          font-size: 18px;
          letter-spacing: 0.16em;
          color: var(--color-text);
          line-height: 1;
        }
        .rail-brand-sub {
          font-family: var(--font-mono);
          font-size: 9px;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: var(--color-text-faint);
        }
        .rail-nav {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .rail-link {
          position: relative;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 0 12px;
          min-height: 44px;
          border-radius: 9px;
          text-decoration: none;
          color: var(--color-text-dim);
          font-size: 14px;
          font-weight: 500;
          letter-spacing: 0.005em;
          transition: background 0.15s var(--ease-out),
            color 0.15s var(--ease-out);
        }
        @media (hover: hover) and (pointer: fine) {
          .rail-link:hover {
            background: var(--color-surface-2);
            color: var(--color-text);
          }
          .rail-link:hover .rail-ico {
            color: var(--color-text-dim);
          }
        }
        .rail-link:active {
          transform: scale(0.98);
        }
        .rail-link[data-active="true"] {
          background: var(--color-accent-weak);
          color: var(--color-accent);
          font-weight: 600;
        }
        .rail-link[data-active="true"]::before {
          content: "";
          position: absolute;
          left: 3px;
          top: 50%;
          transform: translateY(-50%);
          width: 3px;
          height: 16px;
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
        .rail-link[data-active="true"] .rail-ico {
          color: var(--color-accent);
        }
        .rail-foot {
          margin-top: auto;
          padding: 14px 12px 2px;
          border-top: 1px solid var(--color-line);
        }
        .rail-status {
          display: flex;
          align-items: center;
          gap: 8px;
          font-family: var(--font-mono);
          font-size: 10.5px;
          letter-spacing: 0.06em;
          color: var(--color-text-dim);
        }
        .rail-status .dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--color-ok);
          flex: none;
        }

        .content {
          margin-left: 240px;
          min-height: 100vh;
        }

        /* ── Mobile ───────────────────────────────────────────── */
        .botnav,
        .sheet,
        .sheet-scrim {
          display: none;
        }

        @media (max-width: 900px) {
          .rail {
            display: none;
          }
          .content {
            margin-left: 0;
            padding-bottom: calc(60px + env(safe-area-inset-bottom));
          }

          .botnav {
            display: grid;
            grid-auto-flow: column;
            grid-auto-columns: 1fr;
            position: fixed;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 70;
            padding-bottom: env(safe-area-inset-bottom);
            background: rgba(255, 255, 255, 0.92);
            border-top: 1px solid var(--color-line);
            backdrop-filter: blur(12px) saturate(140%);
            -webkit-backdrop-filter: blur(12px) saturate(140%);
          }
          .botnav-link {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 3px;
            min-height: 58px;
            padding: 6px 2px;
            border: none;
            background: none;
            cursor: pointer;
            text-decoration: none;
            color: var(--color-text-faint);
            transition: color 0.15s var(--ease-out);
          }
          .botnav-link:active {
            transform: scale(0.96);
          }
          .botnav-link[data-active="true"] {
            color: var(--color-accent);
          }
          .botnav-ico {
            display: grid;
            place-items: center;
          }
          .botnav-label {
            font-size: 10px;
            font-weight: 600;
            letter-spacing: 0.02em;
          }

          .sheet-scrim {
            display: block;
            position: fixed;
            inset: 0;
            z-index: 75;
            background: rgba(29, 38, 27, 0.32);
            animation: scrim-in 0.2s var(--ease-out);
          }
          .sheet {
            display: block;
            position: fixed;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 76;
            padding: 8px 12px calc(16px + env(safe-area-inset-bottom));
            background: var(--color-bg-elevated);
            border-top: 1px solid var(--color-line);
            border-radius: 16px 16px 0 0;
            box-shadow: 0 -12px 32px rgba(29, 38, 27, 0.12);
            animation: sheet-in 0.28s var(--ease-drawer);
          }
          .sheet-head {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 6px 6px 10px;
          }
          .sheet-title {
            font-family: var(--font-mono);
            font-size: 11px;
            letter-spacing: 0.14em;
            text-transform: uppercase;
            color: var(--color-text-faint);
          }
          .sheet-close {
            display: grid;
            place-items: center;
            width: 34px;
            height: 34px;
            border: none;
            border-radius: 50%;
            background: var(--color-surface-2);
            color: var(--color-text-dim);
            cursor: pointer;
          }
          .sheet-nav {
            display: flex;
            flex-direction: column;
            gap: 2px;
          }
          .sheet-link {
            display: flex;
            align-items: center;
            gap: 13px;
            min-height: 52px;
            padding: 0 14px;
            border-radius: 10px;
            text-decoration: none;
            color: var(--color-text-dim);
            font-size: 15px;
            font-weight: 500;
          }
          .sheet-link:active {
            transform: scale(0.99);
          }
          .sheet-link .sheet-ico {
            display: grid;
            place-items: center;
            color: var(--color-text-faint);
          }
          .sheet-link[data-active="true"] {
            background: var(--color-accent-weak);
            color: var(--color-accent);
            font-weight: 600;
          }
          .sheet-link[data-active="true"] .sheet-ico {
            color: var(--color-accent);
          }
        }

        @keyframes scrim-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes sheet-in {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .rail-link,
          .botnav-link,
          .sheet-link {
            transition: none;
          }
          .rail-link:active,
          .botnav-link:active,
          .sheet-link:active {
            transform: none;
          }
          .sheet,
          .sheet-scrim {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
