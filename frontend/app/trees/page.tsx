"use client"

import { useState, useEffect } from "react"
import { getTreesSummary } from "@/lib/api/detection"
import Link from "next/link"
import AmbientClip from "@/components/AmbientClip"

type TreeSummary = {
  tree_id: number
  gps_lat: number
  gps_lon: number
  coconuts_detected: number
  tasks_remaining: number
}

export default function TreesPage() {
  const [trees, setTrees] = useState<TreeSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const data: TreeSummary[] = await getTreesSummary()
        setTrees(data)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div style={{ padding: "28px clamp(16px, 4vw, 48px) 56px", maxWidth: 1500, margin: "0 auto" }}>
        <div className="kicker">Inventory</div>
        <h1 className="font-display" style={{ fontSize: 36, fontWeight: 700, margin: "8px 0 16px", letterSpacing: "-0.03em" }}>Tree Registry</h1>
        <div className="panel" style={{ overflow: "hidden" }}>
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              style={{
                height: 48,
                borderTop: i === 0 ? "none" : "1px solid var(--color-line)",
                background: "var(--color-surface-2)",
                opacity: 0.5,
                animation: "pulse 1.4s ease-in-out infinite",
                animationDelay: `${i * 0.08}s`,
              }}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: "28px clamp(16px, 4vw, 48px) 56px", maxWidth: 1500, margin: "0 auto" }}>
      <header
        style={{
          position: "relative",
          marginBottom: 24,
          borderRadius: 16,
          overflow: "hidden",
          border: "1px solid var(--color-line)",
          padding: "30px clamp(20px,3vw,40px)",
        }}
      >
        <AmbientClip src="/clips/7.mp4" opacity={0.18} />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(90deg, rgba(14,18,13,0.84), rgba(14,18,13,0.45) 55%, transparent), radial-gradient(120% 140% at 0% 0%, rgba(14,18,13,0.5), transparent)",
            pointerEvents: "none",
          }}
        />
        <div style={{ position: "relative", zIndex: 2 }}>
          <div className="kicker">Inventory</div>
          <h1 className="font-display" style={{ fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 700, margin: "8px 0 4px", letterSpacing: "-0.03em" }}>
            Permanent <span className="lede-accent">Tree Registry</span>
          </h1>
          <p style={{ color: "var(--color-text-dim)", margin: 0, maxWidth: 680 }}>
            Every permanent tree the platform has resolved from drone surveys, with
            its GPS fix, detected coconuts, and remaining harvest tasks.
          </p>
        </div>
      </header>

      <div className="panel" style={{ overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table className="tree-table">
            <thead>
              <tr>
                <Th>ID</Th>
                <Th align="right">Latitude</Th>
                <Th align="right">Longitude</Th>
                <Th align="right">Coconuts</Th>
                <Th align="right">Tasks</Th>
                <Th align="right">Open</Th>
              </tr>
            </thead>
            <tbody>
              {trees.map((t: TreeSummary) => (
                <tr key={t.tree_id}>
                  <Td className="tab" style={{ fontWeight: 600, fontFamily: "var(--font-mono)" }}>#{t.tree_id}</Td>
                  <Td align="right" className="tab" style={{ color: "var(--color-text-dim)", fontFamily: "var(--font-mono)", fontSize: 13 }}>{t.gps_lat.toFixed(6)}</Td>
                  <Td align="right" className="tab" style={{ color: "var(--color-text-dim)", fontFamily: "var(--font-mono)", fontSize: 13 }}>{t.gps_lon.toFixed(6)}</Td>
                  <Td align="right" className="tab" style={{ fontWeight: 600 }}>{t.coconuts_detected}</Td>
                  <Td align="right">
                    <span className={`task-pill ${t.tasks_remaining > 0 ? "pending" : "done"}`}>
                      {t.tasks_remaining > 0 ? t.tasks_remaining : "Clear"}
                    </span>
                  </Td>
                  <Td align="right">
                    <Link href={`/trees/${t.tree_id}`} className="tree-open">
                      Open →
                    </Link>
                  </Td>
                </tr>
              ))}
              {trees.length === 0 && (
                <tr>
                  <Td colSpan={6} style={{ padding: 0 }}>
                    <div className="tree-empty">
                      <div className="tree-empty-title">No trees registered yet</div>
                      <p className="tree-empty-sub">
                        Run a drone survey to resolve permanent trees. They will appear
                        here with GPS fixes and harvest tasks.
                      </p>
                    </div>
                  </Td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <style jsx>{`
        .tree-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
        }
        .tree-table thead tr {
          background: var(--color-surface-2);
        }
        .tree-table tbody tr {
          border-top: 1px solid var(--color-line);
          transition: background 0.14s var(--ease-out);
        }
        .tree-table tbody tr:hover {
          background: var(--color-surface-sunken);
        }
        .tree-table :global(td.tab) {
          font-variant-numeric: tabular-nums;
        }
        .task-pill {
          display: inline-flex;
          align-items: center;
          padding: 2px 11px;
          border-radius: 99px;
          font-size: 12px;
          font-weight: 600;
          font-variant-numeric: tabular-nums;
          border: 1px solid;
        }
        .task-pill.pending {
          color: var(--color-gold-dim);
          background: rgba(201, 138, 46, 0.12);
          border-color: rgba(201, 138, 46, 0.32);
        }
        .task-pill.done {
          color: var(--color-accent);
          background: var(--color-accent-weak);
          border-color: var(--color-accent-dim);
        }
        .tree-open {
          color: var(--color-accent);
          text-decoration: none;
          font-weight: 600;
          border-bottom: 1px solid transparent;
          transition: border-color 0.16s var(--ease-out);
        }
        .tree-open:hover {
          border-bottom-color: var(--color-accent-dim);
        }
        .tree-empty {
          padding: 48px 24px;
          text-align: center;
        }
        .tree-empty-title {
          font-family: var(--font-display);
          font-size: 17px;
          font-weight: 600;
          color: var(--color-text);
        }
        .tree-empty-sub {
          margin: 8px auto 0;
          max-width: 380px;
          color: var(--color-text-dim);
          font-size: 13.5px;
          line-height: 1.5;
        }
      `}</style>
    </div>
  )
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th style={{ padding: "12px 16px", fontWeight: 600, fontSize: 11.5, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-text-faint)", textAlign: align }}>{children}</th>
  )
}
function Td({ children, style, colSpan, align = "left", className }: { children: React.ReactNode; style?: React.CSSProperties; colSpan?: number; align?: "left" | "right"; className?: string }) {
  return <td colSpan={colSpan} className={className} style={{ padding: "13px 16px", verticalAlign: "middle", textAlign: align, ...style }}>{children}</td>
}
