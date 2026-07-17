"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  getDashboardOverview,
  getRobotStatus,
  getRobotRuns,
  type DashboardOverview,
  type RobotStatus,
  type RobotRun,
  type ActivityEvent,
} from "@/lib/api/detection";
import DashboardFarmCard from "@/components/DashboardFarmCard";
import { useRobotSimulation } from "@/lib/useRobotSimulation";
import RobotStatusCard from "@/components/robot/RobotStatusCard";
import AmbientClip from "@/components/AmbientClip";
import { useReveal } from "@/lib/useReveal";

const POLL_MS = 5000;

function fmtIST(ts: string | null | undefined): string {
  if (!ts) return "—";
  const iso = ts.endsWith("Z") ? ts : `${ts}Z`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

const ROBOT_COLORS: Record<string, string> = {
  IDLE: "#6b7a6b",
  HARVESTING: "#3f7d34",
  PAUSED: "#9a6a24",
  COMPLETED: "#2f6f8f",
  CANCELLED: "#b23a2a",
};

function Badge({ text }: { text: string }) {
  const color = ROBOT_COLORS[text] ?? "#6b7280";
  return (
    <span
      className="badge"
      style={{ background: `${color}1f`, color, borderColor: `${color}55` }}
    >
      <span className="dot" style={{ background: color }} />
      {text}
    </span>
  );
}

function StatTile({ label, val, sub }: { label: string; val: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="tile" data-reveal>
      <div className="tile-label">{label}</div>
      <div className="tile-val font-display tracking-tightest">{val}</div>
      {sub != null && <div className="tile-sub">{sub}</div>}
    </div>
  );
}

function MiniBar({ segments }: { segments: { label: string; count: number; color: string }[] }) {
  const total = segments.reduce((s, x) => s + x.count, 0);
  return (
    <div className="minibar">
      <div className="minibar-track">
        {total === 0 ? (
          <span className="minibar-empty">no data</span>
        ) : (
          segments.map((s) =>
            s.count > 0 ? (
              <div
                key={s.label}
                title={`${s.label}: ${s.count}`}
                className="minibar-seg"
                style={{ width: `${(s.count / total) * 100}%`, background: s.color }}
              />
            ) : null
          )
        )}
      </div>
      <div className="minibar-legend">
        {segments.map((s) => (
          <span key={s.label} className="minibar-leg">
            <span className="dot" style={{ background: s.color }} />
            {s.label}: <b>{s.count}</b>
          </span>
        ))}
      </div>
    </div>
  );
}

const ACTIVITY_COLORS: Record<string, string> = {
  SURVEY_COMPLETED: "#6cc6ff",
  INSPECTION_CREATED: "#b98bff",
  INSPECTION_COMPLETED: "#8b5cf6",
  INVENTORY_CREATED: "#f5c451",
  HARVEST_MISSION_CREATED: "#4fe39a",
  HARVEST_MISSION_COMPLETED: "#6cc6ff",
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [robot, setRobot] = useState<RobotStatus | null>(null);
  const [latestRun, setLatestRun] = useState<RobotRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const missionId = data?.current_harvest_mission?.id ?? null;
  const sim = useRobotSimulation(missionId);
  const currentTreeCode = sim.harvestingTreeId != null ? `Tree ${sim.harvestingTreeId}` : null;
  const nextTreeCode = sim.nextTreeId != null ? `Tree ${sim.nextTreeId}` : null;
  const reveal = useReveal();

  const refresh = useCallback(async () => {
    try {
      const overview = await getDashboardOverview();
      setData(overview);
      const mid = overview.current_harvest_mission?.id;
      if (mid) {
        try {
          setRobot(await getRobotStatus(mid));
        } catch {
          setRobot(null);
        }
      } else {
        setRobot(null);
      }
      try {
        const runs = await getRobotRuns(1);
        setLatestRun(runs[0] ?? null);
      } catch {
        setLatestRun(null);
      }
      setError(null);
      setLastRefresh(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load dashboard");
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  if (error && !data) {
    return (
      <main className="page" ref={reveal}>
        <div className="errpanel">
          <h1>System Dashboard</h1>
          <p className="errmsg">Error: {error}</p>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="page" ref={reveal}>
        <div className="skeleton-head" />
        <div className="skeleton-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div className="skeleton-tile" key={i} />
          ))}
        </div>
      </main>
    );
  }

  const o = data.overview;
  const fs = data.farm_summary;
  const hm = data.current_harvest_mission;
  const cov = data.charts.inspection_coverage;
  const hp = data.charts.harvest_progress;
  const rip = data.charts.ripeness_distribution;
  const robotState = robot?.robot_state ?? "IDLE";

  return (
    <main className="page" ref={reveal}>
      <header className="page-head">
        <div>
          <p className="kicker">Mission Control</p>
          <h1 className="page-title font-display tracking-tightest">System Dashboard</h1>
        </div>
        <div className="head-status">
          <span className="dot" style={{ background: "var(--color-ok)" }} />
          <span className="font-mono">
            {lastRefresh ? `Live · ${lastRefresh.toLocaleTimeString("en-IN")}` : "Connecting…"}
          </span>
          {error && <span className="head-err">· {error}</span>}
        </div>
      </header>

      {/* Hero banner — dedicated, clearly visible clip (not hidden behind cards) */}
      <section className="page-hero" aria-label="Farm overview">
        <AmbientClip src="/clips/2.mp4" opacity={0.32} />
        <div className="page-hero-scrim" />
        <div className="page-hero-inner">
          <p className="kicker">Live Operations</p>
          <h2 className="page-hero-title font-display tracking-tightest">
            One calm view of the whole plantation
          </h2>
          <p className="page-hero-sub">
            Survey, digital twin, robot and harvest — unified into a single
            situational-awareness surface.
          </p>
        </div>
      </section>

      {/* Overview */}
      <section className="block">
        <h2 className="block-title">Overview</h2>
        <div className="tile-grid cols-6">
          <StatTile label="Survey Missions" val={o.survey_missions} />
          <StatTile label="Permanent Trees" val={o.permanent_trees} />
          <StatTile label="Trees Inspected" val={o.trees_inspected} />
          <StatTile label="Inventory Snapshots" val={o.inventory_snapshots} />
          <StatTile label="Harvest Missions" val={o.harvest_missions} />
          <StatTile label="Robot Status" val={<Badge text={robotState} />} />
        </div>
      </section>

      {/* Farm Summary */}
      <section className="block">
        <h2 className="block-title">Farm Summary</h2>
        <div className="tile-grid cols-6">
          <StatTile label="Total Trees" val={fs.total_trees} />
          <StatTile label="Total Coconuts" val={fs.total_coconuts} />
          <StatTile label="Mature" val={fs.mature} />
          <StatTile label="Potential" val={fs.potential} />
          <StatTile label="Premature" val={fs.premature} />
          <StatTile label="Harvested" val={fs.harvested_count} />
        </div>
      </section>

      {/* Survey / Harvest / Robot / Run */}
      <section className="block">
        <div className="panel-grid">
          <div className="panel" data-reveal>
            <h3 className="panel-h">Survey</h3>
            <Field name="Latest Survey" val={data.survey.latest_survey ? `#${data.survey.latest_survey.id} · ${data.survey.latest_survey.status}` : "—"} />
            <Field name="Active Survey" val={data.survey.active_survey ? `#${data.survey.active_survey.id}` : "None"} />
            <Field name="Last Scan" val={fmtIST(data.survey.last_scan_time)} />
          </div>

          <div className="panel" data-reveal>
            <h3 className="panel-h">Harvest</h3>
            <Field name="Current Mission" val={hm ? hm.mission_code ?? `#${hm.id}` : "—"} />
            <Field name="Status" val={hm ? <Badge text={hm.status} /> : "—"} />
            <Field name="Queue" val={robot ? `${robot.completed_count}/${robot.total_trees}` : "—"} />
            <Field name="Trees Remaining" val={robot ? robot.remaining_count : "—"} />
            <Field name="Expected Harvest" val={hm ? hm.total_expected_coconuts : "—"} />
          </div>

          <div className="panel" data-reveal>
            <h3 className="panel-h">Robot</h3>
            <Field name="State" val={<Badge text={robotState} />} />
            <Field name="Mission" val={robot ? robot.mission_code ?? `#${robot.mission_id}` : "—"} />
            <Field
              name="Current Tree"
              val={robot?.current_item ? robot.current_item.tree_code ?? `Tree ${robot.current_item.tree_id}` : "—"}
            />
            <Field name="Queue" val={robot ? `${robot.completed_count}/${robot.total_trees}` : "—"} />
          </div>

          <div className="panel" data-reveal>
            <h3 className="panel-h">Latest Run</h3>
            {latestRun ? (
              <>
                <Field
                  name="Run"
                  val={
                    <Link href={`/robot/history/${latestRun.id}`} className="link">
                      #{latestRun.id}
                    </Link>
                  }
                />
                <Field name="Status" val={<Badge text={latestRun.status} />} />
                <Field name="Score" val={latestRun.mission_score ?? "—"} />
                <Field name="Harvested" val={`${latestRun.harvested_trees}/${latestRun.total_trees}`} />
                <Field name="Battery Used" val={`${latestRun.battery_used_pct}%`} />
                <Link href="/robot/history" className="link sm">View all runs →</Link>
              </>
            ) : (
              <Field name="Last run" val="None yet" />
            )}
          </div>
        </div>
      </section>

      {/* Charts */}
      <section className="block">
        <h2 className="block-title">Analytics</h2>
        <div className="panel-grid">
          <div className="panel" data-reveal>
            <h3 className="panel-h">Ripeness Distribution</h3>
            <MiniBar
              segments={[
                { label: "Mature", count: rip.mature, color: "#4fe39a" },
                { label: "Potential", count: rip.potential, color: "#f5c451" },
                { label: "Premature", count: rip.premature, color: "#ff6b5e" },
              ]}
            />
          </div>
          <div className="panel" data-reveal>
            <h3 className="panel-h">Inspection Coverage</h3>
            <MiniBar
              segments={[
                { label: "Inspected", count: cov.inspected, color: "#6cc6ff" },
                { label: "Remaining", count: Math.max(cov.total - cov.inspected, 0), color: "#2c4034" },
              ]}
            />
          </div>
          <div className="panel" data-reveal>
            <h3 className="panel-h">Harvest Progress</h3>
            <MiniBar
              segments={[
                { label: "Completed", count: hp.completed, color: "#4fe39a" },
                { label: "Remaining", count: Math.max(hp.total - hp.completed, 0), color: "#2c4034" },
              ]}
            />
          </div>
        </div>
      </section>

      {/* Twin + Robot status */}
      <section className="block">
        <div className="panel-grid">
          <DashboardFarmCard />
          <RobotStatusCard
            robot={sim.displayRobot}
            sim={sim.sim}
            currentTreeCode={currentTreeCode}
            nextTreeCode={nextTreeCode}
            distanceRemaining={null}
            connection={sim.connection}
          />
        </div>
      </section>

      {/* Recent Activity */}
      <section className="block">
        <h2 className="block-title">Recent Activity</h2>
        <div className="panel" data-reveal>
          {data.recent_activity.length === 0 ? (
            <p className="muted">No activity yet.</p>
          ) : (
            <ul className="feed">
              {data.recent_activity.map((e: ActivityEvent, i) => (
                <li key={`${e.type}-${e.ref}-${i}`} className="feed-item">
                  <span className="dot" style={{ background: ACTIVITY_COLORS[e.type] ?? "#9ca3af" }} />
                  <div className="feed-body">
                    <div className="feed-label">{e.label}</div>
                    <div className="feed-ts font-mono">{fmtIST(e.ts)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <style jsx>{`
        .page {
          padding: 38px 40px 80px;
          max-width: 1320px;
          margin: 0 auto;
        }
        .page-head {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 30px;
          flex-wrap: wrap;
        }
        .page-title {
          font-size: clamp(30px, 4vw, 48px);
          font-weight: 700;
          margin-top: 6px;
        }
        .head-status {
          display: flex;
          align-items: center;
          gap: 9px;
          font-size: 12px;
          letter-spacing: 0.06em;
          color: var(--color-text-dim);
        }
        .head-err {
          color: var(--color-crit);
        }

        .block {
          margin-top: 36px;
        }
        .block-title {
          font-family: var(--font-mono);
          font-size: 12px;
          letter-spacing: 0.24em;
          text-transform: uppercase;
          color: var(--color-text-faint);
          margin-bottom: 16px;
        }
        .tile-grid {
          display: grid;
          gap: 14px;
        }
        .cols-6 {
          grid-template-columns: repeat(6, 1fr);
        }
        .tile {
          background: linear-gradient(180deg, var(--color-surface), var(--color-bg-elevated));
          border: 1px solid var(--color-line);
          border-radius: var(--radius-md);
          padding: 20px 22px;
          box-shadow: 0 1px 3px rgba(28, 38, 27, 0.05);
          transition: border-color 0.3s, transform 0.3s var(--ease-out), box-shadow 0.3s;
        }
        .tile:hover {
          border-color: var(--color-accent-dim);
          transform: translateY(-2px);
        }
        .tile-label {
          font-size: 11px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--color-text-faint);
        }
        .tile-val {
          font-size: clamp(26px, 2.4vw, 38px);
          font-weight: 700;
          margin-top: 8px;
          line-height: 1;
        }
        .tile-sub {
          margin-top: 6px;
          font-size: 12px;
          color: var(--color-text-dim);
        }
        .tile-val :global(.accent) {
          color: var(--color-accent);
        }

        .panel-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 14px;
        }
        .page-hero {
          position: relative;
          border-radius: var(--radius-lg);
          overflow: hidden;
          border: 1px solid var(--color-line);
          min-height: 220px;
          display: flex;
          align-items: flex-end;
          margin-bottom: 36px;
          box-shadow: 0 1px 3px rgba(28, 38, 27, 0.05);
        }
        .page-hero-scrim {
          position: absolute;
          inset: 0;
          background:
            linear-gradient(180deg, rgba(20, 30, 18, 0.18), rgba(20, 30, 18, 0.62)),
            radial-gradient(120% 120% at 0% 100%, rgba(20, 30, 18, 0.5), transparent);
          pointer-events: none;
        }
        .page-hero-inner {
          position: relative;
          z-index: 2;
          padding: 30px clamp(22px, 3vw, 38px);
          color: #f4f7ef;
        }
        .page-hero-title {
          font-size: clamp(24px, 3vw, 36px);
          font-weight: 700;
          margin: 10px 0 8px;
          color: #f6f8f2;
        }
        .page-hero-sub {
          margin: 0;
          max-width: 560px;
          color: #dde5d6;
          font-size: 15px;
          line-height: 1.6;
        }
        .panel {
          padding: 24px 24px 22px;
        }
        .panel-h {
          font-family: var(--font-display);
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 14px;
          color: var(--color-text);
        }
        .panel :global(.link) {
          color: var(--color-accent);
          text-decoration: none;
          font-weight: 600;
        }
        .panel :global(.link.sm) {
          display: inline-block;
          margin-top: 10px;
          font-size: 13px;
        }
        .panel :global(.link):hover {
          text-decoration: underline;
        }

        .badge {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          font-family: var(--font-mono);
          font-size: 11px;
          letter-spacing: 0.1em;
          padding: 4px 11px;
          border-radius: 99px;
          border: 1px solid;
          text-transform: uppercase;
        }

        .minibar {
          margin-top: 4px;
        }
        .minibar-track {
          display: flex;
          height: 14px;
          border-radius: 7px;
          overflow: hidden;
          background: var(--color-surface-3);
        }
        .minibar-seg {
          height: 100%;
        }
        .minibar-empty {
          margin: auto;
          font-size: 11px;
          color: var(--color-text-faint);
        }
        .minibar-legend {
          display: flex;
          gap: 16px;
          margin-top: 12px;
          flex-wrap: wrap;
        }
        .minibar-leg {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: var(--color-text-dim);
        }

        .feed {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .feed-item {
          display: flex;
          gap: 12px;
          padding: 12px 0;
          border-bottom: 1px solid var(--color-line);
        }
        .feed-item:last-child {
          border-bottom: none;
        }
        .feed-body {
          display: flex;
          justify-content: space-between;
          width: 100%;
          align-items: baseline;
          gap: 12px;
        }
        .feed-label {
          font-size: 14px;
          color: var(--color-text);
        }
        .feed-ts {
          font-size: 11px;
          color: var(--color-text-faint);
          white-space: nowrap;
        }
        .muted {
          color: var(--color-text-faint);
          font-size: 14px;
        }

        .errpanel {
          padding: 40px;
        }
        .errmsg {
          color: var(--color-crit);
          margin-top: 10px;
        }

        .skeleton-head {
          height: 40px;
          width: 320px;
          border-radius: 10px;
          background: var(--color-surface-2);
          animation: pulse 1.4s ease-in-out infinite;
        }
        .skeleton-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 14px;
          margin-top: 30px;
        }
        .skeleton-tile {
          height: 110px;
          border-radius: var(--radius-md);
          background: var(--color-surface-2);
          animation: pulse 1.4s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }

        @media (max-width: 1100px) {
          .cols-6 { grid-template-columns: repeat(3, 1fr); }
          .skeleton-grid { grid-template-columns: repeat(3, 1fr); }
        }
        @media (max-width: 640px) {
          .page { padding: 28px 20px 60px; }
          .cols-6 { grid-template-columns: repeat(2, 1fr); }
          .skeleton-grid { grid-template-columns: repeat(2, 1fr); }
        }
      `}</style>
    </main>
  );
}

function Field({ name, val }: { name: string; val: React.ReactNode }) {
  return (
    <div className="field">
      <span className="field-n">{name}</span>
      <span className="field-v">{val}</span>
      <style jsx>{`
        .field {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          padding: 9px 0;
          border-bottom: 1px solid var(--color-line);
        }
        .field:last-child {
          border-bottom: none;
        }
        .field-n {
          font-size: 13px;
          color: var(--color-text-dim);
        }
        .field-v {
          font-size: 13px;
          font-weight: 600;
          color: var(--color-text);
          text-align: right;
        }
      `}</style>
    </div>
  );
}
