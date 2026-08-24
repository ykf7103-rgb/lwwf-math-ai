import { expect, test } from "@playwright/test";
import { installPassportMock } from "./passport-fixture.mjs";

async function readToolDebug(page) {
  await page.waitForFunction(() => Boolean(document.documentElement.dataset.toolDebug));
  return JSON.parse(await page.evaluate(() => document.documentElement.dataset.toolDebug || "{}"));
}

async function expectNoBrokenImages(page) {
  await page.waitForFunction(() => Array.from(document.images).every((image) => image.complete));
  const broken = await page.evaluate(() =>
    Array.from(document.images)
      .filter((image) => image.naturalWidth === 0)
      .map((image) => image.currentSrc || image.getAttribute("src") || image.alt)
  );
  expect(broken).toEqual([]);
}

async function setRange(page, testId, value) {
  await page.getByTestId(testId).evaluate((input, nextValue) => {
    input.value = String(nextValue);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
}

test.beforeEach(async ({ page }) => {
  await installPassportMock(page);
  await page.addInitScript(() => localStorage.clear());
});

test("首頁入口可以開啟體積建築師", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("#studentPage")).toBeVisible();
  await page.getByTestId("volume-architect-topbar-link").click();
  await expect(page.getByTestId("learning-shell")).toHaveClass(/show/);
  const tool = page.frameLocator("#learningShellFrame");
  await expect(tool.getByRole("heading", { name: "體積建築師" })).toBeVisible();
  const debug = JSON.parse(await tool.locator("html").getAttribute("data-tool-debug") || "{}");
  expect(debug.siteId).toBe("lwwf-math-volume-architect");
});

test("舊體積建造器連結會導向新版工具", async ({ page }) => {
  await page.goto("/tools/volume-builder.html");

  await expect(page).toHaveURL(/\/tools\/volume-architect\.html$/);
  await expect(page.getByRole("heading", { name: "體積建築師" })).toBeVisible();
});

test("體積建築師載入後提供安全 debug 與非空方塊畫布", async ({ page }) => {
  await page.goto("/tools/volume-architect.html");

  await expect(page.getByRole("heading", { name: "體積建築師" })).toBeVisible();
  await expect(page.getByTestId("challenge-title")).toContainText("一個 1 cm³ 方塊");
  await expectNoBrokenImages(page);

  const debug = await readToolDebug(page);
  expect(debug).toMatchObject({
    siteId: "lwwf-math-volume-architect",
    route: "volume-builder",
    mode: "challenge",
    selectedActivityId: "unit-cube",
    volume: 12,
    targetVolume: 1,
    completedCount: 0,
    score: 0,
    canvasNonBlank: true
  });
});

test("學生可建立 1 cm³ 方塊並完成第一個任務", async ({ page }) => {
  await page.goto("/tools/volume-architect.html");

  await setRange(page, "length-range", 1);
  await setRange(page, "width-range", 1);
  await setRange(page, "height-range", 1);
  await page.getByTestId("check-answer").click();

  await expect(page.getByTestId("feedback")).toContainText("完成");
  await expect(page.getByTestId("score-pill")).toContainText("完成 1/5");
  const debug = await readToolDebug(page);
  expect(debug.completedCount).toBe(1);
  expect(debug.volume).toBe(1);
  expect(debug.score).toBe(1);
  expect(debug.accuracy).toBe(100);
  expect(debug.saveStatus).toBe("saved-local");
});

test("缺口任務能驗證完整長方體減去移走方塊", async ({ page }) => {
  await page.goto("/tools/volume-architect.html");

  await page.getByTestId("next-challenge").click();
  await page.getByTestId("next-challenge").click();
  await page.getByTestId("next-challenge").click();
  await expect(page.getByTestId("challenge-title")).toContainText("補回缺口");
  await expect(page.getByTestId("volume-readout")).toContainText("24 cm³");
  await setRange(page, "removed-range", 4);
  await expect(page.getByTestId("volume-readout")).toContainText("20 cm³");
  await page.getByTestId("check-answer").click();

  await expect(page.getByTestId("feedback")).toContainText("完成");
  const debug = await readToolDebug(page);
  expect(debug.selectedActivityId).toBe("missing-blocks");
  expect(debug.dimensions).toEqual({ length: 4, width: 3, height: 2 });
  expect(debug.removedBlocks).toBe(4);
  expect(debug.volume).toBe(20);
});

test("390px 手機寬度沒有橫向溢出", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/tools/volume-architect.html");

  await expect(page.getByRole("heading", { name: "體積建築師" })).toBeVisible();
  await expectNoBrokenImages(page);
  const overflow = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth)
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
});

test("Learning Passport mock receives safe volume progress", async ({ page }) => {
  await page.goto("/tools/volume-architect.html");

  await expect(page.getByTestId("passport-pill")).toContainText("護照已連線");
  await setRange(page, "length-range", 1);
  await setRange(page, "width-range", 1);
  await setRange(page, "height-range", 1);
  await page.getByTestId("check-answer").click();
  await page.waitForFunction(() => window.__PASSPORT_TEST_LOG?.length === 1);

  const payload = await page.evaluate(() => window.__PASSPORT_TEST_LOG[0]);
  expect(payload).toMatchObject({
    taskId: "volume-architect-unit-cube",
    taskTitle: "體積建築師：一個 1 cm³ 方塊",
    completed: true,
    score: 100,
    coins: 6,
    metadata: {
      toolId: "lwwf-math-volume-architect",
      topic: "volume",
      challengeId: "unit-cube",
      strategy: "unit-cube",
      dimensions: { length: 1, width: 1, height: 1 },
      baseArea: 1,
      removedBlocks: 0,
      volume: 1,
      unit: "cm3",
      completedCount: 1,
      totalChallenges: 5,
      attempts: 1,
      correct: 1,
      accuracy: 100,
      visualModel: "isometric-blocks"
    }
  });
  expect(JSON.stringify(payload)).not.toMatch(/token|password|apiKey|provider|secret/i);

  const debug = await readToolDebug(page);
  expect(debug.passportSiteId).toBe("lwwf-math-ai");
  expect(debug.apiStatus).toBe("saved-passport");
});
