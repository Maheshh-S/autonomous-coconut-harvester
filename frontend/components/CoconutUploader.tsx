"use client"

import { useState } from "react"
import {
  detectCoconuts,
  storeDetection,
} from "@/lib/api/detection"

export default function CoconutUploader({
  treeId,
  harvestType,
}: {
  treeId: number
  harvestType: string
}) {

  const [image, setImage] =
    useState<File | null>(null)

  const [preview, setPreview] =
    useState<string | null>(null)

  const [result, setResult] =
    useState<string | null>(null)

  const [count, setCount] =
    useState<number | null>(null)



  async function handleChange(
    e: React.ChangeEvent<HTMLInputElement>
  ) {

    const file = e.target.files?.[0]

    if (!file) return

    setImage(file)

    setPreview(
      URL.createObjectURL(file)
    )
  }



  async function detect() {

    if (!image) return

    try {

      const data =
        await detectCoconuts(image)

      setResult(
        "data:image/jpeg;base64," +
        data.annotated_image
      )

      setCount(
        data.coconuts_detected
      )


      // ✅ STORE EACH DETECTION

      let coconutId = 1

      for (const det of data.detections) {

        await storeDetection(
          treeId,
          coconutId,
          det.ripeness,
          det.confidence,
          harvestType
        )

        coconutId++

      }

      console.log(
        "Stored detections for tree",
        treeId
      )

    } catch (err) {

      console.error(
        "Detection failed",
        err
      )

    }

  }



  return (

    <div style={{ marginTop: 20 }}>

      <input
        type="file"
        accept="image/*"
        onChange={handleChange}
      />

      <button
        onClick={detect}
        style={{
          marginLeft: 10,
          background: "green",
          color: "white",
          padding: "6px 12px"
        }}
      >
        Detect Coconuts
      </button>



      {preview && (

        <div>

          <p>Preview</p>

          <img
            src={preview}
            width={400}
            alt="Preview of the uploaded coconut photo"
          />

        </div>

      )}



      {result && (

        <div>

          <p>
            Coconuts detected:
            {count}
          </p>

          <img
            src={result}
            width={400}
            alt="Coconuts detected in the uploaded photo"
          />

        </div>

      )}

    </div>

  )

}