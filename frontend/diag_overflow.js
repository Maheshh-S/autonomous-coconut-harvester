const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on("console", m => { if (m.type() === "error") errs.push(m.text()); });
  page.on("pageerror", e => errs.push("PE:" + e.message));
  await page.goto("http://127.0.0.1:3000/trees/1", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  const data = await page.evaluate(() => {
    const vw = window.innerWidth;
    const offenders = [];
    document.querySelectorAll("*").forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.right > vw + 1 || r.left < -1) {
        offenders.push({
          tag: el.tagName,
          cls: (el.className || "").toString().slice(0, 60),
          right: Math.round(r.right),
          left: Math.round(r.left),
          w: Math.round(r.width),
        });
      }
    });
    return { vw, count: offenders.length, top: offenders.slice(0, 12) };
  });
  console.log(JSON.stringify(data, null, 2));
  console.log("ERRS", errs.slice(0, 3));
  await browser.close();
})();
