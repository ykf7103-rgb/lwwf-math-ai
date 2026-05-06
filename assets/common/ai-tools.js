// ============================================================
// LWWF AI Tools — POE-powered helpers for ai-help.html
// ----------------------------------------------------------------
// 用法：
//   <script src="../common/voice-grader.js"></script>
//   <script src="../common/wrong-tracker.js"></script>
//   <script src="../common/ai-tools.js"></script>
//
//   <!-- 在 ai-help.html 加 3 個掣 -->
//   <div class="ai-tools-row">
//     <button onclick="LWWFAITools.openOcr()">📷 拍題目自動轉 MC</button>
//     <button onclick="LWWFAITools.openWrongList(13)">📝 我的錯題練習</button>
//     <button id="speakBtn">🔊 唸返這條題目</button>
//   </div>
//   <div id="ai-tools-modal-host"></div>
//
// 自動建立全部 modal 同 handlers。
// ============================================================
(function () {
  'use strict';
  if (window.LWWFAITools) return;

  const WORKER_URL = 'https://lwwf-math-ai.lwwfaiteams.workers.dev';

  // ---------- shared modal infrastructure ----------
  function ensureHost() {
    let host = document.getElementById('ai-tools-modal-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'ai-tools-modal-host';
      document.body.appendChild(host);
    }
    return host;
  }

  function injectStyles() {
    if (document.getElementById('lwwf-ai-tools-styles')) return;
    const css = `
.ait-modal{position:fixed;inset:0;background:rgba(0,0,0,0.65);display:flex;align-items:center;
  justify-content:center;z-index:9999;padding:14px;animation:aitFade 0.2s}
@keyframes aitFade{from{opacity:0}to{opacity:1}}
.ait-card{background:#fff;border-radius:18px;padding:22px;max-width:480px;width:100%;
  max-height:90vh;overflow-y:auto;box-shadow:0 12px 40px rgba(0,0,0,0.4);
  border:3px solid #FFD700;font-family:'Noto Sans TC','Microsoft JhengHei',sans-serif}
.ait-card h2{margin:0 0 12px;color:#4A148C;font-size:1.3rem;font-weight:900}
.ait-card .ait-close{float:right;background:none;border:none;font-size:24px;cursor:pointer;color:#888}
.ait-card .ait-status{padding:10px 14px;background:#E1BEE7;border-radius:10px;
  color:#4A148C;font-weight:700;text-align:center;margin-bottom:12px}
.ait-card .ait-status.error{background:#FFCDD2;color:#C62828}
.ait-card .ait-status.success{background:#C8E6C9;color:#2E7D32}
.ait-card label.ait-fileinput{display:block;padding:24px;border:3px dashed #9C27B0;
  border-radius:12px;text-align:center;cursor:pointer;background:#F3E5F5;color:#4A148C;
  font-weight:700;transition:all 0.2s}
.ait-card label.ait-fileinput:hover{background:#E1BEE7;transform:translateY(-2px)}
.ait-card label.ait-fileinput input{display:none}
.ait-card .ait-question{padding:14px 16px;background:#FFF8E1;border:2px solid #FFC107;
  border-radius:10px;font-weight:700;color:#5D4037;margin-bottom:12px;font-size:1.05rem}
.ait-card .ait-options{display:flex;flex-direction:column;gap:8px;margin-bottom:12px}
.ait-card .ait-option{padding:12px 16px;background:#fff;border:2px solid #BA68C8;
  border-radius:10px;cursor:pointer;text-align:left;font-weight:700;color:#4A148C;
  transition:all 0.2s}
.ait-card .ait-option:hover:not(:disabled){background:#F3E5F5;transform:translateX(4px)}
.ait-card .ait-option.right{background:#C8E6C9;border-color:#2E7D32;color:#1B5E20}
.ait-card .ait-option.wrong{background:#FFCDD2;border-color:#C62828;color:#B71C1C}
.ait-card .ait-explain{padding:10px 14px;background:#E3F2FD;border-radius:8px;
  color:#0D47A1;font-size:0.95rem;line-height:1.55;margin-bottom:12px;display:none}
.ait-card .ait-explain.show{display:block}
.ait-card .ait-retry-item{padding:14px;background:#FFF3E0;border:2px solid #FF9800;
  border-radius:10px;margin-bottom:10px}
.ait-card .ait-retry-item .ait-orig{font-size:0.85rem;color:#888;margin-bottom:6px}
.ait-card .ait-retry-item .ait-q{font-weight:700;color:#5D4037;font-size:1.05rem;margin-bottom:6px}
.ait-card .ait-retry-item .ait-hint{font-size:0.9rem;color:#FB8C00;font-style:italic;margin-bottom:8px}
.ait-card .ait-retry-item .ait-input-row{display:flex;gap:6px}
.ait-card .ait-retry-item input{flex:1;padding:8px 10px;border:2px solid #FF9800;border-radius:8px;font-size:0.95rem}
.ait-card .ait-retry-item button{padding:8px 14px;background:#FF9800;color:#fff;border:none;border-radius:8px;font-weight:700;cursor:pointer}
    `;
    const style = document.createElement('style');
    style.id = 'lwwf-ai-tools-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function openModal(html) {
    injectStyles();
    const host = ensureHost();
    host.innerHTML = `<div class="ait-modal" onclick="if(event.target===this) LWWFAITools.closeModal()"><div class="ait-card">${html}</div></div>`;
  }
  function closeModal() {
    const host = ensureHost();
    host.innerHTML = '';
  }

  // ---------- 📷 OCR — 拍題目自動轉 MC ----------
  async function openOcr() {
    openModal(`
      <button class="ait-close" onclick="LWWFAITools.closeModal()">×</button>
      <h2>📷 拍題目自動轉 MC</h2>
      <p style="color:#666;margin-bottom:12px;font-size:0.92rem;line-height:1.6">
        選張題目相片（課本／工作紙），AI 會自動辨認題目，幫你出 4 選 1 的 MC 練習題。
      </p>
      <label class="ait-fileinput">
        📷 選相片 / 影相
        <input type="file" accept="image/*" onchange="LWWFAITools._handleOcrFile(event)">
      </label>
      <div id="ait-ocr-status"></div>
      <div id="ait-ocr-result"></div>
    `);
  }

  async function _handleOcrFile(ev) {
    const file = ev.target.files?.[0];
    if (!file) return;
    const status = document.getElementById('ait-ocr-status');
    status.className = 'ait-status';
    status.innerHTML = '🤖 上載 + 辨識題目中...（10-30 秒）';

    try {
      // Read file as dataURL
      const dataUrl = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.onerror = () => rej(new Error('read failed'));
        r.readAsDataURL(file);
      });

      // POST to worker
      const r = await fetch(`${WORKER_URL}/ocr-question`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ image: dataUrl, chapter: window.LWWF_CURRENT_CHAPTER || null }),
      });
      const data = await r.json();
      if (data.error) throw new Error(data.error);

      status.className = 'ait-status success';
      status.innerHTML = `✅ 辨識成功（${data.provider}）`;

      const html = `
        <div class="ait-question">${data.question}</div>
        <div class="ait-options" id="ait-ocr-opts">
          ${(data.options || []).map((opt, i) => `<button class="ait-option" data-i="${i}" onclick="LWWFAITools._answerOcr(${i}, ${data.answer_index})">${'ABCD'[i]}. ${opt}</button>`).join('')}
        </div>
        <div class="ait-explain" id="ait-ocr-explain">${data.explanation || ''}</div>
      `;
      document.getElementById('ait-ocr-result').innerHTML = html;
    } catch (e) {
      status.className = 'ait-status error';
      status.innerHTML = `❌ 失敗：${e.message}`;
    }
  }

  function _answerOcr(picked, correct) {
    const buttons = document.querySelectorAll('#ait-ocr-opts .ait-option');
    buttons.forEach((b, i) => {
      b.disabled = true;
      if (i === picked) b.classList.add(picked === correct ? 'right' : 'wrong');
      if (i === correct && picked !== correct) b.classList.add('right');
    });
    document.getElementById('ait-ocr-explain').classList.add('show');
  }

  // ---------- 📝 個人化錯題練習 ----------
  async function openWrongList(chapter) {
    chapter = chapter || window.LWWF_CURRENT_CHAPTER || 13;
    openModal(`
      <button class="ait-close" onclick="LWWFAITools.closeModal()">×</button>
      <h2>📝 我的錯題練習</h2>
      <div id="ait-wl-status" class="ait-status">⏳ 載入錯題中...</div>
      <div id="ait-wl-result"></div>
    `);

    const status = document.getElementById('ait-wl-status');

    if (!window.LWWFWrong) {
      status.className = 'ait-status error';
      status.innerHTML = '❌ wrong-tracker.js 未載入';
      return;
    }

    try {
      const data = await window.LWWFWrong.fetchRetries(chapter, 3);
      if (!data.retries || data.retries.length === 0) {
        status.className = 'ait-status success';
        status.innerHTML = data.message || '🎉 無錯題！繼續加油！';
        return;
      }

      status.className = 'ait-status success';
      status.innerHTML = `✅ POE 出了 ${data.retries.length} 條 retry 題（${data.provider}）`;

      const html = data.retries.map((r, idx) => `
        <div class="ait-retry-item" data-id="${r.id}">
          <div class="ait-orig">原題：${r.original_question || '(無)'}</div>
          <div class="ait-q">📝 ${r.question}</div>
          <div class="ait-hint">💡 ${r.hint || ''}</div>
          <div class="ait-input-row">
            <input id="ait-wl-ans-${idx}" placeholder="你的答案">
            <button onclick="LWWFAITools._checkRetry(${idx}, ${JSON.stringify(String(r.answer)).replace(/"/g, '&quot;')}, ${r.id || 'null'})">提交</button>
          </div>
          <div class="ait-explain" id="ait-wl-fb-${idx}"></div>
        </div>
      `).join('');
      document.getElementById('ait-wl-result').innerHTML = html;
    } catch (e) {
      status.className = 'ait-status error';
      status.innerHTML = `❌ 失敗：${e.message}`;
    }
  }

  function _checkRetry(idx, correctAnswer, rowId) {
    const input = document.getElementById(`ait-wl-ans-${idx}`);
    const fb = document.getElementById(`ait-wl-fb-${idx}`);
    const userAns = (input.value || '').trim();
    const norm = s => String(s).replace(/\s+/g, '').replace(/[元米個$]/g, '');
    const isRight = norm(userAns) === norm(correctAnswer);
    fb.classList.add('show');
    if (isRight) {
      fb.style.background = '#C8E6C9';
      fb.style.color = '#1B5E20';
      fb.innerHTML = `✅ 正確！正確答案 = ${correctAnswer}`;
      if (rowId && window.LWWFWrong) {
        window.LWWFWrong.markCorrect(rowId).catch(() => null);
      }
    } else {
      fb.style.background = '#FFCDD2';
      fb.style.color = '#B71C1C';
      fb.innerHTML = `❌ 不對。正確答案 = <b>${correctAnswer}</b>。再試一次！`;
    }
  }

  // ---------- 🔊 TTS 唸題目 ----------
  function speak(text, opts) {
    if (window.LWWFVoice && window.LWWFVoice.speak) {
      return window.LWWFVoice.speak(text, opts);
    }
    // Fallback inline
    if (!('speechSynthesis' in window)) return false;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = (opts && opts.lang) || 'zh-HK';
    u.rate = (opts && opts.rate) || 0.9;
    speechSynthesis.speak(u);
    return true;
  }

  function stopSpeaking() {
    if ('speechSynthesis' in window) speechSynthesis.cancel();
  }

  // ---------- public API ----------
  window.LWWFAITools = {
    openOcr,
    openWrongList,
    speak,
    stopSpeaking,
    closeModal,
    _handleOcrFile,
    _answerOcr,
    _checkRetry,
  };
})();
