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
  confidence: number
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
    "http://127.0.0.1:8000/trees/summary"
  )

  if (!res.ok) {
    throw new Error("Failed to fetch trees")
  }

  return res.json()

}