// ============================================================
// LWWF Voice Grader — POE-powered grading + TTS feedback
// ----------------------------------------------------------------
// API:
//   const result = await LWWFVoice.grade({
//     transcript: '學生講的內容',
//     question: '題目',
//     rubric: '評分要點',
//     modelAnswer: '參考答案',
//     chapter: 13
//   });
//   // result = { score, feedback, key_concepts_mentioned, missing_concepts, transcript, provider }
//
//   // 播聲 feedback：
//   LWWFVoice.speak(result.feedback);
//
//   // 一個 helper：跑 Web Speech API 錄音
//   const transcript = await LWWFVoice.record({ lang: 'yue-Hant-HK', timeout_ms: 30000 });
//
//   // ALL-IN-ONE：錄音 + 評分 + 唸 feedback + (可選) 紀錄錯題
//   await LWWFVoice.recordAndGrade({
//     question, rubric, modelAnswer, chapter,
//     onTranscript: (t) => { ... },
//     onResult: (r) => { ... }
//   });
// ============================================================
(function () {
  'use strict';
  if (window.LWWFVoice) return;

  const WORKER_URL = 'https://lwwf-math-ai.lwwfaiteams.workers.dev';

  // ---------- record(): Web Speech API → transcript ----------
  function record({ lang = 'yue-Hant-HK', interim_callback = null, timeout_ms = 30000 } = {}) {
    return new Promise((resolve, reject) => {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) {
        reject(new Error('Browser does not support speech recognition. Please use Chrome / Edge.'));
        return;
      }
      const r = new SR();
      r.lang = lang;
      r.continuous = true;
      r.interimResults = true;
      r.maxAlternatives = 1;

      let finalText = '';
      let triedFallback = false;
      let timer = null;

      r.onresult = (e) => {
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const t = e.results[i][0].transcript;
          if (e.results[i].isFinal) finalText += t;
          else interim += t;
        }
        if (interim_callback) interim_callback(finalText + interim);
      };

      r.onerror = (e) => {
        if (e.error === 'language-not-supported' && !triedFallback) {
          triedFallback = true;
          r.lang = 'zh-HK';
          try { r.start(); return; } catch {}
        }
        if (timer) clearTimeout(timer);
        reject(new Error(`Speech recognition error: ${e.error}`));
      };

      r.onend = () => {
        if (timer) clearTimeout(timer);
        resolve(finalText.trim());
      };

      try {
        r.start();
      } catch (e) {
        reject(new Error(`Could not start mic: ${e.message}`));
        return;
      }

      // Auto-stop after timeout
      timer = setTimeout(() => {
        try { r.stop(); } catch {}
      }, timeout_ms);

      // Expose stop handle for external control
      r._stopHandle = () => {
        if (timer) clearTimeout(timer);
        try { r.stop(); } catch {}
      };
      record._currentRecognizer = r;
    });
  }

  function stopRecording() {
    if (record._currentRecognizer) {
      try { record._currentRecognizer.stop(); } catch {}
      record._currentRecognizer = null;
    }
  }

  // ---------- grade(): transcript → POE → score + feedback ----------
  async function grade({ transcript, question, rubric, modelAnswer, chapter }) {
    if (!transcript || typeof transcript !== 'string') {
      return { score: 0, feedback: '⚠️ 沒有收到錄音內容', error: 'no-transcript' };
    }
    try {
      const res = await fetch(`${WORKER_URL}/voice-grade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ transcript, question, rubric, modelAnswer, chapter }),
      });
      const data = await res.json();
      if (data.error) {
        return { score: 0, feedback: `⚠️ AI 評分失敗：${data.error}`, error: data.error, transcript };
      }
      return data;
    } catch (e) {
      return { score: 0, feedback: `⚠️ 網絡錯誤：${e.message}`, error: e.message, transcript };
    }
  }

  // ---------- speak(): TTS read aloud feedback (free, browser native) ----------
  function speak(text, { lang = 'zh-HK', rate = 0.9, pitch = 1.0 } = {}) {
    if (!('speechSynthesis' in window)) return false;
    if (!text) return false;
    speechSynthesis.cancel();  // stop any prior utterance
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = rate;
    u.pitch = pitch;
    // Try to pick a Cantonese voice if available
    const voices = speechSynthesis.getVoices();
    const cantonese = voices.find(v => /yue|zh-HK|Cantonese/i.test(v.lang) || /Cantonese|香港|HK/i.test(v.name));
    if (cantonese) u.voice = cantonese;
    speechSynthesis.speak(u);
    return true;
  }

  function stopSpeaking() {
    if ('speechSynthesis' in window) speechSynthesis.cancel();
  }

  // ---------- recordAndGrade(): 一條龍 ----------
  async function recordAndGrade({
    question, rubric, modelAnswer, chapter,
    timeout_ms = 30000,
    speakFeedback = true,
    trackWrong = true,
    source = 'voice',
    onTranscript = null,
    onResult = null,
  }) {
    let transcript;
    try {
      transcript = await record({ timeout_ms, interim_callback: onTranscript });
    } catch (e) {
      return { score: 0, feedback: e.message, error: 'mic-failed' };
    }

    if (onTranscript) onTranscript(transcript);

    const result = await grade({ transcript, question, rubric, modelAnswer, chapter });

    if (onResult) onResult(result);
    if (speakFeedback && result.feedback) speak(result.feedback);

    // Auto-track wrong if score < 60
    if (trackWrong && result.score < 60 && window.LWWFWrong) {
      window.LWWFWrong.record({
        chapter, question, correct_answer: modelAnswer || '(口頭題)',
        student_answer: transcript, source,
      }).catch(() => null);
    }

    return result;
  }

  // ---------- public API ----------
  window.LWWFVoice = {
    record,
    stopRecording,
    grade,
    speak,
    stopSpeaking,
    recordAndGrade,
  };
})();
