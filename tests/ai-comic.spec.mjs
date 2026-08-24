import { expect, test } from "@playwright/test";
import { installPassportMock } from "./passport-fixture.mjs";

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9J8fQAAAAASUVORK5CYII=",
  "base64"
);

async function setSampleImage(page) {
  await page.locator("#fileInput").setInputFiles({
    name: "math-question.png",
    mimeType: "image/png",
    buffer: tinyPng
  });
}

test("7A 只會透過 Learning Passport 安全 API 生成四格漫畫", async ({ page }) => {
  await installPassportMock(page, { classCode: "7A" });
  await page.goto("/tools/ai-comic.html");
  await page.waitForFunction(() => window.__TOOL_DEBUG__?.access === "7A-student");
  await page.evaluate(() => {
    window.LWWFPassport.authorizedFetch = async (input, init = {}) => {
      window.__PASSPORT_AUTH_FETCH_LOG.push({ input: String(input), method: init.method || "GET" });
      return new Response(JSON.stringify({
        ok: true,
        image: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9J8fQAAAAASUVORK5CYII=",
        image_mime: "image/png",
        script: {
          problem: "3 + 4 = ?",
          key_idea: "先數清楚兩組物件。",
          answer: "7",
          panels: Array.from({ length: 4 }, (_, index) => ({ title: `第 ${index + 1} 步`, dialogue: "一起數。", text: "逐步完成。", math: "3 + 4 = 7" }))
        }
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    };
  });
  await setSampleImage(page);
  await expect(page.locator("#generateBtn")).toBeEnabled();
  await page.locator("#generateBtn").click();
  await expect(page.locator("#statusBox")).toContainText("已完成四格漫畫");
  expect(await page.evaluate(() => window.__PASSPORT_AUTH_FETCH_LOG)).toEqual([
    expect.objectContaining({
      input: "https://lwwf-learning-passport.lwwfaiteams.workers.dev/api/site/math-comic",
      method: "POST"
    })
  ]);
  expect(await page.evaluate(() => JSON.stringify(window.__TOOL_DEBUG__))).not.toMatch(/token|provider|model|prompt/i);
});

test("非 7A 學生與教師巡堂均不會呼叫付費生成 API", async ({ browser }) => {
  for (const options of [{ classCode: "5A" }, { mode: "teacher-preview", grade: "p5" }]) {
    const page = await browser.newPage();
    await installPassportMock(page, options);
    await page.goto("/tools/ai-comic.html");
    await page.waitForFunction(() => window.__TOOL_DEBUG__?.access === "restricted");
    await setSampleImage(page);
    await expect(page.locator("#generateBtn")).toBeDisabled();
    expect(await page.evaluate(() => window.__PASSPORT_AUTH_FETCH_LOG)).toEqual([]);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.close();
  }
});
