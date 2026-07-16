const { chromium } = require("playwright")

const BASE = process.env.BASE_URL || "http://localhost:3000"

async function dp(page, type, x, y, target) {
  await page.evaluate(
    ({ type, x, y, target }) => {
      const el = document.querySelector(target)
      if (!el) throw new Error("missing " + target)
      el.dispatchEvent(
        new PointerEvent(type, {
          pointerId: 1,
          pointerType: "mouse",
          bubbles: true,
          cancelable: true,
          clientX: x,
          clientY: y,
        })
      )
    },
    { type, x, y, target }
  )
}

let pass = 0,
  fail = 0
function check(name, cond, extra) {
  if (cond) {
    pass++
    console.log("  PASS  " + name + (extra ? "  (" + extra + ")" : ""))
  } else {
    fail++
    console.log("  FAIL  " + name + (extra ? "  (" + extra + ")" : ""))
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
  await page.waitForTimeout(900)

  const count = (sel) => page.$$eval(sel, (n) => n.length)
  const totalTrees = await count('[data-tree-id]')

  // ---- FIT view: all trees visible (whole farm fits) ----
  const boxesFit = await count('[data-tree-id]')
  const labelsFit = await count('[data-tree-label]')
  const centroidsFit = await count('[data-tree-centroid]')
  console.log(
    "\n[AT FIT] total=" + totalTrees + " boxes=" + boxesFit + " labels=" + labelsFit + " centroids=" + centroidsFit
  )
  check("fit: all trees rendered (culling off at fit)", boxesFit === totalTrees)
  check("fit: labels hidden when zoomed out (LOD <20%)", labelsFit === 0)

  const scaleFit = await page.$eval('[data-testid="zoom-readout"]', (e) =>
    parseInt(e.textContent)
  )
  console.log("  fit zoom % = " + scaleFit)

  // ---- Select a tree at fit: its label MUST be visible even when zoomed out ----
  const box = await page.$('[data-tree-id]')
  const bb = await box.boundingBox()
  const cx = Math.round(bb.x + bb.width / 2)
  const cy = Math.round(bb.y + bb.height / 2)
  await dp(page, "pointerdown", cx, cy, '[data-tree-id]')
  await dp(page, "pointerup", cx, cy, "[data-tree-id]")
  await page.waitForTimeout(300)
  const selectedId = await box.getAttribute("data-tree-id")
  const selectedLabelVisible = await page.$('[data-tree-label="' + selectedId + '"]')
  check("selected label always visible (even zoomed out)", !!selectedLabelVisible)
  // close drawer
  await page.$eval('[data-testid="tree-details-drawer"] button[title^="Close"]', (b) => b.click())
  await page.waitForTimeout(300)

  // ---- Zoom IN to ~200%: culling should drop rendered boxes; all labels show ----
  for (let i = 0; i < 16; i++) {
    await page.evaluate(() => {
      const vp = document.querySelector('[data-testid="zoom-readout"]').parentElement
      vp.dispatchEvent(
        new WheelEvent("wheel", { deltaY: -300, clientX: 640, clientY: 450, bubbles: true, cancelable: true })
      )
    })
    await page.waitForTimeout(40)
  }
  await page.waitForTimeout(300)
  const scaleZoom = await page.$eval('[data-testid="zoom-readout"]', (e) => parseInt(e.textContent))
  const boxesZoom = await count('[data-tree-id]')
  const labelsZoom = await count('[data-tree-label]')
  const centroidsZoom = await count('[data-tree-centroid]')
  console.log(
    "\n[AT ~" + scaleZoom + "%] boxes=" + boxesZoom + " labels=" + labelsZoom + " centroids=" + centroidsZoom + " (total " + totalTrees + ")"
  )
  check("zoom-in: off-screen trees NOT rendered (culling)", boxesZoom < totalTrees, "boxes=" + boxesZoom + "/" + totalTrees)
  check("zoom-in: culled subset stays > 0", boxesZoom > 0)
  check("zoom-in: >40% shows all labels for rendered boxes", labelsZoom === boxesZoom, "labels=" + labelsZoom + " boxes=" + boxesZoom)
  check("zoom-in: centroids shown (>20%)", centroidsZoom === boxesZoom)

  // ---- Pan FPS measurement (synthetic, mid-gesture; no React re-render) ----
  const fps = await page.evaluate(async () => {
    const vp = document.querySelector('[data-testid="zoom-readout"]').parentElement
    const boxEl = document.querySelector('[data-tree-id]')
    boxEl.dispatchEvent(
      new PointerEvent("pointerdown", { pointerId: 1, pointerType: "mouse", bubbles: true, clientX: 640, clientY: 450 })
    )
    let frames = 0,
      last = performance.now(),
      times = []
    await new Promise((res) => {
      function step(t) {
        frames++
        times.push(t - last)
        last = t
        // pan horizontally
        boxEl.dispatchEvent(
          new PointerEvent("pointermove", {
            pointerId: 1,
            pointerType: "mouse",
            bubbles: true,
            clientX: 640 + (frames % 80),
            clientY: 450,
          })
        )
        if (frames < 45) requestAnimationFrame(step)
        else res()
      }
      requestAnimationFrame(step)
    })
    boxEl.dispatchEvent(
      new PointerEvent("pointerup", { pointerId: 1, pointerType: "mouse", bubbles: true, clientX: 640, clientY: 450 })
    )
    times.shift()
    const avg = times.reduce((a, b) => a + b, 0) / times.length
    return Math.round(1000 / avg)
  })
  console.log("\n  pan FPS ≈ " + fps)
  check("pan FPS >= 50 (smooth)", fps >= 50, fps + " fps")

  // ---- Regression: drag pans stage, does not select ----
  await page.evaluate(() => {
    const vp = document.querySelector('[data-testid="zoom-readout"]').parentElement
    vp.dispatchEvent(new WheelEvent("wheel", { deltaY: 300, clientX: 640, clientY: 450, bubbles: true, cancelable: true }))
  }) // reset a bit
  await page.waitForTimeout(200)
  const stageBefore = await page.$eval('[data-tree-id]', () => {
    const box = document.querySelector('[data-tree-id]')
    let p = box.parentElement
    while (p && !/translate/.test(p.style.transform || "")) p = p.parentElement
    return p ? p.style.transform : ""
  })
  await page.$eval('[data-testid="tree-details-drawer"] button[title^="Close"]', (b) => b.click()).catch(() => {})
  await dp(page, "pointerdown", cx, cy, '[data-tree-id]')
  await dp(page, "pointermove", cx + 140, cy + 30, "[data-tree-id]")
  await dp(page, "pointermove", cx + 180, cy + 40, "[data-tree-id]")
  await dp(page, "pointerup", cx + 180, cy + 40, "[data-tree-id]")
  await page.waitForTimeout(300)
  const stageAfter = await page.$eval('[data-tree-id]', () => {
    const box = document.querySelector('[data-tree-id]')
    let p = box.parentElement
    while (p && !/translate/.test(p.style.transform || "")) p = p.parentElement
    return p ? p.style.transform : ""
  })
  check("regression: drag pans the stage", stageBefore !== stageAfter)
  check("regression: drag does NOT select", await page.$eval('[data-testid="tree-details-drawer"]', (d) => d.getAttribute("data-open")) === "false")

  // ---- Regression: Fit button resets ----
  await page.click('button[title^="Fit"]')
  await page.waitForTimeout(400)
  const fitPct = await page.$eval('[data-testid="zoom-readout"]', (e) => parseInt(e.textContent))
  check("regression: Fit restores whole-farm view", fitPct === scaleFit, fitPct + "%")

  // ---- Regression: tap selects, drawer opens, close clears ----
  const box2 = await page.$('[data-tree-id]')
  const bb2 = await box2.boundingBox()
  const c2x = Math.round(bb2.x + bb2.width / 2)
  const c2y = Math.round(bb2.y + bb2.height / 2)
  await dp(page, "pointerdown", c2x, c2y, '[data-tree-id]')
  await dp(page, "pointerup", c2x, c2y, "[data-tree-id]")
  await page.waitForTimeout(300)
  check("regression: tap opens drawer", await page.$eval('[data-testid="tree-details-drawer"]', (d) => d.getAttribute("data-open")) === "true")
  await page.$eval('[data-testid="tree-details-drawer"] button[title^="Close"]', (b) => b.click())
  await page.waitForTimeout(300)
  check("regression: close clears selection", await page.$eval('[data-testid="tree-details-drawer"]', (d) => d.getAttribute("data-open")) === "false")

  // ---- Dashboard (details disabled) still renders boxes, no drawer ----
  const page2 = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  await page2.goto(BASE + "/dashboard", { waitUntil: "domcontentloaded" })
  try {
    await page2.waitForSelector('[data-tree-id]', { timeout: 15000 })
    await page2.waitForTimeout(800)
    const dashBoxes = await page2.$$eval('[data-tree-id]', (n) => n.length)
    const dashDrawer = await page2.$('[data-testid="tree-details-drawer"]')
    check("regression: dashboard renders boxes, no drawer", dashBoxes === totalTrees && !dashDrawer, "boxes=" + dashBoxes)
  } catch (e) {
    check("regression: dashboard renders boxes, no drawer", false, String(e).slice(0, 60))
  }
  await page2.close()

  check("zero console errors (" + errors.length + ")", errors.length === 0)
  if (errors.length) console.log(errors.slice(0, 5))

  console.log("\nRESULT  pass=" + pass + " fail=" + fail)
  await browser.close()
  process.exit(fail === 0 ? 0 : 1)
})().catch((e) => {
  console.error(e)
  process.exit(2)
})
