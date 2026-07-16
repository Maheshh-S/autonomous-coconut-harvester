const { chromium } = require("playwright")

const BASE = process.env.BASE_URL || "http://localhost:3000"

// Dispatch a PointerEvent on an element at viewport coords (x, y).
async function dispatchPointer(page, type, x, y, target) {
  await page.evaluate(
    ({ type, x, y, target }) => {
      const el = document.querySelector(target)
      if (!el) throw new Error("missing " + target)
      const ev = new PointerEvent(type, {
        pointerId: 1,
        pointerType: "mouse",
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
      })
      el.dispatchEvent(ev)
    },
    { type, x, y, target }
  )
}

let pass = 0
let fail = 0
function check(name, cond) {
  if (cond) {
    pass++
    console.log("  PASS  " + name)
  } else {
    fail++
    console.log("  FAIL  " + name)
  }
}

;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  const errors = []
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text())
  })
  page.on("pageerror", (e) => errors.push(String(e)))

  await page.goto(BASE + "/map", { waitUntil: "networkidle" })
  await page.waitForSelector('[data-tree-id]', { timeout: 20000 })
  await page.waitForTimeout(800)

  // Baseline: zoom readout + 302 boxes
  const readout = await page.$('[data-testid="zoom-readout"]')
  check("zoom readout present", !!readout)
  const boxCount = await page.$$eval('[data-tree-id]', (n) => n.length)
  check("302 overlay boxes (" + boxCount + ")", boxCount === 302)

  // Drawer starts closed (translateX(100%))
  const drawerClosed = await page.$eval('[data-testid="tree-details-drawer"]', (d) => {
    const t = getComputedStyle(d).transform
    return { open: d.getAttribute("data-open"), transform: t }
  })
  check("drawer starts closed", drawerClosed.open === "false")

  // Find a tree box center
  const box = await page.$('[data-tree-id]')
  const bb = await box.boundingBox()
  const cx = Math.round(bb.x + bb.width / 2)
  const cy = Math.round(bb.y + bb.height / 2)

  // TAP selects (pointerdown + pointerup same spot)
  await dispatchPointer(page, "pointerdown", cx, cy, '[data-tree-id]')
  await dispatchPointer(page, "pointerup", cx, cy, "[data-tree-id]")
  await page.waitForTimeout(400)
  const afterTap = await page.$eval('[data-testid="tree-details-drawer"]', (d) => ({
    open: d.getAttribute("data-open"),
    treeCode: d.querySelector("h3") ? d.textContent.slice(0, 40) : null,
  }))
  check("tap on tree opens drawer", afterTap.open === "true")

  // Drawer is OUTSIDE the transformed stage: width fixed regardless of zoom.
  const wBefore = await page.$eval('[data-testid="tree-details-drawer"]', (d) => d.getBoundingClientRect().width)

  // Zoom in via wheel to scale the stage, then confirm drawer width unchanged.
  const vp = await page.$('[ref="viewportRef"]').catch(() => null)
  await page.evaluate(() => {
    const el = document.querySelector('[data-testid="zoom-readout"]').parentElement
    el.dispatchEvent(new WheelEvent("wheel", { deltaY: -300, clientX: 640, clientY: 450, bubbles: true, cancelable: true }))
  })
  await page.waitForTimeout(300)
  const wAfter = await page.$eval('[data-testid="tree-details-drawer"]', (d) => d.getBoundingClientRect().width)
  check("drawer width unaffected by zoom (" + Math.round(wBefore) + "->" + Math.round(wAfter) + ")", Math.abs(wBefore - wAfter) < 1)

  // Read stage transform, then DRAG to pan (should NOT select, should move stage).
  const stageBefore = await page.$eval('[data-tree-id]', () => {
    // find stage: the transformed ancestor of an overlay box
    const box = document.querySelector('[data-tree-id]')
    let p = box.parentElement
    while (p && !/translate/.test(p.style.transform || "")) p = p.parentElement
    return p ? p.style.transform : ""
  })
  const px = cx
  const py = cy
  // Close the drawer first so we can assert the drag does NOT open it.
  await page.$eval('[data-testid="tree-details-drawer"] button[title^="Close"]', (b) => b.click())
  await page.waitForTimeout(300)
  await dispatchPointer(page, "pointerdown", px, py, '[data-tree-id]')
  await dispatchPointer(page, "pointermove", px + 120, py + 20, "[data-tree-id]")
  await dispatchPointer(page, "pointermove", px + 160, py + 30, "[data-tree-id]")
  await dispatchPointer(page, "pointerup", px + 160, py + 30, "[data-tree-id]")
  await page.waitForTimeout(300)
  const stageAfter = await page.$eval('[data-tree-id]', () => {
    const box = document.querySelector('[data-tree-id]')
    let p = box.parentElement
    while (p && !/translate/.test(p.style.transform || "")) p = p.parentElement
    return p ? p.style.transform : ""
  })
  check("drag pans the stage (transform changed)", stageBefore !== stageAfter)
  check("drag did NOT select a tree (drawer closed)", await page.$eval('[data-testid="tree-details-drawer"]', (d) => d.getAttribute("data-open")) === "false")

  // Open drawer again, then close — view (stage transform) must be preserved.
  await dispatchPointer(page, "pointerdown", cx, cy, '[data-tree-id]')
  await dispatchPointer(page, "pointerup", cx, cy, "[data-tree-id]")
  await page.waitForTimeout(300)
  const stagePreClose = await page.$eval('[data-tree-id]', () => {
    const box = document.querySelector('[data-tree-id]')
    let p = box.parentElement
    while (p && !/translate/.test(p.style.transform || "")) p = p.parentElement
    return p ? p.style.transform : ""
  })
  await page.click('[data-testid="tree-details-drawer"] button[title^="Close"]')
  await page.waitForTimeout(400)
  const stagePostClose = await page.$eval('[data-tree-id]', () => {
    const box = document.querySelector('[data-tree-id]')
    let p = box.parentElement
    while (p && !/translate/.test(p.style.transform || "")) p = p.parentElement
    return p ? p.style.transform : ""
  })
  check("open/close preserves zoom+pan (stage transform)", stagePreClose === stagePostClose)
  check("close clears selection (drawer closed)", await page.$eval('[data-testid="tree-details-drawer"]', (d) => d.getAttribute("data-open")) === "false")

  // After close, tapping elsewhere still selects.
  await dispatchPointer(page, "pointerdown", cx, cy, '[data-tree-id]')
  await dispatchPointer(page, "pointerup", cx, cy, "[data-tree-id]")
  await page.waitForTimeout(300)
  check("selection works again after close", await page.$eval('[data-testid="tree-details-drawer"]', (d) => d.getAttribute("data-open")) === "true")

  check("zero console errors (" + errors.length + ")", errors.length === 0)
  if (errors.length) console.log(errors.slice(0, 5))

  console.log("\nRESULT  pass=" + pass + " fail=" + fail)
  await browser.close()
  process.exit(fail === 0 ? 0 : 1)
})().catch((e) => {
  console.error(e)
  process.exit(2)
})
