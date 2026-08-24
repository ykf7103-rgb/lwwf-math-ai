(function () {
  "use strict";

  if (window.LWWFMathPassportBridge) return;

  const SITE_ID = "lwwf-math-ai";
  const PASSPORT_ORIGIN = "https://lwwf-learning-passport.lwwfaiteams.workers.dev";
  const READY_EVENT = "lwwf-math-passport-ready";
  const STORAGE_EVENT = "lwwf-math-storage-write";
  const memoryLocal = new Map();
  const memorySession = new Map();
  let snapshot = Object.freeze({ ready: false, mode: "student", readOnly: true });
  let user = null;
  let initPromise = null;
  let initError = "";

  const nativeStorage = captureNativeStorage();
  const nativeFetch = typeof window.fetch === "function" ? window.fetch.bind(window) : null;
  installStorageSandbox();
  installIndexedDbSandbox();
  installRemoteGuard();

  const hostBridge = findHostBridge();
  if (hostBridge) applySnapshot(hostBridge.getState(), false);
  installEmbeddedNavigation();

  function normalizeGrade(value) {
    const grade = String(value || "").trim().toLowerCase();
    return /^p[1-6]$/.test(grade) ? grade : "";
  }

  function activeStudent(value) {
    value = value || snapshot;
    const student = value.studentView || value.student;
    return Boolean(
      value.ready === true &&
      value.mode === "student" &&
      value.readOnly !== true &&
      value.site && value.site.id === SITE_ID &&
      normalizeGrade(value.grade) &&
      student && student.id &&
      student.synthetic !== true &&
      student.readOnly !== true
    );
  }

  function activePreview(value) {
    value = value || snapshot;
    const student = value.studentView || value.student;
    const preview = value.teacherPreview;
    const grade = normalizeGrade(value.grade);
    return Boolean(
      value.ready === true &&
      value.mode === "teacher-preview" &&
      value.readOnly === true &&
      value.site && value.site.id === SITE_ID &&
      grade &&
      student && student.synthetic === true &&
      student.readOnly === true &&
      preview && preview.active === true &&
      preview.role === "TEACHER" &&
      preview.siteId === SITE_ID &&
      normalizeGrade(preview.grade) === grade
    );
  }

  function normalizeUser(value) {
    const source = value && (value.studentView || value.student);
    if (!source || (!activeStudent(value) && !activePreview(value))) return null;
    const grade = normalizeGrade(value.grade);
    const preview = activePreview(value);
    const classCode = String(source.classCode || source.class || (preview ? grade.toUpperCase() + "-PREVIEW" : "")).trim().toUpperCase();
    const classNo = String(source.classNo || source.number || (preview ? "00" : "")).trim().padStart(2, "0");
    if (!classCode || !classNo) return null;
    return Object.freeze({
      id: String(source.id || classCode + classNo),
      class: classCode,
      classCode: classCode,
      number: classNo,
      classNo: classNo,
      name: String(source.displayName || classCode + " " + classNo),
      displayName: String(source.displayName || classCode + " " + classNo),
      grade: grade,
      role: preview ? "teacher-preview" : "student",
      passport: true,
      synthetic: preview,
      readOnly: preview
    });
  }

  function validate(value) {
    if (!value || !value.ready) return value || { ready: false };
    if (activeStudent(value) || activePreview(value)) return value;
    throw new Error("passport-scope-mismatch");
  }

  function applySnapshot(value, strict, notify, errorCode) {
    try {
      snapshot = Object.freeze(Object.assign({}, validate(value)));
      user = normalizeUser(snapshot);
      initError = errorCode || "";
      if (activePreview()) renderPreviewBanner();
      else removePreviewBanner();
      if (notify !== false) dispatchReady();
      return snapshot;
    } catch (error) {
      snapshot = Object.freeze({ ready: false, mode: "student", readOnly: true });
      user = null;
      initError = "passport-scope-mismatch";
      removePreviewBanner();
      if (notify !== false) dispatchReady();
      if (strict !== false) throw error;
      return snapshot;
    }
  }

  async function init(options) {
    options = options || {};
    if (hostBridge) {
      const state = await hostBridge.init();
      return applySnapshot(state, true);
    }
    if (initPromise) return initPromise;
    initPromise = initialize(options).finally(function () { initPromise = null; });
    return initPromise;
  }

  async function initialize(options) {
    await loadPassportSdk();
    if (!window.LWWFPassport || typeof window.LWWFPassport.init !== "function") {
      return applySnapshot({ ready: false }, false);
    }
    try {
      const state = await window.LWWFPassport.init({
        siteId: SITE_ID,
        passportOrigin: PASSPORT_ORIGIN,
        renderStatus: false,
        feedbackWidget: options.feedbackWidget !== false && Boolean(document.body)
      });
      return applySnapshot(state, true);
    } catch (error) {
      const errorCode = error && error.message === "passport-scope-mismatch"
        ? "passport-scope-mismatch"
        : "passport-init-failed";
      console.warn("[LWWF Math Passport] init_failed");
      return applySnapshot({ ready: false }, false, true, errorCode);
    }
  }

  function loadPassportSdk() {
    if (window.LWWFPassport) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      const existing = document.querySelector('script[data-lwwf-math-passport-sdk="true"]');
      if (existing) {
        // All bundled pages place the blocking SDK tag before this runtime, so
        // its load/error event has already fired by the time execution reaches
        // here. Resolve immediately and let initialize() fail closed if the SDK
        // object is unavailable.
        resolve();
        return;
      }
      const script = document.createElement("script");
      script.src = PASSPORT_ORIGIN + "/lwwf-passport-sdk.js";
      script.dataset.lwwfMathPassportSdk = "true";
      script.dataset.autoInit = "false";
      script.referrerPolicy = "no-referrer";
      script.onload = resolve;
      script.onerror = function () { reject(new Error("passport-sdk-load-failed")); };
      document.head.appendChild(script);
    });
  }

  function findHostBridge() {
    try {
      if (window.parent === window || window.parent.location.origin !== window.location.origin) return null;
      const bridge = window.parent.LWWFMathPassportBridge;
      return bridge && typeof bridge.getState === "function" ? bridge : null;
    } catch (error) {
      return null;
    }
  }

  function captureNativeStorage() {
    const proto = window.Storage && window.Storage.prototype;
    if (!proto) return null;
    const lengthDescriptor = Object.getOwnPropertyDescriptor(proto, "length");
    return {
      getItem: proto.getItem,
      setItem: proto.setItem,
      removeItem: proto.removeItem,
      clear: proto.clear,
      key: proto.key,
      lengthGet: lengthDescriptor && lengthDescriptor.get
    };
  }

  function memoryFor(target) {
    try {
      if (target === window.sessionStorage) return memorySession;
    } catch (error) {
      return memoryLocal;
    }
    return memoryLocal;
  }

  function mayPersist() {
    return activeStudent();
  }

  function scopedStorageKey(key) {
    const cleanKey = String(key);
    const legacyProgress = cleanKey.match(/^progress_ch(\d+)$/);
    if (legacyProgress && user && user.class && user.number) {
      return "progress_ch" + legacyProgress[1] + "_" + user.class + "_" + user.number;
    }
    return cleanKey;
  }

  function installStorageSandbox() {
    const proto = window.Storage && window.Storage.prototype;
    if (!proto || !nativeStorage) return;
    proto.getItem = function (key) {
      const cleanKey = scopedStorageKey(key);
      if (mayPersist()) return nativeStorage.getItem.call(this, cleanKey);
      const map = memoryFor(this);
      return map.has(cleanKey) ? map.get(cleanKey) : null;
    };
    proto.setItem = function (key, value) {
      const cleanKey = scopedStorageKey(key);
      const cleanValue = String(value);
      if (mayPersist()) nativeStorage.setItem.call(this, cleanKey, cleanValue);
      else memoryFor(this).set(cleanKey, cleanValue);
      dispatchStorageWrite(cleanKey, cleanValue);
    };
    proto.removeItem = function (key) {
      const cleanKey = scopedStorageKey(key);
      if (mayPersist()) nativeStorage.removeItem.call(this, cleanKey);
      else memoryFor(this).delete(cleanKey);
      dispatchStorageWrite(cleanKey, null);
    };
    proto.clear = function () {
      if (mayPersist()) nativeStorage.clear.call(this);
      else memoryFor(this).clear();
      dispatchStorageWrite("", null);
    };
    proto.key = function (index) {
      if (mayPersist()) return nativeStorage.key.call(this, index);
      return Array.from(memoryFor(this).keys())[Number(index)] || null;
    };
    if (nativeStorage.lengthGet) {
      try {
        Object.defineProperty(proto, "length", {
          configurable: true,
          enumerable: true,
          get: function () {
            return mayPersist() ? nativeStorage.lengthGet.call(this) : memoryFor(this).size;
          }
        });
      } catch (error) {
        // Some browsers keep the native descriptor non-configurable.
      }
    }
  }

  function storageFacade(kind) {
    return Object.freeze({
      getItem: function (key) { try { return window[kind].getItem(key); } catch (error) { return null; } },
      setItem: function (key, value) { try { window[kind].setItem(key, value); } catch (error) {} },
      removeItem: function (key) { try { window[kind].removeItem(key); } catch (error) {} },
      clear: function () { try { window[kind].clear(); } catch (error) {} },
      key: function (index) { try { return window[kind].key(index); } catch (error) { return null; } },
      get length() { try { return window[kind].length; } catch (error) { return 0; } }
    });
  }

  function installIndexedDbSandbox() {
    const proto = window.IDBFactory && window.IDBFactory.prototype;
    if (!proto) return;
    const nativeOpen = proto.open;
    const nativeDelete = proto.deleteDatabase;
    if (typeof nativeOpen === "function") {
      proto.open = function () {
        if (!mayPersist()) throw new DOMException("Memory-only Passport session", "SecurityError");
        return nativeOpen.apply(this, arguments);
      };
    }
    if (typeof nativeDelete === "function") {
      proto.deleteDatabase = function () {
        if (!mayPersist()) throw new DOMException("Memory-only Passport session", "SecurityError");
        return nativeDelete.apply(this, arguments);
      };
    }
  }

  function installRemoteGuard() {
    if (!nativeFetch) return;
    window.fetch = function (input, options) {
      options = options || {};
      const raw = typeof input === "string" ? input : (input && input.url) || "";
      const url = new URL(raw, window.location.href);
      const method = String(options.method || (typeof input !== "string" && input && input.method) || "GET").toUpperCase();
      if (shouldBlockRemote(url, method)) {
        return Promise.reject(new Error("此功能在教師巡堂或未驗證模式中已停用。"));
      }
      return nativeFetch(input, options);
    };
  }

  function shouldBlockRemote(url, method) {
    if (url.origin === PASSPORT_ORIGIN) return false;
    // Legacy direct Supabase access is disabled for every role; Passport owns
    // identity, feedback and progress writes.
    if (url.hostname.endsWith("supabase.co")) return true;
    if (activeStudent()) return false;
    if (url.origin === window.location.origin && (method === "GET" || method === "HEAD")) return false;
    if (url.hostname.endsWith("lwwfaiteams.workers.dev") && method !== "GET" && method !== "HEAD") return true;
    if (/\/(ask|image|math-comic|ocr-question|generate)(?:\/|$)/i.test(url.pathname)) return true;
    return method !== "GET" && method !== "HEAD";
  }

  function installEmbeddedNavigation() {
    if (!hostBridge) return;
    document.addEventListener("click", function (event) {
      const target = event.target.closest("a[href], [onclick*='location.href']");
      if (!target) return;
      let href = target.getAttribute("href") || "";
      if (!href) {
        const inline = target.getAttribute("onclick") || "";
        const match = inline.match(/location\.href\s*=\s*['"]([^'"]+)['"]/);
        href = (match && match[1]) || "";
      }
      if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;
      const url = new URL(href, document.baseURI);
      if (url.origin !== window.location.origin || !window.parent.LWWFMathShell || !window.parent.LWWFMathShell.open) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      window.parent.LWWFMathShell.open(url.toString());
    }, true);
  }

  async function recordProgress(task) {
    if (!activeStudent()) return { ok: true, preview: activePreview(), written: false };
    if (hostBridge) return hostBridge.recordProgress(task);
    if (!window.LWWFPassport || typeof window.LWWFPassport.recordProgress !== "function") {
      return { ok: false, written: false };
    }
    const result = await window.LWWFPassport.recordProgress(task);
    applySnapshot((window.LWWFPassport.getState && window.LWWFPassport.getState()) || snapshot, true, false);
    try {
      window.dispatchEvent(new CustomEvent("lwwf-progress-changed", { detail: { source: "passport" } }));
    } catch (error) {}
    return result;
  }

  function dispatchReady() {
    try {
      window.dispatchEvent(new CustomEvent(READY_EVENT, { detail: getState() }));
      window.dispatchEvent(new CustomEvent("lwwf-progress-changed", { detail: { source: "passport" } }));
    } catch (error) {}
  }

  function dispatchStorageWrite(key, value) {
    try {
      window.dispatchEvent(new CustomEvent(STORAGE_EVENT, { detail: { key: key, value: value } }));
      window.dispatchEvent(new CustomEvent("lwwf-progress-changed", {
        detail: { key: key, raw: value, source: activePreview() ? "sandbox" : "local" }
      }));
    } catch (error) {}
  }

  function renderPreviewBanner() {
    if (!document.body || document.getElementById("lwwfMathPreviewBanner")) return;
    const banner = document.createElement("div");
    banner.id = "lwwfMathPreviewBanner";
    banner.setAttribute("role", "status");
    banner.style.cssText = "position:fixed;left:50%;top:10px;transform:translateX(-50%);z-index:2147482000;background:#4c1d95;color:#fff;padding:9px 16px;border-radius:999px;font:800 14px/1.2 -apple-system,BlinkMacSystemFont,'Microsoft JhengHei',sans-serif;box-shadow:0 8px 24px rgba(76,29,149,.28);pointer-events:none";
    banner.textContent = "教師巡堂 · " + normalizeGrade(snapshot.grade).toUpperCase() + " · 記憶體沙盒（不會儲存進度）";
    document.body.appendChild(banner);
  }

  function removePreviewBanner() {
    const banner = document.getElementById("lwwfMathPreviewBanner");
    if (banner) banner.remove();
  }

  function getState() {
    return Object.assign({}, snapshot, {
      ready: Boolean(snapshot.ready && user),
      readOnly: !activeStudent(),
      synthetic: activePreview(),
      initError: initError
    });
  }

  window.LWWFMathPassportBridge = Object.freeze({
    init: init,
    getState: getState,
    getUser: function () { return user; },
    isReadOnly: function () { return !activeStudent(); },
    isTeacherPreview: function () { return activePreview(); },
    canWrite: function () { return activeStudent(); },
    canUsePaidFeatures: function () { return activeStudent(); },
    recordProgress: recordProgress,
    flush: async function () { return { ok: true, written: false }; },
    storage: storageFacade("localStorage"),
    sessionStorage: storageFacade("sessionStorage"),
    siteId: SITE_ID,
    passportOrigin: PASSPORT_ORIGIN,
    eventName: READY_EVENT,
    storageEventName: STORAGE_EVENT
  });

  if (!document.body) {
    document.addEventListener("DOMContentLoaded", function () {
      if (activePreview()) renderPreviewBanner();
    }, { once: true });
  }

  if (hostBridge) {
    hostBridge.init().then(function (state) { applySnapshot(state, true); }).catch(function () {});
  } else {
    init({ feedbackWidget: Boolean(document.body) }).catch(function () {});
    if (!document.body) {
      document.addEventListener("DOMContentLoaded", function () {
        init({ feedbackWidget: true }).catch(function () {});
      }, { once: true });
    }
  }
})();
