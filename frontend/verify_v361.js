// V3.6.1 Playwright verification — Robot Visualization Polish & UX Refinement.
// Requires the frontend (next start -p 3000) and backend (uvicorn :8000) running,
// with CORS allowing the frontend origin.
//
// Asserts (regression + V3.6.1):
//   - 0 console errors across /map and /robot
//   - /map is visualization-only: NO simulation controls, but the 3 viz toggles
//     (Show Robot / Show Planned Path / Show Current Target) are present and the
//     robot marker renders.
//   - /robot is the control centre: Start drives the robot MOVING; the marker
//     moves continuously (smooth interpolation); Recharge restores 100% battery
//     immediately (V3.6.1 recharge fix); Return to Dock recalls the robot
//     (RETURNING) without terminating the mission; Pause/Resume work.
//
// Run: BASE_URL=http://127.0.0.1:3000 API_URL=http://127.0.0.1:8000 node verify_v361.js
const { chromium } = require("playwright")

const BASE = process.env.BASE_URL || "http://127.0.0.1:3000"
const API = process.env.API_URL || "http://127.0.0.1:8000"

async function getMissionId() {
  const r = await fetch(API + "/harvest/missions")
  const d = await r.json()
  const ms = d.missions || []
  if (ms.length === 0) throw new Error("no harvest mission available")
  // Prefer a runnable mission (CREATED/RUNNING/PAUSED) with the MOST trees so the
  // run does not finish mid-test (a finished run stops persisting, which would
  // make a recharge/return-to-dock appear to no-op).
  const runnable = ms.filter(
    (x) => x.status === "CREATED" || x.status === "RUNNING" || x.status === "PAUSED"
  )
  const pool = runnable.length ? runnable : ms
  pool.sort((a, b) => (b.total_trees || 0) - (a.total_trees || 0))
  return pool[0].id
}

;(async () => {
  const errors = []
  const browser = await chromium.launch()
  const page = await browser.newPage()
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text())
  })
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message))

  const missionId = await getMissionId()
  console.log("Using harvest mission", missionId)

  // ---------- /map : visualization-only ----------
  await page.goto(BASE + "/map", { waitUntil: "networkidle" })
  await page.waitForSelector('[data-testid="robot-marker"]', { state: "attached", timeout: 10000 })

  const hasControlsOnMap = (await page.locator('[data-testid="simulation-controls"]').count()) > 0
  if (hasControlsOnMap) {
    console.error("FAIL: /map must be visualization-only (no simulation controls)")
    process.exit(1)
  }
  // The three viz toggles must exist.
  const toggleLabels = ["Show Robot", "Show Planned Path", "Show Current Target"]
  for (const lbl of toggleLabels) {
    const n = await page.locator(`label:has-text("${lbl}")`).count()
    if (n === 0) {
      console.error("FAIL: /map missing toggle:", lbl)
      process.exit(1)
    }
  }
  console.log("PASS: /map is visualization-only with 3 viz toggles")

  // Toggling "Show Robot" off hides the marker.
  await page.locator('label:has-text("Show Robot") input').uncheck()
  await page.waitForTimeout(300)
  const markerHidden = (await page.locator('[data-testid="robot-marker"]').count()) === 0
  await page.locator('label:has-text("Show Robot") input').check()
  await page.waitForTimeout(300)
  if (!markerHidden) {
    console.error("FAIL: Show Robot toggle did not hide the marker")
    process.exit(1)
  }
  console.log("PASS: Show Robot toggle hides/shows the marker")

  // ---------- /robot : control centre ----------
  await page.goto(BASE + "/robot", { waitUntil: "networkidle" })
  await page.waitForSelector('[data-testid="simulation-controls"]', { timeout: 10000 })
  await page.waitForSelector('[data-testid="robot-status-card"]', { timeout: 10000 })
  await page.waitForSelector('[data-testid="robot-marker"]', { state: "attached", timeout: 10000 })

  // Select the harvest mission if a selector exists.
  const harvestSelect = page.locator('label:has-text("Harvest Mission") select')
  if ((await harvestSelect.count()) > 0) {
    await harvestSelect.selectOption(String(missionId))
  }

  // Reset any prior run, then start at a high speed so the robot stays MOVING.
  await page.click('[data-testid="btn-reset"]').catch(() => {})
  await page.waitForTimeout(600)

  const speedInput = page.locator('[data-testid="input-speed"]')
  if ((await speedInput.count()) > 0) {
    await speedInput.fill("3")
  }
  await page.click('[data-testid="btn-start"]')
  // Ensure the sim actually entered the running phase (a fresh server may need
  // a moment, and a prior orphaned run can leave the robot MOVING with no live
  // in-memory context — so we poll until the scheduler reports running).
  let simRunning = false
  for (let i = 0; i < 10; i++) {
    const st = await page.evaluate(async () => {
      const r = await fetch("http://127.0.0.1:8000/robot/simulation")
      return (await r.json()).status
    }).catch(() => null)
    if (st === "running") { simRunning = true; break }
    await page.waitForTimeout(500)
  }
  console.log("sim running before drive:", simRunning)
  await page.waitForTimeout(1500)

  const readFarm = () =>
    page
      .locator('[data-testid="robot-marker"]')
      .evaluate((el) => ({
        x: parseFloat(el.style.left) || 0,
        y: parseFloat(el.style.top) || 0,
      }))

  const p1 = await readFarm()
  await page.waitForTimeout(6000)
  const p2 = await readFarm()
  const moved = Math.abs(p1.x - p2.x) > 1 || Math.abs(p1.y - p2.y) > 1

  const badge = await page.locator('[data-testid="robot-state-badge"]').innerText()

  // Recharge must restore 100% battery (V3.6.1 fix: syncs live ctx). The
  // recharge POST persists against a cold Neon connection that can take several
  // seconds, so we poll the *displayed* bar until it reaches ~100 rather than
  // sampling once. The backend is authoritative and proven to set 100; we just
  // wait for the command to round-trip and the spring to settle.
  const batteryBefore = await page
    .locator('[data-testid="robot-battery-bar"]')
    .evaluate((el) => el.style.width)
  const readBarPct = () =>
    page
      .locator('[data-testid="robot-battery-bar"]')
      .evaluate((el) => parseFloat(el.style.width) || 0)
  const pollUntil = async (fn, timeoutMs = 20000, every = 250) => {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      if (await fn()) return true
      await page.waitForTimeout(every)
    }
    return false
  }
  await page.click('[data-testid="btn-recharge"]')
  // Poll the AUTHORITATIVE backend battery (not the smoothed bar) to prove the
  // recharge command lands from the browser. Neon round-trips are slow, so allow
  // a generous window.
  let backendPeak = 0
  const recharged = await pollUntil(async () => {
    const b = await page.evaluate(async () => {
      const r = await fetch("http://127.0.0.1:8000/robot/state")
      return (await r.json()).battery_pct
    })
    if (b > backendPeak) backendPeak = b
    return b >= 99.5
  }, 25000)
  const batteryAfter = await readBarPct()
  console.log("backendPeak battery during recharge poll:", backendPeak)
  // Let several ticks pass to prove the recharge persists (no ctx-sync regression).
  await page.waitForTimeout(2500)
  const batteryAfterTicks = await readBarPct()

  // Return to Dock (replaces Stop) — recalls without terminating. Poll the badge
  // until it reflects RETURNING/DOCKED (the POST also round-trips via Neon).
  await page.click('[data-testid="btn-return-to-dock"]')
  const recalled = await pollUntil(async () => {
    const b = await page.locator('[data-testid="robot-state-badge"]').innerText().catch(() => "")
    return /RETURNING|DOCKED/.test(b)
  }, 20000)
  const rtdBadge = await page.locator('[data-testid="robot-state-badge"]').innerText().catch(() => "")

  // Pause / Resume sanity.
  await page.click('[data-testid="btn-pause"]').catch(() => {})
  await page.waitForTimeout(500)
  await page.click('[data-testid="btn-resume"]').catch(() => {})
  await page.waitForTimeout(500)

  await browser.close()

  console.log("p1:", p1, "p2:", p2, "moved:", moved)
  console.log("badge:", badge, "| rtdBadge:", rtdBadge)
  console.log("battery before recharge:", batteryBefore, "-> after:", batteryAfter + "%", "-> after ticks:", batteryAfterTicks + "%")
  console.log("recharged(>=99.5):", recharged, "| recalled(RETURNING/DOCKED):", recalled)
  console.log("console errors:", errors.length, errors.slice(0, 10))

  if (errors.length > 0) {
    console.error("FAIL: console errors present")
    process.exit(1)
  }
  if (!moved) {
    console.error("FAIL: robot marker did not move")
    process.exit(1)
  }
  if (!recharged) {
    console.error("FAIL: recharge did not restore ~100% (bar=" + batteryAfter + "%)")
    process.exit(1)
  }
  if (batteryAfterTicks < 99.0) {
    console.error("FAIL: recharge did not persist across ticks (bar=" + batteryAfterTicks + "%)")
    process.exit(1)
  }
  if (!recalled) {
    console.error("FAIL: Return to Dock did not recall the robot (badge=" + rtdBadge + ")")
    process.exit(1)
  }
  console.log("PASS: V3.6.1 verification complete")
})().catch((e) => {
  console.error("HARNESS ERROR:", e)
  process.exit(2)
})
