"use client"

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import "./leafletFix"
import { useRouter } from "next/navigation"


type Tree = {
  tree_id: number
  gps_lat: number
  gps_lon: number
  coconuts_detected: number
  tasks_remaining: number
}

export default function MapView({
    
  trees,
  
}: {
  trees: Tree[]
}) {


    const router = useRouter()
    
  return (

    <MapContainer
      center={[12.9716, 77.5946]}
      zoom={17}
      style={{
        height: "500px",
        width: "100%",
      }}
    >

      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {trees.map((t) => (

  <Marker
    key={t.tree_id}
    position={[t.gps_lat, t.gps_lon]}
    eventHandlers={{
      click: () => {
        router.push(`/trees/${t.tree_id}`)
      },
    }}
  >

    <Popup>

      Tree {t.tree_id} <br />

      Coconuts: {t.coconuts_detected} <br />

      Tasks: {t.tasks_remaining}

    </Popup>

  </Marker>

))}

    </MapContainer>

  )

}