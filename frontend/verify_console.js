const { chromium } = require('playwright');

const PAGES = [
  { name: 'Home', path: '/' },
  { name: 'Dashboard', path: '/dashboard' },
  { name: 'Survey', path: '/survey' },
  { name: 'Digital Twin', path: '/map' },
  { name: 'Robot', path: '/robot' },
  { name: 'History', path: '/robot/history' },
  { name: 'Trees', path: '/trees' },
  { name: 'Tree Detail', path: '/trees/1' },
];

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const failed = [];
  for (const p of PAGES) {
    const page = await context.newPage();
    const errors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push('PAGEERROR: ' + err.message));
    try {
      await page.goto('http://127.0.0.1:3000' + p.path, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
      // allow data fetch + hydration to settle
      await page.waitForTimeout(6000);
      const real = errors.filter((e) => !/favicon/i.test(e));
      if (real.length > 0) {
        failed.push({ name: p.name, path: p.path, errors: real });
      }
      console.log(`OK  ${p.name.padEnd(14)} ${p.path.padEnd(12)} console_errors=${real.length}`);
    } catch (e) {
      failed.push({ name: p.name, path: p.path, error: e.message });
      console.log(`ERR ${p.name.padEnd(14)} ${p.path.padEnd(12)} ${e.message.split('\n')[0]}`);
    }
    await page.close();
  }
  await browser.close();
  console.log('\n=== SUMMARY ===');
  console.log('pages checked:', PAGES.length, '| failures:', failed.length);
  if (failed.length) {
    console.log(JSON.stringify(failed, null, 2));
    process.exit(1);
  } else {
    console.log('ALL PAGES PASSED WITH ZERO CONSOLE ERRORS');
  }
})();
