export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000"

// Persisted representative tree observation for the Digital Twin overlay (§V2.4).
// All coordinates are in the tile's own pixel space (§V2.5); `survey_tile_id`
// links the tree to its mosaic tile so the overlay can align in farm-pixel space.
// `gps_lat`/`gps_lon` and `times_seen` are carried here (additive, persisted on
// `Tree`) so the V2.5 Tree Details panel (§32/§33) needs no extra bulk request —
// it reads them straight from the overlay data the viewer already loaded.
export type TreeOverlay = {
  tree_id: number
  tree_code: string | null
  gps_lat: number | null
  gps_lon: number | null
  times_seen: number | null
  survey_tile_id: number
  local_pixel_x: number
  local_pixel_y: number
  bbox_x1: number
  bbox_y1: number
  bbox_x2: number
  bbox_y2: number
  confidence: number
}

function getApiUrl(path: string) {
  return `${API_BASE_URL}${path}`
}

export async function detectTrees(image: File) {

  const formData = new FormData()
  formData.append("file", image)

  const res = await fetch(getApiUrl("/detect/trees"), {
    method: "POST",
    body: formData
  })

  if (!res.ok) {
    throw new Error("Tree detection failed")
  }

  return res.json()
}

export async function detectCoconuts(image: File) {

  const formData = new FormData()
  formData.append("file", image)

  const res = await fetch(getApiUrl("/detect/coconuts"), {
    method: "POST",
    body: formData
  })

  if (!res.ok) {
    throw new Error("Coconut detection failed")
  }

  return res.json()
}

export async function storeDetection(
  treeId: number,
  coconutId: number,
  ripeness: string,
  confidence: number,
  harvestType: string
) {

  const res = await fetch(
    getApiUrl("/drone/detection"),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tree_id: treeId,
        coconut_id: coconutId,
        ripeness,
        confidence,
        harvest_type: harvestType,
      }),
    }
  )

  if (!res.ok) {
    throw new Error("Failed to store detection")
  }

  return res.json()
}

export async function getTreesSummary() {

  const res = await fetch(
    getApiUrl("/trees/summary"),
    {
      cache: "no-store",
      next: { revalidate: 0 }
    }
  )

  if (!res.ok) {
    console.error("Fetch failed", res.status)
    throw new Error("Failed to fetch trees")
  }

  return res.json()
}

// ---------------------------------------------------------------------------
// Survey Mission + image ingestion (Feature 2)
// ---------------------------------------------------------------------------

export async function getMissions() {
  const res = await fetch(getApiUrl("/missions"), { cache: "no-store" })
  if (!res.ok) throw new Error("Failed to load missions")
  return res.json()
}

export async function createMission(payload: {
  source_folder: string
  base_gps_lat?: number
  base_gps_lon?: number
}) {
  const res = await fetch(getApiUrl("/mission/create"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error("Failed to create mission")
  return res.json()
}

export async function uploadSurveyImages(missionId: number, files: File[]) {
  const formData = new FormData()
  for (const file of files) {
    formData.append("files", file)
  }
  const res = await fetch(getApiUrl(`/mission/${missionId}/images`), {
    method: "POST",
    body: formData,
  })
  if (!res.ok) throw new Error("Image upload failed")
  return res.json()
}

export async function getMissionImages(missionId: number) {
  const res = await fetch(getApiUrl(`/mission/${missionId}/images`), {
    cache: "no-store",
  })
  if (!res.ok) throw new Error("Failed to load mission images")
  return res.json()
}

export async function completeMission(missionId: number) {
  const res = await fetch(getApiUrl("/mission/complete"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mission_id: missionId }),
  })
  if (!res.ok) throw new Error("Failed to complete mission")
  return res.json()
}

export async function getMissionTiles(missionId: number) {
  const res = await fetch(getApiUrl(`/mission/${missionId}/tiles`), {
    cache: "no-store",
  })
  if (!res.ok) throw new Error("Failed to load survey tiles")
  return res.json()
}

// Bulk tree-overlay data for the Digital Twin (§V2.4, §V2.10). Returns the
// persisted representative observation of every tree shown in the mission's
// mosaic — one call, no per-tree round-trips.
export async function getMissionTreeOverlays(missionId: number) {
  const res = await fetch(getApiUrl(`/mission/${missionId}/trees`), {
    cache: "no-store",
  })
  if (!res.ok) throw new Error("Failed to load tree overlays")
  return res.json() as Promise<{ mission_id: number; trees: TreeOverlay[]; count: number }>
}

export async function getTileStats(missionId: number) {
  const res = await fetch(getApiUrl(`/mission/${missionId}/tiles/stats`), {
    cache: "no-store",
  })
  if (!res.ok) throw new Error("Failed to load tile statistics")
  return res.json()
}

export async function getTileGeneration(missionId: number) {
  const res = await fetch(getApiUrl(`/mission/${missionId}/tile-generation`), {
    cache: "no-store",
  })
  if (!res.ok) throw new Error("Failed to load tile generation progress")
  return res.json()
}

export async function getPermanentTrees(
  missionId: number,
  page: number = 1,
  pageSize: number = 20
) {
  const res = await fetch(
    getApiUrl(
      `/mission/${missionId}/permanent-trees?page=${page}&page_size=${pageSize}`
    ),
    { cache: "no-store" }
  )
  if (!res.ok) throw new Error("Failed to load permanent trees")
  return res.json()
}

// ---------------------------------------------------------------------------
// Tree Inspection Sessions (Feature 7)
// ---------------------------------------------------------------------------

export type InspectionStatus =
  | "CREATED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "FAILED"

export interface Inspection {
  id: number
  inspection_code: string
  tree_id: number
  tree_code: string | null
  created_at: string | null
  completed_at: string | null
  status: InspectionStatus
  inspection_image_count: number
  notes: string | null
}

export async function createInspection(treeId: number, notes?: string) {
  const res = await fetch(getApiUrl("/inspection/create"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tree_id: treeId, notes }),
  })
  if (!res.ok) throw new Error("Failed to create inspection")
  return res.json() as Promise<Inspection>
}

export async function startInspection(id: number) {
  const res = await fetch(getApiUrl(`/inspection/${id}/start`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  })
  if (!res.ok) throw new Error("Failed to start inspection")
  return res.json() as Promise<Inspection>
}

export async function completeInspection(id: number, imageCount: number) {
  const res = await fetch(getApiUrl(`/inspection/${id}/complete`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ inspection_image_count: imageCount }),
  })
  if (!res.ok) throw new Error("Failed to complete inspection")
  return res.json() as Promise<Inspection>
}

export async function getTreeInspections(treeId: number) {
  const res = await fetch(getApiUrl(`/tree/${treeId}/inspections`), {
    cache: "no-store",
  })
  if (!res.ok) throw new Error("Failed to load tree inspections")
  return res.json() as Promise<{ tree_id: number; tree_code: string | null; inspections: Inspection[] }>
}

export type InspectionImageStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"

export interface InspectionImage {
  id: number
  inspection_id: number
  filename: string
  original_filename: string
  upload_order: number
  created_at: string | null
  status: InspectionImageStatus
  detection_count: number
  detection_summary: Record<string, number>
  url: string
}

export async function uploadInspectionImages(
  inspectionId: number,
  files: File[]
) {
  const formData = new FormData()
  for (const file of files) {
    formData.append("files", file)
  }
  const res = await fetch(getApiUrl(`/inspection/${inspectionId}/images`), {
    method: "POST",
    body: formData,
  })
  if (!res.ok) throw new Error("Failed to upload inspection images")
  return res.json() as Promise<{
    inspection_id: number
    uploaded: InspectionImage[]
    uploaded_count: number
  }>
}

export async function processInspectionImages(inspectionId: number) {
  const res = await fetch(getApiUrl(`/inspection/${inspectionId}/process`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  })
  if (!res.ok) throw new Error("Failed to process inspection images")
  return res.json() as Promise<{
    inspection_id: number
    processed: number
    detections_created: number
    images: InspectionImage[]
  }>
}

export async function getInspectionImages(inspectionId: number) {
  const res = await fetch(getApiUrl(`/inspection/${inspectionId}/images`), {
    cache: "no-store",
  })
  if (!res.ok) throw new Error("Failed to load inspection images")
  return res.json() as Promise<{ inspection_id: number; images: InspectionImage[] }>
}

// ---------------------------------------------------------------------------
// Inventory Snapshot (Feature 9)
// ---------------------------------------------------------------------------

export interface InventorySnapshot {
  id: number
  snapshot_code: string | null
  tree_id: number
  tree_code: string | null
  inspection_id: number
  inspection_code: string | null
  created_at: string | null
  total_coconuts: number
  mature_count: number
  potential_count: number
  premature_count: number
}

export async function getTreeInventory(treeId: number) {
  const res = await fetch(getApiUrl(`/tree/${treeId}/inventory`), {
    cache: "no-store",
  })
  if (!res.ok) throw new Error("Failed to load tree inventory")
  return res.json() as Promise<{
    tree_id: number
    tree_code: string | null
    current_inventory_id: number | null
    current: InventorySnapshot | null
  }>
}

export async function getTreeInventoryHistory(treeId: number) {
  const res = await fetch(getApiUrl(`/tree/${treeId}/inventory/history`), {
    cache: "no-store",
  })
  if (!res.ok) throw new Error("Failed to load tree inventory history")
  return res.json() as Promise<{
    tree_id: number
    tree_code: string | null
    current_inventory_id: number | null
    snapshots: InventorySnapshot[]
  }>
}

// ---------------------------------------------------------------------------
// Harvest Planner & Mission Builder (Feature 10)
// ---------------------------------------------------------------------------

export type HarvestType = "mature" | "potential" | "premature" | "all"

export type HarvestMissionStatus =
  | "CREATED"
  | "RUNNING"
  | "PAUSED"
  | "COMPLETED"
  | "CANCELLED"

export interface HarvestMissionItem {
  id: number
  mission_id: number
  tree_id: number
  tree_code: string | null
  gps_lat: number | null
  gps_lon: number | null
  visit_order: number
  expected_coconuts: number
  harvested: number | null
  status: string
}

export type RobotState =
  | "IDLE"
  | "HARVESTING"
  | "PAUSED"
  | "COMPLETED"
  | "CANCELLED"

export interface RobotStatus {
  mission_id: number
  mission_code: string | null
  mission_status: HarvestMissionStatus
  robot_state: RobotState
  current_item: HarvestMissionItem | null
  next_item: HarvestMissionItem | null
  completed_count: number
  remaining_count: number
  total_trees: number
  total_expected_coconuts: number
  harvested_coconuts: number
}

export interface HarvestMission {
  id: number
  mission_code: string | null
  created_at: string | null
  completed_at: string | null
  status: HarvestMissionStatus
  harvest_type: HarvestType
  total_trees: number
  total_expected_coconuts: number
  notes: string | null
  items?: HarvestMissionItem[]
}

export async function createHarvestMission(
  harvestType: HarvestType,
  notes?: string
) {
  const res = await fetch(getApiUrl("/harvest/missions"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ harvest_type: harvestType, notes }),
  })
  if (!res.ok) {
    let detail = "Failed to generate harvest mission"
    try {
      const body = await res.json()
      if (body?.detail) detail = body.detail
    } catch {
      // response had no JSON body; keep the default message
    }
    throw new Error(detail)
  }
  return res.json() as Promise<HarvestMission>
}

export async function getHarvestMissions(limit = 50) {
  const res = await fetch(getApiUrl(`/harvest/missions?limit=${limit}`), {
    cache: "no-store",
  })
  if (!res.ok) throw new Error("Failed to load harvest missions")
  return res.json() as Promise<{ missions: HarvestMission[] }>
}

export async function getHarvestMission(missionId: number) {
  const res = await fetch(getApiUrl(`/harvest/missions/${missionId}`), {
    cache: "no-store",
  })
  if (!res.ok) throw new Error("Failed to load harvest mission")
  return res.json() as Promise<HarvestMission>
}

export async function getHarvestMissionItems(missionId: number) {
  const res = await fetch(getApiUrl(`/harvest/missions/${missionId}/items`), {
    cache: "no-store",
  })
  if (!res.ok) throw new Error("Failed to load harvest mission items")
  return res.json() as Promise<{
    mission_id: number
    mission_code: string | null
    items: HarvestMissionItem[]
  }>
}

async function postHarvestMissionAction(
  missionId: number,
  action: "start" | "pause" | "resume" | "cancel" | "advance"
): Promise<HarvestMission> {
  const res = await fetch(
    getApiUrl(`/harvest/missions/${missionId}/${action}`),
    { method: "POST" }
  )
  if (!res.ok) {
    let detail = `Failed to ${action} harvest mission`
    try {
      const body = await res.json()
      if (body?.detail) detail = body.detail
    } catch {
      // response had no JSON body; keep the default message
    }
    throw new Error(detail)
  }
  return res.json() as Promise<HarvestMission>
}

export function startHarvestMission(missionId: number) {
  return postHarvestMissionAction(missionId, "start")
}

export function pauseHarvestMission(missionId: number) {
  return postHarvestMissionAction(missionId, "pause")
}

export function resumeHarvestMission(missionId: number) {
  return postHarvestMissionAction(missionId, "resume")
}

export function cancelHarvestMission(missionId: number) {
  return postHarvestMissionAction(missionId, "cancel")
}

export function advanceHarvestMission(missionId: number) {
  return postHarvestMissionAction(missionId, "advance")
}

export async function getRobotStatus(missionId: number) {
  const res = await fetch(
    getApiUrl(`/harvest/missions/${missionId}/status`),
    { cache: "no-store" }
  )
  if (!res.ok) throw new Error("Failed to load robot status")
  return res.json() as Promise<RobotStatus>
}

// ---------------------------------------------------------------------------
// Dashboard overview (Feature 12) — read-only descriptive aggregates.
// ---------------------------------------------------------------------------

export interface DashboardSurveyMission {
  id: number
  status: string
  is_active: boolean
  source_folder: string
  created_at: string | null
  completed_at: string | null
  tile_count: number
  processed_count: number
}

export interface DashboardHarvestMission {
  id: number
  mission_code: string | null
  status: HarvestMissionStatus
  harvest_type: HarvestType
  total_trees: number
  total_expected_coconuts: number
  created_at: string | null
  completed_at: string | null
}

export type ActivityType =
  | "SURVEY_COMPLETED"
  | "INSPECTION_CREATED"
  | "INSPECTION_COMPLETED"
  | "INVENTORY_CREATED"
  | "HARVEST_MISSION_CREATED"
  | "HARVEST_MISSION_COMPLETED"

export interface ActivityEvent {
  type: ActivityType
  label: string
  ts: string | null
  ref: string
}

export interface DashboardOverview {
  overview: {
    survey_missions: number
    permanent_trees: number
    trees_inspected: number
    inventory_snapshots: number
    harvest_missions: number
  }
  farm_summary: {
    total_trees: number
    total_coconuts: number
    mature: number
    potential: number
    premature: number
    harvested_count: number
  }
  survey: {
    latest_survey: DashboardSurveyMission | null
    active_survey: DashboardSurveyMission | null
    last_scan_time: string | null
  }
  current_harvest_mission: DashboardHarvestMission | null
  recent_activity: ActivityEvent[]
  charts: {
    ripeness_distribution: {
      mature: number
      potential: number
      premature: number
    }
    inspection_coverage: { inspected: number; total: number }
    harvest_progress: { completed: number; total: number }
  }
}

export async function getDashboardOverview() {
  const res = await fetch(getApiUrl("/dashboard/overview"), {
    cache: "no-store",
  })
  if (!res.ok) throw new Error("Failed to load dashboard overview")
  return res.json() as Promise<DashboardOverview>
}

// ---------------------------------------------------------------------------
// Version 3 — Robot Simulation (V3.1–V3.6, presentation only).
// These are thin clients over the existing backend Simulation + Robot APIs. The
// UI never computes movement, navigation, state, or battery — it only sends
// commands and renders the latest snapshot the backend streams.
// ---------------------------------------------------------------------------

// The 8-value RobotState (V3.3 / §A.3). The string union keeps the frontend
// honest about which states it may display.
export type V3RobotState =
  | "IDLE"
  | "MOVING"
  | "CLIMBING"
  | "SCANNING"
  | "HARVESTING"
  | "RETURNING"
  | "ERROR"
  | "DOCKED"

// One simulation-engine event as broadcast over the WebSocket frame.
export interface RobotSimEvent {
  type: string
  sim_time: number
  detail: Record<string, unknown>
}

// Live robot snapshot delivered each tick over the WebSocket (mirrors the
// backend `WebSocketGateway` frame's `robot` block exactly — read-only).
export interface RobotSnapshot {
  position: { x: number; y: number }
  heading_deg: number
  speed: number
  battery_pct: number
  state: V3RobotState
  waypoint_index: number
  waypoint_count: number
  completed_item_ids: number[]
  finished: boolean
}

// Simulation run status (the scheduler's `status()`).
export interface SimulationStatus {
  status: "stopped" | "running" | "paused" | "finished"
  mission_id: number | null
  sim_time: number
  speed_factor: number
  waypoint_index: number
  waypoint_count: number
  completed_item_ids: number[]
  finished: boolean
  error: string | null
  recent_events: RobotSimEvent[]
}

// Full WebSocket frame (telemetry or snapshot).
export interface RobotFrame {
  type: "telemetry" | "snapshot"
  sim_time: number
  status: SimulationStatus["status"]
  mission_id: number | null
  robot: RobotSnapshot
  events: RobotSimEvent[]
  run: { status: SimulationStatus["status"]; finished: boolean; error: string | null }
}

// Navigation plan (read-only) used to draw the mission path. We reuse the same
// farm-pixel coordinates the twin overlay uses — never recomputed in the UI.
export interface RobotPlanWaypoint {
  kind: "dock" | "tree"
  x: number
  y: number
  tree_id: number | null
  mission_item_id: number | null
}
export interface RobotNavPlan {
  mission_id: number | null
  total_distance: number
  waypoints: RobotPlanWaypoint[]
}

// --- REST control helpers (commands only; no business logic) ----------------

async function postRobot(path: string, body?: Record<string, unknown>) {
  const res = await fetch(getApiUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : JSON.stringify({}),
  })
  if (!res.ok) {
    let detail = `Request to ${path} failed (${res.status})`
    try {
      const b = await res.json()
      if (b?.detail) detail = b.detail
    } catch {
      /* no JSON body */
    }
    throw new Error(detail)
  }
  return res.json()
}

export function startSimulation(missionId?: number, speedFactor = 1) {
  const qs = new URLSearchParams()
  if (missionId != null) qs.set("mission_id", String(missionId))
  qs.set("speed_factor", String(speedFactor))
  return postRobot(`/robot/simulation/start?${qs.toString()}`)
}

export function pauseSimulation() {
  return postRobot("/robot/simulation/pause")
}

export function resumeSimulation() {
  return postRobot("/robot/simulation/resume")
}

export function stopSimulation() {
  return postRobot("/robot/simulation/stop")
}

export function returnRobotToDock() {
  return postRobot("/robot/simulation/return-to-dock")
}

export function rechargeRobot() {
  return postRobot("/robot/recharge")
}

export function resetRobot() {
  return postRobot("/robot/reset")
}

export async function getSimulationStatus() {
  const res = await fetch(getApiUrl("/robot/simulation"), { cache: "no-store" })
  if (!res.ok) throw new Error("Failed to load simulation status")
  return res.json() as Promise<SimulationStatus>
}

// V3.7.3 — backend-owned simulation defaults. The UI initialises its speed
// control to `default_speed_factor` so the default lives in one place (backend).
export type SimulationConfig = {
  default_speed_factor: number
}

export async function getSimulationConfig(): Promise<SimulationConfig> {
  const res = await fetch(getApiUrl("/robot/simulation/config"), {
    cache: "no-store",
  })
  if (!res.ok) throw new Error("Failed to load simulation config")
  return res.json() as Promise<SimulationConfig>
}

export async function getRobotNavPlan(missionId?: number) {
  const qs = missionId != null ? `?mission_id=${missionId}` : ""
  const res = await fetch(getApiUrl(`/robot/navigation/plan${qs}`), {
    cache: "no-store",
  })
  if (!res.ok) throw new Error("Failed to load navigation plan")
  return res.json() as Promise<RobotNavPlan>
}

// --- WebSocket client (live, auto-reconnect, no duplicate frames) -----------

type FrameHandler = (frame: RobotFrame) => void
type StatusHandler = (conn: "connecting" | "open" | "closed") => void

// Connects only to `/ws/robot`. Reconnects automatically with a capped backoff.
// Never sends anything to the server (observe-only), so it can never restart the
// simulation. Frames are delivered in arrival order; the gateway is a single
// broadcaster per tick, so there is no application-level de-duplication needed —
// we simply pass each parsed frame to the handler exactly once.
export class RobotWebSocketClient {
  private url: string
  private ws: WebSocket | null = null
  private frameHandler: FrameHandler | null = null
  private statusHandler: StatusHandler | null = null
  private shouldRun = false
  private retry = 0
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private closedByUser = false

  constructor() {
    const base = API_BASE_URL.replace(/^http/, "ws")
    this.url = `${base}/ws/robot`
  }

  onFrame(fn: FrameHandler) {
    this.frameHandler = fn
  }
  onStatus(fn: StatusHandler) {
    this.statusHandler = fn
  }

  connect() {
    this.shouldRun = true
    this.closedByUser = false
    this.open()
  }

  private open() {
    if (!this.shouldRun) return
    this.statusHandler?.("connecting")
    try {
      this.ws = new WebSocket(this.url)
    } catch {
      this.scheduleReconnect()
      return
    }
    this.ws.onopen = () => {
      this.retry = 0
      this.statusHandler?.("open")
    }
    this.ws.onmessage = (ev) => {
      try {
        const frame = JSON.parse(ev.data as string) as RobotFrame
        this.frameHandler?.(frame)
      } catch {
        /* ignore malformed frame */
      }
    }
    this.ws.onclose = () => {
      this.statusHandler?.("closed")
      this.scheduleReconnect()
    }
    this.ws.onerror = () => {
      // onclose will follow and handle reconnect; close the socket so the
      // browser does not leave it half-open.
      try {
        this.ws?.close()
      } catch {
        /* noop */
      }
    }
  }

  private scheduleReconnect() {
    if (!this.shouldRun || this.closedByUser) return
    this.retry = Math.min(this.retry + 1, 6)
    const delay = Math.min(1000 * 2 ** (this.retry - 1), 15000)
    if (this.retryTimer) clearTimeout(this.retryTimer)
    this.retryTimer = setTimeout(() => this.open(), delay)
  }

  close() {
    this.shouldRun = false
    this.closedByUser = true
    if (this.retryTimer) clearTimeout(this.retryTimer)
    try {
      this.ws?.close()
    } catch {
      /* noop */
    }
    this.ws = null
  }
}

// ---------------------------------------------------------------------------
// Version 3.7 — Mission History & Analytics (read-only, backend-computed).
// The frontend renders these payloads and never recomputes any metric.
// ---------------------------------------------------------------------------

export type RunStatus = "COMPLETED" | "ABORTED" | "FAILED"

export interface RobotRun {
  id: number
  robot_id: number
  mission_id: number | null
  status: RunStatus
  started_at: string | null
  finished_at: string | null
  duration_s: number | null
  total_trees: number
  harvested_trees: number
  skipped_trees: number
  distance_travelled: number
  battery_start_pct: number | null
  battery_end_pct: number | null
  battery_used_pct: number
  recharge_count: number
  avg_harvest_time_s: number | null
  fastest_harvest_s: number | null
  slowest_harvest_s: number | null
  avg_speed: number | null
  idle_time_s: number
  efficiency: number | null
  mission_score: number | null
  score_breakdown: ScoreBreakdown | null
  speed_factor: number | null
}

// Transparent Mission Score breakdown (backend-computed; frontend never derives).
export interface ScoreBreakdown {
  completion: number
  battery_economy: number
  status_factor: number
  safe_return: number
  error_free: number
  raw: number
  final: number
}

export interface TimelineEntry {
  key: string
  icon: string
  color: string
  title: string
  sim_time: number
  timestamp: string | null
  description: string
  tree_id?: number
  distance_m?: number
}

export interface TreeActivity {
  tree_id: number
  tree_code: string | null
  visit_time: number | null
  harvest_duration_s: number | null
  harvest_result: "harvested" | "skipped"
  battery_at_visit: number | null
  inventory_collected: number | null
  inspection_id: number | null
}

export type LogSeverity = "INFO" | "WARNING" | "ERROR"

export interface RobotLogEntry {
  id: number
  timestamp: string | null
  sim_time: number
  event_type: string
  detail: Record<string, unknown> | null
  severity: LogSeverity
  mission_id: number | null
}

export async function getRobotRuns(limit = 100) {
  const res = await fetch(getApiUrl(`/robot/runs?limit=${limit}`), {
    cache: "no-store",
  })
  if (!res.ok) throw new Error("Failed to load robot runs")
  return res.json() as Promise<RobotRun[]>
}

export async function getRobotRun(runId: number) {
  const res = await fetch(getApiUrl(`/robot/runs/${runId}`), {
    cache: "no-store",
  })
  if (!res.ok) throw new Error("Failed to load robot run")
  return res.json() as Promise<RobotRun>
}

export async function getRobotRunTimeline(runId: number) {
  const res = await fetch(getApiUrl(`/robot/runs/${runId}/timeline`), {
    cache: "no-store",
  })
  if (!res.ok) throw new Error("Failed to load run timeline")
  return res.json() as Promise<TimelineEntry[]>
}

export async function getRobotRunTreeActivity(runId: number) {
  const res = await fetch(getApiUrl(`/robot/runs/${runId}/tree-activity`), {
    cache: "no-store",
  })
  if (!res.ok) throw new Error("Failed to load run tree activity")
  return res.json() as Promise<TreeActivity[]>
}

export async function getRobotRunLog(runId: number, limit = 500) {
  const res = await fetch(getApiUrl(`/robot/runs/${runId}/robot-log?limit=${limit}`), {
    cache: "no-store",
  })
  if (!res.ok) throw new Error("Failed to load robot run log")
  return res.json() as Promise<RobotLogEntry[]>
}