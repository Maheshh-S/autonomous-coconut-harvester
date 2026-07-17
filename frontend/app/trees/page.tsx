"use client"

import { useState, useEffect } from "react"
import { getTreesSummary } from "@/lib/api/detection"
import Link from "next/link"

type TreeSummary = {
  tree_id: number
  gps_lat: number
  gps_lon: number
  coconuts_detected: number
  tasks_remaining: number
}

export default function TreesPage() {
  const [trees, setTrees] = useState<TreeSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const data: TreeSummary[] = await getTreesSummary()
        setTrees(data)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div style={{ padding: 20 }}>
        <h1>Trees</h1>
        <p>Loading…</p>
      </div>
    )
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Trees</h1>

      <table border={1} cellPadding={10} style={{ marginTop: 20 }}>
        <thead>
          <tr>
            <th>ID</th>
            <th>Lat</th>
            <th>Lon</th>
            <th>Coconuts</th>
            <th>Tasks</th>
            <th>Open</th>
          </tr>
        </thead>

        <tbody>
          {trees.map((t: TreeSummary) => (
            <tr key={t.tree_id}>
              <td>{t.tree_id}</td>
              <td>{t.gps_lat}</td>
              <td>{t.gps_lon}</td>
              <td>{t.coconuts_detected}</td>
              <td>{t.tasks_remaining}</td>
              <td>
                <Link href={`/trees/${t.tree_id}`}>Open</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
