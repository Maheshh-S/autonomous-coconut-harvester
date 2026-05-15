export async function detectTrees(image: File) {

const formData = new FormData()
formData.append("file", image)

const res = await fetch("http://127.0.0.1:8000/detect/trees", {
method: "POST",
body: formData
})

if (!res.ok) {
throw new Error("Tree detection failed")
}

return res.json()

}



export async function detectCoconuts(image: File) {

const formData = new FormData()
formData.append("file", image)

const res = await fetch("http://127.0.0.1:8000/detect/coconuts", {
method: "POST",
body: formData
})

if (!res.ok) {
throw new Error("Coconut detection failed")
}

return res.json()

}


export async function storeDetection(
  treeId: number,
  coconutId: number,
  ripeness: string,
  confidence: number,
  harvestType: string
) {

  const res = await fetch(
    "http://127.0.0.1:8000/drone/detection",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tree_id: treeId,
        coconut_id: coconutId,
        ripeness,
        confidence,
  harvest_type: harvestType,
      }),
    }
  )

  if (!res.ok) {
    throw new Error("Failed to store detection")
  }

  return res.json()

}

export async function getTreesSummary() {

  const res = await fetch(
    "http://localhost:8000/trees/summary",
    {
      cache: "no-store",
      next: { revalidate: 0 }
    }
  )

  if (!res.ok) {
    console.error("Fetch failed", res.status)
    throw new Error("Failed to fetch trees")
  }

  return res.json()

}


export async function getMapData() {

  const res = await fetch(
    "http://127.0.0.1:8000/plantation/map",
    {
      cache: "no-store"
    }
  )

  if (!res.ok) {
    throw new Error("Failed to fetch map data")
  }

  return res.json()

}