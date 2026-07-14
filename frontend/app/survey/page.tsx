"use client"

import { useEffect, useRef, useState } from "react"
import {
  getMissions,
  createMission,
  uploadSurveyImages,
  getMissionImages,
  completeMission,
  getTileStats,
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
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000"

const IMAGE_EXT = /\.(jpe?g|png)$/i

export default function SurveyPage() {
  const [missions, setMissions] = useState<Mission[]>([])
  const [selectedMissionId, setSelectedMissionId] = useState<number | null>(null)
  const [newFolder, setNewFolder] = useState("")
  const [files, setFiles] = useState<File[]>([])
  const [images, setImages] = useState<UploadedImage[]>([])
  const [uploading, setUploading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [tileStats, setTileStats] = useState<TileStats | null>(null)
  const folderInputRef = useRef<HTMLInputElement | null>(null)

  const selectedMission = missions.find((m) => m.id === selectedMissionId) ?? null

  async function loadMissions() {
    try {
      const data = await getMissions()
      const list: Mission[] = data.missions ?? []
      setMissions(list)
      if (selectedMissionId === null && list.length > 0) {
        setSelectedMissionId(list[0].id)
      }
    } catch (err) {
      console.error("Failed to load missions", err)
    }
  }

  async function loadImages(missionId: number) {
    try {
      const data = await getMissionImages(missionId)
      setImages(
        (data.images ?? []).map((img: UploadedImage) => ({
          ...img,
          url: API_BASE_URL + img.url,
        }))
      )
    } catch (err) {
      console.error("Failed to load mission images", err)
    }
  }

  async function loadTileStats(missionId: number) {
    try {
      const data = await getTileStats(missionId)
      setTileStats(data as TileStats)
    } catch (err) {
      console.error("Failed to load tile statistics", err)
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

  // Tile statistics are independent of the image-upload loop, so they load on
  // every mission switch regardless of upload state.
  useEffect(() => {
    if (selectedMissionId === null) return
    loadTileStats(selectedMissionId)
  }, [selectedMissionId])

  // Reset completion state only when the selected mission changes (not on every
  // upload toggle), so a finished upload keeps its "completed" indicator.
  useEffect(() => {
    setDone(false)
    setError(null)
    setSuccess(null)
  }, [selectedMissionId])

  const canComplete =
    selectedMissionId !== null &&
    selectedMission?.status === "PROCESSING" &&
    images.length > 0

  async function handleComplete() {
    if (selectedMissionId === null) return
    const confirmed = window.confirm(
      "Complete this Survey Mission? It becomes the active source of truth and further uploads will be disabled."
    )
    if (!confirmed) return
    try {
      await completeMission(selectedMissionId)
      setSuccess("✅ Survey Mission completed and set active.")
      setError(null)
      await loadMissions()
    } catch (err) {
      setError("Failed to complete mission: " + (err as Error).message)
    }
  }

  async function handleCreateMission() {
    const source_folder = newFolder.trim() || `mission_${Date.now()}`
    try {
      const mission = await createMission({ source_folder })
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
          disabled={!canComplete}
          title={
            canComplete
              ? "Mark this mission complete and active"
              : "Available once a PROCESSING mission has at least one uploaded image"
          }
        >
          Complete Survey Mission
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
    </main>
  )
}
