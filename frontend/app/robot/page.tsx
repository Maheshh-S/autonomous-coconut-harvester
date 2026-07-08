"use client"

import { useEffect, useState } from "react"

type Task = {
  task_id: number
  tree_id: number
  coconut_id: number
  status: string
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000"

export default function RobotPage() {

  const [task, setTask] = useState<Task | null>(null)
  const [message, setMessage] = useState("")

  async function loadTask() {

    const res = await fetch(
      `${API_BASE_URL}/robot/next_task`,
      { cache: "no-store" }
    )

    const data = await res.json()

    if (data.message) {
      setMessage(data.message)
      setTask(null)
    } else {
      setTask(data)
      setMessage("")
    }
  }

  async function completeTask() {

    if (!task) return

    await fetch(
      `${API_BASE_URL}/robot/complete_task`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          task_id: task.task_id,
        }),
      }
    )

    loadTask()
  }

  useEffect(() => {
    loadTask()
  }, [])

  return (

    <div style={{ padding: 20 }}>

      <h1>Robot Control</h1>

      {message && <p>{message}</p>}

      {task && (

        <div>

          <p>Task ID: {task.task_id}</p>
          <p>Tree ID: {task.tree_id}</p>
          <p>Coconut ID: {task.coconut_id}</p>
          <p>Status: {task.status}</p>

          <button
            onClick={completeTask}
            style={{
              marginTop: 10,
              padding: 10,
              background: "green",
              color: "white",
            }}
          >
            Complete Task
          </button>

        </div>

      )}

    </div>

  )

}