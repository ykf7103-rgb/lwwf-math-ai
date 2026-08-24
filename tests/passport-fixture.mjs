export const PASSPORT_SDK_URL =
  "https://lwwf-learning-passport.lwwfaiteams.workers.dev/lwwf-passport-sdk.js";

export async function installPassportMock(page, options = {}) {
  const mode = options.mode || "student";
  const grade = options.grade || "p5";
  const preview = mode === "teacher-preview";
  const siteId = options.siteId || "lwwf-math-ai";
  const teacherRole = options.teacherRole || "TEACHER";
  const classCode = options.classCode || (preview ? grade.toUpperCase() + "-PREVIEW" : "5A");
  const classNo = options.classNo || (preview ? "00" : "01");
  const ready = options.ready !== false;
  const state = {
    ready,
    mode,
    readOnly: preview,
    site: ready ? { id: siteId, title: "數學 AI 學習區" } : null,
    grade,
    student: ready
      ? {
          id: preview ? "teacher-preview:" + grade : classCode + classNo,
          classCode,
          classNo,
          displayName: preview ? "教師巡堂 " + grade.toUpperCase() : classCode + " " + classNo,
          grade,
          synthetic: preview,
          readOnly: preview
        }
      : null,
    studentView: ready
      ? {
          id: preview ? "teacher-preview:" + grade : classCode + classNo,
          classCode,
          classNo,
          displayName: preview ? "教師巡堂 " + grade.toUpperCase() : classCode + " " + classNo,
          grade,
          synthetic: preview,
          readOnly: preview
        }
      : null,
    teacherPreview: preview && ready
      ? { active: true, role: teacherRole, siteId, grade }
      : null,
    siteProgress: preview
      ? { siteId, tasks: {}, coins: 0, completedTasks: 0, synthetic: true, readOnly: true }
      : { siteId, tasks: {}, coins: 0, completedTasks: 0 },
    expiresAt: ready ? Date.now() + 10 * 60 * 1000 : 0
  };

  const body = `(() => {
    const state = ${JSON.stringify(state)};
    window.__PASSPORT_TEST_LOG = [];
    window.__PASSPORT_AUTH_FETCH_LOG = [];
    const handoffKeys = ["lwwfToken","lwwfTeacherPreviewToken","lwwfSiteId","lwwfGrade","lwwfPassportOrigin"];
    const cleanUrl = new URL(location.href);
    let changed = false;
    for (const key of handoffKeys) {
      if (cleanUrl.searchParams.has(key)) {
        cleanUrl.searchParams.delete(key);
        changed = true;
      }
    }
    if (changed) history.replaceState(history.state, "", cleanUrl.pathname + cleanUrl.search + cleanUrl.hash);

    function renderWidget() {
      if (!document.body || document.querySelector("[data-testid='passport-feedback-widget']")) return;
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.testid = "passport-feedback-widget";
      button.textContent = state.mode === "teacher-preview" ? "問題回報" : "回報問題";
      button.style.cssText = "position:fixed;right:18px;bottom:18px;z-index:2147483500";
      document.body.appendChild(button);
    }

    window.LWWFPassport = {
      init: async (options = {}) => {
        if (options.feedbackWidget !== false) renderWidget();
        return { ...state };
      },
      getState: () => ({ ...state }),
      recordProgress: async (payload) => {
        if (state.mode === "teacher-preview") throw new Error("preview-read-only");
        window.__PASSPORT_TEST_LOG.push(structuredClone(payload));
        state.siteProgress.tasks[payload.taskId] = {
          completed: payload.completed !== false,
          score: Number(payload.score || 0),
          coins: Number(payload.coins || 0)
        };
        return { ok: true, siteProgress: state.siteProgress };
      },
      authorizedFetch: async (input, init = {}) => {
        window.__PASSPORT_AUTH_FETCH_LOG.push({ input: String(input), method: init.method || "GET" });
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
      },
      listPreviewFeedback: async () => ({ items: [] }),
      updatePreviewFeedback: async () => ({ ok: true })
    };
  })();`;

  await page.route(PASSPORT_SDK_URL, route =>
    route.fulfill({
      status: 200,
      contentType: "application/javascript; charset=utf-8",
      body
    })
  );
}
