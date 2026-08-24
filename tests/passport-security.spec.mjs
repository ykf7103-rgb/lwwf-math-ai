import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { installPassportMock } from "./passport-fixture.mjs";

const previewGrades = ["p1", "p2", "p3", "p4", "p5", "p6"];

async function instrumentBrowser(page) {
  await page.addInitScript(() => {
    window.__NATIVE_STORAGE_WRITES = [];
    window.__REMOTE_REQUESTS = [];
    const nativeSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      window.__NATIVE_STORAGE_WRITES.push({ key: String(key), value: String(value) });
      return nativeSetItem.call(this, key, value);
    };
    const nativeFetch = window.fetch.bind(window);
    window.fetch = async function (input, init = {}) {
      window.__REMOTE_REQUESTS.push({
        url: typeof input === "string" ? input : input?.url || "",
        method: String(init.method || input?.method || "GET").toUpperCase()
      });
      return nativeFetch(input, init);
    };
  });
}

for (const grade of previewGrades) {
  test(`教師巡堂 ${grade.toUpperCase()} 取得合約完整的 synthetic read-only 身分`, async ({ page }) => {
    await installPassportMock(page, { mode: "teacher-preview", grade });
    await instrumentBrowser(page);
    await page.goto("/?lwwfTeacherPreviewToken=one-time-test-code&lwwfSiteId=lwwf-math-ai&lwwfGrade=" + grade);

    await page.waitForFunction(() => window.LWWFMathPassportBridge?.getState?.().ready === true);
    const state = await page.evaluate(() => window.LWWFMathPassportBridge.getState());
    expect(state).toMatchObject({
      ready: true,
      mode: "teacher-preview",
      readOnly: true,
      synthetic: true,
      grade,
      site: { id: "lwwf-math-ai" }
    });
    expect(state.studentView).toMatchObject({ synthetic: true, readOnly: true });
    expect(state.teacherPreview).toMatchObject({
      active: true,
      role: "TEACHER",
      siteId: "lwwf-math-ai",
      grade
    });
    await expect(page.locator("#studentPage")).toBeVisible();
    await expect(page.locator("#lwwfMathPreviewBanner")).toContainText(grade.toUpperCase());
    await expect(page.getByTestId("passport-feedback-widget")).toBeVisible();
    expect(page.url()).not.toContain("lwwfTeacherPreviewToken");
    expect(page.url()).not.toContain("lwwfSiteId");
  });
}

test("巡堂工具操作只寫記憶體，亦不呼叫進度、IndexedDB 或生成服務", async ({ page }) => {
  await installPassportMock(page, { mode: "teacher-preview", grade: "p5" });
  await instrumentBrowser(page);
  await page.goto("/?lwwfTeacherPreviewToken=one-time-test-code&lwwfSiteId=lwwf-math-ai&lwwfGrade=p5");
  await expect(page.locator("#studentPage")).toBeVisible();

  await page.getByTestId("fraction-kitchen-topbar-link").click();
  await expect(page.getByTestId("learning-shell")).toHaveClass(/show/);
  const tool = page.frameLocator("#learningShellFrame");
  await expect(tool.getByRole("heading", { name: "分數料理台" })).toBeVisible();
  await tool.getByTestId("num-up").click();
  await tool.getByTestId("num-up").click();
  await tool.getByTestId("check-answer").click();
  await expect(tool.getByTestId("feedback")).toContainText("完成");
  await expect(tool.getByTestId("passport-pill")).toContainText("教師巡堂沙盒");

  const frameHandle = await page.locator("#learningShellFrame").elementHandle();
  const childFrame = await frameHandle.contentFrame();
  const childEvidence = await childFrame.evaluate(() => {
    localStorage.setItem("preview-local-probe", "memory-only");
    sessionStorage.setItem("preview-session-probe", "memory-only");
    let indexedDbBlocked = false;
    try {
      indexedDB.open("preview-must-not-open");
    } catch (error) {
      indexedDbBlocked = error?.name === "SecurityError";
    }
    return {
      localValue: localStorage.getItem("preview-local-probe"),
      sessionValue: sessionStorage.getItem("preview-session-probe"),
      nativeWrites: window.__NATIVE_STORAGE_WRITES || [],
      requests: window.__REMOTE_REQUESTS || [],
      indexedDbBlocked
    };
  });

  const evidence = await page.evaluate(() => ({
    nativeWrites: window.__NATIVE_STORAGE_WRITES,
    progressWrites: window.__PASSPORT_TEST_LOG,
    requests: window.__REMOTE_REQUESTS,
    indexedDbBlocked: (() => {
      try {
        indexedDB.open("preview-must-not-open");
        return false;
      } catch (error) {
        return error?.name === "SecurityError";
      }
    })()
  }));
  expect(evidence.nativeWrites).toEqual([]);
  expect(evidence.progressWrites).toEqual([]);
  expect(evidence.indexedDbBlocked).toBe(true);
  expect(childEvidence.localValue).toBe("memory-only");
  expect(childEvidence.sessionValue).toBe("memory-only");
  expect(childEvidence.nativeWrites).toEqual([]);
  expect(childEvidence.indexedDbBlocked).toBe(true);
  expect(evidence.requests.filter(item =>
    /supabase\.co|lwwf-math-ai\.lwwfaiteams\.workers\.dev\/(?:ask|image|math-comic|generate)/i.test(item.url)
  )).toEqual([]);
  expect(childEvidence.requests.filter(item =>
    /supabase\.co|lwwf-math-ai\.lwwfaiteams\.workers\.dev\/(?:ask|image|math-comic|generate)/i.test(item.url)
  )).toEqual([]);
});

test("巡堂開啟既有課題頁時會先注入記憶體保護層", async ({ page }) => {
  await installPassportMock(page, { mode: "teacher-preview", grade: "p5" });
  await instrumentBrowser(page);
  await page.goto("/?lwwfTeacherPreviewToken=one-time-test-code&lwwfSiteId=lwwf-math-ai&lwwfGrade=p5");
  await expect(page.locator("#studentPage")).toBeVisible();
  await page.evaluate(() => window.LWWFMathShell.open("assets/ch13/index.html"));
  await expect(page.getByTestId("learning-shell")).toHaveClass(/show/);

  const frameHandle = await page.locator("#learningShellFrame").elementHandle();
  const childFrame = await frameHandle.contentFrame();
  await childFrame.waitForFunction(() => window.LWWFMathPassportBridge?.isTeacherPreview?.() === true);
  const result = await childFrame.evaluate(() => {
    localStorage.setItem("legacy-page-preview-probe", "sandbox");
    sessionStorage.setItem("legacy-page-session-probe", "sandbox");
    let indexedDbBlocked = false;
    try {
      indexedDB.open("legacy-preview-must-not-open");
    } catch (error) {
      indexedDbBlocked = error?.name === "SecurityError";
    }
    return {
      localValue: localStorage.getItem("legacy-page-preview-probe"),
      sessionValue: sessionStorage.getItem("legacy-page-session-probe"),
      nativeWrites: window.__NATIVE_STORAGE_WRITES || [],
      indexedDbBlocked,
      state: window.LWWFMathPassportBridge.getState()
    };
  });
  expect(result.localValue).toBe("sandbox");
  expect(result.sessionValue).toBe("sandbox");
  expect(result.nativeWrites).toEqual([]);
  expect(result.indexedDbBlocked).toBe(true);
  expect(result.state).toMatchObject({ mode: "teacher-preview", readOnly: true, synthetic: true });
  expect(await page.evaluate(() => window.__PASSPORT_TEST_LOG)).toEqual([]);
});

test("巡堂直接開啟 AI 問功課頁亦只回傳本機沙盒示範", async ({ page }) => {
  await installPassportMock(page, { mode: "teacher-preview", grade: "p5" });
  await instrumentBrowser(page);
  await page.goto("/assets/ch12/ai-help.html?lwwfTeacherPreviewToken=one-time-test-code&lwwfSiteId=lwwf-math-ai&lwwfGrade=p5");
  await page.waitForFunction(() =>
    window.LWWFMathPassportBridge?.isTeacherPreview?.() === true && typeof window.sendToWorker === "function"
  );
  const response = await page.evaluate(() => window.sendToWorker("示範題目"));
  expect(response).toContain("教師巡堂沙盒示範");
  const evidence = await page.evaluate(() => ({
    nativeWrites: window.__NATIVE_STORAGE_WRITES || [],
    requests: window.__REMOTE_REQUESTS || []
  }));
  expect(evidence.nativeWrites).toEqual([]);
  expect(evidence.requests.filter(item => /lwwf-math-ai\.lwwfaiteams\.workers\.dev/i.test(item.url))).toEqual([]);
  expect(await page.evaluate(() => window.__PASSPORT_TEST_LOG)).toEqual([]);
  await expect(page.getByTestId("passport-feedback-widget")).toBeVisible();
});

for (const invalid of [
  { label: "錯誤站點", options: { mode: "teacher-preview", grade: "p5", siteId: "another-site" } },
  { label: "超出 P1–P6 年級", options: { mode: "teacher-preview", grade: "p7" } },
  { label: "非教師角色", options: { mode: "teacher-preview", grade: "p5", teacherRole: "STUDENT" } }
]) {
  test(`不完整巡堂合約會 fail closed：${invalid.label}`, async ({ page }) => {
    await installPassportMock(page, invalid.options);
    await page.goto("/");
    await expect(page.locator("#loginPage")).toBeVisible();
    await expect(page.locator("#studentPage")).toBeHidden();
    const state = await page.evaluate(() => window.LWWFMathPassportBridge.getState());
    expect(state.ready).toBe(false);
    expect(state.readOnly).toBe(true);
    expect(state.initError).toBe("passport-scope-mismatch");
  });
}

test("正式靜態 bundle 不再含前端帳戶、密碼比對或舊 raw-handoff 儲存", async () => {
  const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const runtime = readFileSync(new URL("../assets/common/passport-runtime.js", import.meta.url), "utf8");
  const bridge = readFileSync(new URL("../assets/common/passport-bridge.js", import.meta.url), "utf8");
  const progress = readFileSync(new URL("../assets/common/progress.js", import.meta.url), "utf8");

  expect(index).not.toMatch(/pwdHash|hashPassword|teacherPassword|studentPassword/i);
  expect(index).not.toMatch(/password\s*===|pwd\s*===/i);
  expect(index).toContain("const STUDENTS = Object.freeze([])");
  expect(runtime + bridge + progress).not.toMatch(/lwwf_passport_handoff_v1|lwwf_auth_user|mathai_user/i);
  expect(runtime + bridge + progress).not.toMatch(/sessionStorage\.setItem\s*\(/i);
  expect(index).not.toMatch(/SUPABASE_ANON_KEY|Authorization.{0,40}Bearer/i);
});
