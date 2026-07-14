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



  useEffect(() => {

    async function loadTree() {

      const trees: TreeSummary[] = await getTreesSummary()

      const t = trees.find(
        (x) => String(x.tree_id) === treeId
      )

      setTree(t ?? null)
    }

    loadTree()
  }, [treeId])

  // --------------------------

  if (!tree) {
    return <div>Loading...</div>
  }

  return (

    <div style={{ padding: 20 }}>

      <h1>Tree Detail Page</h1>

      <p>Tree ID: {tree.tree_id}</p>
      <p>Latitude: {tree.gps_lat}</p>
      <p>Longitude: {tree.gps_lon}</p>

      <p>
        Coconuts detected: {tree.coconuts_detected}
      </p>

      <p>
        Tasks remaining: {tree.tasks_remaining}
      </p>

      {tree.tasks_remaining > 0 && (
        <p style={{ color: "orange" }}>
          Harvest required
        </p>
      )}

      {tree.tasks_remaining === 0 && (
        <p style={{ color: "green" }}>
          No harvest needed
        </p>
      )}

      <hr />

      <h2>Coconut Detection</h2>

      {/* -------------------- */}
      {/* Harvest preference */}
      {/* -------------------- */}

      <div style={{ marginTop: 20 }}>

        <h3>Harvest Preference</h3>

        <select
          value={harvestType}
          onChange={(e) =>
            setHarvestType(e.target.value)
          }
        >
          <option value="mature">
            Mature only
          </option>

          <option value="tender">
            Tender only
          </option>

          <option value="both">
            Both
          </option>

        </select>

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

//strech 


