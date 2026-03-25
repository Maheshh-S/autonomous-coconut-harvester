import { getTreesSummary } from "@/lib/api/detection"
import CoconutUploader from "@/components/CoconutUploader"

type Props = {
  params: Promise<{
    treeId: string
  }>
}

export default async function TreePage({
  params,
}: Props) {

  const { treeId } = await params

  const trees = await getTreesSummary()

  const tree = trees.find(
    (t: any) => t.tree_id == treeId
  )

  if (!tree) {
    return <div>Tree not found</div>
  }

  return (

    <div style={{ padding: 20 }}>

      <h1>Tree Detail Page</h1>

      <p>Tree ID: {tree.tree_id}</p>
      <p>Latitude: {tree.gps_lat}</p>
      <p>Longitude: {tree.gps_lon}</p>
      <p>Coconuts detected: {tree.coconuts_detected}</p>
      <p>Tasks remaining: {tree.tasks_remaining}</p>

      <hr />

      <h2>Coconut Detection</h2>

      <CoconutUploader
        treeId={tree.tree_id}
      />

    </div>

  )
}