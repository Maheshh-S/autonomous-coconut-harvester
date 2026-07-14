// Playwright end‑to‑end test for coconut ripeness detection
import { test, expect } from "@playwright/test";

const COCO_IMAGE = "/Users/mahesh/Developer/Major-Project/autonomous-coconut-harvester/demo_images/coconut/coconut6.jpg";

test("Coconut ripeness detection UI works", async ({ page }) => {
  // 1️⃣ Open the app
  await page.goto("http://localhost:3000");

  // 2️⃣ Locate the Coconut Uploader section by its heading
  const uploaderSection = page.locator('text=Upload Coconut Image').first();
  await expect(uploaderSection).toBeVisible();

  // 3️⃣ Within that section, find the file input and upload an image
  const fileInput = uploaderSection.locator('..').locator('input[type="file"][accept="image/*"]');
  await fileInput.setInputFiles(COCO_IMAGE);

  // 4️⃣ Click the Detect Coconuts button within the same section
  const detectBtn = uploaderSection.locator('..').getByRole("button", { name: "Detect Coconuts" });
  await detectBtn.click();

  // 5️⃣ Wait for the network response from the backend and UI update
  const [response] = await Promise.all([
    page.waitForResponse(resp => resp.url().includes("/detect/coconuts") && resp.status() === 200),
    page.waitForSelector("text=Coconuts detected:")
  ]);

  const json = await response.json();
  // Verify the backend returned at least one detection
  expect(json.coconuts_detected).toBeGreaterThan(0);
  // Verify each detection has a non‑empty ripeness label
  for (const det of json.detections) {
    expect(det.ripeness).toBeTruthy();
  }

  // 6️⃣ Confirm the UI shows the same count
  const countText = await page.textContent("p:has-text('Coconuts detected')");
  expect(countText).toContain(json.coconuts_detected.toString());
});
