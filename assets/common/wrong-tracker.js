// LWWF Math wrong-question tracker.
// Safe learning evidence is scoped by the in-memory Passport identity. Teacher
// preview remains a memory-only sandbox and never calls a generation service.
(function () {
  "use strict";
  if (window.LWWFWrong) return;

  const WORKER_URL = "https://lwwf-math-ai.lwwfaiteams.workers.dev";
  let rows = [];

  function client() {
    return window.LWWFMathPassportBridge || null;
  }

  function currentUser() {
    return client()?.getUser?.() || null;
  }

  function storageKey() {
    const user = currentUser();
    return user ? "lwwf_math_wrong_v2_" + user.id : "lwwf_math_wrong_v2_sandbox";
  }

  function load() {
    try {
      const value = JSON.parse(client()?.storage?.getItem(storageKey()) || "[]");
      rows = Array.isArray(value) ? value.slice(0, 50) : [];
    } catch (error) {
      rows = [];
    }
  }

  function save() {
    client()?.storage?.setItem(storageKey(), JSON.stringify(rows.slice(0, 50)));
  }

  function clean(value, limit) {
    return String(value == null ? "" : value).replace(/[\u0000-\u001f]/g, " ").trim().slice(0, limit);
  }

  async function record(payload) {
    const user = currentUser();
    if (!user) return { ok: false, reason: "no-passport-session" };
    const chapter = Number(payload?.chapter || 0);
    const question = clean(payload?.question, 300);
    const answer = clean(payload?.correct_answer, 120);
    if (!chapter || !question || !answer) return { ok: false, reason: "missing-fields" };
    load();
    let row = rows.find(item => item.chapter === chapter && item.question_text === question);
    if (!row) {
      row = {
        id: "local-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8),
        chapter,
        question_text: question,
        correct_answer: answer,
        student_answer: clean(payload?.student_answer, 120),
        source: clean(payload?.source, 60),
        wrong_count: 0,
        correct_count: 0,
        mastered: false
      };
      rows.unshift(row);
    }
    row.wrong_count += 1;
    row.student_answer = clean(payload?.student_answer, 120);
    row.last_wrong_at = new Date().toISOString();
    save();
    return { ok: true, action: row.wrong_count === 1 ? "inserted" : "updated", id: row.id, wrong_count: row.wrong_count };
  }

  async function markCorrect(rowId) {
    load();
    const row = rows.find(item => item.id === rowId);
    if (!row) return { ok: false, reason: "not-found" };
    row.correct_count = Number(row.correct_count || 0) + 1;
    row.mastered = row.correct_count >= 3;
    row.last_retry_at = new Date().toISOString();
    save();
    return { ok: true, correct_count: row.correct_count, mastered: row.mastered };
  }

  async function getList(chapter, includeMastered) {
    if (!currentUser()) return [];
    load();
    return rows.filter(item => (!chapter || item.chapter === Number(chapter)) && (includeMastered || !item.mastered)).slice(0, 20);
  }

  async function fetchRetries(chapter, count) {
    const bridge = client();
    if (!bridge || !bridge.canUsePaidFeatures()) {
      return { retries: [], message: "教師巡堂沙盒不會讀取遠端錯題或呼叫生成服務。" };
    }
    const list = await getList(chapter, false);
    const candidates = list.filter(item => Number(item.wrong_count || 0) >= 2).slice(0, 5);
    if (!candidates.length) return { retries: [], message: "沒有錯兩次或以上的題目，繼續加油！" };
    const cached = candidates.filter(item => item.ai_retry_question && item.ai_retry_answer);
    const wanted = Math.max(1, Math.min(5, Number(count || 3)));
    if (cached.length >= wanted) {
      return {
        retries: cached.slice(0, wanted).map(item => ({
          id: item.id,
          question: item.ai_retry_question,
          answer: item.ai_retry_answer,
          hint: item.ai_retry_hint || "",
          original_question: item.question_text
        }))
      };
    }

    try {
      const response = await fetch(WORKER_URL + "/wrong-question-retry", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          wrong_questions: candidates.map(item => ({
            question: item.question_text,
            correct_answer: item.correct_answer,
            student_answer: item.student_answer,
            chapter: item.chapter
          })),
          n_retries: wanted
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error("retry-generation-failed");
      const retries = (data.retries || []).slice(0, wanted);
      retries.forEach(function (retry, index) {
        const row = candidates[index];
        if (!row) return;
        row.ai_retry_question = clean(retry.question, 300);
        row.ai_retry_answer = clean(retry.answer, 120);
        row.ai_retry_hint = clean(retry.hint, 200);
      });
      save();
      return {
        retries: retries.map(function (retry, index) {
          return {
            id: candidates[index]?.id,
            question: clean(retry.question, 300),
            answer: clean(retry.answer, 120),
            hint: clean(retry.hint, 200),
            original_question: candidates[index]?.question_text
          };
        })
      };
    } catch (error) {
      return { retries: [], error: "暫時未能建立重試題。" };
    }
  }

  window.addEventListener("lwwf-math-passport-ready", load);
  window.LWWFWrong = { record, markCorrect, getList, fetchRetries };
})();
