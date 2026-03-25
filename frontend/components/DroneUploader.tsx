"use client"

import { useState } from "react"
import { detectTrees } from "@/lib/api/detection"
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

  const [image,setImage] = useState<File | null>(null)
  const [preview,setPreview] = useState<string | null>(null)

  const [trees,setTrees] = useState<Tree[]>([])
  const [result,setResult] = useState<string | null>(null)
  const [count,setCount] = useState<number | null>(null)

  const [selectedTree,setSelectedTree] = useState<Tree | null>(null)


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

  function selectTree(tree: Tree) {

  console.log("Navigate to tree:", tree.id)

  router.push(`/tree/${tree.id}`)

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