"use client"

import { useState } from "react"

export default function CoconutUploader({
  treeId,
}: {
  treeId: number
}) {

  const [image, setImage] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const [count, setCount] = useState<number | null>(null)

  function handleChange(
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

    const formData = new FormData()

    formData.append("file", image)

    const res = await fetch(
      "http://127.0.0.1:8000/detect/coconuts",
      {
        method: "POST",
        body: formData
      }
    )

    const data = await res.json()

    setResult(
      "data:image/jpeg;base64," +
      data.annotated_image
    )

    setCount(
      data.coconuts_detected
    )

    console.log(
      "Tree",
      treeId,
      data
    )
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
          <img src={preview} width={400} />
        </div>
      )}


      {result && (
        <div>
          <p>Coconuts detected: {count}</p>
          <img src={result} width={400} />
        </div>
      )}

    </div>

  )

}