"use client"

import { useState, useEffect, use } from "react"
import { getTreesSummary } from "@/lib/api/detection"
import CoconutUploader from "@/components/CoconutUploader"

type Props = {
  params: Promise<{
    treeId: string
  }>
}

type TreeSummary = {
  tree_id: number
  gps_lat: number
  gps_lon: number
  coconuts_detected: number
  tasks_remaining: number
}

export default function TreePage({ params }: Props) {

  // ✅ unwrap async params (Next 16 rule)
  const { treeId } = use(params)

  const [harvestType, setHarvestType] = useState("mature")
  const [tree, setTree] = useState<TreeSummary | null>(null)
  const [notFound, setNotFound] = useState(false)



  useEffect(() => {

    async function loadTree() {

      setNotFound(false)
      const trees: TreeSummary[] = await getTreesSummary()

      const t = trees.find(
        (x) => String(x.tree_id) === treeId
      )

      setTree(t ?? null)
      if (!t) setNotFound(true)
    }

    loadTree()
  }, [treeId])

  // --------------------------

  if (notFound) {
    return (
      <div style={{ padding: "28px clamp(16px, 4vw, 48px) 56px", maxWidth: 1100, margin: "0 auto" }}>
        <div className="kicker">Tree Detail</div>
        <h1 className="font-display" style={{ fontSize: 36, fontWeight: 700, margin: "8px 0 16px" }}>
          Tree Registry
        </h1>
        <div
          style={{
            border: "1px solid var(--color-crit)",
            background: "rgba(255,107,94,0.08)",
            color: "#ff9a90",
            borderRadius: 14,
            padding: 18,
          }}
        >
          Tree #{treeId} not found.
        </div>
      </div>
    )
  }

  if (!tree) {
    return <div style={{ padding: 24, color: "var(--color-text-dim)" }}>Loading...</div>
  }

  const needsHarvest = tree.tasks_remaining > 0

  return (

    <div style={{ padding: "28px clamp(16px, 4vw, 48px) 56px", maxWidth: 1100, margin: "0 auto" }}>

      <div className="kicker">Tree Detail · #{tree.tree_id}</div>
      <h1 className="font-display" style={{ fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 700, margin: "8px 0 4px", letterSpacing: "-0.03em" }}>
        Tree <span className="lede-accent">{tree.tree_id}</span>
      </h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 12,
          margin: "20px 0",
        }}
      >
        <Stat label="Latitude" value={tree.gps_lat} />
        <Stat label="Longitude" value={tree.gps_lon} />
        <Stat label="Coconuts detected" value={tree.coconuts_detected} />
        <Stat
          label="Tasks remaining"
          value={tree.tasks_remaining}
          accent={needsHarvest ? "gold" : "green"}
        />
      </div>

      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 14px",
          borderRadius: 99,
          fontSize: 13,
          fontWeight: 600,
          marginBottom: 8,
          color: needsHarvest ? "#f5c451" : "#4fe39a",
          background: needsHarvest ? "rgba(245,196,81,0.12)" : "rgba(79,227,154,0.12)",
          border: `1px solid ${needsHarvest ? "rgba(245,196,81,0.4)" : "rgba(79,227,154,0.4)"}`,
        }}
      >
        <span className="dot" style={{ background: needsHarvest ? "var(--color-gold)" : "var(--color-accent)" }} />
        {needsHarvest ? "Harvest required" : "No harvest needed"}
      </div>

      <hr style={{ border: "none", borderTop: "1px solid var(--color-line)", margin: "20px 0" }} />

      <h2 className="font-display" style={{ fontSize: 20, fontWeight: 600, margin: "0 0 16px" }}>
        Coconut Detection
      </h2>

      {/* -------------------- */}
      {/* Harvest preference */}
      {/* -------------------- */}

      <div style={{ marginTop: 8, marginBottom: 20 }}>
        <label style={{ display: "inline-flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--color-text-faint)", fontFamily: "var(--font-mono)" }}>
            Harvest Preference
          </span>
          <select
            value={harvestType}
            onChange={(e) => setHarvestType(e.target.value)}
            className="select"
          >
            <option value="mature">Mature only</option>
            <option value="potential">Potential only</option>
            <option value="premature">Premature only</option>
            <option value="all">All</option>
          </select>
        </label>
      </div>

      {/* -------------------- */}
      {/* Coconut uploader */}
      {/* -------------------- */}

      <CoconutUploader
        treeId={tree.tree_id}
        harvestType={harvestType}
      />

    </div>

  )

}

function Stat({
  label,
  value,
  accent,
}: {
  label: string
  value: React.ReactNode
  accent?: "gold" | "green"
}) {
  const color =
    accent === "gold"
      ? "var(--color-gold)"
      : accent === "green"
      ? "var(--color-accent)"
      : "var(--color-text)"
  return (
    <div
      style={{
        background: "var(--color-surface-2)",
        border: "1px solid var(--color-line)",
        borderRadius: 12,
        padding: "14px 16px",
      }}
    >
      <div style={{ fontSize: 11, color: "var(--color-text-faint)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</div>
      <div className="font-display" style={{ fontSize: 20, fontWeight: 700, marginTop: 4, color }}>{value}</div>
    </div>
  )
}
