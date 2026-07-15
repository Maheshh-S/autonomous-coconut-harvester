"use client"

import dynamic from "next/dynamic"

const MapView = dynamic(
  () => import("./MapView"),
  { ssr: false }
)

type Tree = {
  tree_id: number
  tree_code?: string | null
  gps_lat: number
  gps_lon: number
  coconuts_detected: number
  tasks_remaining: number
}

export default function MapWrapper({
  trees,
}: {
  trees: Tree[]
}) {

  return <MapView trees={trees} />

}