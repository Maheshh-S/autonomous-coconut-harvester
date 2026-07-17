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
  COMPLETED: "#4fe39a",
  ABORTED: "#f5c451",
  FAILED: "#ff6b5e",
}

const tabNames = ["summary", "timeline", "tree-activity", "robot-log"] as const
type Tab = (typeof tabNames)[number]

const SEVERITY: Record<LogSeverity, { color: string }> = {
  INFO: { color: "#6cc6ff" },
  WARNING: { color: "#f5c451" },
  ERROR: { color: "#ff6b5e" },
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

const STATUS_LABEL: Record<RunStatus, string> = {
  COMPLETED: "Completed",
  ABORTED: "Aborted",
  FAILED: "Failed",
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      style={{
        background: "var(--color-surface-2)",
        border: "1px solid var(--color-line)",
        borderRadius: 12,
        padding: "14px 16px",
      }}
    >
      <div style={{ fontSize: 11, color: "var(--color-text-faint)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</div>
      <div style={{ fontSize: 19, fontWeight: 700, marginTop: 4 }}>{value}</div>
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

  if (loading) return <div style={{ padding: 24, color: "var(--color-text-dim)" }}>Loading run {runId}…</div>
  if (error) return <div style={{ padding: 24, color: "var(--color-crit)" }}>{error}</div>
  if (!run) return <div style={{ padding: 24, color: "var(--color-text-dim)" }}>Run not found.</div>

  return (
    <div style={{ padding: "28px clamp(16px, 4vw, 48px) 56px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ marginBottom: 16 }}>
        <Link href="/robot/history" style={{ color: "var(--color-accent)", textDecoration: "none", fontSize: 14, borderBottom: "1px solid var(--color-accent-dim)" }}>
          ← Back to Mission History
        </Link>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 6, flexWrap: "wrap" }}>
        <h1 className="font-display" style={{ fontSize: 26, fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>
          Run #{run.id}
        </h1>
        <span style={statusPill(statusColor[run.status])}>{STATUS_LABEL[run.status]}</span>
      </div>
      <p style={{ color: "var(--color-text-dim)", marginTop: 4 }}>
        Mission {run.mission_id ?? "—"} · finished {fmtTime(run.finished_at)} ·
        speed ×{run.speed_factor ?? 1}
      </p>

      <div style={{ display: "flex", gap: 8, margin: "20px 0", flexWrap: "wrap" }}>
        {tabNames.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={tab === t ? "btn btn-primary" : "btn btn-ghost"}
            style={{ height: 38, padding: "8px 16px", textTransform: "capitalize", fontSize: 13 }}
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
            <Metric label="Harvested / Total" value={`${run.harvested_trees}/${run.total_trees}`} />
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
          <div style={{ color: "var(--color-text-faint)", fontSize: 13 }}>
            Started {fmtTime(run.started_at)} · finished {fmtTime(run.finished_at)}
          </div>
        </div>
      )}

      {tab === "timeline" && (
        <ol style={{ paddingLeft: 0, listStyle: "none", margin: 0 }}>
          {timeline.length === 0 && <li style={{ color: "var(--color-text-dim)" }}>No events.</li>}
          {timeline.map((e) => (
            <li
              key={e.key}
              style={{
                display: "flex",
                gap: 14,
                padding: "12px 0",
                borderBottom: "1px solid var(--color-line)",
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
                  boxShadow: `0 0 10px ${e.color}`,
                }}
              />
              <div>
                <div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span>{e.title}</span>
                  {e.tree_id != null && e.title !== "Travelled" ? (
                    <span style={{ fontWeight: 400, color: "var(--color-accent)" }}>#{e.tree_id}</span>
                  ) : null}
                  {e.distance_m != null ? (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: "var(--color-text-dim)",
                        background: "var(--color-surface-2)",
                        borderRadius: 99,
                        padding: "1px 8px",
                        border: "1px solid var(--color-line)",
                      }}
                    >
                      {e.distance_m} m
                    </span>
                  ) : null}
                </div>
                <div style={{ color: "var(--color-text-dim)", fontSize: 13 }}>
                  {e.description} · sim t={e.sim_time}s
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      {tab === "tree-activity" && (
        <div className="panel" style={{ overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ background: "var(--color-surface-2)", textAlign: "left" }}>
                  <Th2>Tree</Th2>
                  <Th2>Result</Th2>
                  <Th2>Visit (sim t)</Th2>
                  <Th2>Harvest time</Th2>
                  <Th2>Battery</Th2>
                  <Th2>Inventory</Th2>
                </tr>
              </thead>
              <tbody>
                {trees.length === 0 && (
                  <tr>
                    <Td2 colSpan={6} style={{ color: "var(--color-text-dim)" }}>
                      No trees visited.
                    </Td2>
                  </tr>
                )}
                {trees.map((t) => (
                  <tr key={t.tree_id} style={{ borderTop: "1px solid var(--color-line)" }}>
                    <Td2>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <Link
                          href={`/trees/${t.tree_id}`}
                          style={{ color: "var(--color-accent)", textDecoration: "none", fontWeight: 600, borderBottom: "1px solid var(--color-accent-dim)" }}
                        >
                          #{t.tree_id}
                          {t.tree_code ? ` (${t.tree_code})` : ""}
                        </Link>
                        <span style={{ display: "inline-flex", gap: 6 }}>
                          <ActionLink href={`/trees/${t.tree_id}`} color="#4fe39a">
                            Open Tree
                          </ActionLink>
                          <ActionLink href={`/map?tree=${t.tree_id}`} color="#f5c451">
                            Open Digital Twin
                          </ActionLink>
                        </span>
                      </div>
                    </Td2>
                    <Td2>
                      <span
                        style={{
                          padding: "2px 10px",
                          borderRadius: 99,
                          fontSize: 12,
                          fontWeight: 600,
                          color: t.harvest_result === "harvested" ? "#4fe39a" : "var(--color-text-dim)",
                          background:
                            t.harvest_result === "harvested"
                              ? "rgba(79,227,154,0.14)"
                              : "var(--color-surface-2)",
                          border: `1px solid ${t.harvest_result === "harvested" ? "rgba(79,227,154,0.4)" : "var(--color-line)"}`,
                        }}
                      >
                        {t.harvest_result}
                      </span>
                    </Td2>
                    <Td2>{t.visit_time != null ? `${t.visit_time}s` : "—"}</Td2>
                    <Td2>{t.harvest_duration_s != null ? `${t.harvest_duration_s}s` : "—"}</Td2>
                    <Td2>{t.battery_at_visit != null ? `${t.battery_at_visit}%` : "—"}</Td2>
                    <Td2>{t.inventory_collected ?? "—"}</Td2>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "robot-log" && (
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 13,
            background: "var(--color-bg-elevated)",
            color: "#cfe0d8",
            borderRadius: 14,
            padding: 14,
            maxHeight: 480,
            overflow: "auto",
            border: "1px solid var(--color-line)",
          }}
        >
          {log.length === 0 && <div style={{ color: "var(--color-text-faint)" }}>No events.</div>}
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
                <span style={{ color: "#6cc6ff" }}>{e.event_type}</span>{" "}
                <span style={{ color: "var(--color-text-faint)" }}>t={e.sim_time}</span>{" "}
                {e.detail ? (
                  <span style={{ color: "#b9ccc2" }}>
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

function Th2({ children }: { children: React.ReactNode }) {
  return (
    <th style={{ padding: "12px 16px", fontWeight: 600, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-text-faint)" }}>{children}</th>
  )
}
function Td2({
  children,
  colSpan,
  style,
}: {
  children: React.ReactNode
  colSpan?: number
  style?: React.CSSProperties
}) {
  return (
    <td colSpan={colSpan} style={{ padding: "12px 16px", ...style }}>
      {children}
    </td>
  )
}

function ActionLink({ href, color, children }: { href: string; color: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      style={{
        color: "white",
        background: color,
        borderRadius: 6,
        padding: "2px 8px",
        fontSize: 12,
        fontWeight: 600,
        textDecoration: "none",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </a>
  )
}

function statusPill(color: string): React.CSSProperties {
  return {
    padding: "3px 12px",
    borderRadius: 99,
    color,
    background: "color-mix(in srgb, " + color + " 16%, transparent)",
    border: "1px solid color-mix(in srgb, " + color + " 40%, transparent)",
    fontSize: 13,
    fontWeight: 600,
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
        background: "linear-gradient(180deg, var(--color-surface), var(--color-bg-elevated))",
        border: "1px solid var(--color-line)",
        borderRadius: 16,
        padding: 20,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <span style={{ fontSize: 12, color: "var(--color-text-faint)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Mission Score</span>
        <span className="font-display" style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.02em" }}>
          {score}
          <span style={{ fontSize: 16, color: "var(--color-text-faint)", fontWeight: 600 }}> / 100</span>
        </span>
      </div>
      {bd ? (
        <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
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
                    marginBottom: 4,
                  }}
                >
                  <span style={{ color: "var(--color-text-dim)" }}>{f.label}</span>
                  <span style={{ fontWeight: 600, color: "var(--color-text)" }}>{pct}%</span>
                </div>
                <div
                  style={{
                    height: 6,
                    borderRadius: 3,
                    background: "var(--color-surface-3)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${pct}%`,
                      height: "100%",
                      background:
                        pct >= 80 ? "#4fe39a" : pct >= 50 ? "#f5c451" : "#ff6b5e",
                      borderRadius: 3,
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div style={{ marginTop: 8, color: "var(--color-text-faint)", fontSize: 13 }}>
          Breakdown not available for this run.
        </div>
      )}
    </div>
  )
}
