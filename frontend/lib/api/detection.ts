const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000"

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