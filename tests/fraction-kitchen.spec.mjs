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

test.beforeEach(async ({ page }) => {
  await installPassportMock(page);
  await page.addInitScript(() => localStorage.clear());
});

test("首頁入口可以開啟分數料理台", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("#studentPage")).toBeVisible();
  await page.getByTestId("fraction-kitchen-topbar-link").click();
  await expect(page.getByTestId("learning-shell")).toHaveClass(/show/);
  const tool = page.frameLocator("#learningShellFrame");
  await expect(tool.getByRole("heading", { name: "分數料理台" })).toBeVisible();
  const debug = JSON.parse(await tool.locator("html").getAttribute("data-tool-debug") || "{}");
  expect(debug.siteId).toBe("lwwf-math-fraction-kitchen");
});

test("分數料理台載入後提供安全 debug 摘要", async ({ page }) => {
  await page.goto("/tools/fraction-kitchen.html");

  await expect(page.getByRole("heading", { name: "分數料理台" })).toBeVisible();
  await expect(page.getByText("切出和目標一樣大的分數")).toBeVisible();
  await expectNoBrokenImages(page);

  const debug = await readToolDebug(page);
  expect(debug).toMatchObject({
    siteId: "lwwf-math-fraction-kitchen",
    route: "fraction-kitchen",
    mode: "challenge",
    numerator: 1,
    denominator: 4,
    targetFraction: "3/4",
    completedCount: 0,
    score: 0
  });
});

test("學生切出 3/4 後可完成第一個挑戰", async ({ page }) => {
  await page.goto("/tools/fraction-kitchen.html");

  await page.getByTestId("num-up").click();
  await page.getByTestId("num-up").click();
  await expect(page.getByTestId("student-fraction")).toContainText("3/4");
  await page.getByTestId("check-answer").click();

  await expect(page.getByTestId("feedback")).toContainText("完成");
  await expect(page.getByTestId("score-pill")).toContainText("完成 1/4");
  const debug = await readToolDebug(page);
  expect(debug.completedCount).toBe(1);
  expect(debug.score).toBe(1);
  expect(debug.accuracy).toBe(100);
  expect(debug.saveStatus).toBe("saved-local");
});

test("錯誤答案會給出交叉乘積提示", async ({ page }) => {
  await page.goto("/tools/fraction-kitchen.html");

  await page.getByTestId("den-2").click();
  await page.getByTestId("check-answer").click();

  await expect(page.getByTestId("feedback")).toContainText("仍未相等");
  await expect(page.getByTestId("feedback")).toContainText("交叉乘積");
  const debug = await readToolDebug(page);
  expect(debug.completedCount).toBe(0);
  expect(debug.attempts).toBe(1);
});

test("390px 手機寬度沒有橫向溢出", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/tools/fraction-kitchen.html");

  await expect(page.getByRole("heading", { name: "分數料理台" })).toBeVisible();
  await expectNoBrokenImages(page);
  const overflow = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth)
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
});

test("Learning Passport mock receives safe fraction progress", async ({ page }) => {
  await page.goto("/tools/fraction-kitchen.html");

  await expect(page.getByTestId("passport-pill")).toContainText("護照已連線");
  await page.getByTestId("num-up").click();
  await page.getByTestId("num-up").click();
  await page.getByTestId("check-answer").click();
  await page.waitForFunction(() => window.__PASSPORT_TEST_LOG?.length === 1);

  const payload = await page.evaluate(() => window.__PASSPORT_TEST_LOG[0]);
  expect(payload).toMatchObject({
    taskId: "fraction-kitchen-same-denominator",
    taskTitle: "分數料理台：3/4",
    completed: true,
    score: 100,
    coins: 5,
    metadata: {
      toolId: "lwwf-math-fraction-kitchen",
      topic: "fractions",
      challengeId: "same-denominator",
      targetFraction: "3/4",
      studentFraction: "3/4",
      simplifiedFraction: "3/4",
      completedCount: 1,
      totalChallenges: 4,
      attempts: 1,
      correct: 1,
      accuracy: 100,
      strategy: "equivalent-fraction",
      visualModel: "circle-plate"
    }
  });
  expect(JSON.stringify(payload)).not.toMatch(/token|password|apiKey|provider|secret/i);

  const debug = await readToolDebug(page);
  expect(debug.passportSiteId).toBe("lwwf-math-ai");
  expect(debug.apiStatus).toBe("saved-passport");
});
