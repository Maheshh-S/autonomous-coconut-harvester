"use client"

import { useEffect, useRef, useState } from "react"
import { API_BASE_URL } from "@/lib/api/detection"
import type {
  TreeOverlay,
  InventorySnapshot,
  Inspection,
  InspectionImage,
} from "@/lib/api/detection"
import {
  getTreeInventory,
  getTreeInventoryHistory,
  getTreeInspections,
  getInspectionImages,
  getHarvestMissions,
  getHarvestMissionItems,
} from "@/lib/api/detection"

// V2.5 — Tree Details Panel (PROJECT_SPECIFICATION.md §32, §33). Reuses the
// existing Feature 6–11 APIs (inventory, inventory history, inspections, harvest
// missions) — it introduces NO new backend logic and performs NO mutations
// (read-only). FarmViewer owns `selectedTreeId` and renders this panel; the
// panel only reads data for the selected tree and emits `onClose`.
//
// Data flow / reuse:
//   - tree_code, gps, times_seen come from the already-loaded `TreeOverlay`
//     (the bulk `/mission/{id}/trees` response), so the panel never refetches
//     them.
//   - inventory / inventory-history / inspections are fetched per tree but
//     cached in a Map, so re-selecting a tree is instant (no duplicate
//     requests). The latest completed inspection's images are fetched on demand.
//   - harvest status is read from the most recent Harvest Mission's items,
//     loaded once and reused across selections (§35/§43 reuse, no new endpoint).

type HarvestEntry = { mission_code: string | null; status: string }

type TreeDetail = {
  inventory: {
    tree_code: string | null
    current_inventory_id: number | null
    current: InventorySnapshot | null
  } | null
  history: InventorySnapshot[] | null
  inspections: Inspection[] | null
  images: InspectionImage[] | null
  harvest: HarvestEntry | null
}

const HARVEST_TYPE_LABEL: Record<string, string> = {
  mature: "Mature",
  potential: "Potential",
  premature: "Premature",
  all: "All",
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleString()
}

function useIsMobile() {
  const [mobile, setMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)")
    const update = () => setMobile(mq.matches)
    update()
    mq.addEventListener("change", update)
    return () => mq.removeEventListener("change", update)
  }, [])
  return mobile
}

export default function TreeDetailsPanel({
  tree,
  apiBaseUrl,
  onClose,
}: {
  tree: TreeOverlay | null
  apiBaseUrl?: string
  onClose: () => void
}) {
  const isMobile = useIsMobile()
  const base = apiBaseUrl || API_BASE_URL
  const [collapsed, setCollapsed] = useState(false)

  const [detail, setDetail] = useState<TreeDetail | null>(null)
  const [loading, setLoading] = useState(false)

  // Per-tree detail cache (avoids duplicate requests on reselect).
  const cache = useRef<Map<number, TreeDetail>>(new Map())
  // Harvest-mission lookup, loaded once for the panel's lifetime.
  const harvestLookup = useRef<Map<number, HarvestEntry> | null>(null)
  const [harvestReady, setHarvestReady] = useState(false)

  const treeId = tree?.tree_id ?? null

  // Load harvest status once: most recent Harvest Mission's ordered items.
  useEffect(() => {
    let cancelled = false
    async function loadHarvest() {
      try {
        const { missions } = await getHarvestMissions(1)
        const latest = (missions || []).sort((a, b) => b.id - a.id)[0]
        if (latest) {
          const mission = await getHarvestMissionItems(latest.id)
          const map = new Map<number, HarvestEntry>()
          for (const it of mission.items || []) {
            map.set(it.tree_id, {
              mission_code: latest.mission_code,
              status: it.status,
            })
          }
          if (!cancelled) harvestLookup.current = map
        }
      } catch {
        // Harvest status is optional ("if applicable"); ignore failures.
      } finally {
        if (!cancelled) setHarvestReady(true)
      }
    }
    loadHarvest()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (treeId == null) {
      setDetail(null)
      setLoading(false)
      return
    }
    const lookup = () => harvestLookup.current?.get(treeId) ?? null
    const cached = cache.current.get(treeId)
    if (cached) {
      setDetail({ ...cached, harvest: lookup() })
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    ;(async () => {
      const [inv, hist, insp] = await Promise.all([
        getTreeInventory(treeId),
        getTreeInventoryHistory(treeId),
        getTreeInspections(treeId),
      ])
      let images: InspectionImage[] | null = null
      const latest = (insp.inspections || []).find(
        (i) =>
          i.status === "COMPLETED" && (i.inspection_image_count ?? 0) > 0
      )
      if (latest) {
        try {
          const r = await getInspectionImages(latest.id)
          images = r.images || []
        } catch {
          images = []
        }
      }
      const d: TreeDetail = {
        inventory: inv,
        history: hist.snapshots || [],
        inspections: insp.inspections || [],
        images,
        harvest: lookup(),
      }
      if (!cancelled) {
        cache.current.set(treeId, d)
        setDetail(d)
        setLoading(false)
      }
    })().catch(() => {
      if (!cancelled) {
        setDetail(null)
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
    // harvestReady triggers a re-resolve so harvest status appears once loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [treeId, harvestReady])

  if (!tree) return null

  const inv = detail?.inventory?.current ?? null
  const mature = inv?.mature_count ?? 0
  const potential = inv?.potential_count ?? 0
  const premature = inv?.premature_count ?? 0
  const total = inv?.total_coconuts ?? 0

  const panelStyle: React.CSSProperties = isMobile
    ? {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        maxHeight: "48vh",
        background: "#0d130d",
        borderTop: "1px solid #2c3a2c",
        color: "#dce8dc",
        zIndex: 6,
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 -4px 16px rgba(0,0,0,0.4)",
      }
    : {
        position: "absolute",
        top: 0,
        right: 0,
        bottom: 0,
        width: 360,
        background: "#0d130d",
        borderLeft: "1px solid #2c3a2c",
        color: "#dce8dc",
        zIndex: 6,
        display: "flex",
        flexDirection: "column",
        boxShadow: "-4px 0 16px rgba(0,0,0,0.4)",
      }

  return (
    <div
      data-testid="tree-details-panel"
      onPointerDown={(e) => e.stopPropagation()}
      style={panelStyle}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 12px",
          borderBottom: collapsed ? "none" : "1px solid #2c3a2c",
          flexShrink: 0,
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 14 }}>
          {tree.tree_code ?? `Tree #${tree.tree_id}`}
          <span style={{ color: "#6b7d6b", fontWeight: 400, marginLeft: 6 }}>
            #{tree.tree_id}
          </span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            title={collapsed ? "Expand" : "Collapse"}
            onClick={() => setCollapsed((c) => !c)}
            style={hdrBtn}
          >
            {collapsed ? "▢" : "—"}
          </button>
          <button
            type="button"
            title="Close (clears selection)"
            onClick={onClose}
            style={hdrBtn}
          >
            ×
          </button>
        </div>
      </div>

      {!collapsed && (
        <div style={{ overflowY: "auto", padding: 12, flex: 1 }}>
          {loading && <p style={{ color: "#9fb39f" }}>Loading tree details…</p>}

          {/* Location */}
          <Section title="Location">
            <Row label="GPS">
              {tree.gps_lat != null && tree.gps_lon != null
                ? `${tree.gps_lat.toFixed(6)}, ${tree.gps_lon.toFixed(6)}`
                : "—"}
            </Row>
            <Row label="Times seen">{tree.times_seen ?? "—"}</Row>
            <Row label="Detection confidence">
              {tree.confidence != null
                ? `${(tree.confidence * 100).toFixed(1)}%`
                : "—"}
            </Row>
          </Section>

          {/* Current Inventory */}
          <Section title="Current Inventory">
            {inv ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 6,
                }}
              >
                <Stat label="Total" value={total} />
                <Stat label="Mature" value={mature} />
                <Stat label="Potential" value={potential} />
                <Stat label="Premature" value={premature} />
              </div>
            ) : (
              <p style={{ color: "#9fb39f", margin: 0 }}>No inventory yet.</p>
            )}
          </Section>

          {/* Inventory History */}
          <Section title="Inventory History">
            {(detail?.history?.length ?? 0) > 0 ? (
              <ul style={listStyle}>
                {(detail?.history || []).slice(0, 10).map((s) => (
                  <li key={s.id} style={{ marginBottom: 6 }}>
                    <span style={{ color: "#9fb39f" }}>
                      {fmtDate(s.created_at)}
                    </span>{" "}
                    — T:{s.total_coconuts} M:{s.mature_count} P:
                    {s.potential_count} PR:{s.premature_count}
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ color: "#9fb39f", margin: 0 }}>No history.</p>
            )}
          </Section>

          {/* Inspection History */}
          <Section title="Inspection History">
            {(detail?.inspections?.length ?? 0) > 0 ? (
              <ul style={listStyle}>
                {(detail?.inspections || []).slice(0, 10).map((i) => (
                  <li key={i.id} style={{ marginBottom: 6 }}>
                    <span style={{ color: "#9fb39f" }}>
                      {i.inspection_code ?? `#${i.id}`}
                    </span>{" "}
                    — {i.status}
                    {i.inspection_image_count
                      ? ` · ${i.inspection_image_count} imgs`
                      : ""}{" "}
                    <span style={{ color: "#9fb39f" }}>
                      ({fmtDate(i.created_at)})
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ color: "#9fb39f", margin: 0 }}>No inspections.</p>
            )}
          </Section>

          {/* Latest Inspection Images */}
          <Section title="Latest Inspection Images">
            {(detail?.images?.length ?? 0) > 0 ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 6,
                }}
              >
                {(detail?.images || []).slice(0, 6).map((img) => (
                  <img
                    key={img.id}
                    src={`${base}${img.url}`}
                    alt={img.original_filename || "inspection"}
                    style={{
                      width: "100%",
                      aspectRatio: "1 / 1",
                      objectFit: "cover",
                      borderRadius: 4,
                      border: "1px solid #2c3a2c",
                    }}
                  />
                ))}
              </div>
            ) : (
              <p style={{ color: "#9fb39f", margin: 0 }}>
                No inspection images.
              </p>
            )}
          </Section>

          {/* Harvest */}
          <Section title="Harvest">
            <Row label="Eligible (current inventory)">
              {inv
                ? [
                    mature > 0 ? `Mature (${mature})` : null,
                    premature > 0 ? `Premature (${premature})` : null,
                    total > 0 ? `All (${total})` : null,
                  ]
                    .filter(Boolean)
                    .join(", ") || "None"
                : "—"}
            </Row>
            <Row label="Status">
              {detail?.harvest
                ? `In ${detail.harvest.mission_code ?? "mission"} — ${
                    HARVEST_TYPE_LABEL[detail.harvest.status] ||
                    detail.harvest.status
                  }`
                : "Not in a harvest mission"}
            </Row>
          </Section>
        </div>
      )}
    </div>
  )
}

const hdrBtn: React.CSSProperties = {
  width: 28,
  height: 28,
  fontSize: 16,
  lineHeight: 1,
  color: "#dce8dc",
  background: "rgba(20,28,20,0.85)",
  border: "1px solid #2c3a2c",
  borderRadius: 6,
  cursor: "pointer",
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h3
        style={{
          fontSize: 12,
          textTransform: "uppercase",
          letterSpacing: 0.5,
          color: "#8fae8f",
          margin: "0 0 8px",
        }}
      >
        {title}
      </h3>
      {children}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        fontSize: 13,
        padding: "2px 0",
      }}
    >
      <span style={{ color: "#9fb39f" }}>{label}</span>
      <span style={{ textAlign: "right" }}>{children}</span>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        background: "rgba(20,28,20,0.6)",
        border: "1px solid #2c3a2c",
        borderRadius: 6,
        padding: "6px 8px",
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 700 }}>{value}</div>
      <div style={{ fontSize: 11, color: "#9fb39f" }}>{label}</div>
    </div>
  )
}

const listStyle: React.CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  fontSize: 12,
  lineHeight: 1.4,
}
