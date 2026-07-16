"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  getRobotRuns,
  type RobotRun,
  type RunStatus,
} from "@/lib/api/detection"

const statusColor: Record<RunStatus, string> = {
  COMPLETED: "#22c55e",
  ABORTED: "#f59e0b",
  FAILED: "#ef4444",
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
    <div style={{ padding: 24, color: "#111" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
        Mission History &amp; Analytics
      </h1>
      <p style={{ color: "#555", marginTop: 0, marginBottom: 16 }}>
        Every completed robot run, with the backend-computed summary, score, and
        per-tree activity. All metrics are derived server-side.
      </p>

      {loading && <p>Loading runs…</p>}
      {error && <p style={{ color: "#ef4444" }}>{error}</p>}
      {!loading && !error && runs.length === 0 && (
        <p style={{ color: "#666" }}>
          No runs yet. Start a robot simulation from the{" "}
          <Link href="/robot">Robot</Link> page to record one.
        </p>
      )}

      {sorted.length > 0 && (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            background: "white",
            fontSize: 14,
          }}
        >
          <thead>
            <tr style={{ background: "#f3f4f6", textAlign: "left" }}>
              <th style={th}>#</th>
              <th style={th}>Status</th>
              <th style={th}>Mission</th>
              <th style={th}>Finished</th>
              <th
                style={{ ...th, cursor: "pointer" }}
                onClick={() => toggleSort("duration_s")}
              >
                Duration {sortKey === "duration_s" ? arrow() : ""}
              </th>
              <th
                style={{ ...th, cursor: "pointer" }}
                onClick={() => toggleSort("harvested_trees")}
              >
                Harvested {sortKey === "harvested_trees" ? arrow() : ""}
              </th>
              <th style={th}>Battery used</th>
              <th style={th}>Distance</th>
              <th
                style={{ ...th, cursor: "pointer" }}
                onClick={() => toggleSort("mission_score")}
              >
                Score {sortKey === "mission_score" ? arrow() : ""}
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr
                key={r.id}
                style={{ borderTop: "1px solid #eee" }}
              >
                <td style={td}>
                  <Link
                    href={`/robot/history/${r.id}`}
                    style={{ color: "#2563eb", textDecoration: "underline" }}
                  >
                    {r.id}
                  </Link>
                </td>
                <td style={td}>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "2px 8px",
                      borderRadius: 12,
                      color: "white",
                      background: statusColor[r.status],
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {r.status}
                  </span>
                </td>
                <td style={td}>{r.mission_id ?? "—"}</td>
                <td style={td}>{fmtTime(r.finished_at)}</td>
                <td style={td}>{fmtDuration(r.duration_s)}</td>
                <td style={td}>
                  {r.harvested_trees}/{r.total_trees}
                </td>
                <td style={td}>{r.battery_used_pct}%</td>
                <td style={td}>{r.distance_travelled} m</td>
                <td style={{ ...td, fontWeight: 700 }}>
                  {r.mission_score ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

const th: React.CSSProperties = {
  padding: "8px 12px",
  fontWeight: 600,
  fontSize: 13,
}
const td: React.CSSProperties = {
  padding: "8px 12px",
  verticalAlign: "middle",
}

function arrow() {
  return "▼"
}
