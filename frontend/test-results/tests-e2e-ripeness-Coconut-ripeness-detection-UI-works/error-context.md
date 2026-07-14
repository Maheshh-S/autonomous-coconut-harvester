# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests/e2e/ripeness.spec.ts >> Coconut ripeness detection UI works
- Location: tests/e2e/ripeness.spec.ts:6:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('text=Upload Coconut Image').first()
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('text=Upload Coconut Image').first()

```

```yaml
- link "Home":
  - /url: /
- link "Dashboard":
  - /url: /trees
- link "Map":
  - /url: /map
- link "Robot":
  - /url: /robot
- main:
  - heading "Autonomous Coconut Harvesting System" [level=1]
  - paragraph: Drone Tree Detection and Coconut Ripeness Analysis
  - heading "Upload Drone Image" [level=2]
  - button "Choose File"
  - button "Detect Trees"
- alert
```

# Test source

```ts
  1  | // Playwright end‑to‑end test for coconut ripeness detection
  2  | import { test, expect } from "@playwright/test";
  3  | 
  4  | const COCO_IMAGE = "/Users/mahesh/Developer/Major-Project/autonomous-coconut-harvester/demo_images/coconut/coconut6.jpg";
  5  | 
  6  | test("Coconut ripeness detection UI works", async ({ page }) => {
  7  |   // 1️⃣ Open the app
  8  |   await page.goto("http://localhost:3000");
  9  | 
  10 |   // 2️⃣ Locate the Coconut Uploader section by its heading
  11 |   const uploaderSection = page.locator('text=Upload Coconut Image').first();
> 12 |   await expect(uploaderSection).toBeVisible();
     |                                 ^ Error: expect(locator).toBeVisible() failed
  13 | 
  14 |   // 3️⃣ Within that section, find the file input and upload an image
  15 |   const fileInput = uploaderSection.locator('..').locator('input[type="file"][accept="image/*"]');
  16 |   await fileInput.setInputFiles(COCO_IMAGE);
  17 | 
  18 |   // 4️⃣ Click the Detect Coconuts button within the same section
  19 |   const detectBtn = uploaderSection.locator('..').getByRole("button", { name: "Detect Coconuts" });
  20 |   await detectBtn.click();
  21 | 
  22 |   // 5️⃣ Wait for the network response from the backend and UI update
  23 |   const [response] = await Promise.all([
  24 |     page.waitForResponse(resp => resp.url().includes("/detect/coconuts") && resp.status() === 200),
  25 |     page.waitForSelector("text=Coconuts detected:")
  26 |   ]);
  27 | 
  28 |   const json = await response.json();
  29 |   // Verify the backend returned at least one detection
  30 |   expect(json.coconuts_detected).toBeGreaterThan(0);
  31 |   // Verify each detection has a non‑empty ripeness label
  32 |   for (const det of json.detections) {
  33 |     expect(det.ripeness).toBeTruthy();
  34 |   }
  35 | 
  36 |   // 6️⃣ Confirm the UI shows the same count
  37 |   const countText = await page.textContent("p:has-text('Coconuts detected')");
  38 |   expect(countText).toContain(json.coconuts_detected.toString());
  39 | });
  40 | 
```