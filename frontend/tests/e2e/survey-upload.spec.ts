// Playwright end-to-end test for Survey Mission image ingestion (Feature 2).
// Run with: npx playwright test tests/e2e/survey-upload.spec.ts --headed
import { test, expect } from "@playwright/test";

const SURVEY_PAGE = "http://localhost:3000/survey";
const FIXTURE_DIR = "/tmp/survey_e2e";
const EXPECTED_IMAGES = 6;

test("Survey image ingestion workflow", async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => pageErrors.push(err.message));

  // 1. Open the Survey page.
  await page.goto(SURVEY_PAGE, { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: /Survey Mission/i })).toBeVisible();

  // 2. Create a Survey Mission.
  const folderName = `e2e_${Date.now()}`;
  await page.getByPlaceholder("new folder name").fill(folderName);
  await page.getByRole("button", { name: /Create mission/i }).click();
  await expect(
    page.locator('p:has-text("Selected mission #")')
  ).toBeVisible({ timeout: 10000 });

  // 3. Select a folder of images (directory input).
  const dirInput = page.locator('input[type="file"][webkitdirectory]');
  await dirInput.setInputFiles(FIXTURE_DIR);

  // The UI should report the total selected images.
  await expect(page.getByText(/Total images selected:/i)).toBeVisible();
  const totalText = await page.textContent("p:has-text('Total images selected')");
  const total = Number((totalText || "").replace(/\D/g, ""));
  expect(total).toBe(EXPECTED_IMAGES);

  // 4. Upload.
  await page.getByRole("button", { name: /Upload images/i }).click();

  // 5. Observe completion.
  await expect(page.getByText(/Upload completed/i)).toBeVisible({ timeout: 30000 });

  // 6. Uploaded images are visible as assets.
  const thumbs = page.locator("section:has(h2:has-text('Uploaded images')) img");
  await expect(thumbs.first()).toBeVisible();
  expect(await thumbs.count()).toBe(total);

  // The images are actually served (no broken links).
  const src = await thumbs.first().getAttribute("src");
  expect(src).toContain("/survey/uploads/");
  const resp = await page.request.get(src!);
  expect(resp.status()).toBe(200);
  expect(resp.headers()["content-type"]).toContain("image/");

  // Progress counters are consistent.
  const counters = page.locator("div.mt-2.flex.gap-6.text-sm");
  await expect(counters.getByText(/Uploaded:/i)).toContainText("6");
  await expect(counters.getByText(/Remaining:/i)).toContainText("0");
  await expect(counters.getByText(/Total:/i)).toContainText("6");

  // 7. No unexpected browser errors.
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
