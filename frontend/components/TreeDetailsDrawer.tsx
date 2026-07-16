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

// V2.5 / V2.5.1 — Tree Details Drawer (PROJECT_SPECIFICATION.md §32, §33).
// Reuses the existing Feature 6–11 APIs (inventory, inventory history,
// inspections, harvest missions) — it introduces NO new backend logic and
// performs NO mutations (read-only). FarmViewer owns `selectedTreeId` and
// renders this drawer; the drawer only reads data for the selected tree and
// emits `onClose`.
//
// V2.5.1 (ISSUE 1) — the drawer is mounted as a SIBLING of the FarmViewer
// Viewport, OUTSIDE the transformed stage, so it stays fixed on screen at any
// zoom. It is always mounted and slides in/out via `open`, so opening/closing
// never recreates the viewer.
//
// V2.5.1 (ISSUE 2) — clean dashboard cards; no new data.
//
// Data flow / reuse:
//   - tree_code, gps, times_seen come from the already-loaded `TreeOverlay`
//     (the bulk `/mission/{id}/trees` response), so the drawer never refetches
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

export default function TreeDetailsDrawer({
  open,
  tree,
  apiBaseUrl,
  onClose,
}: {
  open: boolean
  tree: TreeOverlay | null
  apiBaseUrl?: string
  onClose: () => void
}) {
  const isMobile = useIsMobile()
  const base = apiBaseUrl || API_BASE_URL

  const [detail, setDetail] = useState<TreeDetail | null>(null)
  const [loading, setLoading] = useState(false)

  // Per-tree detail cache (avoids duplicate requests on reselect).
  const cache = useRef<Map<number, TreeDetail>>(new Map())
  // Harvest-mission lookup, loaded once for the drawer's lifetime.
  const harvestLookup = useRef<Map<number, HarvestEntry> | null>(null)
  const [harvestReady, setHarvestReady] = useState(false)

  // Keep the last selected tree so the drawer still shows its content while it
  // slides out on close (V2.5.1 ISSUE 4 — no flicker / no viewer recreation).
  const lastTree = useRef<TreeOverlay | null>(null)
  if (tree) lastTree.current = tree
  const displayTree = tree ?? lastTree.current

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
      // On close, keep the last detail so the drawer content stays visible
      // during the slide-out; it is replaced when a new tree is selected.
      setLoading(false)
      return
    }
    // Wait for the harvest lookup to finish loading before fetching details, so
    // the first open doesn't fire the detail request twice (once before and once
    // after harvestReady flips). The harvest status is merged in below.
    if (!harvestReady) {
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
    // treeId re-triggers a fresh fetch; harvestReady gates the first run until
    // the harvest lookup is ready (avoids a duplicate detail request).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [treeId, harvestReady])

  const inv = detail?.inventory?.current ?? null
  const mature = inv?.mature_count ?? 0
  const potential = inv?.potential_count ?? 0
  const premature = inv?.premature_count ?? 0
  const total = inv?.total_coconuts ?? 0

  const drawerStyle: React.CSSProperties = {
    zIndex: 6,
    background: "#0d130d",
    color: "#dce8dc",
    display: "flex",
    flexDirection: "column",
    boxShadow: isMobile
      ? "0 -8px 24px rgba(0,0,0,0.5)"
      : "-8px 0 24px rgba(0,0,0,0.5)",
    transition: "transform 0.22s ease-out",
    transform: open
      ? "translate(0,0)"
      : isMobile
      ? "translateY(100%)"
      : "translateX(100%)",
    pointerEvents: open ? "auto" : "none",
        ...(isMobile
          ? {
              position: "fixed",
              left: 0,
              right: 0,
              bottom: 0,
              top: "auto",
              height: "70vh",
              borderTop: "1px solid #243024",
            }
          : {
              position: "absolute",
              top: 52,
              right: 0,
              bottom: 0,
              width: "min(384px, 92vw)",
              borderLeft: "1px solid #243024",
            }),
  }

  return (
    <div
      data-testid="tree-details-drawer"
      data-open={open ? "true" : "false"}
      onPointerDown={(e) => e.stopPropagation()}
      style={drawerStyle}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 14px",
          borderBottom: "1px solid #243024",
          flexShrink: 0,
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 15 }}>
          {displayTree?.tree_code ?? `Tree #${displayTree?.tree_id ?? ""}`}
          {displayTree && (
            <span style={{ color: "#6b7d6b", fontWeight: 400, marginLeft: 6 }}>
              #{displayTree.tree_id}
            </span>
          )}
        </div>
        <button
          type="button"
          title="Close (clears selection)"
          onClick={onClose}
          style={hdrBtn}
        >
          ×
        </button>
      </div>

      <div style={{ overflowY: "auto", padding: 14, flex: 1 }}>
        {!displayTree ? null : loading && !detail ? (
          <p style={{ color: "#9fb39f" }}>Loading tree details…</p>
        ) : (
          <>
            {/* Tree Information */}
            <Card title="Tree Information">
              <Row label="Tree code">
                {displayTree.tree_code ?? "—"}
              </Row>
              <Row label="GPS">
                {displayTree.gps_lat != null && displayTree.gps_lon != null
                  ? `${displayTree.gps_lat.toFixed(6)}, ${displayTree.gps_lon.toFixed(6)}`
                  : "—"}
              </Row>
              <Row label="Times seen">{displayTree.times_seen ?? "—"}</Row>
              <Row label="Detection confidence">
                {displayTree.confidence != null
                  ? `${(displayTree.confidence * 100).toFixed(1)}%`
                  : "—"}
              </Row>
            </Card>

            {/* Current Inventory */}
            <Card title="Current Inventory">
              {inv ? (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 8,
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
            </Card>

            {/* Inspection History */}
            <Card title="Inspection History">
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
            </Card>

            {/* Latest Inspection Images */}
            <Card title="Latest Inspection Images">
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
                        borderRadius: 6,
                        border: "1px solid #243024",
                      }}
                    />
                  ))}
                </div>
              ) : (
                <p style={{ color: "#9fb39f", margin: 0 }}>
                  No inspection images.
                </p>
              )}
            </Card>

            {/* Harvest Status */}
            <Card title="Harvest Status">
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
            </Card>
          </>
        )}
      </div>
    </div>
  )
}

const hdrBtn: React.CSSProperties = {
  width: 30,
  height: 30,
  fontSize: 18,
  lineHeight: 1,
  color: "#dce8dc",
  background: "rgba(20,28,20,0.85)",
  border: "1px solid #243024",
  borderRadius: 6,
  cursor: "pointer",
}

function Card({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid #243024",
        borderRadius: 10,
        padding: "12px 14px",
        marginBottom: 12,
      }}
    >
      <h3
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: 0.6,
          color: "#8fae8f",
          margin: "0 0 10px",
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
        padding: "3px 0",
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
        border: "1px solid #243024",
        borderRadius: 8,
        padding: "8px 10px",
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
