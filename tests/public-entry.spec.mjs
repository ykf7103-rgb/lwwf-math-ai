import { expect, test } from "@playwright/test";

const forbiddenStudentLabels = /system\s*prompt|api\s*key|poe\s*nano|gemini\s*flash|whisper\s*stt|proxy\s*token/i;

for (const viewport of [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 },
]) {
  test(`公開入口保持精簡並隱藏技術更新：${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(page.locator("#loginPage")).toBeVisible();
    await expect(page.locator(".update-log")).toBeHidden();
    const visibleText = await page.locator("body").innerText();
    expect(visibleText).not.toMatch(forbiddenStudentLabels);

    const overflow = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - innerWidth));
    expect(overflow).toBeLessThanOrEqual(2);
  });
}
