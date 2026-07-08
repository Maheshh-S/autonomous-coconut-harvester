import { getTreesSummary } from "@/lib/api/detection"
import Link from "next/link"

export default async function TreesPage() {

  const trees = await getTreesSummary()

  return (

    <div style={{ padding: 20 }}>

      <h1>Farm Dashboard</h1>

      <table
        border={1}
        cellPadding={10}
        style={{ marginTop: 20 }}
      >

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

          {trees.map((t: any) => (

            <tr key={t.tree_id}>

              <td>{t.tree_id}</td>

              <td>{t.gps_lat}</td>

              <td>{t.gps_lon}</td>

              <td>{t.coconuts_detected}</td>

              <td>{t.tasks_remaining}</td>

              <td>

                <Link href={`/trees/${t.tree_id}`}>
                  Open
                </Link>

              </td>

            </tr>

          ))}

        </tbody>

      </table>

    </div>

  )

}