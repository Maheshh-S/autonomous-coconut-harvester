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
  type Inspection,
  type InspectionImage,
  type InventorySnapshot,
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
  newly_created: number
  matched_existing: number
  avg_match_confidence: number | null
  trees: PermanentTree[]
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000"

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
  const [expandedTree, setExpandedTree] = useState<number | null>(null)
  const [treeInspections, setTreeInspections] = useState<Record<number, Inspection[]>>({})
  const [inspectionImages, setInspectionImages] = useState<Record<number, InspectionImage[]>>({})
  const [treeInventory, setTreeInventory] = useState<
    Record<number, { currentId: number | null; snapshots: InventorySnapshot[] }>
  >({})
  const [inspLoading, setInspLoading] = useState(false)
  const [inspUploading, setInspUploading] = useState<Record<number, boolean>>({})
  const [completeCount, setCompleteCount] = useState<Record<number, number>>({})
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

  async function loadPermanentTrees(missionId: number) {
    // Guard against stale responses overwriting fresh data (e.g. a slow
    // pre-completion read resolving after the post-completion read). Only the
    // most recent load for a given mission is applied.
    const seq = ++loadSeq.current
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const data = await getPermanentTrees(missionId)
        if (seq === loadSeq.current) setPermTrees(data as PermanentTrees)
        return
      } catch (err) {
        if (attempt === 1) console.error("Failed to load permanent trees", err)
      }
    }
  }

  useEffect(() => {
    loadMissions()
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
    loadPermanentTrees(selectedMissionId)
  }, [selectedMissionId])

  // Reset completion state only when the selected mission changes (not on every
  // upload toggle), so a finished upload keeps its "completed" indicator.
  useEffect(() => {
    setDone(false)
    setError(null)
    setSuccess(null)
    setTileGen(null)
    setPermTrees(null)
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
            </>
          )}
        </section>
      )}

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
