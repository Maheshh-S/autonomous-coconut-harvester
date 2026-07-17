const { chromium } = require("playwright")

const BASE = "http://127.0.0.1:3000"

async function checkPage(browser, path, label, expectText) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await ctx.newPage()
  const errors = []
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text())
  })
  page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message))
  await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 30000 })
  await page.waitForTimeout(1500)
  const body = await page.textContent("body")
  const found = expectText.every((t) => body && body.includes(t))
  console.log(
    `[${label}] status=${page.url().endsWith(path) ? "ok" : page.url()} errors=${errors.length} expectFound=${found}`
  )
  if (errors.length) console.log("  ERRORS:", errors.slice(0, 8))
  await ctx.close()
  return { errors: errors.length, found }
}

;(async () => {
  const browser = await chromium.launch()
  let totalErrors = 0

  // History list
  let r = await checkPage(browser, "/robot/history", "history-list", ["Mission History"])
  totalErrors += r.errors

  // Detail page (run 2). Look for score breakdown factors + severity log.
  r = await checkPage(browser, "/robot/history/1", "history-detail", [
    "Mission Score",
    "Completion",
    "Harvested / Total",
  ])
  totalErrors += r.errors

  // Map with ?tree= focus (should not crash)
  r = await checkPage(browser, "/map?tree=698", "map-tree-focus", [])
  totalErrors += r.errors

  await browser.close()
  console.log("TOTAL_CONSOLE_ERRORS=" + totalErrors)
  process.exit(totalErrors === 0 ? 0 : 1)
})()
