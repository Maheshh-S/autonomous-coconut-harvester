import { getMapData } from "@/lib/api/detection"
import MapWrapper from "@/components/MapWrapper"

export default async function MapPage() {

  const trees = await getMapData()

  return (

    <div style={{ padding: 20 }}>

      <h1>Farm Map View</h1>

      <MapWrapper trees={trees} />

    </div>

  )

}