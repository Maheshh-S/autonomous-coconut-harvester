"use client"

import { useEffect, useRef, useState } from "react"
import {
  getMissions,
  createMission,
  uploadSurveyImages,
  getMissionImages,
  completeMission,
  getTileStats,
  getTileGeneration,
  getPermanentTrees,
  createInspection,
  startInspection,
  completeInspection,
  getTreeInspections,
  uploadInspectionImages,
  processInspectionImages,
  getInspectionImages,
  getTreeInventoryHistory,
  createHarvestMission,
  getHarvestMissions,
  getHarvestMission,
  startHarvestMission,
  pauseHarvestMission,
  resumeHarvestMission,
  cancelHarvestMission,
  advanceHarvestMission,
  getRobotStatus,
  type Inspection,
  type InspectionImage,
  type InventorySnapshot,
  type HarvestMission,
  type HarvestType,
  type RobotStatus,
  API_BASE_URL,
} from "@/lib/api/detection"

type Mission = {
  id: number
  status: string
  is_active: boolean
  source_folder: string
}

type UploadedImage = {
  id: number
  mission_id: number
  original_filename: string
  url: string
}

type TileStats = {
  mission_id: number
  total: number
  pending: number
  processing: number
  completed: number
  failed: number
  detections_total: number
  processed_tiles: number
  remaining_tiles: number
}

type TileGeneration = {
  mission_id: number
  images_uploaded: number
  tiles_generated: number
  remaining: number
  generation_status: "not_started" | "in_progress" | "complete"
}

type PermanentTree = {
  id: number
  tree_code: string
  gps_lat: number
  gps_lon: number
  times_seen: number
  first_seen_mission_id: number | null
  last_seen_mission_id: number | null
  last_matching_confidence: number | null
  is_new: boolean
}

type PermanentTrees = {
  mission_id: number
  total: number
  page: number
  page_size: number
  total_pages: number
  newly_created: number
  matched_existing: number
  avg_match_confidence: number | null
  trees: PermanentTree[]
}

const IMAGE_EXT = /\.(jpe?g|png)$/i

// Single-farm system: the Survey Mission creation form prefills the farmer's
// real farm coordinates. These are sent to the backend and stored on the
// mission; the GPS Projection service always reads them from the mission.
const FARM_DEFAULT_LAT = 12.1947222
const FARM_DEFAULT_LON = 76.6100556

export default function SurveyPage() {
  const [missions, setMissions] = useState<Mission[]>([])
  const [selectedMissionId, setSelectedMissionId] = useState<number | null>(null)
  const [newFolder, setNewFolder] = useState("")
  const [files, setFiles] = useState<File[]>([])
  const [images, setImages] = useState<UploadedImage[]>([])
  const [uploading, setUploading] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [tileStats, setTileStats] = useState<TileStats | null>(null)
  const [tileGen, setTileGen] = useState<TileGeneration | null>(null)
  const [permTrees, setPermTrees] = useState<PermanentTrees | null>(null)
  const [permPage, setPermPage] = useState(1)
  const PERM_PAGE_SIZE = 20
  const [expandedTree, setExpandedTree] = useState<number | null>(null)
  const [treeInspections, setTreeInspections] = useState<Record<number, Inspection[]>>({})
  const [inspectionImages, setInspectionImages] = useState<Record<number, InspectionImage[]>>({})
  const [treeInventory, setTreeInventory] = useState<
    Record<number, { currentId: number | null; snapshots: InventorySnapshot[] }>
  >({})
  const [inspLoading, setInspLoading] = useState(false)
  const [inspUploading, setInspUploading] = useState<Record<number, boolean>>({})
  const [completeCount, setCompleteCount] = useState<Record<number, number>>({})
  // Harvest Planner (Feature 10)
  const [harvestType, setHarvestType] = useState<HarvestType>("mature")
  const [harvestMissions, setHarvestMissions] = useState<HarvestMission[]>([])
  const [selectedHarvest, setSelectedHarvest] = useState<HarvestMission | null>(
    null
  )
  const [harvestGenerating, setHarvestGenerating] = useState(false)
  const [robotStatus, setRobotStatus] = useState<RobotStatus | null>(null)
  const [harvestExecuting, setHarvestExecuting] = useState(false)
  const folderInputRef = useRef<HTMLInputElement | null>(null)
  const loadSeq = useRef(0)

  const selectedMission = missions.find((m) => m.id === selectedMissionId) ?? null

  async function loadMissions() {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const data = await getMissions()
        const list: Mission[] = data.missions ?? []
        setMissions(list)
        if (selectedMissionId === null && list.length > 0) {
          setSelectedMissionId(list[0].id)
        }
        return
      } catch (err) {
        if (attempt === 1) console.error("Failed to load missions", err)
      }
    }
  }

  async function loadImages(missionId: number) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const data = await getMissionImages(missionId)
        setImages(
          (data.images ?? []).map((img: UploadedImage) => ({
            ...img,
            url: API_BASE_URL + img.url,
          }))
        )
        return
      } catch (err) {
        if (attempt === 1) console.error("Failed to load mission images", err)
      }
    }
  }

  async function loadTileStats(missionId: number) {
    // Retry once: the burst of reads right after a heavy completion request can
    // occasionally drop a connection; these are idempotent GETs.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const data = await getTileStats(missionId)
        setTileStats(data as TileStats)
        return
      } catch (err) {
        if (attempt === 1) console.error("Failed to load tile statistics", err)
      }
    }
  }

  async function loadTileGeneration(missionId: number) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const data = await getTileGeneration(missionId)
        setTileGen(data as TileGeneration)
        return
      } catch (err) {
        if (attempt === 1) console.error("Failed to load tile generation progress", err)
      }
    }
  }

  async function loadPermanentTrees(missionId: number, page: number = 1) {
    // Guard against stale responses overwriting fresh data (e.g. a slow
    // pre-completion read resolving after the post-completion read). Only the
    // most recent load for a given mission is applied.
    const seq = ++loadSeq.current
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const data = await getPermanentTrees(missionId, page, PERM_PAGE_SIZE)
        if (seq === loadSeq.current) setPermTrees(data as PermanentTrees)
        return
      } catch (err) {
        if (attempt === 1) console.error("Failed to load permanent trees", err)
      }
    }
  }

  useEffect(() => {
    loadMissions()
    loadHarvestMissions()
  }, [])

  useEffect(() => {
    if (selectedMissionId === null) {
      setImages([])
      setTileStats(null)
      return
    }
    // Don't clobber images that are being appended during an active upload.
    if (uploading) return
    loadImages(selectedMissionId)
  }, [selectedMissionId, uploading])

  // Tile statistics and generation progress are independent of the image-upload
  // loop, so they load on every mission switch regardless of upload state.
  useEffect(() => {
    if (selectedMissionId === null) return
    loadTileStats(selectedMissionId)
    loadTileGeneration(selectedMissionId)
    setPermPage(1)
    loadPermanentTrees(selectedMissionId, 1)
  }, [selectedMissionId])

  // Reset completion state only when the selected mission changes (not on every
  // upload toggle), so a finished upload keeps its "completed" indicator.
  useEffect(() => {
    setDone(false)
    setError(null)
    setSuccess(null)
    setTileGen(null)
    setPermTrees(null)
    setPermPage(1)
  }, [selectedMissionId])

  const canComplete =
    selectedMissionId !== null &&
    selectedMission?.status === "PROCESSING" &&
    images.length > 0 &&
    !processing

  async function handleComplete() {
    if (selectedMissionId === null) return
    const confirmed = window.confirm(
      "Complete this Survey Mission? It becomes the active source of truth and further uploads will be disabled."
    )
    if (!confirmed) return
    setProcessing(true)
    setError(null)
    setSuccess(null)
    try {
      await completeMission(selectedMissionId)
      setSuccess("✅ Survey Mission completed and set active.")
      // Generation + permanent-tree matching run server-side on completion;
      // refresh every Survey-related view exactly once, after the backend
      // returns success, so the UI never shows a transient empty state.
      await loadMissions()
      await loadTileStats(selectedMissionId)
      await loadTileGeneration(selectedMissionId)
      await loadPermanentTrees(selectedMissionId)
    } catch (err) {
      setError("Failed to complete mission: " + (err as Error).message)
    } finally {
      setProcessing(false)
    }
  }

  async function loadTreeInspections(treeId: number): Promise<Inspection[]> {
    try {
      const data = await getTreeInspections(treeId)
      setTreeInspections((prev) => ({ ...prev, [treeId]: data.inspections }))
      return data.inspections
    } catch (err) {
      setError("Failed to load inspections: " + (err as Error).message)
      return []
    }
  }

  async function handleStartInspection(treeId: number) {
    setInspLoading(true)
    setError(null)
    try {
      const created = await createInspection(treeId)
      await startInspection(created.id)
      await loadTreeInspections(treeId)
    } catch (err) {
      setError("Failed to start inspection: " + (err as Error).message)
    } finally {
      setInspLoading(false)
    }
  }

  async function handleCompleteInspection(treeId: number, inspId: number) {
    setInspLoading(true)
    setError(null)
    try {
      const count = completeCount[inspId] ?? 1
      // Completing an inspection builds its immutable Inventory Snapshot and
      // repoints the tree at it (Feature 9); refresh both so the UI reflects it.
      await completeInspection(inspId, count)
      await loadTreeInspections(treeId)
      await loadTreeInventory(treeId)
    } catch (err) {
      setError("Failed to complete inspection: " + (err as Error).message)
    } finally {
      setInspLoading(false)
    }
  }

  async function loadTreeInventory(treeId: number) {
    try {
      const data = await getTreeInventoryHistory(treeId)
      setTreeInventory((prev) => ({
        ...prev,
        [treeId]: {
          currentId: data.current_inventory_id,
          snapshots: data.snapshots,
        },
      }))
    } catch (err) {
      setError("Failed to load inventory: " + (err as Error).message)
    }
  }

  async function loadHarvestMissions() {
    try {
      const data = await getHarvestMissions()
      setHarvestMissions(data.missions)
      // Keep the detailed view in sync with the newest mission if none picked yet.
      if (selectedHarvest === null && data.missions.length > 0) {
        const full = await getHarvestMission(data.missions[0].id)
        setSelectedHarvest(full)
        // Also load the robot status so the dashboard reflects a mission that is
        // already running/paused/completed after a page reload (§45).
        await refreshRobotStatus(full.id)
      }
    } catch (err) {
      setError("Failed to load harvest missions: " + (err as Error).message)
    }
  }

  async function handleGenerateHarvestMission() {
    setHarvestGenerating(true)
    setError(null)
    setSuccess(null)
    try {
      // The planner reads the latest Inventory Snapshots, filters eligible trees,
      // and builds one immutable mission with an ordered (nearest-neighbour) queue.
      const mission = await createHarvestMission(harvestType)
      setSelectedHarvest(mission)
      setSuccess(
        `✅ ${mission.mission_code} created — ${mission.total_trees} tree(s), ${mission.total_expected_coconuts} expected coconuts.`
      )
      await loadHarvestMissions()
    } catch (err) {
      setError("Failed to generate harvest mission: " + (err as Error).message)
    } finally {
      setHarvestGenerating(false)
    }
  }

  async function handleSelectHarvestMission(missionId: number) {
    try {
      const full = await getHarvestMission(missionId)
      setSelectedHarvest(full)
      await refreshRobotStatus(missionId)
    } catch (err) {
      setError("Failed to load harvest mission: " + (err as Error).message)
    }
  }

  // Robot Mission Execution (Feature 11): one-shared-state helpers keep the
  // mission detail, queue, and robot status in sync after each action.
  async function refreshRobotStatus(missionId: number) {
    try {
      const status = await getRobotStatus(missionId)
      setRobotStatus(status)
    } catch (err) {
      setError("Failed to load robot status: " + (err as Error).message)
    }
  }

  async function runHarvestAction(
    action:
      | "start"
      | "pause"
      | "resume"
      | "cancel"
      | "advance",
    missionId: number
  ) {
    setHarvestExecuting(true)
    setError(null)
    setSuccess(null)
    try {
      const mission =
        action === "start"
          ? await startHarvestMission(missionId)
          : action === "pause"
            ? await pauseHarvestMission(missionId)
            : action === "resume"
              ? await resumeHarvestMission(missionId)
              : action === "cancel"
                ? await cancelHarvestMission(missionId)
                : await advanceHarvestMission(missionId)
      setSelectedHarvest(mission)
      await loadHarvestMissions()
      await refreshRobotStatus(missionId)
    } catch (err) {
      setError("Failed to " + action + " mission: " + (err as Error).message)
    } finally {
      setHarvestExecuting(false)
    }
  }

  function toggleTree(treeId: number) {
    setExpandedTree((prev) => (prev === treeId ? null : treeId))
    if (expandedTree !== treeId) {
      loadTreeInspections(treeId).then((insps) =>
        insps.forEach((i) => loadInspectionImages(i.id))
      )
      loadTreeInventory(treeId)
    }
  }

  async function loadInspectionImages(inspId: number) {
    try {
      const data = await getInspectionImages(inspId)
      setInspectionImages((prev) => ({ ...prev, [inspId]: data.images }))
    } catch (err) {
      setError("Failed to load inspection images: " + (err as Error).message)
    }
  }

  async function handleUploadInspectionImages(
    treeId: number,
    inspId: number,
    files: File[]
  ) {
    if (files.length === 0) return
    setInspUploading((prev) => ({ ...prev, [inspId]: true }))
    setError(null)
    try {
      await uploadInspectionImages(inspId, files)
      // Run ripeness detection immediately after upload (idempotent per image).
      await processInspectionImages(inspId)
      await loadInspectionImages(inspId)
      // Refresh the inspection so inspection_image_count stays in sync.
      await loadTreeInspections(treeId)
    } catch (err) {
      setError("Failed to upload inspection images: " + (err as Error).message)
    } finally {
      setInspUploading((prev) => ({ ...prev, [inspId]: false }))
    }
  }

  async function handleProcessInspectionImages(treeId: number, inspId: number) {
    setInspLoading(true)
    setError(null)
    try {
      await processInspectionImages(inspId)
      await loadInspectionImages(inspId)
      await loadTreeInspections(treeId)
    } catch (err) {
      setError("Failed to process inspection images: " + (err as Error).message)
    } finally {
      setInspLoading(false)
    }
  }


  async function handleCreateMission() {
    const source_folder = newFolder.trim() || `mission_${Date.now()}`
    try {
      // The simulated drone automatically provides the farm's base GPS; the
      // farmer never enters coordinates. The mission is the single source of
      // truth and the GPS Projection service reads these values from it.
      const mission = await createMission({
        source_folder,
        base_gps_lat: FARM_DEFAULT_LAT,
        base_gps_lon: FARM_DEFAULT_LON,
      })
      setNewFolder("")
      // Add the new mission locally and select it directly, so we never reset
      // selection to an unrelated mission or trigger a competing image load.
      setMissions((prev) => [mission, ...prev])
      setSelectedMissionId(mission.id)
    } catch (err) {
      setError("Could not create mission: " + (err as Error).message)
    }
  }

  function handleFolderSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? [])
      .filter((f) => IMAGE_EXT.test(f.name) || f.type.startsWith("image/"))
    setFiles(selected)
    setDone(false)
    setError(null)
  }

  async function handleUpload() {
    if (selectedMissionId === null || files.length === 0) return
    setUploading(true)
    setError(null)
    setDone(false)
    try {
      for (const file of files) {
        const data = await uploadSurveyImages(selectedMissionId, [file])
        const uploaded = data.uploaded?.[0]
        if (uploaded) {
          setImages((prev) => [
            ...prev,
            { ...uploaded, url: API_BASE_URL + uploaded.url },
          ])
        }
      }
      setDone(true)
    } catch (err) {
      setError("Upload failed: " + (err as Error).message)
    } finally {
      setUploading(false)
    }
  }

  const total = files.length
  const uploadedCount = images.length
  const remaining = Math.max(total - uploadedCount, 0)
  const progress = total > 0 ? Math.round((uploadedCount / total) * 100) : 0

  return (
    <main className="p-10 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold">Survey Mission — Image Ingestion</h1>
      <p className="mt-2 text-gray-600">
        Upload a folder of drone imagery for a Survey Mission. Images are stored
        and associated with the mission; no processing happens yet.
      </p>

      {error && (
        <p className="mt-4 text-red-600 font-semibold">{error}</p>
      )}

      {success && (
        <p className="mt-4 text-green-700 font-semibold">{success}</p>
      )}

      {/* Mission selection / creation */}
      <section className="mt-8 border rounded p-4">
        <h2 className="text-xl font-semibold mb-3">1. Select or create a mission</h2>
        <div className="flex flex-wrap items-center gap-3">
          <select
            className="border rounded px-2 py-1"
            value={selectedMissionId ?? ""}
            onChange={(e) => setSelectedMissionId(Number(e.target.value))}
          >
            <option value="" disabled>
              -- choose mission --
            </option>
            {missions.map((m) => (
              <option key={m.id} value={m.id}>
                #{m.id} — {m.source_folder} ({m.status})
              </option>
            ))}
          </select>

          <input
            className="border rounded px-2 py-1"
            placeholder="new folder name"
            value={newFolder}
            onChange={(e) => setNewFolder(e.target.value)}
          />
          <button
            className="bg-blue-600 text-white px-4 py-1 rounded"
            onClick={handleCreateMission}
          >
            Create mission
          </button>
        </div>
        {selectedMissionId !== null && (
          <p className="mt-2 text-sm text-gray-600">
            Selected mission #{selectedMissionId}
          </p>
        )}
      </section>

      {/* Folder selection */}
      <section className="mt-6 border rounded p-4">
        <h2 className="text-xl font-semibold mb-3">2. Select folder of images</h2>
        <input
          ref={folderInputRef}
          type="file"
          multiple
          accept="image/*"
          {...({ webkitdirectory: "", directory: "" } as any)}
          onChange={handleFolderSelect}
        />
        <p className="mt-2 text-sm text-gray-600">
          Total images selected: <strong>{total}</strong>
        </p>
      </section>

      {/* Upload */}
      <section className="mt-6 border rounded p-4">
        <h2 className="text-xl font-semibold mb-3">3. Upload</h2>
        <button
          className="bg-green-600 text-white px-4 py-2 rounded disabled:opacity-50"
          onClick={handleUpload}
          disabled={
            uploading ||
            selectedMissionId === null ||
            total === 0 ||
            selectedMission?.status !== "PROCESSING"
          }
        >
          {uploading ? "Uploading…" : "Upload images"}
        </button>

        <button
          className="ml-3 bg-purple-700 text-white px-4 py-2 rounded disabled:opacity-50"
          onClick={handleComplete}
          disabled={!canComplete || processing}
          title={
            canComplete
              ? "Mark this mission complete and active"
              : "Available once a PROCESSING mission has at least one uploaded image"
          }
        >
          {processing ? "Processing…" : "Complete Survey Mission"}
        </button>

        <div className="mt-4">
          <div className="h-3 bg-gray-200 rounded overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-2 flex gap-6 text-sm">
            <span>Uploaded: <strong>{uploadedCount}</strong></span>
            <span>Remaining: <strong>{remaining}</strong></span>
            <span>Total: <strong>{total}</strong></span>
          </div>
          {done && total > 0 && (
            <p className="mt-2 text-green-700 font-semibold">
              ✅ Upload completed — {uploadedCount} image(s) stored.
            </p>
          )}
        </div>
      </section>

      {/* Uploaded assets */}
      <section className="mt-6">
        <h2 className="text-xl font-semibold mb-3">
          Uploaded images ({images.length})
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {images.map((img) => (
            <div key={img.id} className="border rounded overflow-hidden">
              <img
                src={img.url}
                alt={img.original_filename}
                className="w-full h-32 object-cover"
              />
              <p className="text-xs truncate p-1">{img.original_filename}</p>
            </div>
          ))}
        </div>
        {images.length === 0 && (
          <p className="text-gray-500 text-sm">No images uploaded yet.</p>
        )}
      </section>

      {/* Survey Tiles (read-only, Feature 3) */}
      {selectedMissionId !== null && (
        <section className="mt-6 border rounded p-4">
          <h2 className="text-xl font-semibold mb-3">Survey Tiles</h2>
          {tileStats === null ? (
            <p className="text-gray-500 text-sm">Loading tile statistics…</p>
          ) : tileStats.total === 0 ? (
            <p className="text-gray-500">No survey tiles have been generated yet.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="border rounded p-3 text-center">
                <div className="text-2xl font-bold">{tileStats.total}</div>
                <div className="text-xs text-gray-600">Total Survey Tiles</div>
              </div>
              <div className="border rounded p-3 text-center">
                <div className="text-2xl font-bold">{tileStats.pending}</div>
                <div className="text-xs text-gray-600">Pending</div>
              </div>
              <div className="border rounded p-3 text-center">
                <div className="text-2xl font-bold">{tileStats.processing}</div>
                <div className="text-xs text-gray-600">Processing</div>
              </div>
              <div className="border rounded p-3 text-center">
                <div className="text-2xl font-bold">{tileStats.completed}</div>
                <div className="text-xs text-gray-600">Completed</div>
              </div>
              <div className="border rounded p-3 text-center">
                <div className="text-2xl font-bold">{tileStats.failed}</div>
                <div className="text-xs text-gray-600">Failed</div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Detected Trees (Feature 5) — raw detections only; no Tree IDs / GPS / map */}
      {selectedMissionId !== null && (
        <section className="mt-6 border rounded p-4">
          <h2 className="text-xl font-semibold mb-3">Detected Trees</h2>
          {tileStats === null ? (
            <p className="text-gray-500 text-sm">Loading detection progress…</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="border rounded p-3 text-center">
                <div className="text-2xl font-bold">{tileStats.detections_total}</div>
                <div className="text-xs text-gray-600">Total detections</div>
              </div>
              <div className="border rounded p-3 text-center">
                <div className="text-2xl font-bold">{tileStats.processed_tiles}</div>
                <div className="text-xs text-gray-600">Processed tiles</div>
              </div>
              <div className="border rounded p-3 text-center">
                <div className="text-2xl font-bold">{tileStats.remaining_tiles}</div>
                <div className="text-xs text-gray-600">Remaining tiles</div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Permanent Trees (Feature 6) — digital-twin foundation; stable Tree IDs */}
      {selectedMissionId !== null && (
        <section className="mt-6 border rounded p-4">
          <h2 className="text-xl font-semibold mb-3">Permanent Trees</h2>
          {processing ? (
            <p className="text-gray-500 text-sm">
              Processing… matching detections to permanent Tree IDs.
            </p>
          ) : permTrees === null ? (
            <p className="text-gray-500 text-sm">Loading permanent trees…</p>
          ) : permTrees.total === 0 ? (
            <p className="text-gray-500">
              No permanent trees yet. Complete the mission to match detections to
              permanent Tree IDs.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="border rounded p-3 text-center">
                  <div className="text-2xl font-bold">{permTrees.total}</div>
                  <div className="text-xs text-gray-600">Total Trees</div>
                </div>
                <div className="border rounded p-3 text-center">
                  <div className="text-2xl font-bold">{permTrees.newly_created}</div>
                  <div className="text-xs text-gray-600">Newly Created</div>
                </div>
                <div className="border rounded p-3 text-center">
                  <div className="text-2xl font-bold">
                    {permTrees.matched_existing}
                  </div>
                  <div className="text-xs text-gray-600">Matched Existing</div>
                </div>
                <div className="border rounded p-3 text-center">
                  <div className="text-2xl font-bold">
                    {permTrees.avg_match_confidence !== null
                      ? permTrees.avg_match_confidence.toFixed(3)
                      : "—"}
                  </div>
                  <div className="text-xs text-gray-600">Avg Match Confidence</div>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {permTrees.trees.map((t) => {
                  const insps = treeInspections[t.id] || []
                  const isOpen = expandedTree === t.id
                  return (
                    <div key={t.id} className="border rounded p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="font-semibold">{t.tree_code}</div>
                          <div className="text-xs text-gray-600">
                            Seen {t.times_seen}× · Match{" "}
                            {t.last_matching_confidence !== null
                              ? t.last_matching_confidence.toFixed(3)
                              : "new"}{" "}
                            · {t.gps_lat.toFixed(6)}, {t.gps_lon.toFixed(6)}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => toggleTree(t.id)}
                            className="px-3 py-1.5 text-sm border rounded bg-white hover:bg-gray-50"
                          >
                            {isOpen ? "Hide History" : "Inspection History"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStartInspection(t.id)}
                            disabled={inspLoading}
                            className="px-3 py-1.5 text-sm border rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                          >
                            Start Inspection
                          </button>
                        </div>
                      </div>

                      {isOpen && (
                        <div className="mt-3">
                          {(() => {
                            const inv = treeInventory[t.id]
                            const snaps = inv?.snapshots || []
                            const current =
                              snaps.find((s) => s.id === inv?.currentId) || null
                            return (
                              <div className="mb-3">
                                <h4 className="text-sm font-semibold mb-2">
                                  Current Inventory
                                </h4>
                                {current ? (
                                  <div className="rounded border border-emerald-300 bg-emerald-50 p-2">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-sm font-semibold text-emerald-800">
                                        <span className="font-mono">
                                          {current.snapshot_code}
                                        </span>{" "}
                                        · {current.total_coconuts} coconuts
                                      </span>
                                      <span className="text-xs text-gray-500">
                                        {current.created_at
                                          ? new Date(
                                              current.created_at
                                            ).toLocaleString()
                                          : ""}
                                      </span>
                                    </div>
                                    <div className="mt-1 flex flex-wrap gap-2 text-xs">
                                      <span className="rounded bg-white px-2 py-0.5">
                                        Mature: {current.mature_count}
                                      </span>
                                      <span className="rounded bg-white px-2 py-0.5">
                                        Potential: {current.potential_count}
                                      </span>
                                      <span className="rounded bg-white px-2 py-0.5">
                                        Premature: {current.premature_count}
                                      </span>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-sm text-gray-500">
                                    No inventory yet. Complete an inspection to
                                    build one.
                                  </p>
                                )}

                                {snaps.length > 0 && (
                                  <div className="mt-2">
                                    <h4 className="text-sm font-semibold mb-1">
                                      Inventory History
                                    </h4>
                                    <div className="space-y-1">
                                      {snaps.map((s) => (
                                        <div
                                          key={s.id}
                                          className={
                                            "rounded border px-2 py-1 text-xs " +
                                            (s.id === inv?.currentId
                                              ? "border-emerald-300 bg-emerald-50"
                                              : "border-gray-200")
                                          }
                                        >
                                          <div className="flex items-center justify-between gap-2">
                                            <span className="font-mono">
                                              {s.snapshot_code}
                                              {s.id === inv?.currentId && (
                                                <span className="ml-1 rounded bg-emerald-600 px-1 py-0.5 text-[10px] text-white">
                                                  CURRENT
                                                </span>
                                              )}
                                            </span>
                                            <span className="text-gray-500">
                                              {s.created_at
                                                ? new Date(
                                                    s.created_at
                                                  ).toLocaleString()
                                                : ""}
                                            </span>
                                          </div>
                                          <div className="text-gray-700 mt-0.5">
                                            Total: {s.total_coconuts} · Mature:{" "}
                                            {s.mature_count} · Potential:{" "}
                                            {s.potential_count} · Premature:{" "}
                                            {s.premature_count}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )
                          })()}

                          <h4 className="text-sm font-semibold mb-2">
                            Inspection History
                          </h4>
                          {insps.length === 0 ? (
                            <p className="text-sm text-gray-500">
                              No inspections yet for this tree.
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {insps.map((insp) => {
                                const imgs = inspectionImages[insp.id] || []
                                const canAddImages =
                                  insp.status === "CREATED" ||
                                  insp.status === "IN_PROGRESS"
                                const inspSnap = (
                                  treeInventory[t.id]?.snapshots || []
                                ).find((s) => s.inspection_id === insp.id)
                                return (
                                <div
                                  key={insp.id}
                                  className="border rounded p-2 text-sm"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div>
                                      <span className="font-mono">
                                        {insp.inspection_code}
                                      </span>{" "}
                                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">
                                        {insp.status}
                                      </span>
                                    </div>
                                    <span className="text-xs text-gray-500">
                                      {insp.created_at
                                        ? new Date(insp.created_at).toLocaleString()
                                        : ""}
                                    </span>
                                  </div>
                                  <div className="text-xs text-gray-600 mt-1">
                                    Images: {insp.inspection_image_count}
                                    {insp.completed_at
                                      ? ` · Completed ${new Date(insp.completed_at).toLocaleString()}`
                                      : ""}
                                    {insp.notes ? ` · ${insp.notes}` : ""}
                                  </div>

                                  {canAddImages && (
                                    <div className="flex flex-wrap items-center gap-2 mt-2">
                                      <input
                                        type="file"
                                        multiple
                                        accept="image/*"
                                        onChange={(e) => {
                                          const files = e.target.files
                                            ? Array.from(e.target.files)
                                            : []
                                          handleUploadInspectionImages(
                                            t.id,
                                            insp.id,
                                            files
                                          )
                                          e.target.value = ""
                                        }}
                                        className="text-xs"
                                        disabled={inspUploading[insp.id]}
                                      />
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleProcessInspectionImages(
                                            t.id,
                                            insp.id
                                          )
                                        }
                                        disabled={inspLoading || inspUploading[insp.id]}
                                        className="px-3 py-1 text-sm border rounded bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
                                      >
                                        Process / Re-scan
                                      </button>
                                      <span className="text-xs text-gray-500">
                                        {inspUploading[insp.id]
                                          ? "Uploading & scanning…"
                                          : ""}
                                      </span>
                                    </div>
                                  )}

                                  {imgs.length > 0 && (
                                    <div className="mt-2 space-y-1">
                                      <div className="text-xs font-semibold">
                                        Inspection Images
                                      </div>
                                      {imgs.map((img) => (
                                        <div
                                          key={img.id}
                                          className="border rounded px-2 py-1"
                                        >
                                          <div className="flex items-center justify-between gap-2">
                                            <span className="truncate">
                                              {img.original_filename}
                                            </span>
                                            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">
                                              {img.status}
                                            </span>
                                          </div>
                                          <div className="text-xs text-gray-600 mt-0.5">
                                            Detections: {img.detection_count}
                                            {img.detection_count > 0 && (
                                              <span className="ml-1">
                                                (
                                                {Object.entries(
                                                  img.detection_summary
                                                )
                                                  .map(([k, v]) => `${k}: ${v}`)
                                                  .join(", ")}
                                                )
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {inspSnap && (
                                    <div className="mt-2 rounded border border-emerald-200 bg-emerald-50 px-2 py-1">
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="text-xs font-semibold text-emerald-800">
                                          Inventory Snapshot{" "}
                                          <span className="font-mono">
                                            {inspSnap.snapshot_code}
                                          </span>
                                        </span>
                                        <span className="text-xs text-gray-500">
                                          {inspSnap.created_at
                                            ? new Date(
                                                inspSnap.created_at
                                              ).toLocaleString()
                                            : ""}
                                        </span>
                                      </div>
                                      <div className="text-xs text-emerald-900 mt-0.5">
                                        Total: {inspSnap.total_coconuts} · Mature:{" "}
                                        {inspSnap.mature_count} · Potential:{" "}
                                        {inspSnap.potential_count} · Premature:{" "}
                                        {inspSnap.premature_count}
                                      </div>
                                    </div>
                                  )}

                                  {(insp.status === "CREATED" ||
                                    insp.status === "IN_PROGRESS") && (
                                    <div className="flex items-center gap-2 mt-2">
                                      <input
                                        type="number"
                                        min={0}
                                        value={
                                          completeCount[insp.id] ??
                                          Math.max(imgs.length, 1)
                                        }
                                        onChange={(e) =>
                                          setCompleteCount((prev) => ({
                                            ...prev,
                                            [insp.id]: Number(e.target.value),
                                          }))
                                        }
                                        className="w-20 border rounded px-2 py-1 text-sm"
                                      />
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleCompleteInspection(t.id, insp.id)
                                        }
                                        disabled={inspLoading}
                                        className="px-3 py-1 text-sm border rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                                      >
                                        Complete
                                      </button>
                                    </div>
                                  )}
                                </div>
                                )})}

                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {permTrees && permTrees.total_pages > 1 && (
                <div className="mt-4 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      const p = Math.max(1, permPage - 1)
                      setPermPage(p)
                      if (selectedMissionId !== null)
                        loadPermanentTrees(selectedMissionId, p)
                    }}
                    disabled={permPage <= 1}
                    className="px-3 py-1.5 text-sm border rounded bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-600">
                    Page {permTrees.page} of {permTrees.total_pages}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const p = Math.min(permTrees.total_pages, permPage + 1)
                      setPermPage(p)
                      if (selectedMissionId !== null)
                        loadPermanentTrees(selectedMissionId, p)
                    }}
                    disabled={permPage >= permTrees.total_pages}
                    className="px-3 py-1.5 text-sm border rounded bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* Harvest Planner & Mission Builder (Feature 10) */}
      <section className="mt-6 border rounded p-4" data-testid="harvest-planner">
        <h2 className="text-xl font-semibold mb-3">Harvest Planner</h2>
        <p className="text-sm text-gray-600 mb-3">
          Generate a Harvest Mission from the latest Inventory Snapshots. Eligible
          trees are ordered by a Nearest-Neighbour route. Execute it below to drive
          the robot through the queue and update Inventory History.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm font-medium" htmlFor="harvest-type">
            Harvest type
          </label>
          <select
            id="harvest-type"
            className="border rounded px-2 py-1"
            value={harvestType}
            onChange={(e) => setHarvestType(e.target.value as HarvestType)}
          >
            <option value="mature">Mature</option>
            <option value="potential">Potential</option>
            <option value="premature">Premature</option>
            <option value="all">All</option>
          </select>
          <button
            type="button"
            onClick={handleGenerateHarvestMission}
            disabled={harvestGenerating}
            className="bg-emerald-700 text-white px-4 py-1.5 rounded disabled:opacity-50"
          >
            {harvestGenerating ? "Generating…" : "Generate Harvest Mission"}
          </button>
        </div>

        {selectedHarvest && (
          <div
            className="mt-4 rounded border border-emerald-300 bg-emerald-50 p-3"
            data-testid="harvest-mission"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-lg font-semibold text-emerald-900 font-mono">
                {selectedHarvest.mission_code}
              </span>
              <span className="rounded bg-emerald-600 px-2 py-0.5 text-xs text-white">
                {selectedHarvest.status}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-sm">
              <span className="rounded bg-white px-2 py-0.5">
                Harvest type: <strong>{selectedHarvest.harvest_type}</strong>
              </span>
              <span className="rounded bg-white px-2 py-0.5">
                Total trees: <strong>{selectedHarvest.total_trees}</strong>
              </span>
              <span className="rounded bg-white px-2 py-0.5">
                Expected coconuts:{" "}
                <strong>{selectedHarvest.total_expected_coconuts}</strong>
              </span>
            </div>

            <h3 className="mt-3 text-sm font-semibold">Ordered Tree Queue</h3>
            {selectedHarvest.items && selectedHarvest.items.length > 0 ? (
              <ol className="mt-1 space-y-1" data-testid="harvest-queue">
                {selectedHarvest.items.map((item) => (
                  <li
                    key={item.id}
                    className={
                      "flex items-center gap-3 rounded border px-2 py-1 text-sm " +
                      (item.status === "COMPLETED"
                        ? "border-emerald-200 bg-emerald-100"
                        : item.status === "IN_PROGRESS"
                          ? "border-emerald-500 bg-emerald-200"
                          : item.status === "CANCELLED"
                            ? "border-gray-200 bg-gray-100 opacity-60"
                            : "border-emerald-200 bg-white")
                    }
                  >
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-xs font-semibold text-white">
                      {item.visit_order}
                    </span>
                    <span className="font-mono">{item.tree_code}</span>
                    <span className="text-gray-600">
                      Expected: {item.expected_coconuts}
                    </span>
                    {item.harvested !== null && item.harvested !== undefined && (
                      <span className="text-gray-600">
                        Harvested: {item.harvested}
                      </span>
                    )}
                    <span className="ml-auto rounded bg-gray-100 px-1.5 py-0.5 text-xs">
                      {item.status}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-gray-500">No trees in this mission.</p>
            )}

            {/* Robot Mission Execution (Feature 11) */}
            <div className="mt-3 rounded border border-emerald-200 bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">Robot Status</h3>
                {robotStatus && robotStatus.mission_id === selectedHarvest.id && (
                  <span
                    className="rounded bg-emerald-700 px-2 py-0.5 text-xs text-white font-mono"
                    data-testid="robot-state"
                  >
                    {robotStatus.robot_state}
                  </span>
                )}
              </div>
              {robotStatus && robotStatus.mission_id === selectedHarvest.id ? (
                <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded bg-emerald-50 px-2 py-1">
                    Mission:{" "}
                    <strong>{robotStatus.mission_status}</strong>
                  </div>
                  <div className="rounded bg-emerald-50 px-2 py-1">
                    Current tree:{" "}
                    <strong>
                      {robotStatus.current_item
                        ? robotStatus.current_item.tree_code
                        : "—"}
                    </strong>
                  </div>
                  <div className="rounded bg-emerald-50 px-2 py-1">
                    Completed: <strong>{robotStatus.completed_count}</strong>
                  </div>
                  <div className="rounded bg-emerald-50 px-2 py-1">
                    Remaining: <strong>{robotStatus.remaining_count}</strong>
                  </div>
                  <div className="rounded bg-emerald-50 px-2 py-1">
                    Harvested:{" "}
                    <strong>{robotStatus.harvested_coconuts}</strong>
                  </div>
                  <div className="rounded bg-emerald-50 px-2 py-1">
                    Next tree:{" "}
                    <strong>
                      {robotStatus.next_item
                        ? robotStatus.next_item.tree_code
                        : "—"}
                    </strong>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-sm text-gray-500">
                  Start the mission to see robot status.
                </p>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                {selectedHarvest.status === "CREATED" && (
                  <button
                    type="button"
                    data-testid="harvest-start"
                    onClick={() => runHarvestAction("start", selectedHarvest.id)}
                    disabled={harvestExecuting}
                    className="bg-emerald-700 text-white px-3 py-1.5 rounded disabled:opacity-50"
                  >
                    Start Mission
                  </button>
                )}
                {selectedHarvest.status === "RUNNING" && (
                  <>
                    <button
                      type="button"
                      data-testid="harvest-advance"
                      onClick={() =>
                        runHarvestAction("advance", selectedHarvest.id)
                      }
                      disabled={harvestExecuting}
                      className="bg-emerald-700 text-white px-3 py-1.5 rounded disabled:opacity-50"
                    >
                      Advance to Next Tree
                    </button>
                    <button
                      type="button"
                      data-testid="harvest-pause"
                      onClick={() =>
                        runHarvestAction("pause", selectedHarvest.id)
                      }
                      disabled={harvestExecuting}
                      className="bg-amber-600 text-white px-3 py-1.5 rounded disabled:opacity-50"
                    >
                      Pause
                    </button>
                  </>
                )}
                {selectedHarvest.status === "PAUSED" && (
                  <button
                    type="button"
                    data-testid="harvest-resume"
                    onClick={() => runHarvestAction("resume", selectedHarvest.id)}
                    disabled={harvestExecuting}
                    className="bg-emerald-700 text-white px-3 py-1.5 rounded disabled:opacity-50"
                  >
                    Resume
                  </button>
                )}
                {selectedHarvest.status !== "COMPLETED" &&
                  selectedHarvest.status !== "CANCELLED" && (
                    <button
                      type="button"
                      data-testid="harvest-cancel"
                      onClick={() =>
                        runHarvestAction("cancel", selectedHarvest.id)
                      }
                      disabled={harvestExecuting}
                      className="bg-red-600 text-white px-3 py-1.5 rounded disabled:opacity-50"
                    >
                      Cancel Mission
                    </button>
                  )}
              </div>
              {harvestExecuting && (
                <p className="mt-2 text-sm text-gray-500">Working…</p>
              )}
            </div>
          </div>
        )}

        {harvestMissions.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-semibold mb-1">Harvest Missions</h3>
            <div className="space-y-1">
              {harvestMissions.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleSelectHarvestMission(m.id)}
                  className={
                    "block w-full rounded border px-2 py-1 text-left text-xs " +
                    (selectedHarvest?.id === m.id
                      ? "border-emerald-300 bg-emerald-50"
                      : "border-gray-200 hover:bg-gray-50")
                  }
                >
                  <span className="font-mono">{m.mission_code}</span> ·{" "}
                  {m.harvest_type} · {m.status} · {m.total_trees} tree(s) ·{" "}
                  {m.total_expected_coconuts} expected ·{" "}
                  {m.created_at ? new Date(m.created_at).toLocaleString() : ""}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Survey Tile Generation (Feature 4) */}
      {selectedMissionId !== null && (
        <section className="mt-6 border rounded p-4">
          <h2 className="text-xl font-semibold mb-3">Survey Tile Generation</h2>
          {tileGen === null ? (
            <p className="text-gray-500 text-sm">Loading generation progress…</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="border rounded p-3 text-center">
                <div className="text-2xl font-bold">{tileGen.images_uploaded}</div>
                <div className="text-xs text-gray-600">Images Uploaded</div>
              </div>
              <div className="border rounded p-3 text-center">
                <div className="text-2xl font-bold">{tileGen.tiles_generated}</div>
                <div className="text-xs text-gray-600">Tiles Generated</div>
              </div>
              <div className="border rounded p-3 text-center">
                <div className="text-2xl font-bold">{tileGen.remaining}</div>
                <div className="text-xs text-gray-600">Remaining</div>
              </div>
              <div className="border rounded p-3 text-center">
                <div className="text-2xl font-bold">
                  {tileGen.generation_status === "complete"
                    ? "Complete"
                    : tileGen.generation_status === "in_progress"
                      ? "In Progress"
                      : "Not Started"}
                </div>
                <div className="text-xs text-gray-600">Generation Status</div>
              </div>
            </div>
          )}
        </section>
      )}
    </main>
  )
}
