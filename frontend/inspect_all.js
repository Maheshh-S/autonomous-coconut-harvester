const { chromium } = require("playwright");

const BASE = "http://127.0.0.1:3000";
const PAGES = [
  ["/", "landing"],
  ["/dashboard", "dashboard"],
  ["/survey", "survey"],
  ["/map", "map"],
  ["/robot", "robot"],
  ["/robot/history", "history"],
  ["/trees", "trees"],
  ["/trees/1", "tree-detail"],
];

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 834, height: 1112 },
  { name: "mobile", width: 390, height: 844 },
];

(async () => {
  const browser = await chromium.launch();
  const results = [];
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    for (const [path, name] of PAGES) {
      const errors = [];
      page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
      page.on("pageerror", (e) => errors.push("PAGEERR: " + e.message));
      try {
        await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 15000 });
      } catch (e) {
        errors.push("NAV: " + e.message);
      }
      await page.waitForTimeout(1500);
      const metrics = await page.evaluate(() => {
        const de = document.documentElement;
        const overflowX = de.scrollWidth > window.innerWidth + 1;
        const h1 = document.querySelector("h1");
        const cs = h1 ? getComputedStyle(h1) : null;
        const body = getComputedStyle(document.body);
        // find smallest font size among visible text
        let minText = 999, maxText = 0;
        document.querySelectorAll("p,span,a,button,li,td,th,label,div").forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) return;
          const t = (el.textContent || "").trim();
          if (!t || t.length > 60) return;
          const s = parseFloat(getComputedStyle(el).fontSize);
          if (!isNaN(s)) { if (s < minText) minText = s; if (s > maxText) maxText = s; }
        });
        return {
          overflowX,
          scrollW: de.scrollWidth,
          innerW: window.innerWidth,
          bodyBg: body.backgroundColor,
          h1Size: cs ? cs.fontSize : null,
          h1Color: cs ? cs.color : null,
          minText: minText === 999 ? null : minText,
        };
      });
      await page.screenshot({ path: `shots/${name}-${vp.name}.png`, fullPage: false });
      results.push({ page: name, vp: vp.name, ...metrics, errors: errors.slice(0, 4) });
    }
    await ctx.close();
  }
  await browser.close();
  console.table(results.map(r => ({ page: r.page, vp: r.vp, overflowX: r.overflowX, scrollW: r.scrollW, innerW: r.innerW, h1: r.h1Size, minText: r.minText, errs: r.errors.length })));
  // print errors detail
  results.filter(r => r.errors.length).forEach(r => console.log("ERRORS", r.page, r.vp, r.errors));
})();
