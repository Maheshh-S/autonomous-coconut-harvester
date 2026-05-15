"use client"

import { useState, useEffect, use } from "react"
import { getTreesSummary } from "@/lib/api/detection"
import CoconutUploader from "@/components/CoconutUploader"

type Props = {
  params: Promise<{
    treeId: string
  }>
}

export default function TreePage({ params }: Props) {

  // ✅ unwrap async params (Next 16 rule)
  const { treeId } = use(params)

  const [harvestType, setHarvestType] = useState("mature")
  const [tree, setTree] = useState<any>(null)



  async function loadTree() {

    const trees = await getTreesSummary()

    const t = trees.find(
      (x: any) => x.tree_id == treeId
    )

    setTree(t)
  }

  useEffect(() => {
    loadTree()
  }, [])

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


