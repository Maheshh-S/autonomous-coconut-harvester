export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000"

// Persisted representative tree observation for the Digital Twin overlay (§V2.4).
// All coordinates are in the tile's own pixel space (§V2.5); `survey_tile_id`
// links the tree to its mosaic tile so the overlay can align in farm-pixel space.
export type TreeOverlay = {
  tree_id: number
  tree_code: string | null
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

export async function getMapData() {
 
  const res = await fetch(
    getApiUrl("/plantation/map"),
    {
      cache: "no-store"
    }
  )

  if (!res.ok) {
    throw new Error("Failed to fetch map data")
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

export async function getPermanentTrees(missionId: number) {
  const res = await fetch(getApiUrl(`/mission/${missionId}/permanent-trees`), {
    cache: "no-store",
  })
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

export interface MapTree {
  tree_id: number
  tree_code: string | null
  gps_lat: number
  gps_lon: number
  coconuts_detected: number
  tasks_remaining: number
}