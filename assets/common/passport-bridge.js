(function () {
  "use strict";

  if (window.LWWFMathPassportBridge) return;

  const DEFAULT_PASSPORT_ORIGIN = "https://lwwf-learning-passport.lwwfaiteams.workers.dev";
  const SITE_ID = "lwwf-math-ai";
  const SYNC_CACHE_PREFIX = "lwwf_passport_math_sync_v1";

  let initPromise = null;
  let flushTimer = 0;
  let flushing = false;
  let storagePatched = false;

  function loadPassportSdk() {
    if (window.LWWFPassport) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const sdkSrc = getPassportOrigin() + "/lwwf-passport-sdk.js";
      const existing = document.querySelector('script[data-lwwf-passport-sdk="true"]');
      if (existing) {
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", () => reject(new Error("LWWF Passport SDK load failed")), { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = sdkSrc;
      script.async = true;
      script.dataset.lwwfPassportSdk = "true";
      script.onload = resolve;
      script.onerror = () => reject(new Error("LWWF Passport SDK load failed"));
      document.head.appendChild(script);
    });
  }

  function initPassport() {
    if (initPromise) return initPromise;
    initPromise = loadPassportSdk()
      .then(() => window.LWWFPassport.init({
        siteId: SITE_ID,
        passportOrigin: getPassportOrigin(),
        renderStatus: false
      }))
      .then((state) => {
        if (state && state.student) {
          const user = normalizePassportStudent(state.student);
          if (user) {
            storeMathUser(user);
            activateMathRoot(user);
          }
        }
        return state;
      })
      .catch((error) => {
        console.warn("[LWWF Math Passport]", error);
        return { ready: false };
      });
    return initPromise;
  }

  function getPassportOrigin() {
    const fromSearch = originFromParams(new URLSearchParams(window.location.search));
    if (fromSearch) return fromSearch;
    const fromHash = originFromParams(parseHashParams(window.location.hash));
    if (fromHash) return fromHash;
    try {
      const stored = JSON.parse(localStorage.getItem("lwwf_passport_handoff_v1") || "{}");
      if (stored.passportOrigin) return new URL(stored.passportOrigin).origin;
    } catch {}
    return DEFAULT_PASSPORT_ORIGIN;
  }

  function originFromParams(params) {
    try {
      const raw = params.get("lwwfPassportOrigin");
      return raw ? new URL(raw).origin : "";
    } catch {
      return "";
    }
  }

  function parseHashParams(hash) {
    const raw = String(hash || "").replace(/^#/, "");
    const queryPart = raw.includes("?") ? raw.split("?").slice(1).join("?") : raw;
    return new URLSearchParams(queryPart);
  }

  function normalizePassportStudent(student) {
    const classCode = String(student.classCode || student.class || "").trim().toUpperCase();
    const classNo = String(student.classNo || student.number || "").trim().padStart(2, "0");
    if (!classCode || !classNo) return null;
    return {
      class: classCode,
      number: classNo,
      name: student.displayName || `${classCode}${classNo}`,
      role: "student",
      passportId: student.id || "",
      source: "learning-passport"
    };
  }

  function getStoredUser() {
    try {
      return JSON.parse(localStorage.getItem("lwwf_auth_user") || sessionStorage.getItem("lwwf_auth_user") || "null");
    } catch {
      return null;
    }
  }

  function storeMathUser(user) {
    const existing = getStoredUser();
    if (existing && existing.role === "teacher") return;
    const payload = JSON.stringify(user);
    try {
      localStorage.setItem("lwwf_auth_user", payload);
      localStorage.setItem("mathai_user", payload);
      localStorage.setItem("lwwf_auth_lastActive", String(Date.now()));
      sessionStorage.setItem("lwwf_auth_user", payload);
      sessionStorage.setItem("mathai_user", payload);
    } catch {}
  }

  function activateMathRoot(user) {
    try {
      if (typeof currentUser !== "undefined" && (!currentUser || currentUser.role !== "teacher")) {
        currentUser = user;
      }
      if (typeof persistAuth === "function") persistAuth();
      const studentPage = document.getElementById("studentPage");
      const studentVisible = studentPage && studentPage.style.display !== "none" && studentPage.classList.contains("active");
      if (typeof showStudentDashboard === "function" && !studentVisible) {
        Promise.resolve(showStudentDashboard()).catch((error) => console.warn("[LWWF Math Passport]", error));
      } else {
        if (typeof updateCoinDisplay === "function") updateCoinDisplay();
        if (typeof renderProgression === "function") renderProgression();
      }
    } catch {}
    dispatchMathProgress("passport-auth");
  }

  function patchStorage() {
    if (storagePatched) return;
    storagePatched = true;
    const previous = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      previous.apply(this, arguments);
      if (this === localStorage && shouldWatchKey(key)) {
        scheduleFlush("storage");
      }
    };
  }

  function shouldWatchKey(key) {
    return typeof key === "string" && (/^progress_ch\d+_/.test(key) || /^scores_[A-Z0-9]+_\d+$/i.test(key));
  }

  function dispatchMathProgress(source) {
    try {
      window.dispatchEvent(new CustomEvent("lwwf-progress-changed", { detail: { source: "passport-bridge-" + source } }));
    } catch {}
  }

  function scheduleFlush(source) {
    clearTimeout(flushTimer);
    flushTimer = setTimeout(() => {
      flushPassportProgress(source).catch((error) => console.warn("[LWWF Math Passport]", error));
    }, 500);
  }

  async function flushPassportProgress() {
    if (flushing) return;
    flushing = true;
    try {
      const state = await initPassport();
      if (!state || !state.ready || !window.LWWFPassport) return;
      const user = normalizePassportStudent(state.student) || getStoredUser();
      if (!user || !user.class || !user.number) return;
      const tasks = collectTasks(user);
      for (const task of tasks) {
        await syncTask(user, task);
      }
    } finally {
      flushing = false;
    }
  }

  function collectTasks(user) {
    const tasks = [];
    for (let chapter = 12; chapter <= 21; chapter += 1) {
      const key = `progress_ch${chapter}_${user.class}_${user.number}`;
      const progress = readJson(localStorage.getItem(key));
      Object.entries(progress).forEach(([stepId, value]) => {
        if (!isCompleteValue(value)) return;
        tasks.push(buildProgressTask(chapter, stepId, value));
      });
    }

    const scores = readJson(localStorage.getItem(`scores_${user.class}_${user.number}`));
    Object.entries(scores).forEach(([activityKey, value]) => {
      if (!value || typeof value !== "object") return;
      tasks.push(buildScoreTask(12, activityKey, value));
    });
    return dedupeTasks(tasks);
  }

  function readJson(raw) {
    try {
      const value = JSON.parse(raw || "{}");
      return value && typeof value === "object" ? value : {};
    } catch {
      return {};
    }
  }

  function isCompleteValue(value) {
    if (!value || typeof value !== "object") return false;
    return value.done === true || typeof value.coins === "number" || typeof value.score === "number" || value.passed === true;
  }

  function buildProgressTask(chapter, stepId, value) {
    return {
      taskId: cleanTaskId(`math-ch${chapter}-${stepId}`),
      taskTitle: `數學 Ch.${chapter} ${labelForStep(stepId)}`,
      completed: true,
      score: scoreFromValue(value),
      coins: coinsForStep(stepId, value)
    };
  }

  function buildScoreTask(chapter, activityKey, value) {
    return {
      taskId: cleanTaskId(`math-ch${chapter}-${activityKey}`),
      taskTitle: `數學 Ch.${chapter} ${labelForStep(activityKey)}`,
      completed: true,
      score: scoreFromValue(value),
      coins: coinsForScore(activityKey, value)
    };
  }

  function cleanTaskId(value) {
    return String(value).replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 120);
  }

  function labelForStep(stepId) {
    const key = String(stepId || "");
    const exact = {
      infographic: "資訊圖",
      flashcards: "學習卡",
      summary: "課程總結",
      song: "溫習歌",
      national: "國安教育",
      supplementary: "補充教材",
      "bonus-quiz": "Bonus 測驗",
      bonus: "Bonus 任務"
    };
    if (exact[key]) return exact[key];
    const match = key.match(/^([a-z_]+)(\d*)$/i);
    const prefix = match ? match[1] : key;
    const number = match && match[2] ? ` ${match[2]}` : "";
    const labels = {
      slides: "簡報",
      assess: "評估",
      game: "遊戲",
      quiz: "測驗",
      iq_quiz: "課前預習",
      prelearn: "課前預習",
      voice: "錄音題",
      mc_quiz: "選擇題"
    };
    return (labels[prefix] || key) + number;
  }

  function scoreFromValue(value) {
    const score = Number(value && value.score);
    const total = Number(value && value.total);
    const correct = Number(value && value.correct);
    if (Number.isFinite(correct) && Number.isFinite(total) && total > 0) {
      return clamp(Math.round((correct / total) * 100), 0, 100);
    }
    if (Number.isFinite(score) && Number.isFinite(total) && total > 0 && score <= total) {
      return clamp(Math.round((score / total) * 100), 0, 100);
    }
    if (Number.isFinite(score)) return clamp(Math.round(score), 0, 100);
    if (value && value.passed) return 100;
    return 100;
  }

  function coinsForScore(activityKey, value) {
    if (typeof value.coins === "number") return clamp(value.coins, 0, 50);
    if ((activityKey === "quiz1" || activityKey === "quiz4") && Number(value.total) > 0) {
      return clamp(Math.round((Number(value.score || 0) / Number(value.total)) * 2), 0, 2);
    }
    return coinsForStep(activityKey, value);
  }

  function coinsForStep(stepId, value) {
    if (value && typeof value.coins === "number") return clamp(value.coins, 0, 50);
    if (/^game\d*$/.test(stepId)) return 3;
    if (/^(slides|prelearn|assess)\d*$/.test(stepId)) return 2;
    if (/^(iq_quiz|voice)\d*$/.test(stepId)) return 1;
    if (stepId === "infographic" || stepId === "flashcards" || stepId === "song" || stepId === "summary" || stepId === "bonus" || stepId === "bonus-quiz") return 2;
    if (stepId === "extras" && value && typeof value.extras_coins === "number") return clamp(value.extras_coins, 0, 50);
    return 1;
  }

  function clamp(value, min, max) {
    const number = Number(value);
    if (!Number.isFinite(number)) return min;
    return Math.max(min, Math.min(max, number));
  }

  function dedupeTasks(tasks) {
    const byId = new Map();
    tasks.forEach((task) => {
      const old = byId.get(task.taskId);
      if (!old || task.coins > old.coins || task.score > old.score) byId.set(task.taskId, task);
    });
    return [...byId.values()];
  }

  async function syncTask(user, task) {
    const cache = readSyncCache(user);
    const old = cache[task.taskId];
    if (old && old.coins >= task.coins && old.score >= task.score && old.completed === task.completed) return;
    await window.LWWFPassport.recordProgress(task);
    cache[task.taskId] = {
      completed: task.completed,
      score: task.score,
      coins: task.coins,
      at: Date.now()
    };
    writeSyncCache(user, cache);
  }

  function syncCacheKey(user) {
    return `${SYNC_CACHE_PREFIX}_${user.class}_${user.number}`;
  }

  function readSyncCache(user) {
    return readJson(localStorage.getItem(syncCacheKey(user)));
  }

  function writeSyncCache(user, cache) {
    try {
      localStorage.setItem(syncCacheKey(user), JSON.stringify(cache));
    } catch {}
  }

  patchStorage();
  window.addEventListener("lwwf-progress-changed", () => scheduleFlush("progress-event"));
  window.addEventListener("storage", (event) => {
    if (shouldWatchKey(event.key)) scheduleFlush("storage-event");
  });
  window.addEventListener("lwwf-passport-updated", (event) => {
    const user = event.detail && event.detail.student ? normalizePassportStudent(event.detail.student) : null;
    if (user) {
      storeMathUser(user);
      dispatchMathProgress("passport-updated");
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      initPassport().then(() => scheduleFlush("dom-ready"));
    });
  } else {
    initPassport().then(() => scheduleFlush("ready"));
  }

  window.LWWFMathPassportBridge = {
    init: initPassport,
    flush: flushPassportProgress,
    collectTasks
  };
})();
