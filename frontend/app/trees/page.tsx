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
        <h1 className="font-display" style={{ fontSize: 36, fontWeight: 700, margin: "8px 0 16px" }}>Trees</h1>
        <p style={{ color: "var(--color-text-dim)" }}>Loading…</p>
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
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ background: "var(--color-surface-2)", textAlign: "left" }}>
                <Th>ID</Th>
                <Th>Latitude</Th>
                <Th>Longitude</Th>
                <Th>Coconuts</Th>
                <Th>Tasks</Th>
                <Th>Open</Th>
              </tr>
            </thead>
            <tbody>
              {trees.map((t: TreeSummary) => (
                <tr key={t.tree_id} style={{ borderTop: "1px solid var(--color-line)" }}>
                  <Td style={{ fontWeight: 600 }}>#{t.tree_id}</Td>
                  <Td style={{ color: "var(--color-text-dim)" }}>{t.gps_lat}</Td>
                  <Td style={{ color: "var(--color-text-dim)" }}>{t.gps_lon}</Td>
                  <Td>{t.coconuts_detected}</Td>
                  <Td>
                    <span
                      style={{
                        padding: "2px 10px",
                        borderRadius: 99,
                        fontSize: 12,
                        fontWeight: 600,
                        color: t.tasks_remaining > 0 ? "#f5c451" : "#4fe39a",
                        background: t.tasks_remaining > 0 ? "rgba(245,196,81,0.14)" : "rgba(79,227,154,0.14)",
                        border: `1px solid ${t.tasks_remaining > 0 ? "rgba(245,196,81,0.4)" : "rgba(79,227,154,0.4)"}`,
                      }}
                    >
                      {t.tasks_remaining}
                    </span>
                  </Td>
                  <Td>
                    <Link
                      href={`/trees/${t.tree_id}`}
                      style={{ color: "var(--color-accent)", textDecoration: "none", fontWeight: 600, borderBottom: "1px solid var(--color-accent-dim)" }}
                    >
                      Open →
                    </Link>
                  </Td>
                </tr>
              ))}
              {trees.length === 0 && (
                <tr>
                  <Td colSpan={6} style={{ color: "var(--color-text-dim)", padding: 24 }}>
                    No trees registered yet.
                  </Td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th style={{ padding: "12px 16px", fontWeight: 600, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-text-faint)" }}>{children}</th>
  )
}
function Td({ children, style, colSpan }: { children: React.ReactNode; style?: React.CSSProperties; colSpan?: number }) {
  return <td colSpan={colSpan} style={{ padding: "12px 16px", verticalAlign: "middle", ...style }}>{children}</td>
}
