"use client"

import { useEffect, useState, use } from "react"
import Link from "next/link"
import {
  Play,
  Tree as TreeIcon,
  Ladder,
  Check,
  BatteryWarning,
  House,
  Flag,
  Lightning,
  Path,
  DotOutline,
  type Icon,
} from "@phosphor-icons/react"
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

// Robot-log severities, mapped to on-palette tokens (WCAG-safe on the light
// theme). `tone` is a low-alpha fill for the tag chip; `color` is the readable
// text/rule colour.
const SEVERITY: Record<LogSeverity, { color: string; tone: string }> = {
  INFO: { color: "var(--color-text-dim)", tone: "var(--color-surface-2)" },
  WARNING: { color: "var(--color-warn)", tone: "color-mix(in srgb, var(--color-warn) 12%, transparent)" },
  ERROR: { color: "var(--color-crit)", tone: "color-mix(in srgb, var(--color-crit) 12%, transparent)" },
}

// Timeline event vocabulary. The backend emits a stable `icon` string per event;
// we map each to one Phosphor glyph (single icon family) and an on-palette token
// so the machine-log reads with the app's light-agri colour language rather than
// the generic hex the backend ships as a fallback.
type TimelineKind = {
  glyph: Icon
  color: string
  tone: string
}
const TIMELINE_KIND: Record<string, TimelineKind> = {
  play: { glyph: Play, color: "var(--color-accent)", tone: "var(--color-accent-weak)" },
  tree: { glyph: TreeIcon, color: "var(--color-accent)", tone: "var(--color-accent-weak)" },
  climb: { glyph: Ladder, color: "var(--color-text-dim)", tone: "var(--color-surface-2)" },
  check: { glyph: Check, color: "var(--color-ok)", tone: "var(--color-accent-weak)" },
  battery: { glyph: BatteryWarning, color: "var(--color-crit)", tone: "color-mix(in srgb, var(--color-crit) 12%, transparent)" },
  home: { glyph: House, color: "var(--color-warn)", tone: "color-mix(in srgb, var(--color-warn) 12%, transparent)" },
  flag: { glyph: Flag, color: "var(--color-ok)", tone: "var(--color-accent-weak)" },
  bolt: { glyph: Lightning, color: "var(--color-warn)", tone: "color-mix(in srgb, var(--color-warn) 12%, transparent)" },
  route: { glyph: Path, color: "var(--color-text-faint)", tone: "var(--color-surface-2)" },
}
const TIMELINE_FALLBACK: TimelineKind = {
  glyph: DotOutline,
  color: "var(--color-text-faint)",
  tone: "var(--color-surface-2)",
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

      {tab === "timeline" && <Timeline timeline={timeline} />}

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

      {tab === "robot-log" && <RobotLog log={log} />}
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

// Machine-log timeline. A single vertical rail threads every event so the run
// reads as a sequence (a real timeline, not a flat divider list). Each node is
// a Phosphor glyph on the rail; the sim-clock is a monospace, tabular chip so
// the times align like a robot log. Motion is a one-shot staggered reveal that
// mirrors the order events actually happened; it is disabled under
// prefers-reduced-motion (handled in the scoped block below).
function Timeline({ timeline }: { timeline: TimelineEntry[] }) {
  if (timeline.length === 0) {
    return (
      <div
        style={{
          border: "1px dashed var(--color-line-strong)",
          borderRadius: 12,
          padding: "28px 20px",
          textAlign: "center",
          color: "var(--color-text-dim)",
          fontSize: 14,
        }}
      >
        No events recorded for this run.
      </div>
    )
  }

  return (
    <div className="tl">
      <ol className="tl-list">
        {timeline.map((e, i) => {
          const kind = TIMELINE_KIND[e.icon] ?? TIMELINE_FALLBACK
          const Glyph = kind.glyph
          return (
            <li
              key={e.key}
              className="tl-row"
              style={{ "--tl-i": i, "--tl-tone": kind.tone, "--tl-color": kind.color } as React.CSSProperties}
            >
              <div className="tl-node" aria-hidden="true">
                <Glyph size={16} weight="bold" color={kind.color} />
              </div>
              <div className="tl-body">
                <div className="tl-head">
                  <span className="tl-title">{e.title}</span>
                  {e.tree_id != null && e.title !== "Travelled" ? (
                    <Link href={`/trees/${e.tree_id}`} className="tl-tree">
                      #{e.tree_id}
                    </Link>
                  ) : null}
                  {e.distance_m != null ? (
                    <span className="tl-chip">{e.distance_m} m</span>
                  ) : null}
                  <span className="tl-clock">t+{e.sim_time}s</span>
                </div>
                <div className="tl-desc">{e.description}</div>
              </div>
            </li>
          )
        })}
      </ol>

      <style jsx>{`
        .tl {
          position: relative;
        }
        .tl-list {
          list-style: none;
          margin: 0;
          padding: 0;
        }
        .tl-row {
          position: relative;
          display: grid;
          grid-template-columns: 34px 1fr;
          gap: 14px;
          padding: 4px 0 18px;
        }
        /* The rail: a continuous hairline behind the nodes, stopping at the
           last node so it never dangles past the final event. */
        .tl-row::before {
          content: "";
          position: absolute;
          left: 16px;
          top: 22px;
          bottom: -4px;
          width: 2px;
          background: var(--color-line);
        }
        .tl-row:last-child::before {
          display: none;
        }
        .tl-node {
          position: relative;
          z-index: 1;
          width: 34px;
          height: 34px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          background: var(--tl-tone);
          border: 1.5px solid var(--tl-color);
          flex-shrink: 0;
        }
        .tl-body {
          min-width: 0;
          padding-top: 2px;
        }
        .tl-head {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .tl-title {
          font-weight: 650;
          font-size: 15px;
          letter-spacing: -0.01em;
        }
        .tl-tree {
          font-family: var(--font-mono);
          font-size: 12px;
          font-weight: 600;
          color: var(--color-accent);
          text-decoration: none;
          font-variant-numeric: tabular-nums;
          border-bottom: 1px solid var(--color-accent-dim);
          transition: border-color 0.15s var(--ease-out);
        }
        .tl-tree:hover {
          border-bottom-color: var(--color-accent);
        }
        .tl-tree:active {
          transform: translateY(1px);
        }
        .tl-chip {
          font-family: var(--font-mono);
          font-size: 11px;
          font-weight: 600;
          color: var(--color-text-dim);
          background: var(--color-surface-2);
          border: 1px solid var(--color-line);
          border-radius: 8px;
          padding: 1px 8px;
          font-variant-numeric: tabular-nums;
        }
        .tl-clock {
          margin-left: auto;
          font-family: var(--font-mono);
          font-size: 12px;
          font-weight: 600;
          color: var(--color-text-faint);
          font-variant-numeric: tabular-nums;
          letter-spacing: 0.02em;
        }
        .tl-desc {
          margin-top: 3px;
          color: var(--color-text-dim);
          font-size: 13px;
          line-height: 1.5;
        }

        /* Motivated motion: events reveal in the order they occurred, so the
           list reads as a playback of the run. One-shot, capped stagger. */
        @media (prefers-reduced-motion: no-preference) {
          .tl-row {
            opacity: 0;
            transform: translateY(6px);
            animation: tl-in 0.4s var(--ease-out) forwards;
            animation-delay: calc(min(var(--tl-i), 12) * 45ms);
          }
        }
        @keyframes tl-in {
          to {
            opacity: 1;
            transform: none;
          }
        }
        @media (max-width: 560px) {
          .tl-clock {
            margin-left: 0;
          }
        }
      `}</style>
    </div>
  )
}

// Flattens a log-entry `detail` object into aligned key=value tokens so the log
// reads as a machine record rather than a raw JSON blob.
function fmtDetail(detail: Record<string, unknown>): { k: string; v: string }[] {
  return Object.entries(detail).map(([k, v]) => ({
    k,
    v: typeof v === "object" && v !== null ? JSON.stringify(v) : String(v),
  }))
}

// Robot log. A terminal-styled, monospace record with aligned columns
// (clock · severity · event · detail) so entries scan like a real machine log.
// Colours are on-palette and WCAG-safe on the light theme (the previous
// near-white text on a white surface was unreadable). Presentation only — the
// RobotLogEntry shape and ordering are untouched.
function RobotLog({ log }: { log: RobotLogEntry[] }) {
  return (
    <div className="rl">
      <div className="rl-bar">
        <span className="rl-dot" aria-hidden="true" />
        <span className="rl-name">robot.log</span>
        <span className="rl-count">
          {log.length} {log.length === 1 ? "entry" : "entries"}
        </span>
      </div>
      <div className="rl-body">
        {log.length === 0 ? (
          <div className="rl-empty">No log entries recorded for this run.</div>
        ) : (
          log.map((e) => {
            const sev = SEVERITY[e.severity] ?? SEVERITY.INFO
            const detail = e.detail ? fmtDetail(e.detail) : []
            return (
              <div key={e.id} className="rl-row" style={{ "--rl-color": sev.color, "--rl-tone": sev.tone } as React.CSSProperties}>
                <span className="rl-clock">t+{e.sim_time}</span>
                <span className="rl-sev">{e.severity}</span>
                <span className="rl-event">{e.event_type}</span>
                {detail.length > 0 ? (
                  <span className="rl-detail">
                    {detail.map((d) => (
                      <span key={d.k} className="rl-kv">
                        <span className="rl-k">{d.k}</span>
                        <span className="rl-eq">=</span>
                        <span className="rl-v">{d.v}</span>
                      </span>
                    ))}
                  </span>
                ) : null}
              </div>
            )
          })
        )}
      </div>

      <style jsx>{`
        .rl {
          border: 1px solid var(--color-line);
          border-radius: 14px;
          overflow: hidden;
          background: var(--color-bg-elevated);
        }
        .rl-bar {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 9px 14px;
          background: var(--color-surface-2);
          border-bottom: 1px solid var(--color-line);
        }
        .rl-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--color-accent);
          flex-shrink: 0;
        }
        .rl-name {
          font-family: var(--font-mono);
          font-size: 12px;
          font-weight: 600;
          color: var(--color-text-dim);
          letter-spacing: 0.02em;
        }
        .rl-count {
          margin-left: auto;
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--color-text-faint);
          font-variant-numeric: tabular-nums;
        }
        .rl-body {
          font-family: var(--font-mono);
          font-size: 12.5px;
          line-height: 1.65;
          max-height: 480px;
          overflow: auto;
          padding: 8px 0;
        }
        .rl-empty {
          padding: 20px 14px;
          color: var(--color-text-faint);
          font-size: 13px;
        }
        .rl-row {
          display: grid;
          grid-template-columns: 62px 74px auto 1fr;
          gap: 10px;
          align-items: baseline;
          padding: 3px 14px 3px 11px;
          border-left: 3px solid var(--rl-color);
        }
        .rl-row:hover {
          background: var(--color-surface-2);
        }
        .rl-clock {
          color: var(--color-text-faint);
          font-variant-numeric: tabular-nums;
          text-align: right;
        }
        .rl-sev {
          color: var(--rl-color);
          background: var(--rl-tone);
          font-weight: 700;
          font-size: 10.5px;
          letter-spacing: 0.04em;
          text-align: center;
          border-radius: 6px;
          padding: 0 4px;
        }
        .rl-event {
          color: var(--color-text);
          font-weight: 600;
          white-space: nowrap;
        }
        .rl-detail {
          display: inline-flex;
          flex-wrap: wrap;
          gap: 8px;
          min-width: 0;
        }
        .rl-kv {
          display: inline-flex;
          align-items: baseline;
        }
        .rl-k {
          color: var(--color-text-faint);
        }
        .rl-eq {
          color: var(--color-line-strong);
          margin: 0 1px;
        }
        .rl-v {
          color: var(--color-text-dim);
          font-variant-numeric: tabular-nums;
        }
        @media (max-width: 560px) {
          .rl-row {
            grid-template-columns: 54px 66px 1fr;
          }
          .rl-detail {
            grid-column: 1 / -1;
            padding-left: 64px;
          }
        }
      `}</style>
    </div>
  )
}
