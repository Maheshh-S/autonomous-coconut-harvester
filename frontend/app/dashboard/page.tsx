"use client"

import { useCallback, useEffect, useState } from "react"
import {
  getDashboardOverview,
  getRobotStatus,
  getMapData,
  type DashboardOverview,
  type RobotStatus,
  type MapTree,
  type ActivityEvent,
} from "@/lib/api/detection"
import MapWrapper from "@/components/MapWrapper"
import DashboardFarmCard from "@/components/DashboardFarmCard"

const POLL_MS = 5000

function fmtIST(ts: string | null | undefined): string {
  if (!ts) return "—"
  const iso = ts.endsWith("Z") ? ts : `${ts}Z`
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ts
  return d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  })
}

const card: React.CSSProperties = {
  border: "1px solid #e2e2e2",
  borderRadius: 8,
  padding: 16,
  background: "#fff",
  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
}

const sectionTitle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 600,
  margin: "28px 0 12px",
}

const label: React.CSSProperties = { fontSize: 12, color: "#666" }
const value: React.CSSProperties = { fontSize: 26, fontWeight: 700 }

function StatCard({ title, val }: { title: string; val: React.ReactNode }) {
  return (
    <div style={card}>
      <div style={label}>{title}</div>
      <div style={value}>{val}</div>
    </div>
  )
}

function Field({ name, val }: { name: string; val: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
      <span style={{ color: "#666" }}>{name}</span>
      <span style={{ fontWeight: 600 }}>{val}</span>
    </div>
  )
}

const ROBOT_COLORS: Record<string, string> = {
  IDLE: "#9ca3af",
  HARVESTING: "#16a34a",
  PAUSED: "#f59e0b",
  COMPLETED: "#2563eb",
  CANCELLED: "#dc2626",
}

function Badge({ text }: { text: string }) {
  return (
    <span
      style={{
        background: ROBOT_COLORS[text] ?? "#6b7280",
        color: "white",
        borderRadius: 12,
        padding: "2px 10px",
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {text}
    </span>
  )
}

function Bar({
  segments,
}: {
  segments: { label: string; count: number; color: string }[]
}) {
  const total = segments.reduce((s, x) => s + x.count, 0)
  return (
    <div>
      <div
        style={{
          display: "flex",
          height: 22,
          borderRadius: 6,
          overflow: "hidden",
          background: "#f1f1f1",
        }}
      >
        {total === 0 ? (
          <div style={{ flex: 1, textAlign: "center", fontSize: 12, color: "#999" }}>
            no data
          </div>
        ) : (
          segments.map((s) =>
            s.count > 0 ? (
              <div
                key={s.label}
                title={`${s.label}: ${s.count}`}
                style={{ width: `${(s.count / total) * 100}%`, background: s.color }}
              />
            ) : null
          )
        )}
      </div>
      <div style={{ display: "flex", gap: 14, marginTop: 8, flexWrap: "wrap" }}>
        {segments.map((s) => (
          <span key={s.label} style={{ fontSize: 12, color: "#444" }}>
            <span
              style={{
                display: "inline-block",
                width: 10,
                height: 10,
                background: s.color,
                borderRadius: 2,
                marginRight: 5,
              }}
            />
            {s.label}: <b>{s.count}</b>
          </span>
        ))}
      </div>
    </div>
  )
}

const ACTIVITY_COLORS: Record<string, string> = {
  SURVEY_COMPLETED: "#0ea5e9",
  INSPECTION_CREATED: "#a855f7",
  INSPECTION_COMPLETED: "#7c3aed",
  INVENTORY_CREATED: "#f59e0b",
  HARVEST_MISSION_CREATED: "#10b981",
  HARVEST_MISSION_COMPLETED: "#2563eb",
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardOverview | null>(null)
  const [robot, setRobot] = useState<RobotStatus | null>(null)
  const [trees, setTrees] = useState<MapTree[]>([])
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const refresh = useCallback(async () => {
    try {
      const overview = await getDashboardOverview()
      setData(overview)

      const missionId = overview.current_harvest_mission?.id
      if (missionId) {
        try {
          setRobot(await getRobotStatus(missionId))
        } catch {
          setRobot(null)
        }
      } else {
        setRobot(null)
      }

      try {
        setTrees(await getMapData())
      } catch {
        // map is non-critical; leave prior trees in place
      }

      setError(null)
      setLastRefresh(new Date())
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load dashboard")
    }
  }, [])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, POLL_MS)
    return () => clearInterval(id)
  }, [refresh])

  if (error && !data) {
    return (
      <main style={{ padding: 24 }}>
        <h1>System Dashboard</h1>
        <p style={{ color: "#dc2626" }}>Error: {error}</p>
      </main>
    )
  }

  if (!data) {
    return (
      <main style={{ padding: 24 }}>
        <h1>System Dashboard</h1>
        <p>Loading…</p>
      </main>
    )
  }

  const o = data.overview
  const fs = data.farm_summary
  const hm = data.current_harvest_mission
  const cov = data.charts.inspection_coverage
  const hp = data.charts.harvest_progress
  const rip = data.charts.ripeness_distribution

  const robotState = robot?.robot_state ?? "IDLE"
  const queueProgress =
    robot != null ? `${robot.completed_count}/${robot.total_trees}` : "—"

  return (
    <main style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h1 style={{ fontSize: 26, fontWeight: 700 }}>System Dashboard</h1>
        <span style={{ fontSize: 12, color: "#888" }}>
          {lastRefresh ? `Updated ${lastRefresh.toLocaleTimeString("en-IN")}` : ""}
          {error ? ` · ${error}` : ""}
        </span>
      </div>
      <p style={{ color: "#666", marginTop: 4 }}>
        Read-only overview of the whole system.
      </p>

      {/* Overview Cards */}
      <div style={sectionTitle}>Overview</div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 12,
        }}
      >
        <StatCard title="Survey Missions" val={o.survey_missions} />
        <StatCard title="Permanent Trees" val={o.permanent_trees} />
        <StatCard title="Trees Inspected" val={o.trees_inspected} />
        <StatCard title="Inventory Snapshots" val={o.inventory_snapshots} />
        <StatCard title="Harvest Missions" val={o.harvest_missions} />
        <div style={card}>
          <div style={label}>Robot Status</div>
          <div style={{ marginTop: 8 }}>
            <Badge text={robotState} />
          </div>
        </div>
      </div>

      {/* Farm Summary */}
      <div style={sectionTitle}>Farm Summary</div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: 12,
        }}
      >
        <StatCard title="Total Trees" val={fs.total_trees} />
        <StatCard title="Total Coconuts" val={fs.total_coconuts} />
        <StatCard title="Mature" val={fs.mature} />
        <StatCard title="Potential" val={fs.potential} />
        <StatCard title="Premature" val={fs.premature} />
        <StatCard title="Harvested Count" val={fs.harvested_count} />
      </div>

      {/* Survey / Harvest / Robot sections */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 12,
          marginTop: 24,
        }}
      >
        <div style={card}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Survey</div>
          <Field
            name="Latest Survey"
            val={
              data.survey.latest_survey
                ? `#${data.survey.latest_survey.id} (${data.survey.latest_survey.status})`
                : "—"
            }
          />
          <Field
            name="Active Survey"
            val={
              data.survey.active_survey
                ? `#${data.survey.active_survey.id}`
                : "None"
            }
          />
          <Field name="Last Scan Time" val={fmtIST(data.survey.last_scan_time)} />
        </div>

        <div style={card}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Harvest</div>
          <Field
            name="Current Mission"
            val={hm ? hm.mission_code ?? `#${hm.id}` : "—"}
          />
          <Field name="Status" val={hm ? <Badge text={hm.status} /> : "—"} />
          <Field
            name="Queue Progress"
            val={robot ? `${robot.completed_count}/${robot.total_trees}` : "—"}
          />
          <Field
            name="Trees Remaining"
            val={robot ? robot.remaining_count : "—"}
          />
          <Field
            name="Expected Harvest"
            val={hm ? hm.total_expected_coconuts : "—"}
          />
        </div>

        <div style={card}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Robot</div>
          <Field name="Robot State" val={<Badge text={robotState} />} />
          <Field
            name="Current Mission"
            val={robot ? robot.mission_code ?? `#${robot.mission_id}` : "—"}
          />
          <Field
            name="Current Tree"
            val={
              robot?.current_item
                ? robot.current_item.tree_code ??
                  `Tree ${robot.current_item.tree_id}`
                : "—"
            }
          />
          <Field name="Queue Progress" val={queueProgress} />
        </div>
      </div>

      {/* Charts */}
      <div style={sectionTitle}>Charts</div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 12,
        }}
      >
        <div style={card}>
          <div style={{ fontWeight: 600, marginBottom: 10 }}>
            Ripeness Distribution
          </div>
          <Bar
            segments={[
              { label: "Mature", count: rip.mature, color: "#16a34a" },
              { label: "Potential", count: rip.potential, color: "#f59e0b" },
              { label: "Premature", count: rip.premature, color: "#ef4444" },
            ]}
          />
        </div>

        <div style={card}>
          <div style={{ fontWeight: 600, marginBottom: 10 }}>
            Inspection Coverage
          </div>
          <Bar
            segments={[
              { label: "Inspected", count: cov.inspected, color: "#2563eb" },
              {
                label: "Not Inspected",
                count: Math.max(cov.total - cov.inspected, 0),
                color: "#d1d5db",
              },
            ]}
          />
        </div>

        <div style={card}>
          <div style={{ fontWeight: 600, marginBottom: 10 }}>
            Harvest Progress
          </div>
          <Bar
            segments={[
              { label: "Completed", count: hp.completed, color: "#16a34a" },
              {
                label: "Remaining",
                count: Math.max(hp.total - hp.completed, 0),
                color: "#d1d5db",
              },
            ]}
          />
        </div>
      </div>

      {/* Digital Twin (small interactive Farm Viewer → /map) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 12,
          marginTop: 24,
        }}
      >
        <DashboardFarmCard />
      </div>

      {/* Map + Recent Activity */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)",
          gap: 12,
          marginTop: 24,
          alignItems: "start",
        }}
      >
        <div style={card}>
          <div style={{ fontWeight: 600, marginBottom: 10 }}>
            Farm Map ({trees.length} trees)
          </div>
          {trees.length > 0 ? (
            <MapWrapper trees={trees} />
          ) : (
            <p style={{ color: "#999" }}>No permanent trees to display.</p>
          )}
        </div>

        <div style={card}>
          <div style={{ fontWeight: 600, marginBottom: 10 }}>Recent Activity</div>
          {data.recent_activity.length === 0 ? (
            <p style={{ color: "#999" }}>No activity yet.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {data.recent_activity.map((e: ActivityEvent, i) => (
                <li
                  key={`${e.type}-${e.ref}-${i}`}
                  style={{
                    display: "flex",
                    gap: 8,
                    padding: "8px 0",
                    borderBottom: "1px solid #f0f0f0",
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      marginTop: 6,
                      flex: "0 0 auto",
                      background: ACTIVITY_COLORS[e.type] ?? "#9ca3af",
                    }}
                  />
                  <div>
                    <div style={{ fontSize: 14 }}>{e.label}</div>
                    <div style={{ fontSize: 12, color: "#999" }}>
                      {fmtIST(e.ts)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  )
}
