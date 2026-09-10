"use client"

import { useEffect, useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import {
  getRobotRuns,
  type RobotRun,
  type RunStatus,
} from "@/lib/api/detection"
import PageHero from "@/components/PageHero"
import Pager from "@/components/Pager"
import SkeletonRows from "@/components/SkeletonRows"
import { usePagination } from "@/lib/usePagination"
import { fmtIST } from "@/lib/formatTime"

// Status colours are AA-checked tokens (text + 16% tint background both derive
// from the same value; the old neon hexes failed contrast on white).
const statusColor: Record<RunStatus, string> = {
  COMPLETED: "var(--color-accent)",
  ABORTED: "var(--color-gold-ink)",
  FAILED: "var(--color-crit)",
}

function fmtDuration(s: number | null) {
  if (s == null) return "—"
  const m = Math.floor(s / 60)
  const sec = Math.round(s % 60)
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`
}

function fmtTime(iso: string | null) {
  return fmtIST(iso)
}

type SortKey = "finished_at" | "mission_score" | "harvested_trees" | "duration_s"

export default function MissionHistoryPage() {
  // V5.0: run-status labels come from the shared status dictionary.
  const t = useTranslations("history")
  const ts = useTranslations("status")
  const [runs, setRuns] = useState<RobotRun[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>("finished_at")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const [statusFilter, setStatusFilter] = useState<"all" | RunStatus>("all")
  useEffect(() => {
    setLoading(true)
    getRobotRuns(200)
      .then((d) => setRuns(d))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  const sorted = useMemo(() => {
    const arr = [...runs].filter((r) => statusFilter === "all" || r.status === statusFilter)
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
  }, [runs, sortKey, sortDir, statusFilter])

  const pager = usePagination(sorted)

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
      <PageHero
        kicker={t("heroKicker")}
        title={t("heroTitle")}
        accent={t("heroAccent")}
        sub={t("heroSub")}
        clip="/clips/6.mp4"
      />

      {loading && (
        <div className="panel" style={{ overflow: "hidden" }}>
          <SkeletonRows rows={8} />
        </div>
      )}
      {error && <p style={{ color: "var(--color-crit)" }}>{error}</p>}
      {!loading && !error && runs.length === 0 && (
        <div className="panel-2" style={{ padding: 24, color: "var(--color-text-dim)" }}>
          {t("emptyCtaA")}{" "}
          <Link href="/robot" style={{ color: "var(--color-accent)", textDecoration: "none", borderBottom: "1px solid var(--color-accent-dim)" }}>
            {t("emptyCtaLink")}
          </Link>{" "}
          {t("emptyCtaB")}
        </div>
      )}

      {sorted.length > 0 && (
        <div className="panel" style={{ overflow: "hidden" }}>
          <div className="hist-toolbar">
            <div className="hist-chips" role="group" aria-label={t("filterAria")}>
              {(["all", "COMPLETED", "ABORTED", "FAILED"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  className={"hist-chip" + (statusFilter === f ? " active" : "")}
                  onClick={() => setStatusFilter(f)}
                >
                  {f === "all" ? t("allRuns") : ts(f)}
                </button>
              ))}
            </div>
            <span className="hist-count font-mono">{t("runsCount", { count: sorted.length })}</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ background: "var(--color-surface-2)", textAlign: "left" }}>
                  <Th>#</Th>
                  <Th>{t("thStatus")}</Th>
                  <Th>{t("thMission")}</Th>
                  <Th>{t("thFinished")}</Th>
                  <Th align="right" sortable dir={sortKey === "duration_s" ? sortDir : null} onClick={() => toggleSort("duration_s")}>
                    {t("thDuration")}
                  </Th>
                  <Th align="right" sortable dir={sortKey === "harvested_trees" ? sortDir : null} onClick={() => toggleSort("harvested_trees")}>
                    {t("thHarvested")}
                  </Th>
                  <Th align="right">{t("thBattery")}</Th>
                  <Th align="right">{t("thDistance")}</Th>
                  <Th align="right" sortable dir={sortKey === "mission_score" ? sortDir : null} onClick={() => toggleSort("mission_score")}>
                    {t("thScore")}
                  </Th>
                </tr>
              </thead>
              <tbody>
                {pager.slice.map((r) => (
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
                        {ts(r.status)}
                      </span>
                    </Td>
                    <Td>{r.mission_id ?? "—"}</Td>
                    <Td style={{ color: "var(--color-text-dim)", whiteSpace: "nowrap" }}>{fmtTime(r.finished_at)}</Td>
                    <Td align="right" className="tab">{fmtDuration(r.duration_s)}</Td>
                    <Td align="right" className="tab">
                      {r.harvested_trees}/{r.total_trees}
                    </Td>
                    <Td align="right" className="tab">{r.battery_used_pct}%</Td>
                    <Td align="right" className="tab">{r.distance_travelled} m</Td>
                    <Td align="right" className="tab" style={{ fontWeight: 700, color: "var(--color-accent)" }}>
                      {r.mission_score ?? "—"}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={pager.page} totalPages={pager.totalPages} onPrev={pager.prev} onNext={pager.next} />
        </div>
      )}
      {!loading && !error && runs.length > 0 && sorted.length === 0 && (
        <div className="panel-2" style={{ padding: 24, color: "var(--color-text-dim)" }}>
          {t("emptyFilter", { status: ts(statusFilter as RunStatus) })}
        </div>
      )}

      <style jsx>{`
        .hist-toolbar {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          padding: 12px 16px;
          border-bottom: 1px solid var(--color-line);
        }
        .hist-chips { display: flex; gap: 6px; flex-wrap: wrap; }
        .hist-chip {
          padding: 6px 13px;
          border-radius: 999px;
          border: 1px solid var(--color-line-strong);
          background: var(--color-surface);
          color: var(--color-text-dim);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: border-color 140ms var(--ease-out), background 140ms var(--ease-out), color 140ms var(--ease-out);
        }
        .hist-chip:hover { border-color: var(--color-accent-dim); }
        .hist-chip.active {
          border-color: var(--color-accent);
          background: var(--color-accent-weak);
          color: var(--color-accent);
        }
        .hist-count { font-size: 12px; color: var(--color-text-faint); margin-left: auto; }
        td.tab { font-variant-numeric: tabular-nums; }
      `}</style>
    </div>
  )
}

function Th({
  children,
  sortable,
  dir,
  onClick,
  align = "left",
}: {
  children: React.ReactNode
  sortable?: boolean
  /** null = inactive (muted ↕ affordance); "asc"/"desc" = active arrow. */
  dir?: "asc" | "desc" | null
  onClick?: () => void
  align?: "left" | "right"
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
        textAlign: align,
      }}
    >
      {children}
      {sortable && (
        <span
          aria-hidden
          style={{
            marginLeft: 6,
            fontSize: 10,
            opacity: dir ? 1 : 0.35,
            color: dir ? "var(--color-accent)" : "var(--color-text-faint)",
          }}
        >
          {dir === "asc" ? "▲" : dir === "desc" ? "▼" : "↕"}
        </span>
      )}
    </th>
  )
}

function Td({
  children,
  style,
  align = "left",
  className,
}: {
  children: React.ReactNode
  style?: React.CSSProperties
  align?: "left" | "right"
  className?: string
}) {
  return (
    <td className={className} style={{ padding: "12px 16px", verticalAlign: "middle", textAlign: align, ...style }}>{children}</td>
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
