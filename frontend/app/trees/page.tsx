"use client"

import { useState, useEffect } from "react"
import { useTranslations } from "next-intl"
import { getTreesSummary } from "@/lib/api/detection"
import Link from "next/link"
import PageHero from "@/components/PageHero"
import Pager from "@/components/Pager"
import { usePagination } from "@/lib/usePagination"

type TreeSummary = {
  tree_id: number
  gps_lat: number
  gps_lon: number
  coconuts_detected: number
  tasks_remaining: number
}

export default function TreesPage() {
  // V5.0: registry chrome comes from the trees/common dictionaries.
  const t = useTranslations("trees")
  const tc = useTranslations("common")
  const [trees, setTrees] = useState<TreeSummary[]>([])
  const [loading, setLoading] = useState(true)
  // V4.0.4 — client-side search + task filter (the registry previously had no
  // way to find one tree among paginated pages).
  const [query, setQuery] = useState("")
  const [taskFilter, setTaskFilter] = useState<"all" | "pending" | "clear">("all")

  const filtered = trees.filter((row) => {
    const q = query.trim().toLowerCase()
    if (q) {
      const hay = `#${row.tree_id} ${row.tree_id} ${row.gps_lat.toFixed(6)} ${row.gps_lon.toFixed(6)}`
      if (!hay.includes(q.replace(/^#/, ""))) return false
    }
    if (taskFilter === "pending" && row.tasks_remaining === 0) return false
    if (taskFilter === "clear" && row.tasks_remaining > 0) return false
    return true
  })
  const pager = usePagination(filtered)

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
        <div className="kicker">{t("heroKicker")}</div>
        <h1 className="font-display" style={{ fontSize: 36, fontWeight: 700, margin: "8px 0 16px", letterSpacing: "-0.03em" }}>{t("heroAccent")}</h1>
        <div className="panel" style={{ overflow: "hidden" }}>
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              style={{
                height: 48,
                borderTop: i === 0 ? "none" : "1px solid var(--color-line)",
                background: "var(--color-surface-2)",
                opacity: 0.5,
                animation: "pulse 1.4s ease-in-out infinite",
                animationDelay: `${i * 0.08}s`,
              }}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: "28px clamp(16px, 4vw, 48px) 56px", maxWidth: 1500, margin: "0 auto" }}>
      <PageHero
        kicker={t("heroKicker")}
        title={t("heroTitle")}
        accent={t("heroAccent")}
        sub={t("heroSub")}
        clip="/clips/7.mp4"
      />

      <div className="toolbar">
        <input
          className="input tree-search"
          placeholder={t("searchPlaceholder")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={t("searchLabel")}
        />
        <div className="filter-chips" role="group" aria-label={t("filterTasks")}>
          {(["all", "pending", "clear"] as const).map((f) => (
            <button
              key={f}
              type="button"
              className={"filter-chip" + (taskFilter === f ? " active" : "")}
              onClick={() => setTaskFilter(f)}
            >
              {f === "all" ? t("fAll") : f === "pending" ? t("fPending") : t("fClear")}
            </button>
          ))}
        </div>
        <span className="toolbar-count font-mono">
          {tc("countOf", { filtered: filtered.length, total: trees.length })}
        </span>
      </div>

      <div className="panel" style={{ overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table className="tree-table">
            <thead>
              <tr>
                <Th>ID</Th>
                <Th align="right">{t("thLatitude")}</Th>
                <Th align="right">{t("thLongitude")}</Th>
                <Th align="right">{t("thCoconuts")}</Th>
                <Th align="right">{t("thTasks")}</Th>
                <Th align="right">{t("thOpen")}</Th>
              </tr>
            </thead>
            <tbody>
              {pager.slice.map((row: TreeSummary) => (
                <tr key={row.tree_id}>
                  <Td className="tab" style={{ fontWeight: 600, fontFamily: "var(--font-mono)" }}>#{row.tree_id}</Td>
                  <Td align="right" className="tab" style={{ color: "var(--color-text-dim)", fontFamily: "var(--font-mono)", fontSize: 13 }}>{row.gps_lat.toFixed(6)}</Td>
                  <Td align="right" className="tab" style={{ color: "var(--color-text-dim)", fontFamily: "var(--font-mono)", fontSize: 13 }}>{row.gps_lon.toFixed(6)}</Td>
                  <Td align="right" className="tab" style={{ fontWeight: 600 }}>{row.coconuts_detected}</Td>
                  <Td align="right">
                    <span className={`task-pill ${row.tasks_remaining > 0 ? "pending" : "done"}`}>
                      {row.tasks_remaining > 0 ? row.tasks_remaining : t("fClear")}
                    </span>
                  </Td>
                  <Td align="right">
                    <Link href={`/trees/${row.tree_id}`} className="tree-open">
                      {t("thOpen")} →
                    </Link>
                  </Td>
                </tr>
              ))}
              {filtered.length === 0 && trees.length > 0 && (
                <tr>
                  <Td colSpan={6} style={{ padding: 0 }}>
                    <div className="tree-empty">
                      <div className="tree-empty-title">{t("noMatchTitle")}</div>
                      <p className="tree-empty-sub">
                        {t("noMatchSub")}
                      </p>
                    </div>
                  </Td>
                </tr>
              )}
              {trees.length === 0 && (
                <tr>
                  <Td colSpan={6} style={{ padding: 0 }}>
                    <div className="tree-empty">
                      <div className="tree-empty-title">{t("emptyTitle")}</div>
                      <p className="tree-empty-sub">
                        {t("emptySub")}
                      </p>
                    </div>
                  </Td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pager page={pager.page} totalPages={pager.totalPages} onPrev={pager.prev} onNext={pager.next} />
      </div>

      <style jsx>{`
        .toolbar {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 14px;
        }
        .tree-search { max-width: 320px; flex: 1; min-width: 200px; }
        .filter-chips { display: flex; gap: 6px; }
        .filter-chip {
          padding: 7px 14px;
          border-radius: 999px;
          border: 1px solid var(--color-line-strong);
          background: var(--color-surface);
          color: var(--color-text-dim);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: border-color 140ms var(--ease-out), background 140ms var(--ease-out), color 140ms var(--ease-out);
        }
        .filter-chip:hover { border-color: var(--color-accent-dim); }
        .filter-chip.active {
          border-color: var(--color-accent);
          background: var(--color-accent-weak);
          color: var(--color-accent);
        }
        .toolbar-count { font-size: 12px; color: var(--color-text-faint); margin-left: auto; }
        .tree-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
        }
        .tree-table thead tr {
          background: var(--color-surface-2);
        }
        .tree-table tbody tr {
          border-top: 1px solid var(--color-line);
          transition: background 0.14s var(--ease-out);
        }
        .tree-table tbody tr:hover {
          background: var(--color-surface-sunken);
        }
        .tree-table :global(td.tab) {
          font-variant-numeric: tabular-nums;
        }
        .task-pill {
          display: inline-flex;
          align-items: center;
          padding: 2px 11px;
          border-radius: 99px;
          font-size: 12px;
          font-weight: 600;
          font-variant-numeric: tabular-nums;
          border: 1px solid;
        }
        .task-pill.pending {
          color: var(--color-gold-dim);
          background: rgba(201, 138, 46, 0.12);
          border-color: rgba(201, 138, 46, 0.32);
        }
        .task-pill.done {
          color: var(--color-accent);
          background: var(--color-accent-weak);
          border-color: var(--color-accent-dim);
        }
        .tree-open {
          color: var(--color-accent);
          text-decoration: none;
          font-weight: 600;
          border-bottom: 1px solid transparent;
          transition: border-color 0.16s var(--ease-out);
        }
        .tree-open:hover {
          border-bottom-color: var(--color-accent-dim);
        }
        .tree-empty {
          padding: 48px 24px;
          text-align: center;
        }
        .tree-empty-title {
          font-family: var(--font-display);
          font-size: 17px;
          font-weight: 600;
          color: var(--color-text);
        }
        .tree-empty-sub {
          margin: 8px auto 0;
          max-width: 380px;
          color: var(--color-text-dim);
          font-size: 13.5px;
          line-height: 1.5;
        }
      `}</style>
    </div>
  )
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th style={{ padding: "12px 16px", fontWeight: 600, fontSize: 11.5, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-text-faint)", textAlign: align }}>{children}</th>
  )
}
function Td({ children, style, colSpan, align = "left", className }: { children: React.ReactNode; style?: React.CSSProperties; colSpan?: number; align?: "left" | "right"; className?: string }) {
  return <td colSpan={colSpan} className={className} style={{ padding: "13px 16px", verticalAlign: "middle", textAlign: align, ...style }}>{children}</td>
}
