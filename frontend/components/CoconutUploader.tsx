"use client"

import { useState } from "react"
import { Crosshair } from "@phosphor-icons/react"
import {
  detectCoconuts,
  storeDetection,
} from "@/lib/api/detection"

// V4.0.4 — restyled to match the survey dropzone language (was a raw file
// input with a hardcoded "green" button). Text/selector contracts preserved
// for the e2e specs: input[type=file][accept="image/*"], "Detect Coconuts",
// "Coconuts detected:".
export default function CoconutUploader({
  treeId,
  harvestType,
}: {
  treeId: number
  harvestType: string
}) {
  const [image, setImage] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const [count, setCount] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImage(file)
    setPreview(URL.createObjectURL(file))
  }

  async function detect() {
    if (!image) return
    setBusy(true)
    try {
      const data = await detectCoconuts(image)
      setResult("data:image/jpeg;base64," + data.annotated_image)
      setCount(data.coconuts_detected ?? data.detections?.length ?? 0)
      let coconutId = 1
      for (const d of data.detections ?? []) {
        await storeDetection(
          treeId,
          coconutId++,
          d.ripeness,
          d.confidence,
          harvestType
        )
      }
    } catch (err) {
      console.error("Detection failed", err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ marginTop: 20 }}>
      <label className="cu-dropzone">
        <input type="file" accept="image/*" onChange={handleChange} className="cu-file" />
        <Crosshair size={30} weight="regular" aria-hidden />
        <span className="cu-title">Choose a close-up coconut photo</span>
        <span className="cu-sub">
          {image ? image.name : "JPG or PNG — detection runs on the device server."}
        </span>
      </label>

      <div style={{ marginTop: 12 }}>
        <button
          type="button"
          onClick={detect}
          disabled={!image || busy}
          className="cu-detect"
          style={{ opacity: !image || busy ? 0.5 : 1, cursor: !image || busy ? "default" : "pointer" }}
          title={image ? "Run ripeness detection on this photo" : "Choose a photo first"}
        >
          {busy ? "Detecting…" : "Detect Coconuts"}
        </button>
      </div>

      {preview && (
        <div className="cu-card">
          <p className="cu-card-h">Preview</p>
          <img src={preview} alt="Preview of the uploaded coconut photo" />
        </div>
      )}

      {result && (
        <div className="cu-card">
          <p className="cu-card-h">
            Coconuts detected:
            <span className="cu-count font-mono">{count}</span>
          </p>
          <img src={result} alt="Coconuts detected in the uploaded photo" />
        </div>
      )}

      <style jsx>{`
        .cu-dropzone {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          border: 1.5px dashed var(--color-line-strong);
          border-radius: var(--radius-md);
          background: var(--color-surface-sunken);
          padding: 26px 20px;
          cursor: pointer;
          text-align: center;
          color: var(--color-accent);
          transition: border-color 140ms var(--ease-out), background 140ms var(--ease-out);
        }
        .cu-dropzone:hover {
          border-color: var(--color-accent);
          background: var(--color-accent-glow);
        }
        .cu-file {
          position: absolute;
          width: 1px;
          height: 1px;
          opacity: 0;
          overflow: hidden;
          clip: rect(0 0 0 0);
        }
        .cu-title { font-weight: 600; font-size: 14px; color: var(--color-text); }
        .cu-sub {
          font-size: 12px;
          color: var(--color-text-dim);
          max-width: 320px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 100%;
        }
        .cu-detect {
          padding: 11px 18px;
          border-radius: var(--radius-sm);
          border: 1px solid transparent;
          background: var(--color-accent);
          color: #fff;
          font-weight: 600;
          font-size: 14px;
          min-height: 44px;
          transition: background 120ms var(--ease-out);
        }
        .cu-detect:hover { background: var(--color-accent-deep); }
        .cu-card {
          margin-top: 16px;
          border: 1px solid var(--color-line);
          border-radius: var(--radius-md);
          background: var(--color-surface);
          padding: 14px;
        }
        .cu-card img {
          width: 100%;
          max-width: 420px;
          border-radius: var(--radius-sm);
          display: block;
        }
        .cu-card-h {
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 600;
          font-size: 13px;
          color: var(--color-text);
          margin: 0 0 10px;
        }
        .cu-count {
          background: var(--color-accent-weak);
          color: var(--color-accent);
          border-radius: 999px;
          padding: 1px 10px;
          font-size: 12px;
        }
      `}</style>
    </div>
  )
}
