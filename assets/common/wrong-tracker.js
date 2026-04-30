// ============================================================
// LWWF Math Wrong-Question Tracker — Supabase + POE retry
// ----------------------------------------------------------------
// 點用：
//   <script src="../common/wrong-tracker.js"></script>
//   // 學生答錯時：
//   window.LWWFWrong.record({
//     chapter: 13,
//     question: '45 × 0.01 = ?',
//     correct_answer: '0.45',
//     student_answer: '4.5',
//     source: 'game1'
//   });
//
//   // 學生答對重做題時：
//   window.LWWFWrong.markCorrect(rowId);
//
//   // 攞錯題清單（AI 助教用）：
//   const list = await window.LWWFWrong.getList(13);
//
//   // 出 retry 題（POE 生）：
//   const retries = await window.LWWFWrong.fetchRetries(13);
// ============================================================
(function () {
  'use strict';
  if (window.LWWFWrong) return;

  const SUPABASE_URL = 'https://ygpsvwughqstubwxhzoe.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlncHN2d3VnaHFzdHVid3hoem9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMTM3NzUsImV4cCI6MjA5MTg4OTc3NX0.DBsx2945F0Vdfhptx-Tr9mVqaa2i9jE4tMQIvjffvII';
  const WORKER_URL = 'https://lwwf-math-ai.lwwfaiteams.workers.dev';
  const TABLE = 'student_wrong_questions';

  // -- helpers --
  function getStudentId() {
    try {
      const raw = localStorage.getItem('lwwf_auth_user')
        || localStorage.getItem('mathai_user')
        || sessionStorage.getItem('lwwf_auth_user')
        || sessionStorage.getItem('mathai_user');
      if (!raw) return null;
      const u = JSON.parse(raw);
      if (!u || !u.class || !u.number) return null;
      return `${u.class}-${u.number}`;
    } catch { return null; }
  }

  async function sbFetch(path, opts = {}) {
    const url = `${SUPABASE_URL}/rest/v1/${path}`;
    const headers = {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      ...(opts.headers || {}),
    };
    const r = await fetch(url, { ...opts, headers });
    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      throw new Error(`Supabase ${r.status}: ${txt.slice(0, 200)}`);
    }
    return r.json().catch(() => null);
  }

  // ---------- record(): 記錄一題錯題 ----------
  // 如果同 student_id + chapter + question_text 已存在 → wrong_count + 1
  // 否則 → INSERT 新 row
  async function record({ chapter, question, correct_answer, student_answer, source }) {
    const student_id = getStudentId();
    if (!student_id) return { ok: false, reason: 'no-student' };
    if (!chapter || !question || !correct_answer) return { ok: false, reason: 'missing-fields' };

    try {
      // 1. 揾返舊有 row
      const q = `?student_id=eq.${encodeURIComponent(student_id)}&chapter=eq.${chapter}&question_text=eq.${encodeURIComponent(question)}&select=id,wrong_count`;
      const existing = await sbFetch(`${TABLE}${q}`);

      if (existing && existing.length > 0) {
        // 2a. UPDATE wrong_count
        const row = existing[0];
        await sbFetch(`${TABLE}?id=eq.${row.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            wrong_count: (row.wrong_count || 0) + 1,
            student_answer: student_answer ?? null,
            last_wrong_at: new Date().toISOString(),
          }),
        });
        return { ok: true, action: 'updated', id: row.id, wrong_count: row.wrong_count + 1 };
      } else {
        // 2b. INSERT 新 row
        const inserted = await sbFetch(TABLE, {
          method: 'POST',
          body: JSON.stringify({
            student_id,
            chapter,
            question_text: question,
            correct_answer: String(correct_answer),
            student_answer: student_answer ?? null,
            source: source ?? null,
          }),
        });
        return { ok: true, action: 'inserted', id: inserted?.[0]?.id };
      }
    } catch (e) {
      console.warn('[wrong-tracker] record failed:', e.message);
      return { ok: false, reason: 'sb-error', error: e.message };
    }
  }

  // ---------- markCorrect(): 學生答對重做題 ----------
  // correct_count + 1，如果 ≥ 3 → mastered = true
  async function markCorrect(rowId) {
    if (!rowId) return { ok: false };
    try {
      const cur = await sbFetch(`${TABLE}?id=eq.${rowId}&select=correct_count`);
      if (!cur || cur.length === 0) return { ok: false, reason: 'not-found' };
      const newCount = (cur[0].correct_count || 0) + 1;
      const mastered = newCount >= 3;
      await sbFetch(`${TABLE}?id=eq.${rowId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          correct_count: newCount,
          mastered,
          last_retry_at: new Date().toISOString(),
        }),
      });
      return { ok: true, correct_count: newCount, mastered };
    } catch (e) {
      console.warn('[wrong-tracker] markCorrect failed:', e.message);
      return { ok: false, error: e.message };
    }
  }

  // ---------- getList(): 攞學生錯題（未 mastered） ----------
  async function getList(chapter, includeMastered = false) {
    const student_id = getStudentId();
    if (!student_id) return [];
    try {
      let q = `?student_id=eq.${encodeURIComponent(student_id)}&select=*&order=last_wrong_at.desc&limit=20`;
      if (chapter) q += `&chapter=eq.${chapter}`;
      if (!includeMastered) q += `&mastered=eq.false`;
      const rows = await sbFetch(`${TABLE}${q}`);
      return rows || [];
    } catch (e) {
      console.warn('[wrong-tracker] getList failed:', e.message);
      return [];
    }
  }

  // ---------- fetchRetries(): 用 POE 生 retry 題 ----------
  // 揀 wrong_count >= 2 + mastered = false 嘅題目，最多 5 條，BATCH 一次過 POE call
  async function fetchRetries(chapter, n_retries = 3) {
    const list = await getList(chapter, false);
    const candidates = list.filter(r => (r.wrong_count || 0) >= 2).slice(0, 5);
    if (candidates.length === 0) {
      return { retries: [], message: '冇錯 ≥ 2 次嘅題目，繼續加油！' };
    }

    // 如果已經 cached AI retry → 直接返
    const cached = candidates.filter(r => r.ai_retry_question && r.ai_retry_answer);
    if (cached.length >= n_retries) {
      return {
        retries: cached.slice(0, n_retries).map(r => ({
          id: r.id,
          question: r.ai_retry_question,
          answer: r.ai_retry_answer,
          hint: r.ai_retry_hint || '',
          original_question: r.question_text,
        })),
        provider: 'cache',
      };
    }

    // POE 生
    try {
      const r = await fetch(`${WORKER_URL}/wrong-question-retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          wrong_questions: candidates.map(c => ({
            question: c.question_text,
            correct_answer: c.correct_answer,
            student_answer: c.student_answer,
            chapter: c.chapter,
          })),
          n_retries,
        }),
      });
      const data = await r.json();
      const retries = (data.retries || []).slice(0, n_retries);

      // 寫返 ai_retry_* fields 落 candidates，俾下次 reuse
      retries.forEach(async (ret, idx) => {
        const row = candidates[idx];
        if (!row) return;
        await sbFetch(`${TABLE}?id=eq.${row.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            ai_retry_question: ret.question,
            ai_retry_answer: String(ret.answer),
            ai_retry_hint: ret.hint || '',
          }),
        }).catch(() => null);
      });

      return {
        retries: retries.map((ret, idx) => ({
          id: candidates[idx]?.id,
          question: ret.question,
          answer: ret.answer,
          hint: ret.hint || '',
          original_question: candidates[idx]?.question_text,
        })),
        provider: data.provider || 'poe',
      };
    } catch (e) {
      console.warn('[wrong-tracker] fetchRetries failed:', e.message);
      return { retries: [], error: e.message };
    }
  }

  // ---------- public API ----------
  window.LWWFWrong = {
    record,
    markCorrect,
    getList,
    fetchRetries,
  };
})();
