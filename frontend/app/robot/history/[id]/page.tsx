"use client"

import { useEffect, useState, use } from "react"
import Link from "next/link"
import {
  getRobotRun,
  getRobotRunTimeline,
  getRobotRunTreeActivity,
  getRobotRunLog,
  type RobotRun,
  type RunStatus,
  type ScoreBreakdown,
  type TimelineEntry,
  type TreeActivity,
  type RobotLogEntry,
  type LogSeverity,
} from "@/lib/api/detection"

const statusColor: Record<RunStatus, string> = {
  COMPLETED: "#22c55e",
  ABORTED: "#f59e0b",
  FAILED: "#ef4444",
}

const tabNames = ["summary", "timeline", "tree-activity", "robot-log"] as const
type Tab = (typeof tabNames)[number]

const SEVERITY: Record<LogSeverity, { color: string }> = {
  INFO: { color: "#38bdf8" },
  WARNING: { color: "#f59e0b" },
  ERROR: { color: "#ef4444" },
}

// The four transparent score factors shown to the user (backend-derived order).
const SCORE_FACTORS: { key: keyof ScoreBreakdown; label: string }[] = [
  { key: "completion", label: "Completion" },
  { key: "battery_economy", label: "Battery Efficiency" },
  { key: "safe_return", label: "Safe Return" },
  { key: "error_free", label: "Error Free" },
]

function fmtDuration(s: number | null) {
  if (s == null) return "—"
  const m = Math.floor(s / 60)
  const sec = Math.round(s % 60)
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`
}

function fmtTime(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleString()
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      style={{
        background: "#f9fafb",
        border: "1px solid #eef2f7",
        borderRadius: 8,
        padding: "12px 14px",
      }}
    >
      <div style={{ fontSize: 12, color: "#6b7280" }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>{value}</div>
    </div>
  )
}

export default function RunDetailPage({
  params,
}: {
  // Next 16 — route params are async; unwrap with React.use().
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const runId = Number(id)
  const [run, setRun] = useState<RobotRun | null>(null)
  const [timeline, setTimeline] = useState<TimelineEntry[]>([])
  const [trees, setTrees] = useState<TreeActivity[]>([])
  const [log, setLog] = useState<RobotLogEntry[]>([])
  const [tab, setTab] = useState<Tab>("summary")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    Promise.all([
      getRobotRun(runId),
      getRobotRunTimeline(runId),
      getRobotRunTreeActivity(runId),
      getRobotRunLog(runId),
    ])
      .then(([r, tl, tr, lg]) => {
        if (!active) return
        setRun(r)
        setTimeline(tl)
        setTrees(tr)
        setLog(lg)
      })
      .catch((e) => active && setError(String(e)))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [runId])

  if (loading) return <div style={page}>Loading run {runId}…</div>
  if (error) return <div style={{ ...page, color: "#ef4444" }}>{error}</div>
  if (!run) return <div style={page}>Run not found.</div>

  return (
    <div style={page}>
      <div style={{ marginBottom: 12 }}>
        <Link href="/robot/history" style={{ color: "#2563eb" }}>
          ← Back to Mission History
        </Link>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 4,
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
          Run #{run.id}
        </h1>
        <span
          style={{
            padding: "3px 10px",
            borderRadius: 14,
            color: "white",
            background: statusColor[run.status],
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {run.status}
        </span>
      </div>
      <p style={{ color: "#555", marginTop: 4 }}>
        Mission {run.mission_id ?? "—"} · finished {fmtTime(run.finished_at)} ·
        speed ×{run.speed_factor ?? 1}
      </p>

      <div style={{ display: "flex", gap: 8, margin: "16px 0" }}>
        {tabNames.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              border: "1px solid #d1d5db",
              background: tab === t ? "#111827" : "white",
              color: tab === t ? "white" : "#111",
              fontSize: 13,
              cursor: "pointer",
              textTransform: "capitalize",
            }}
          >
            {t.replace("-", " ")}
          </button>
        ))}
      </div>

      {tab === "summary" && (
        <div>
          <ScoreBlock run={run} />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
              gap: 12,
              margin: "16px 0",
            }}
          >
            <Metric
              label="Harvested / Total"
              value={`${run.harvested_trees}/${run.total_trees}`}
            />
            <Metric label="Skipped" value={run.skipped_trees} />
            <Metric label="Duration" value={fmtDuration(run.duration_s)} />
            <Metric label="Distance" value={`${run.distance_travelled} m`} />
            <Metric label="Battery used" value={`${run.battery_used_pct}%`} />
            <Metric label="Recharges" value={run.recharge_count} />
            <Metric
              label="Avg harvest time"
              value={run.avg_harvest_time_s != null ? `${run.avg_harvest_time_s}s` : "—"}
            />
            <Metric
              label="Fastest / Slowest"
              value={
                run.fastest_harvest_s != null && run.slowest_harvest_s != null
                  ? `${run.fastest_harvest_s}s / ${run.slowest_harvest_s}s`
                  : "—"
              }
            />
            <Metric
              label="Avg speed"
              value={run.avg_speed != null ? `${run.avg_speed}` : "—"}
            />
            <Metric label="Idle time" value={`${run.idle_time_s}s`} />
            <Metric
              label="Efficiency"
              value={run.efficiency != null ? `${run.efficiency}` : "—"}
            />
          </div>
          <div style={{ color: "#666", fontSize: 13 }}>
            Started {fmtTime(run.started_at)} · finished {fmtTime(run.finished_at)}
          </div>
        </div>
      )}

      {tab === "timeline" && (
        <ol style={{ paddingLeft: 0, listStyle: "none", margin: 0 }}>
          {timeline.length === 0 && <li style={{ color: "#666" }}>No events.</li>}
          {timeline.map((e) => (
            <li
              key={e.key}
              style={{
                display: "flex",
                gap: 12,
                padding: "10px 0",
                borderBottom: "1px solid #f0f0f0",
              }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: e.color,
                  marginTop: 6,
                  flexShrink: 0,
                }}
              />
              <div>
                <div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                  <span>{e.title}</span>
                  {e.tree_id != null && e.title !== "Travelled" ? (
                    <span style={{ fontWeight: 400, color: "#3b82f6" }}>#{e.tree_id}</span>
                  ) : null}
                  {e.distance_m != null ? (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: "#475569",
                        background: "#f1f5f9",
                        borderRadius: 10,
                        padding: "1px 8px",
                      }}
                    >
                      {e.distance_m} m
                    </span>
                  ) : null}
                </div>
                <div style={{ color: "#666", fontSize: 13 }}>
                  {e.description} · sim t={e.sim_time}s
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      {tab === "tree-activity" && (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ background: "#f3f4f6", textAlign: "left" }}>
              <Th>Tree</Th>
              <Th>Result</Th>
              <Th>Visit (sim t)</Th>
              <Th>Harvest time</Th>
              <Th>Battery</Th>
              <Th>Inventory</Th>
            </tr>
          </thead>
          <tbody>
            {trees.length === 0 && (
              <tr>
                <Td colSpan={6} style={{ color: "#666" }}>
                  No trees visited.
                </Td>
              </tr>
            )}
            {trees.map((t) => (
              <tr key={t.tree_id} style={{ borderTop: "1px solid #eee" }}>
                <Td>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <Link
                      href={`/trees/${t.tree_id}`}
                      style={{ color: "#2563eb", textDecoration: "underline" }}
                    >
                      #{t.tree_id}
                      {t.tree_code ? ` (${t.tree_code})` : ""}
                    </Link>
                    <span style={{ display: "inline-flex", gap: 6 }}>
                      <a
                        href={`/trees/${t.tree_id}`}
                        style={actionLink("#2563eb")}
                      >
                        Open Tree
                      </a>
                      <a
                        href={`/map?tree=${t.tree_id}`}
                        style={actionLink("#16a34a")}
                      >
                        Open Digital Twin
                      </a>
                    </span>
                  </div>
                </Td>
                <Td>
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: 10,
                      fontSize: 12,
                      color: "white",
                      background:
                        t.harvest_result === "harvested" ? "#22c55e" : "#9ca3af",
                    }}
                  >
                    {t.harvest_result}
                  </span>
                </Td>
                <Td>{t.visit_time != null ? `${t.visit_time}s` : "—"}</Td>
                <Td>{t.harvest_duration_s != null ? `${t.harvest_duration_s}s` : "—"}</Td>
                <Td>
                  {t.battery_at_visit != null ? `${t.battery_at_visit}%` : "—"}
                </Td>
                <Td>{t.inventory_collected ?? "—"}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {tab === "robot-log" && (
        <div
          style={{
            fontFamily: "monospace",
            fontSize: 13,
            background: "#0f172a",
            color: "#e2e8f0",
            borderRadius: 8,
            padding: 12,
            maxHeight: 480,
            overflow: "auto",
          }}
        >
          {log.length === 0 && <div style={{ color: "#94a3b8" }}>No events.</div>}
          {log.map((e) => {
            const sev = SEVERITY[e.severity] ?? SEVERITY.INFO
            return (
              <div
                key={e.id}
                style={{
                  padding: "3px 0",
                  borderLeft: `3px solid ${sev.color}`,
                  paddingLeft: 8,
                  marginBottom: 2,
                }}
              >
                <span
                  style={{
                    color: sev.color,
                    fontWeight: 700,
                    fontSize: 11,
                    marginRight: 8,
                  }}
                >
                  {e.severity}
                </span>
                <span style={{ color: "#38bdf8" }}>{e.event_type}</span>{" "}
                <span style={{ color: "#94a3b8" }}>t={e.sim_time}</span>{" "}
                {e.detail ? (
                  <span style={{ color: "#cbd5e1" }}>
                    {JSON.stringify(e.detail)}
                  </span>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const page: React.CSSProperties = { padding: 24, color: "#111" }

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th style={{ padding: "8px 12px", fontWeight: 600, fontSize: 13 }}>{children}</th>
  )
}
function Td({
  children,
  colSpan,
  style,
}: {
  children: React.ReactNode
  colSpan?: number
  style?: React.CSSProperties
}) {
  return (
    <td colSpan={colSpan} style={{ padding: "8px 12px", ...style }}>
      {children}
    </td>
  )
}

function actionLink(color: string): React.CSSProperties {
  return {
    color: "white",
    background: color,
    borderRadius: 6,
    padding: "2px 8px",
    fontSize: 12,
    fontWeight: 600,
    textDecoration: "none",
    whiteSpace: "nowrap",
  }
}

// Transparent Mission Score (backend source of truth). Renders the final score
// and the per-factor breakdown so the user can see exactly how it was derived.
// The frontend never computes the score — only displays the backend breakdown.
function ScoreBlock({ run }: { run: RobotRun }) {
  const score = run.mission_score ?? 0
  const bd = run.score_breakdown
  return (
    <div
      style={{
        background: "#f9fafb",
        border: "1px solid #eef2f7",
        borderRadius: 8,
        padding: 16,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: 13, color: "#6b7280" }}>Mission Score</span>
        <span style={{ fontSize: 30, fontWeight: 800 }}>
          {score}
          <span style={{ fontSize: 16, color: "#9ca3af", fontWeight: 600 }}> / 100</span>
        </span>
      </div>
      {bd ? (
        <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
          {SCORE_FACTORS.map((f) => {
            const v = bd[f.key] ?? 0
            const pct = Math.round(v * 100)
            return (
              <div key={f.key}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 13,
                    marginBottom: 3,
                  }}
                >
                  <span style={{ color: "#374151" }}>{f.label}</span>
                  <span style={{ fontWeight: 600, color: "#111827" }}>{pct}%</span>
                </div>
                <div
                  style={{
                    height: 6,
                    borderRadius: 3,
                    background: "#e5e7eb",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${pct}%`,
                      height: "100%",
                      background:
                        pct >= 80 ? "#22c55e" : pct >= 50 ? "#f59e0b" : "#ef4444",
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div style={{ marginTop: 8, color: "#9ca3af", fontSize: 13 }}>
          Breakdown not available for this run.
        </div>
      )}
    </div>
  )
}
