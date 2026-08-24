// LWWF Math progress adapter.
// Identity and remote writes are owned by the Learning Passport SDK. Teacher
// preview uses the Passport bridge's in-memory storage and never calls a remote API.
(function () {
  "use strict";
  if (window.LWWFProgress) return;

  const scriptElement = document.currentScript;
  const pending = new Map();
  const sent = new Map();
  let syncTimer = null;

  function bridge() {
    return window.LWWFMathPassportBridge || null;
  }

  function ensureBridge() {
    if (bridge()) return bridge().init();
    return new Promise(function (resolve) {
      if (!scriptElement || !scriptElement.src) {
        resolve({ ready: false });
        return;
      }
      const script = document.createElement("script");
      script.src = scriptElement.src
        .replace("progress.js", "passport-runtime.js")
        .replace(/\?v=[^&]*/, "") + "?v=20260822";
      script.async = false;
      script.referrerPolicy = "no-referrer";
      script.onload = function () {
        bridge().init().then(resolve).catch(function () { resolve({ ready: false }); });
      };
      script.onerror = function () { resolve({ ready: false }); };
      document.head.appendChild(script);
    });
  }

  function storage() {
    return bridge() && bridge().storage;
  }

  function getUser() {
    return bridge() && bridge().getUser();
  }

  const MAX_FIELDS = ["coins", "score", "correct", "passed", "total", "attempts"];
  function mergeBest(oldValue, newValue) {
    if (!oldValue || typeof oldValue !== "object") return newValue || {};
    if (!newValue || typeof newValue !== "object") return oldValue || {};
    const merged = Object.assign({}, oldValue);
    Object.entries(newValue).forEach(function (entry) {
      const stepId = entry[0];
      const fresh = entry[1];
      const old = merged[stepId];
      if (!old || typeof old !== "object" || !fresh || typeof fresh !== "object") {
        merged[stepId] = fresh;
        return;
      }
      const value = Object.assign({}, old, fresh);
      MAX_FIELDS.forEach(function (field) {
        const oldNumber = typeof old[field] === "number" ? old[field] : null;
        const newNumber = typeof fresh[field] === "number" ? fresh[field] : null;
        if (oldNumber !== null && newNumber !== null) value[field] = Math.max(oldNumber, newNumber);
        else if (oldNumber !== null) value[field] = oldNumber;
      });
      if (old.done || fresh.done) value.done = true;
      if (typeof old.ts === "number" && typeof fresh.ts === "number") value.ts = Math.max(old.ts, fresh.ts);
      merged[stepId] = value;
    });
    return merged;
  }

  function readObject(raw) {
    try {
      const value = JSON.parse(raw || "{}");
      return value && typeof value === "object" && !Array.isArray(value) ? value : {};
    } catch (error) {
      return {};
    }
  }

  function cleanTaskId(value) {
    return String(value).replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 120);
  }

  function clamp(value, min, max) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : min;
  }

  function scoreFromValue(value) {
    const score = Number(value && value.score);
    const total = Number(value && value.total);
    const correct = Number(value && value.correct);
    if (Number.isFinite(correct) && Number.isFinite(total) && total > 0) {
      return clamp(Math.round(correct / total * 100), 0, 100);
    }
    if (Number.isFinite(score) && Number.isFinite(total) && total > 0 && score <= total) {
      return clamp(Math.round(score / total * 100), 0, 100);
    }
    if (Number.isFinite(score)) return clamp(Math.round(score), 0, 100);
    return value && value.passed ? 100 : 100;
  }

  function coinsForStep(stepId, value) {
    if (value && typeof value.coins === "number") return clamp(value.coins, 0, 50);
    if (/^game\d*$/.test(stepId)) return 3;
    if (/^(slides|prelearn|assess)\d*$/.test(stepId)) return 2;
    if (/^(iq_quiz|voice)\d*$/.test(stepId)) return 1;
    if (/^(infographic|flashcards|song|summary|bonus|bonus-quiz)$/.test(stepId)) return 2;
    if (stepId === "extras" && value && typeof value.extras_coins === "number") {
      return clamp(value.extras_coins, 0, 50);
    }
    return 1;
  }

  function labelForStep(stepId) {
    const labels = {
      infographic: "資訊圖",
      flashcards: "學習卡",
      summary: "課程總結",
      song: "溫習歌",
      national: "國安教育",
      supplementary: "補充教材",
      bonus: "Bonus 任務",
      "bonus-quiz": "Bonus 測驗"
    };
    if (labels[stepId]) return labels[stepId];
    const match = String(stepId || "").match(/^([a-z_]+)(\d*)$/i);
    const prefix = match ? match[1] : String(stepId || "");
    const number = match && match[2] ? " " + match[2] : "";
    const prefixes = {
      slides: "簡報",
      assess: "評估",
      game: "遊戲",
      quiz: "測驗",
      iq_quiz: "課前預習",
      prelearn: "課前預習",
      voice: "錄音題",
      mc_quiz: "選擇題"
    };
    return (prefixes[prefix] || prefix) + number;
  }

  function taskFor(chapter, stepId, value) {
    return {
      taskId: cleanTaskId("math-ch" + chapter + "-" + stepId),
      taskTitle: "數學 Ch." + chapter + " " + labelForStep(stepId),
      completed: true,
      score: scoreFromValue(value),
      coins: coinsForStep(stepId, value),
      metadata: {
        chapter: Number(chapter),
        activity: cleanTaskId(stepId),
        source: "lwwf-math-ai"
      }
    };
  }

  function tasksFromPayload(chapter, payload) {
    return Object.entries(payload).filter(function (entry) {
      const value = entry[1];
      return value && typeof value === "object" &&
        (value.done === true || value.passed === true || typeof value.score === "number" || typeof value.coins === "number");
    }).map(function (entry) {
      return taskFor(chapter, entry[0], entry[1]);
    });
  }

  function parseStorageWrite(key, value) {
    let match = String(key || "").match(/^progress_ch(\d+)_([^_]+)_(.+)$/);
    if (match) return { chapter: Number(match[1]), payload: readObject(value) };
    match = String(key || "").match(/^scores_([^_]+)_(.+)$/);
    if (match) return { chapter: 12, payload: readObject(value) };
    return null;
  }

  async function writeTask(task) {
    const client = bridge();
    if (!client || !client.canWrite()) return false;
    const current = client.getState();
    const remote = current && current.siteProgress && current.siteProgress.tasks &&
      current.siteProgress.tasks[task.taskId];
    const previous = sent.get(task.taskId) || remote;
    if (previous &&
        Number(previous.score || 0) >= task.score &&
        Number(previous.coins || 0) >= task.coins &&
        previous.completed !== false) {
      return true;
    }
    await client.recordProgress(task);
    sent.set(task.taskId, {
      completed: true,
      score: task.score,
      coins: task.coins
    });
    return true;
  }

  async function syncToPassport(chapter, cls, number, raw) {
    await ensureBridge();
    const client = bridge();
    if (!client || !client.canWrite()) return false;
    const tasks = tasksFromPayload(Number(chapter), readObject(raw));
    try {
      for (const task of tasks) await writeTask(task);
      pending.delete(String(chapter));
      showSyncToast("✅ 進度已更新至 Learning Passport", "ok");
      return true;
    } catch (error) {
      pending.set(String(chapter), { chapter: chapter, cls: cls, number: number, raw: raw });
      showSyncToast("⚠️ 進度暫存於本頁，稍後再試", "fail");
      return false;
    }
  }

  function queueSync(detail) {
    if (!detail) return;
    const user = getUser();
    if (!user || !bridge() || !bridge().canWrite()) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(function () {
      syncToPassport(detail.chapter, user.class, user.number, JSON.stringify(detail.payload)).catch(function () {});
    }, 350);
  }

  async function flushPending() {
    if (!bridge() || !bridge().canWrite()) return;
    for (const item of Array.from(pending.values())) {
      await syncToPassport(item.chapter, item.cls, item.number, item.raw);
    }
  }

  async function refreshFromPassport(chapter) {
    await ensureBridge();
    const client = bridge();
    const currentUser = getUser();
    if (!client || !currentUser || !client.getState().ready) return null;
    const store = storage();
    if (!store) return null;
    const chapterNumber = Number(chapter);
    const key = chapterNumber === 12
      ? "scores_" + currentUser.class + "_" + currentUser.number
      : "progress_ch" + chapterNumber + "_" + currentUser.class + "_" + currentUser.number;
    let local = readObject(store.getItem(key));
    const tasks = (client.getState().siteProgress && client.getState().siteProgress.tasks) || {};
    const remote = {};
    Object.entries(tasks).forEach(function (entry) {
      const match = entry[0].match(new RegExp("^math-ch" + chapterNumber + "-(.+)$"));
      if (!match) return;
      const task = entry[1] || {};
      remote[match[1]] = {
        done: task.completed !== false,
        score: Number(task.score || 0),
        coins: Number(task.coins || 0),
        ts: task.updatedAt ? new Date(task.updatedAt).getTime() : Date.now()
      };
    });
    local = mergeBest(local, remote);
    store.setItem(key, JSON.stringify(local));
    return local;
  }

  function computeCoins(progress) {
    if (!progress || typeof progress !== "object") return 0;
    return Object.entries(progress).reduce(function (total, entry) {
      const value = entry[1];
      if (!value || !value.done) return total;
      return total + coinsForStep(entry[0], value);
    }, 0);
  }

  function computeCh12Coins(scores) {
    if (!scores || typeof scores !== "object") return 0;
    return Object.entries(scores).reduce(function (total, entry) {
      const key = entry[0];
      const value = entry[1];
      if (!value || typeof value !== "object") return total;
      if (typeof value.coins === "number") return total + value.coins;
      if ((key === "quiz1" || key === "quiz4") && Number(value.total) > 0) {
        return total + Math.min(2, Math.round(Number(value.score || 0) / Number(value.total) * 2));
      }
      return total;
    }, 0);
  }

  function getTotalCoinsAllChapters(currentUser) {
    currentUser = currentUser || getUser();
    const store = storage();
    if (!currentUser || !store) return 0;
    let total = computeCh12Coins(readObject(store.getItem("scores_" + currentUser.class + "_" + currentUser.number)));
    for (let chapter = 13; chapter <= 21; chapter += 1) {
      total += computeCoins(readObject(store.getItem("progress_ch" + chapter + "_" + currentUser.class + "_" + currentUser.number)));
    }
    return total;
  }

  function showSyncToast(message, kind) {
    if (!document.body || (bridge() && bridge().isTeacherPreview())) return;
    let element = document.getElementById("__lwwfSyncToast");
    if (!element) {
      element = document.createElement("div");
      element.id = "__lwwfSyncToast";
      element.style.cssText = "position:fixed;bottom:20px;right:20px;color:white;padding:10px 16px;border-radius:10px;font-size:.88rem;font-weight:700;z-index:99998;box-shadow:0 4px 14px rgba(0,0,0,.25);font-family:-apple-system,'Microsoft JhengHei',sans-serif";
      document.body.appendChild(element);
    }
    element.style.background = kind === "fail" ? "#b91c1c" : "#166534";
    element.textContent = message;
    clearTimeout(element.__hideTimer);
    element.__hideTimer = setTimeout(function () { element.remove(); }, 2600);
  }

  function handleStorageWrite(event) {
    const detail = event && event.detail;
    const parsed = detail && parseStorageWrite(detail.key, detail.value);
    if (parsed) queueSync(parsed);
  }

  function autoRefresh() {
    const effectiveUrl = new URL(document.baseURI);
    const match = effectiveUrl.pathname.match(/\/ch(\d+)\//);
    if (match) refreshFromPassport(Number(match[1])).catch(function () {});
    const query = effectiveUrl.search.match(/[?&]ch=(\d+)/);
    if (query && !match) refreshFromPassport(Number(query[1])).catch(function () {});
  }

  window.addEventListener("lwwf-math-storage-write", handleStorageWrite);
  window.addEventListener("lwwf-math-passport-ready", autoRefresh);
  window.addEventListener("online", function () { flushPending().catch(function () {}); });
  window.addEventListener("pagehide", function () { flushPending().catch(function () {}); });

  window.LWWFProgress = {
    getUser: getUser,
    refreshFromCloud: refreshFromPassport,
    refreshFromPassport: refreshFromPassport,
    syncToCloud: syncToPassport,
    syncToPassport: syncToPassport,
    flushOfflineQueue: flushPending,
    flushPending: flushPending,
    logHealth: async function () { return { ok: true, remote: false }; },
    showSyncToast: showSyncToast,
    computeCoins: computeCoins,
    computeCh12Coins: computeCh12Coins,
    getTotalCoinsAllChapters: getTotalCoinsAllChapters,
    mergeBest: mergeBest,
    _ensureSupabase: async function () { return null; }
  };

  ensureBridge().then(autoRefresh).catch(function () {});
})();
