"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  getRobotRuns,
  type RobotRun,
  type RunStatus,
} from "@/lib/api/detection"
import AmbientClip from "@/components/AmbientClip"

const statusColor: Record<RunStatus, string> = {
  COMPLETED: "#4fe39a",
  ABORTED: "#f5c451",
  FAILED: "#ff6b5e",
}

function fmtDuration(s: number | null) {
  if (s == null) return "—"
  const m = Math.floor(s / 60)
  const sec = Math.round(s % 60)
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`
}

function fmtTime(iso: string | null) {
  if (!iso) return "—"
  const d = new Date(iso)
  return d.toLocaleString()
}

const STATUS_LABEL: Record<RunStatus, string> = {
  COMPLETED: "Completed",
  ABORTED: "Aborted",
  FAILED: "Failed",
}

type SortKey = "finished_at" | "mission_score" | "harvested_trees" | "duration_s"

export default function MissionHistoryPage() {
  const [runs, setRuns] = useState<RobotRun[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>("finished_at")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")

  useEffect(() => {
    setLoading(true)
    getRobotRuns(200)
      .then((d) => setRuns(d))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  const sorted = useMemo(() => {
    const arr = [...runs]
    arr.sort((a, b) => {
      let av: number | string
      let bv: number | string
      if (sortKey === "finished_at") {
        av = a.finished_at ?? ""
        bv = b.finished_at ?? ""
      } else if (sortKey === "mission_score") {
        av = a.mission_score ?? -1
        bv = b.mission_score ?? -1
      } else if (sortKey === "harvested_trees") {
        av = a.harvested_trees
        bv = b.harvested_trees
      } else {
        av = a.duration_s ?? -1
        bv = b.duration_s ?? -1
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1
      if (av > bv) return sortDir === "asc" ? 1 : -1
      return 0
    })
    return arr
  }, [runs, sortKey, sortDir])

  function toggleSort(k: SortKey) {
    if (k === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(k)
      setSortDir("desc")
    }
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
        <AmbientClip src="/clips/6.mp4" opacity={0.2} />
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
          <div className="kicker">Analytics</div>
          <h1
            className="font-display"
            style={{ fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 700, margin: "8px 0 4px", letterSpacing: "-0.03em" }}
          >
            Mission <span className="lede-accent">History &amp; Analytics</span>
          </h1>
          <p style={{ color: "var(--color-text-dim)", margin: 0, maxWidth: 680 }}>
            Every completed robot run, with the backend-computed summary, score, and
            per-tree activity. All metrics are derived server-side.
          </p>
        </div>
      </header>

      {loading && <p style={{ color: "var(--color-text-dim)" }}>Loading runs…</p>}
      {error && <p style={{ color: "var(--color-crit)" }}>{error}</p>}
      {!loading && !error && runs.length === 0 && (
        <div className="panel-2" style={{ padding: 24, color: "var(--color-text-dim)" }}>
          No runs yet. Start a robot simulation from the{" "}
          <Link href="/robot" style={{ color: "var(--color-accent)", textDecoration: "none", borderBottom: "1px solid var(--color-accent-dim)" }}>
            Robot
          </Link>{" "}
          page to record one.
        </div>
      )}

      {sorted.length > 0 && (
        <div className="panel" style={{ overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ background: "var(--color-surface-2)", textAlign: "left" }}>
                  <Th>#</Th>
                  <Th>Status</Th>
                  <Th>Mission</Th>
                  <Th>Finished</Th>
                  <Th sortable onClick={() => toggleSort("duration_s")}>
                    Duration {sortKey === "duration_s" ? arrow(sortDir) : ""}
                  </Th>
                  <Th sortable onClick={() => toggleSort("harvested_trees")}>
                    Harvested {sortKey === "harvested_trees" ? arrow(sortDir) : ""}
                  </Th>
                  <Th>Battery used</Th>
                  <Th>Distance</Th>
                  <Th sortable onClick={() => toggleSort("mission_score")}>
                    Score {sortKey === "mission_score" ? arrow(sortDir) : ""}
                  </Th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => (
                  <tr key={r.id} style={{ borderTop: "1px solid var(--color-line)" }}>
                    <Td>
                      <Link
                        href={`/robot/history/${r.id}`}
                        style={{ color: "var(--color-accent)", textDecoration: "none", fontWeight: 600, borderBottom: "1px solid var(--color-accent-dim)" }}
                      >
                        {r.id}
                      </Link>
                    </Td>
                    <Td>
                      <span style={statusPill(statusColor[r.status])}>
                        {STATUS_LABEL[r.status]}
                      </span>
                    </Td>
                    <Td>{r.mission_id ?? "—"}</Td>
                    <Td style={{ color: "var(--color-text-dim)" }}>{fmtTime(r.finished_at)}</Td>
                    <Td>{fmtDuration(r.duration_s)}</Td>
                    <Td>
                      {r.harvested_trees}/{r.total_trees}
                    </Td>
                    <Td>{r.battery_used_pct}%</Td>
                    <Td>{r.distance_travelled} m</Td>
                    <Td style={{ fontWeight: 700, color: "var(--color-accent-bright)" }}>
                      {r.mission_score ?? "—"}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function Th({
  children,
  sortable,
  onClick,
}: {
  children: React.ReactNode
  sortable?: boolean
  onClick?: () => void
}) {
  return (
    <th
      onClick={onClick}
      style={{
        padding: "12px 16px",
        fontWeight: 600,
        fontSize: 12,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        color: "var(--color-text-faint)",
        cursor: sortable ? "pointer" : "default",
        userSelect: sortable ? "none" : "auto",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  )
}

function Td({
  children,
  style,
}: {
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  return (
    <td style={{ padding: "12px 16px", verticalAlign: "middle", ...style }}>{children}</td>
  )
}

function statusPill(color: string): React.CSSProperties {
  return {
    display: "inline-block",
    padding: "3px 10px",
    borderRadius: 99,
    color,
    background: "color-mix(in srgb, " + color + " 16%, transparent)",
    border: "1px solid color-mix(in srgb, " + color + " 40%, transparent)",
    fontSize: 12,
    fontWeight: 600,
  }
}

function arrow(dir: "asc" | "desc") {
  return dir === "asc" ? "▲" : "▼"
}
