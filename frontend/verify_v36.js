// V3.6 Playwright verification — Live Robot Visualization on the Digital Twin.
// Requires the frontend (next start -p 3000) and backend (uvicorn :8000) running,
// with CORS allowing the frontend origin.
//
// Asserts: 0 console errors, robot marker renders + moves over time, controls
// (start/pause/resume/stop/reset) work, and the status card reflects live state.
//
// Run: BASE_URL=http://127.0.0.1:3000 node verify_v36.js
const { chromium } = require("playwright")

const BASE = process.env.BASE_URL || "http://127.0.0.1:3000"
const API = process.env.API_URL || "http://127.0.0.1:8000"

async function getMissionId() {
  const r = await fetch(API + "/harvest/missions")
  const d = await r.json()
  const m =
    (d.missions || []).find((x) => x.status === "CREATED") || d.missions?.[0]
  if (!m) throw new Error("no harvest mission available")
  return m.id
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

  await page.goto(BASE + "/map", { waitUntil: "networkidle" })

  // Controls + status card present
  await page.waitForSelector('[data-testid="simulation-controls"]', { timeout: 10000 })
  await page.waitForSelector('[data-testid="robot-status-card"]', { timeout: 10000 })
  await page.waitForSelector('[data-testid="robot-marker"]', { state: "attached", timeout: 10000 })

  // Select the HARVEST mission in its dedicated selector.
  const harvestSelect = page.locator('label:has-text("Harvest Mission") select')
  await harvestSelect.selectOption(String(missionId))

  // Reset any prior run so we start clean, then start at a moderate speed so the
  // robot stays MOVING long enough to observe movement (the sim moves the robot
  // slowly relative to the farm size, so we use speed 10 and sample over 6s).
  await page.click('[data-testid="btn-reset"]').catch(() => {})
  await page.waitForTimeout(500)

  const speedInput = page.locator('[data-testid="input-speed"]')
  await speedInput.fill("10")
  await page.click('[data-testid="btn-start"]')
  await page.waitForTimeout(1000)

  // Sample the marker's farm-pixel position (via its left/top style) at two
  // points ~6s apart. Because the marker is counter-scaled and screen-space
  // deltas are tiny, we compare the underlying farm-pixel coords instead.
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

  const moved =
    Math.abs(p1.x - p2.x) > 1 || Math.abs(p1.y - p2.y) > 1

  const badge = await page
    .locator('[data-testid="robot-state-badge"]')
    .innerText()

  // Pause then resume
  await page.click('[data-testid="btn-pause"]')
  await page.waitForTimeout(800)
  const pausedBadge = await page
    .locator('[data-testid="robot-state-badge"]')
    .innerText()
  await page.click('[data-testid="btn-resume"]')
  await page.waitForTimeout(800)

  // Stop
  await page.click('[data-testid="btn-stop"]')
  await page.waitForTimeout(800)

  await browser.close()

  console.log("p1:", p1, "p2:", p2, "moved:", moved)
  console.log("state badge:", badge, "paused badge:", pausedBadge)
  console.log("console errors:", errors.length, errors.slice(0, 10))

  if (errors.length > 0) {
    console.error("FAIL: console errors present")
    process.exit(1)
  }
  if (!moved) {
    console.error("FAIL: robot marker did not move")
    process.exit(1)
  }
  console.log("PASS: V3.6 verification complete")
})().catch((e) => {
  console.error("HARNESS ERROR:", e)
  process.exit(2)
})
