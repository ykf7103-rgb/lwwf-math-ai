// ============================================================
// LWWF Math Progress Sync — Supabase + localStorage hybrid
// ----------------------------------------------------------------
// 解決學生反映嘅問題：
//   1. 完成簡報/評估/遊戲沒有顯示完成 → cross-tab + cloud sync
//   2. 完成後沒有派金幣 → unified computeCoins() rule
//   3. 完成後下次回來又未完成 → Supabase = source of truth
//   4. 不同課題畫面金幣數量不同 → consistent localStorage cache
//
// 點解掂：
//   • Hijack localStorage.setItem on `progress_ch*` keys → debounced
//     auto-upsert to Supabase student_progress + student_scores
//   • On page load, refreshFromCloud(chapter) merges cloud → local
//   • Cross-tab `storage` event + same-tab `lwwf-progress-changed`
//     event drive UI re-render
//   • visibilitychange/pagehide flushes pending writes
//
// 51 個既有 sub-page 唔需要改一行。Chapter index page 只需加：
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

  // ---------- localStorage.setItem hijack ----------
  const origSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function(key, value) {
    origSetItem.call(this, key, value);
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
        detail: { chapter, key, raw: value, source: 'local' }
      }));
    } catch {}
    // Debounced cloud sync
    clearTimeout(debouncedSync[key]);
    debouncedSync[key] = setTimeout(() => {
      delete debouncedSync[key];
      syncToCloud(chapter, cls, num, value).catch(() => {});
    }, DEBOUNCE_MS);
  };

  // ---------- Cloud sync ----------
  async function syncToCloud(chapter, cls, num, raw) {
    let p;
    try { p = JSON.parse(raw || '{}'); } catch { return; }
    if (!p || typeof p !== 'object') return;
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
    try {
      const results = await Promise.all(tasks);
      const err = results.find(r => r && r.error);
      if (err && err.error) console.warn('[lwwf-progress] sync partial fail:', err.error);
    } catch(e) {
      console.warn('[lwwf-progress] sync exception:', e);
    }
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
      const merged = JSON.parse(JSON.stringify(local || {}));
      (progRes.data || []).forEach(r => {
        merged[r.step_id] = Object.assign(merged[r.step_id] || {}, {
          done: true,
          ts: r.done_at ? new Date(r.done_at).getTime() : Date.now()
        });
      });
      (scoreRes.data || []).forEach(r => {
        merged[r.activity_key] = Object.assign(
          merged[r.activity_key] || { done: true },
          r.data || {}
        );
      });
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

  // Total coins across all chapters (12-21) for a user.
  // Reads from localStorage; assumes refreshFromCloud(ch) was called for any chapter
  // we want fresh data on. (chapter-header.js re-reads on lwwf-progress-changed.)
  function getTotalCoinsAllChapters(user) {
    user = user || getUser();
    if (!user) return 0;
    let total = 0;
    // Ch12 stores under scores_{cls}_{num}
    try {
      const ch12 = JSON.parse(localStorage.getItem(`scores_${user.class}_${user.number}`) || '{}');
      Object.values(ch12).forEach(s => {
        if (typeof s === 'object' && s !== null) {
          if (typeof s.coins === 'number') total += s.coins;
          else if (typeof s.score === 'number') total += s.score;
        }
      });
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
    computeCoins,
    getTotalCoinsAllChapters,
    flushPending,
    _ensureSupabase: ensureSupabase,  // exposed for advanced use
  };
})();
