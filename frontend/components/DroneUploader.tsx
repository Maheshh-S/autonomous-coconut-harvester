"use client"

import { useState } from "react"
import { detectTrees, API_BASE_URL } from "@/lib/api/detection"
import { useRouter } from "next/navigation"

type Tree = {
  id: number
  x1: number
  y1: number
  x2: number
  y2: number
  confidence: number
}

export default function DroneUploader() {

  const [image, setImage] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

  const [trees, setTrees] = useState<Tree[]>([])
  const [result, setResult] = useState<string | null>(null)
  const [count, setCount] = useState<number | null>(null)

  const router = useRouter()

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {

    const file = e.target.files?.[0]
    if (!file) return

    setImage(file)

    const url = URL.createObjectURL(file)
    setPreview(url)
  }

  async function runTreeDetection() {

    if (!image) return

    try {

      const data = await detectTrees(image)

      setTrees(data.trees)
      setResult("data:image/jpeg;base64," + data.annotated_image)
      setCount(data.trees_detected)

    } catch (err) {

      console.error("Tree detection failed", err)
    }
  }

  async function selectTree(tree: Tree) {

    try {

      // per‑tree GPS offset based on bounding‑box centre (x and y)
      const IMG_WIDTH = 600 // rendered image width (px)
      const IMG_HEIGHT = 600 // rendered image height (px)

      // use separate steps for latitude (x) and longitude (y)
      const GPS_STEP_LAT = 0.001 // degrees lat per full‑width offset
      const GPS_STEP_LON = 0.001 // degrees lon per full‑height offset

      const boxCx = (tree.x1 + tree.x2) / 2
      const boxCy = (tree.y1 + tree.y2) / 2

      const offsetLat = (boxCx / IMG_WIDTH) * GPS_STEP_LAT
      const offsetLon = (boxCy / IMG_HEIGHT) * GPS_STEP_LON

      const gps_lat = 12.9716 + offsetLat
      const gps_lon = 77.5946 + offsetLon

      const params = new URLSearchParams({
        gps_lat: gps_lat.toString(),
        gps_lon: gps_lon.toString(),
      })

      const res = await fetch(
        `${API_BASE_URL}/drone/tree_detected?${params.toString()}`,
        {
          method: "POST",
        }
      )

      if (!res.ok) {
        throw new Error("Failed to register tree")
      }

      const data = await res.json()

      router.push(`/trees/${data.tree_id}`)

    } catch (err) {

      console.error("Failed to register tree", err)
      router.push("/trees")
    }
  }

  return (

    <div className="mt-8">

      <h2 className="text-xl font-semibold mb-4">
        Upload Drone Image
      </h2>

      <input
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
      />

      <button
        onClick={runTreeDetection}
        className="ml-4 bg-green-600 text-white px-4 py-2 rounded"
      >
        Detect Trees
      </button>

      {preview && (

        <div className="mt-6">

          <p className="text-gray-600">Preview</p>

          <img
            src={preview}
            className="w-[600px] rounded shadow"
            alt="Preview of the uploaded drone scan image"
          />

        </div>
      )}

      {result && (

        <div className="mt-6">

          <p className="font-semibold">
            Trees Detected: {count}
          </p>

          <div className="relative w-[600px]">

            <img
              src={result}
              className="rounded shadow"
              alt="Trees detected in the drone scan"
            />

            {trees.map((tree) => (

              <div
                key={tree.id}
                onClick={() => selectTree(tree)}
                className="absolute border-2 border-red-500 cursor-pointer"
                style={{
                  left: tree.x1,
                  top: tree.y1,
                  width: tree.x2 - tree.x1,
                  height: tree.y2 - tree.y1
                }}
              />

            ))}

          </div>

        </div>
      )}
    </div>
  )
}