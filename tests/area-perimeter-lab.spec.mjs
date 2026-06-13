import { expect, test } from "@playwright/test";

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
  await page.addInitScript(() => localStorage.clear());
});

test("首頁入口可以開啟面積周界診斷室", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "數學AI學習區" })).toBeVisible();
  await expect(page.getByTestId("area-perimeter-home-link")).toBeVisible();
  await page.getByTestId("area-perimeter-home-link").click();

  await expect(page).toHaveURL(/\/tools\/area-perimeter-lab\.html$/);
  await expect(page.getByRole("heading", { name: "面積周界診斷室" })).toBeVisible();
  const debug = await readToolDebug(page);
  expect(debug.siteId).toBe("lwwf-math-area-perimeter-lab");
});

test("面積周界診斷室載入後提供安全 debug 摘要", async ({ page }) => {
  await page.goto("/tools/area-perimeter-lab.html");

  await expect(page.getByRole("heading", { name: "面積周界診斷室" })).toBeVisible();
  await expect(page.getByTestId("challenge-title")).toContainText("圍欄要看周界");
  await expect(page.getByTestId("target-readout")).toContainText("周界 14 cm");
  await expectNoBrokenImages(page);

  const debug = await readToolDebug(page);
  expect(debug).toMatchObject({
    siteId: "lwwf-math-area-perimeter-lab",
    route: "area-perimeter-lab",
    mode: "challenge",
    selectedActivityId: "border-garden",
    dimensions: { length: 3, width: 3 },
    selectedMeasure: "area",
    requiredMeasure: "perimeter",
    area: 9,
    perimeter: 12,
    completedCount: 0,
    score: 0
  });
});

test("學生能完成圍欄周界任務", async ({ page }) => {
  await page.goto("/tools/area-perimeter-lab.html");

  await setRange(page, "length-range", 4);
  await setRange(page, "width-range", 3);
  await page.getByTestId("measure-perimeter").click();
  await page.getByTestId("check-answer").click();

  await expect(page.getByTestId("feedback")).toContainText("完成");
  await expect(page.getByTestId("score-pill")).toContainText("完成 1/5");
  const debug = await readToolDebug(page);
  expect(debug.completedCount).toBe(1);
  expect(debug.selectedMeasure).toBe("perimeter");
  expect(debug.area).toBe(12);
  expect(debug.perimeter).toBe(14);
  expect(debug.saveStatus).toBe("saved-local");
});

test("錯用面積時會提示圍邊應看周界", async ({ page }) => {
  await page.goto("/tools/area-perimeter-lab.html");

  await setRange(page, "length-range", 4);
  await setRange(page, "width-range", 3);
  await page.getByTestId("check-answer").click();

  await expect(page.getByTestId("feedback")).toContainText("圍邊");
  await expect(page.getByTestId("feedback")).toContainText("周界");
  await page.waitForFunction(() => JSON.parse(document.documentElement.dataset.toolDebug || "{}").attempts === 1);
  const debug = await readToolDebug(page);
  expect(debug.completedCount).toBe(0);
  expect(debug.attempts).toBe(1);
});

test("390px 手機寬度沒有橫向溢出", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/tools/area-perimeter-lab.html");

  await expect(page.getByRole("heading", { name: "面積周界診斷室" })).toBeVisible();
  await expectNoBrokenImages(page);
  const overflow = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth)
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
});

test("Learning Passport mock receives safe area-perimeter progress", async ({ page }) => {
  await page.goto("/tools/area-perimeter-lab.html");

  await page.evaluate(() => {
    window.__PASSPORT_TEST_LOG = [];
    window.LWWFPassport = {
      getState: () => ({ ready: true, grade: "p4" }),
      recordProgress: async (payload) => {
        window.__PASSPORT_TEST_LOG.push(payload);
        return { ok: true };
      }
    };
    window.dispatchEvent(new CustomEvent("lwwf-passport-updated"));
  });

  await expect(page.getByTestId("passport-pill")).toContainText("護照已連線");
  await setRange(page, "length-range", 4);
  await setRange(page, "width-range", 3);
  await page.getByTestId("measure-perimeter").click();
  await page.getByTestId("check-answer").click();
  await page.waitForFunction(() => window.__PASSPORT_TEST_LOG?.length === 1);

  const payload = await page.evaluate(() => window.__PASSPORT_TEST_LOG[0]);
  expect(payload).toMatchObject({
    taskId: "area-perimeter-border-garden",
    taskTitle: "面積周界診斷室：圍欄要看周界",
    completed: true,
    score: 100,
    coins: 5,
    metadata: {
      toolId: "lwwf-math-area-perimeter-lab",
      topic: "area-perimeter",
      challengeId: "border-garden",
      strategy: "border-not-fill",
      dimensions: { length: 4, width: 3 },
      selectedMeasure: "perimeter",
      area: 12,
      perimeter: 14,
      targetArea: 12,
      targetPerimeter: 14,
      completedCount: 1,
      totalChallenges: 5,
      attempts: 1,
      correct: 1,
      accuracy: 100,
      visualModel: "grid-border-tiles"
    }
  });
  expect(JSON.stringify(payload)).not.toMatch(/token|password|apiKey|provider|secret/i);

  const debug = await readToolDebug(page);
  expect(debug.passportSiteId).toBe("lwwf-math-ai");
  expect(debug.apiStatus).toBe("saved-passport");
});
