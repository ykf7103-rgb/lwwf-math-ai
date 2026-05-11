// ============================================================
// LWWF Math Progress Sync — Supabase + localStorage hybrid
// ----------------------------------------------------------------
// 解決學生反映的問題：
//   1. 完成簡報/評估/遊戲沒有顯示完成 → cross-tab + cloud sync
//   2. 完成後沒有派金幣 → unified computeCoins() rule
//   3. 完成後下次回來又未完成 → Supabase = source of truth
//   4. 不同課題畫面金幣數量不同 → consistent localStorage cache
//
// 為什麼掂：
//   • Hijack localStorage.setItem on `progress_ch*` keys → debounced
//     auto-upsert to Supabase student_progress + student_scores
//   • On page load, refreshFromCloud(chapter) merges cloud → local
//   • Cross-tab `storage` event + same-tab `lwwf-progress-changed`
//     event drive UI re-render
//   • visibilitychange/pagehide flushes pending writes
//
// 51 個既有 sub-page 不需要改一行。Chapter index page 只需加：
//   window.addEventListener('lwwf-progress-changed', renderProgress);
// ============================================================
(function() {
  'use strict';
  if (window.LWWFProgress) return;  // 已 load

  const SUPABASE_URL = 'https://ygpsvwughqstubwxhzoe.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlncHN2d3VnaHFzdHVid3hoem9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMTM3NzUsImV4cCI6MjA5MTg4OTc3NX0.DBsx2945F0Vdfhptx-Tr9mVqaa2i9jE4tMQIvjffvII';
  const DEBOUNCE_MS = 600;
  const SCORE_FIELDS = ['score','total','coins','correct','wrong','attempts','passed','duration_sec','items','extras_coins'];

  let sb = null;
  let _isCloudLoading = false;     // suppress hijack while we write cloud→local
  const debouncedSync = {};        // key → timeout id

  function getUser() {
    try {
      const raw = localStorage.getItem('lwwf_auth_user')
                || localStorage.getItem('mathai_user')
                || sessionStorage.getItem('lwwf_auth_user')
                || sessionStorage.getItem('mathai_user');
      if (!raw) return null;
      const u = JSON.parse(raw);
      return (u && u.class && u.number) ? u : null;
    } catch { return null; }
  }

  async function ensureSupabase() {
    if (sb) return sb;
    if (!window.supabase) {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
        s.onload = resolve;
        s.onerror = () => reject(new Error('Supabase CDN load failed'));
        document.head.appendChild(s);
      });
    }
    if (!window.supabase) throw new Error('Supabase global missing after CDN load');
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return sb;
  }

  // ---------- mergeBest: 「best of」semantics — 永遠保留最高分/最多金幣 ----------
  // 解決 bug：學生重玩遊戲拎了低分時，不要用低分 overwrite 高分
  // 同 cloud sync race condition：不要用 stale cloud 數據 overwrite local 新分
  const MAX_FIELDS = ['coins','score','correct','passed','total','attempts'];
  function mergeBest(oldP, newP) {
    if (!oldP || typeof oldP !== 'object') return newP;
    if (!newP || typeof newP !== 'object') return oldP;
    const merged = { ...oldP };
    Object.entries(newP).forEach(([stepId, freshVal]) => {
      const oldVal = merged[stepId];
      if (!oldVal || typeof oldVal !== 'object' || !freshVal || typeof freshVal !== 'object') {
        merged[stepId] = freshVal;
        return;
      }
      // Both are objects: shallow merge with MAX-semantics on numeric fields
      const out = { ...oldVal, ...freshVal };
      MAX_FIELDS.forEach(k => {
        const oldNum = typeof oldVal[k] === 'number' ? oldVal[k] : null;
        const newNum = typeof freshVal[k] === 'number' ? freshVal[k] : null;
        if (oldNum !== null && newNum !== null) out[k] = Math.max(oldNum, newNum);
        else if (oldNum !== null && newNum === null) out[k] = oldNum;  // preserve old if new missing
      });
      // done: sticky true (once done, always done)
      if (oldVal.done || freshVal.done) out.done = true;
      // ts: take latest
      if (typeof oldVal.ts === 'number' && typeof freshVal.ts === 'number') {
        out.ts = Math.max(oldVal.ts, freshVal.ts);
      }
      merged[stepId] = out;
    });
    return merged;
  }

  // ---------- localStorage.setItem hijack ----------
  const origSetItem = Storage.prototype.setItem;
  const origGetItem = Storage.prototype.getItem;
  Storage.prototype.setItem = function(key, value) {
    let finalValue = value;
    // 🚨 Apply mergeBest BEFORE write — 防止 sub-page 的 markDone() overwrite 高分
    if (this === localStorage && !_isCloudLoading && typeof key === 'string') {
      const m = key.match(/^progress_ch(\d+)_([^_]+)_(.+)$/);
      if (m) {
        try {
          const oldRaw = origGetItem.call(this, key);
          const oldP = JSON.parse(oldRaw || '{}');
          const newP = JSON.parse(value || '{}');
          finalValue = JSON.stringify(mergeBest(oldP, newP));
        } catch(e) {}
      }
    }
    origSetItem.call(this, key, finalValue);
    if (this !== localStorage || _isCloudLoading) return;
    if (typeof key !== 'string') return;
    // Only watch progress_ch{N}_{class}_{num} (per-user). Anonymous progress_chN ignored.
    const m = key.match(/^progress_ch(\d+)_([^_]+)_(.+)$/);
    if (!m) return;
    const chapter = parseInt(m[1]);
    const cls = m[2], num = m[3];
    // Same-tab event for chapter index UI updates
    try {
      window.dispatchEvent(new CustomEvent('lwwf-progress-changed', {
        detail: { chapter, key, raw: finalValue, source: 'local' }
      }));
    } catch {}
    // Debounced cloud sync — 用 finalValue（已 mergeBest）不是 raw value
    clearTimeout(debouncedSync[key]);
    debouncedSync[key] = setTimeout(() => {
      delete debouncedSync[key];
      syncToCloud(chapter, cls, num, finalValue).catch(() => {});
    }, DEBOUNCE_MS);
  };

  // ---------- Health log + offline queue (2026-05-11 hardening) ----------
  const OFFLINE_QUEUE_KEY = 'lwwf_sync_offline_queue';
  const MAX_RETRY = 3;
  const RETRY_DELAY_MS = [1000, 3000, 8000];  // exponential-ish backoff

  async function logHealth(eventType, details) {
    try {
      const sb = await ensureSupabase();
      const u = getUser();
      const row = {
        class: u && u.class ? u.class : null,
        student_number: u && u.number ? u.number : null,
        chapter: (details && details.chapter) || null,
        event_type: eventType,
        error_msg: (details && details.error) ? String(details.error).slice(0, 1000) : null,
        latency_ms: (details && typeof details.latencyMs === 'number') ? details.latencyMs : null,
        user_agent: (navigator.userAgent || '').slice(0, 200),
      };
      // Best effort: no await on outer, no toast on failure (avoid recursion)
      sb.from('sync_health_log').insert(row).then(() => {}, () => {});
    } catch (e) {}
  }

  function queueOffline(chapter, cls, num, raw) {
    try {
      const q = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
      q.push({ chapter, cls, num, raw, queued_at: Date.now() });
      // Cap queue at 50 entries (drop oldest)
      const trimmed = q.slice(-50);
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(trimmed));
      logHealth('offline_queue', { chapter });
    } catch (e) {}
  }

  async function flushOfflineQueue() {
    let q;
    try { q = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]'); }
    catch { return; }
    if (!q.length) return;
    const remain = [];
    for (const item of q) {
      const ok = await syncToCloud(item.chapter, item.cls, item.num, item.raw, 0, true);
      if (!ok) remain.push(item);
    }
    try { localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remain)); } catch {}
    if (q.length > remain.length) {
      logHealth('offline_flush', { chapter: q[0].chapter, latencyMs: q.length - remain.length });
      try { showSyncToast(`✅ 補回 ${q.length - remain.length} 筆離線進度`, 'ok'); } catch {}
    }
  }

  // Toast UI for sync feedback (non-blocking, auto-dismiss)
  function showSyncToast(msg, kind) {
    try {
      if (!document.body) return;
      let el = document.getElementById('__lwwfSyncToast');
      if (!el) {
        el = document.createElement('div');
        el.id = '__lwwfSyncToast';
        el.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#333;color:white;padding:10px 16px;border-radius:10px;font-size:0.88rem;font-weight:700;z-index:99998;box-shadow:0 4px 14px rgba(0,0,0,0.25);opacity:0;transition:opacity 0.3s;font-family:-apple-system,"PingFang TC","Microsoft JhengHei",sans-serif;max-width:280px;line-height:1.4;';
        document.body.appendChild(el);
      }
      el.style.background = kind === 'fail' ? 'linear-gradient(135deg,#E53935,#B71C1C)' :
                            kind === 'ok'   ? 'linear-gradient(135deg,#4CAF50,#2E7D32)' :
                                              'linear-gradient(135deg,#1565C0,#0D47A1)';
      el.textContent = msg;
      el.style.opacity = '1';
      clearTimeout(el.__hideTimer);
      el.__hideTimer = setTimeout(() => { el.style.opacity = '0'; }, 3500);
    } catch (e) {}
  }

  // ---------- Cloud sync (with retry + offline queue) ----------
  // attempt: current retry count (0 = first try)
  // isReplay: true when called from offline queue (don't re-queue on fail)
  async function syncToCloud(chapter, cls, num, raw, attempt, isReplay) {
    attempt = attempt || 0;
    let p;
    try { p = JSON.parse(raw || '{}'); } catch { return false; }
    if (!p || typeof p !== 'object') return false;
    const start = Date.now();
    try {
      const sb = await ensureSupabase();
      const progRows = [];
      const scoreRows = [];
      Object.entries(p).forEach(([stepId, val]) => {
        if (!val || typeof val !== 'object' || !val.done) return;
        progRows.push({ class: cls, student_number: num, chapter, step_id: stepId });
        const detail = {};
        SCORE_FIELDS.forEach(k => { if (val[k] !== undefined) detail[k] = val[k]; });
        if (Object.keys(detail).length > 0) {
          scoreRows.push({
            class: cls, student_number: num, chapter,
            activity_key: stepId, data: detail
          });
        }
      });
      const tasks = [];
      if (progRows.length > 0) {
        tasks.push(sb.from('student_progress').upsert(progRows, {
          onConflict: 'class,student_number,chapter,step_id'
        }));
      }
      if (scoreRows.length > 0) {
        tasks.push(sb.from('student_scores').upsert(scoreRows, {
          onConflict: 'class,student_number,chapter,activity_key'
        }));
      }
      const results = await Promise.all(tasks);
      const err = results.find(r => r && r.error);
      const latency = Date.now() - start;
      if (err && err.error) {
        // Soft error from Supabase — retry if attempts left
        if (attempt < MAX_RETRY) {
          logHealth('sync_retry', { chapter, error: err.error.message, latencyMs: latency });
          setTimeout(() => syncToCloud(chapter, cls, num, raw, attempt + 1, isReplay),
                     RETRY_DELAY_MS[attempt] || 8000);
          return false;
        }
        console.warn('[lwwf-progress] sync failed after retries:', err.error);
        logHealth('sync_fail', { chapter, error: err.error.message, latencyMs: latency });
        if (!isReplay) {
          queueOffline(chapter, cls, num, raw);
          showSyncToast('⚠️ 進度暫存本機，稍後自動上傳', 'fail');
        }
        return false;
      }
      logHealth('sync_ok', { chapter, latencyMs: latency });
      return true;
    } catch (e) {
      const latency = Date.now() - start;
      console.warn('[lwwf-progress] sync exception:', e);
      // Network error → retry
      if (attempt < MAX_RETRY) {
        logHealth('sync_retry', { chapter, error: String(e), latencyMs: latency });
        setTimeout(() => syncToCloud(chapter, cls, num, raw, attempt + 1, isReplay),
                   RETRY_DELAY_MS[attempt] || 8000);
        return false;
      }
      logHealth('sync_fail', { chapter, error: String(e), latencyMs: latency });
      if (!isReplay) {
        queueOffline(chapter, cls, num, raw);
        showSyncToast('⚠️ 網絡未穩，進度暫存本機', 'fail');
      }
      return false;
    }
  }

  // Try flushing offline queue on page load + every 30s + on visibility
  function startOfflineQueueFlusher() {
    flushOfflineQueue().catch(() => {});
    setInterval(() => flushOfflineQueue().catch(() => {}), 30000);
    window.addEventListener('online', () => flushOfflineQueue().catch(() => {}));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') flushOfflineQueue().catch(() => {});
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startOfflineQueueFlusher);
  } else {
    setTimeout(startOfflineQueueFlusher, 100);
  }

  // Pull from Supabase → merge into localStorage (preserves any local-only data)
  async function refreshFromCloud(chapter) {
    const user = getUser();
    if (!user) return null;
    const key = `progress_ch${chapter}_${user.class}_${user.number}`;
    let local;
    try { local = JSON.parse(localStorage.getItem(key) || '{}'); } catch { local = {}; }
    try {
      const sb = await ensureSupabase();
      const [progRes, scoreRes] = await Promise.all([
        sb.from('student_progress')
          .select('step_id,done_at')
          .eq('class', user.class).eq('student_number', user.number).eq('chapter', chapter),
        sb.from('student_scores')
          .select('activity_key,data')
          .eq('class', user.class).eq('student_number', user.number).eq('chapter', chapter),
      ]);
      // 🚨 Build cloud-side object first, THEN mergeBest with local — 確保
      // 不會用 stale cloud 數據 overwrite local 新分（race condition）
      const cloudP = {};
      (progRes.data || []).forEach(r => {
        cloudP[r.step_id] = {
          done: true,
          ts: r.done_at ? new Date(r.done_at).getTime() : Date.now()
        };
      });
      (scoreRes.data || []).forEach(r => {
        cloudP[r.activity_key] = Object.assign(
          cloudP[r.activity_key] || { done: true },
          r.data || {}
        );
      });
      // mergeBest: 取 max 的 coins/score，保留最新 ts，done 一旦 true 永遠 true
      const merged = mergeBest(local || {}, cloudP);
      // Write back without re-firing the hijack
      _isCloudLoading = true;
      try { origSetItem.call(localStorage, key, JSON.stringify(merged)); }
      finally { _isCloudLoading = false; }
      try {
        window.dispatchEvent(new CustomEvent('lwwf-progress-changed', {
          detail: { chapter, key, raw: JSON.stringify(merged), source: 'cloud' }
        }));
      } catch {}
      return merged;
    } catch(e) {
      console.warn('[lwwf-progress] cloud fetch failed, using local:', e);
      return local;
    }
  }

  // ---------- Unified coin computation ----------
  // Rules (consistent across all chapters):
  //   game{N}              → val.coins (or default 3)
  //   slides{N}            → val.coins (or default 2)
  //   prelearn{N}          → val.coins (or default 2)
  //   assess{N}            → val.coins (or default 2)
  //   infographic          → val.coins (or default 2)
  //   flashcards / bonus   → val.coins (or default 2)
  //   extras               → items count: 0 if <2, else min(5, n+2)
  function computeCoins(progress) {
    if (!progress || typeof progress !== 'object') return 0;
    let total = 0;
    Object.entries(progress).forEach(([stepId, val]) => {
      if (!val || !val.done) return;
      if (typeof val.coins === 'number') {
        total += val.coins;
        return;
      }
      if (/^game\d*$/.test(stepId)) total += 3;
      else if (/^(slides|prelearn|assess)\d*$/.test(stepId)) total += 2;
      else if (stepId === 'infographic' || stepId === 'flashcards' || stepId === 'bonus' || stepId === 'bonus-quiz') total += 2;
      else if (stepId === 'extras') {
        if (typeof val.extras_coins === 'number') total += val.extras_coins;
        else if (val.items && typeof val.items === 'object') {
          const n = Object.keys(val.items).length;
          if (n >= 2) total += Math.min(5, n + 2);
        }
      }
    });
    return total;
  }

  // Ch12 coin computation — UNIFIED single source of truth (rule #19, 2026-05-03 fix)
  // 取代之前 root index 的 computeEarnedCoins（hardcoded list 漏 ch12_game2）
  // 同 getTotalCoinsAllChapters 之前 raw `coins||score`（quiz1 score=10 變 10 coins overdose）
  // Logic:
  //   - 任何 entry 有 coins 字段（含 ch12_game2 等 unusual key）→ 計入 v.coins
  //   - quiz1 / quiz4 沒有 coins 但有 score/total → 用 Math.min(2, round(score/total*2)) derivation
  //   - 其他沒有 coins 的 entry → 不計（避免 raw score 過大）
  function computeCh12Coins(scores) {
    if (!scores || typeof scores !== 'object') return 0;
    let total = 0;
    Object.entries(scores).forEach(([k, v]) => {
      if (!v || typeof v !== 'object') return;
      if (typeof v.coins === 'number') {
        total += v.coins;
        return;
      }
      if ((k === 'quiz1' || k === 'quiz4') && typeof v.score === 'number'
          && typeof v.total === 'number' && v.total > 0) {
        total += Math.min(2, Math.round((v.score / v.total) * 2));
      }
    });
    return total;
  }

  // Total coins across all chapters (12-21) for a user.
  // Reads from localStorage; assumes refreshFromCloud(ch) was called for any chapter
  // we want fresh data on. (chapter-header.js re-reads on lwwf-progress-changed.)
  function getTotalCoinsAllChapters(user) {
    user = user || getUser();
    if (!user) return 0;
    let total = 0;
    // Ch12 stores under scores_{cls}_{num} — use unified computeCh12Coins
    try {
      const ch12 = JSON.parse(localStorage.getItem(`scores_${user.class}_${user.number}`) || '{}');
      total += computeCh12Coins(ch12);
    } catch {}
    // Ch13-21 stored under progress_ch{N}_{cls}_{num}
    for (let ch = 13; ch <= 21; ch++) {
      try {
        const k = `progress_ch${ch}_${user.class}_${user.number}`;
        const p = JSON.parse(localStorage.getItem(k) || '{}');
        total += computeCoins(p);
      } catch {}
    }
    return total;
  }

  // ---------- Auto-flush on page hide ----------
  function flushPending() {
    Object.keys(debouncedSync).forEach(key => {
      clearTimeout(debouncedSync[key]);
      delete debouncedSync[key];
      const value = localStorage.getItem(key);
      if (!value) return;
      const m = key.match(/^progress_ch(\d+)_([^_]+)_(.+)$/);
      if (m) {
        // Fire-and-forget (browser may kill but we did our best)
        syncToCloud(parseInt(m[1]), m[2], m[3], value).catch(() => {});
      }
    });
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushPending();
  });
  window.addEventListener('pagehide', flushPending);

  // ---------- Cross-tab sync ----------
  window.addEventListener('storage', (e) => {
    if (!e.key || !e.key.startsWith('progress_ch')) return;
    try {
      window.dispatchEvent(new CustomEvent('lwwf-progress-changed', {
        detail: { key: e.key, raw: e.newValue, source: 'cross-tab' }
      }));
    } catch {}
  });

  // ---------- Auto-refresh on chapter pages ----------
  function autoRefresh() {
    // Sub-page or chapter index inside /chN/ → refresh that chapter
    const m = location.pathname.match(/\/ch(\d+)\//);
    if (m) refreshFromCloud(parseInt(m[1])).catch(() => {});
    // Root index.html with ?ch=N URL → refresh that chapter (Ch12 main)
    const qm = location.search.match(/[?&]ch=(\d+)/);
    if (qm && !m) refreshFromCloud(parseInt(qm[1])).catch(() => {});
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoRefresh);
  } else {
    setTimeout(autoRefresh, 0);
  }

  // ---------- Public API ----------
  window.LWWFProgress = {
    getUser,
    refreshFromCloud,
    syncToCloud,
    flushOfflineQueue,
    logHealth,
    showSyncToast,
    computeCoins,
    computeCh12Coins,                    // NEW 2026-05-03: unified ch12 coin logic
    getTotalCoinsAllChapters,
    flushPending,
    mergeBest,                           // exposed for testing
    _ensureSupabase: ensureSupabase,
  };

  // 🚨 Fire init event so chapter-header.js / chapter index pages can re-render
  // 用統一 computeCoins() 規則（解決首次 page load 用 legacy getTotalCoins
  // 漏計 default coins 的 bug）
  try {
    window.dispatchEvent(new CustomEvent('lwwf-progress-changed', {
      detail: { source: 'init' }
    }));
  } catch {}
})();
