"use client";

import { useCallback, useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
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
import Pager from "@/components/Pager";
import SkeletonRows from "@/components/SkeletonRows";
import { usePagination } from "@/lib/usePagination";
import { fmtIST } from "@/lib/formatTime";

const POLL_MS = 5000;

const ROBOT_COLORS: Record<string, string> = {
  IDLE: "var(--color-text-faint)",
  HARVESTING: "var(--color-accent)",
  PAUSED: "var(--color-gold-ink)",
  COMPLETED: "var(--color-ok)",
  CANCELLED: "var(--color-crit)",
};

function Badge({ text }: { text: string }) {
  const ts = useTranslations("status");
  const color = ROBOT_COLORS[text] ?? "var(--color-text-faint)";
  // Only dictionary-known codes translate; backend novelties render raw so a
  // missing key can never crash the badge.
  const label = text in ROBOT_COLORS ? ts(text) : text;
  return (
    <span
      className="badge"
      style={{
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
        color,
        borderColor: `color-mix(in srgb, ${color} 40%, transparent)`,
      }}
    >
      <span className="dot" style={{ background: color }} />
      {label}
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
  const t = useTranslations("dashboard");
  const total = segments.reduce((s, x) => s + x.count, 0);
  return (
    <div className="minibar">
      <div className="minibar-track">
        {total === 0 ? (
          <span className="minibar-empty">{t("minibarEmpty")}</span>
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
  SURVEY_COMPLETED: "var(--color-accent)",
  INSPECTION_CREATED: "var(--color-gold-ink)",
  INSPECTION_COMPLETED: "var(--color-leaf)",
  INVENTORY_CREATED: "var(--color-info)",
  HARVEST_MISSION_CREATED: "var(--color-husk)",
  HARVEST_MISSION_COMPLETED: "var(--color-ok)",
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [robot, setRobot] = useState<RobotStatus | null>(null);
  const [latestRun, setLatestRun] = useState<RobotRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const t = useTranslations("dashboard");
  const tr = useTranslations("ripeness");
  const missionId = data?.current_harvest_mission?.id ?? null;
  const sim = useRobotSimulation(missionId);
  const format = useFormatter();
  const currentTreeCode = sim.harvestingTreeId != null ? t("treeCode", { id: sim.harvestingTreeId }) : null;
  const nextTreeCode = sim.nextTreeId != null ? t("treeCode", { id: sim.nextTreeId }) : null;
  const reveal = useReveal();
  const activity = usePagination(data?.recent_activity ?? []);

  // V5.1: backend activity vocabulary → translated label, keyed by the stable
  // `type` (a closed 6-value vocabulary). Dynamic bits come from the additive
  // `params` (id/code/count) — never parsed out of English text. Unknown types
  // fall back to the raw English label so a new backend event can never crash
  // the feed.
  function activityText(e: ActivityEvent): string {
    const p = e.params ?? {};
    switch (e.type) {
      case "SURVEY_COMPLETED":
        return t("actSurvey", { id: p.id ?? e.ref })
      case "INSPECTION_CREATED":
        return t("actInspCreated", { code: p.code ?? e.ref })
      case "INSPECTION_COMPLETED":
        return t("actInspDone", { code: p.code ?? e.ref })
      case "INVENTORY_CREATED":
        return t("actInvCreated", { code: p.code ?? e.ref, count: p.count ?? "—" })
      case "HARVEST_MISSION_CREATED":
        return t("actHarvestCreated", { code: p.code ?? e.ref })
      case "HARVEST_MISSION_COMPLETED":
        return t("actHarvestDone", { code: p.code ?? e.ref })
      default:
        return e.label
    }
  }

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
      setError(e instanceof Error ? e.message : t("errLoad"));
    }
  }, [t]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  if (error && !data) {
    return (
      <main className="page" ref={reveal}>
        <div className="errpanel">
          <h1>{t("dashTitle")}</h1>
          <p className="errmsg">{t("errPrefix", { msg: error })}</p>
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
        <div className="block">
          <div className="panel-grid pgrid">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="panel-skel" />
            ))}
          </div>
        </div>
        <div className="block">
          <div className="panel-skel psk-feed" />
        </div>
        <style jsx>{`
          .pgrid {
            grid-template-columns: repeat(2, 1fr);
          }
          .panel-skel {
            height: 168px;
            border: 1px solid var(--color-line);
            border-radius: var(--radius-md);
            background: linear-gradient(180deg, var(--color-surface), var(--color-bg-elevated));
            opacity: 0.5;
            animation: pulse 1.4s ease-in-out infinite;
          }
          .panel-skel {
            animation-delay: 0.15s;
          }
          .psk-feed {
            height: 220px;
          }
        `}</style>
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
          <p className="kicker">{t("headerKicker")}</p>
          <h1 className="page-title font-display tracking-tightest">{t("headerTitle")}</h1>
        </div>
        <div className="head-status">
          <span className="dot" style={{ background: "var(--color-ok)" }} />
          <span className="font-mono">
            {lastRefresh
              ? t("liveNow", {
                  time: format.dateTime(lastRefresh, {
                    hour: "numeric",
                    minute: "2-digit",
                    second: "2-digit",
                  }),
                })
              : t("connecting")}
          </span>
          {error && <span className="head-err">· {error}</span>}
        </div>
      </header>

      {/* Hero banner — dedicated, clearly visible clip (not hidden behind cards) */}
      <section className="page-hero" aria-label={t("heroAria")}>
        <AmbientClip src="/clips/2.mp4" opacity={0.32} />
        <div className="page-hero-scrim" />
        <div className="page-hero-inner">
          <p className="kicker">{t("heroKicker")}</p>
          <h2 className="page-hero-title font-display tracking-tightest">
            {t("heroTitle")}
          </h2>
          <p className="page-hero-sub">
            {t("heroSub")}
          </p>
        </div>
      </section>

      {/* Overview */}
      <section className="block">
        <h2 className="block-title">{t("overview")}</h2>
        <div className="tile-grid cols-6">
          <StatTile label={t("tileSurveyMissions")} val={o.survey_missions} />
          <StatTile label={t("tilePermanentTrees")} val={o.permanent_trees} />
          <StatTile label={t("treesInspected")} val={o.trees_inspected} />
          <StatTile label={t("inventorySnapshots")} val={o.inventory_snapshots} />
          <StatTile label={t("harvestMissions")} val={o.harvest_missions} />
          <StatTile
            label={t("latestRunScore")}
            val={latestRun?.mission_score ?? "—"}
            sub={latestRun ? t("runLabel", { id: latestRun.id }) : t("noRunsYet")}
          />
        </div>
      </section>

      {/* Farm Summary — compact striped rows (Overview above carries the tiles) */}
      <section className="block">
        <h2 className="block-title">{t("farmSummary")}</h2>
        <div className="panel" data-reveal>
          <div className="sum-grid">
            <div className="sum-row"><span>{t("totalTrees")}</span><b>{fs.total_trees}</b></div>
            <div className="sum-row"><span>{t("totalCoconuts")}</span><b>{fs.total_coconuts}</b></div>
            <div className="sum-row"><span>{t("mature")}</span><b>{fs.mature}</b></div>
            <div className="sum-row"><span>{t("potential")}</span><b>{fs.potential}</b></div>
            <div className="sum-row"><span>{t("premature")}</span><b>{fs.premature}</b></div>
            <div className="sum-row"><span>{t("harvested")}</span><b>{fs.harvested_count}</b></div>
          </div>
        </div>
      </section>

      {/* Survey / Harvest / Robot / Run */}
      <section className="block">
        <div className="panel-grid">
          <div className="panel" data-reveal>
            <h3 className="panel-h">{t("panelSurvey")}</h3>
            <Field name={t("fLatestSurvey")} val={data.survey.latest_survey ? `#${data.survey.latest_survey.id} · ${data.survey.latest_survey.status}` : "—"} />
            <Field name={t("fActiveSurvey")} val={data.survey.active_survey ? `#${data.survey.active_survey.id}` : t("noneValue")} />
            <Field name={t("fLastScan")} val={fmtIST(data.survey.last_scan_time)} />
          </div>

          <div className="panel" data-reveal>
            <h3 className="panel-h">{t("panelHarvest")}</h3>
            <Field name={t("fCurrentMission")} val={hm ? hm.mission_code ?? `#${hm.id}` : "—"} />
            <Field name={t("fStatus")} val={hm ? <Badge text={hm.status} /> : "—"} />
            <Field name={t("fQueue")} val={robot ? `${robot.completed_count}/${robot.total_trees}` : "—"} />
            <Field name={t("fTreesRemaining")} val={robot ? robot.remaining_count : "—"} />
            <Field name={t("expectedHarvest")} val={hm ? hm.total_expected_coconuts : "—"} />
          </div>

          <div className="panel" data-reveal>
            <h3 className="panel-h">{t("latestRun")}</h3>
            {latestRun ? (
              <>
                <Field
                  name={t("fRun")}
                  val={
                    <Link href={`/robot/history/${latestRun.id}`} className="link">
                      #{latestRun.id}
                    </Link>
                  }
                />
                <Field name={t("fStatus")} val={<Badge text={latestRun.status} />} />
                <Field name={t("fScore")} val={latestRun.mission_score ?? "—"} />
                <Field name={t("fHarvested")} val={`${latestRun.harvested_trees}/${latestRun.total_trees}`} />
                <Field name={t("fBatteryUsed")} val={`${latestRun.battery_used_pct}%`} />
                <Link href="/robot/history" className="link sm">{t("viewAllRuns")}</Link>
              </>
            ) : (
              <Field name={t("fLastRun")} val={t("noneYet")} />
            )}
          </div>
        </div>
      </section>

      {/* Charts */}
      <section className="block">
        <h2 className="block-title">{t("analyticsTitle")}</h2>
        <div className="panel-grid">
          <div className="panel" data-reveal>
            <h3 className="panel-h">{t("ripenessDistribution")}</h3>
            <MiniBar
              segments={[
                { label: tr("mature"), count: rip.mature, color: "var(--color-leaf)" },
                { label: tr("potential"), count: rip.potential, color: "var(--color-gold)" },
                { label: tr("premature"), count: rip.premature, color: "var(--color-crit)" },
              ]}
            />
          </div>
          <div className="panel" data-reveal>
            <h3 className="panel-h">{t("coverageTitle")}</h3>
            <MiniBar
              segments={[
                { label: t("inspected"), count: cov.inspected, color: "var(--color-accent)" },
                { label: t("remaining"), count: Math.max(cov.total - cov.inspected, 0), color: "var(--color-line-strong)" },
              ]}
            />
          </div>
          <div className="panel" data-reveal>
            <h3 className="panel-h">{t("harvestProgress")}</h3>
            <MiniBar
              segments={[
                { label: t("completed"), count: hp.completed, color: "var(--color-accent)" },
                { label: t("remaining"), count: Math.max(hp.total - hp.completed, 0), color: "var(--color-line-strong)" },
              ]}
            />
          </div>
        </div>
      </section>

      {/* Twin + Robot status */}
      <section className="block">
        <div className="panel-grid">
          <DashboardFarmCard
            robot={sim.displayRobot}
            plan={sim.plan}
            destinationTreeId={sim.destinationTreeId}
            harvestingTreeId={sim.harvestingTreeId}
            completedTreeIds={sim.completedTreeIds}
          />
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
        <h2 className="block-title">{t("recentActivity")}</h2>
        <div className="panel" data-reveal>
          {data.recent_activity.length === 0 ? (
            <p className="muted">{t("noActivityYet")}</p>
          ) : (
            <>
              <ul className="feed">
                {activity.slice.map((e: ActivityEvent, i) => (
                  <li key={`${e.type}-${e.ref}-${i}`} className="feed-item">
                    <span className="dot" style={{ background: ACTIVITY_COLORS[e.type] ?? "#9ca3af" }} />
                    <div className="feed-body">
                      <div className="feed-label">{activityText(e)}</div>
                      <div className="feed-ts font-mono">{fmtIST(e.ts)}</div>
                    </div>
                  </li>
                ))}
              </ul>
              <Pager page={activity.page} totalPages={activity.totalPages} onPrev={activity.prev} onNext={activity.next} />
            </>
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
        .sum-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0 32px;
        }
        .sum-row {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: 12px;
          padding: 11px 2px;
          border-bottom: 1px solid var(--color-line);
          font-size: 13px;
        }
        .sum-row span { color: var(--color-text-dim); }
        .sum-row b {
          font-variant-numeric: tabular-nums;
          font-size: 15px;
          color: var(--color-text);
        }
        @media (max-width: 900px) {
          .sum-grid { grid-template-columns: 1fr; }
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
