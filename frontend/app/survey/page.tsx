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

              <details className="mt-4">
                <summary className="cursor-pointer text-sm text-gray-700">
                  Show {permTrees.trees.length} permanent tree
                  {permTrees.trees.length === 1 ? "" : "s"}
                </summary>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-sm border">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border px-2 py-1 text-left">Tree ID</th>
                        <th className="border px-2 py-1 text-left">Times Seen</th>
                        <th className="border px-2 py-1 text-left">
                          Match Confidence
                        </th>
                        <th className="border px-2 py-1 text-left">GPS (lat, lon)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {permTrees.trees.map((t) => (
                        <tr key={t.id}>
                          <td className="border px-2 py-1">{t.tree_code}</td>
                          <td className="border px-2 py-1">{t.times_seen}</td>
                          <td className="border px-2 py-1">
                            {t.last_matching_confidence !== null
                              ? t.last_matching_confidence.toFixed(3)
                              : "new"}
                          </td>
                          <td className="border px-2 py-1">
                            {t.gps_lat.toFixed(6)}, {t.gps_lon.toFixed(6)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
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
