// ============================================================
// Speech-to-Text auto-injector for prelearn 錄音題 pages
// 用法：<script src="../common/stt.js"></script> at end of body
// 自動喺任何有 #textFallback 嘅 page 加 🎙️ 語音輸入 button
// 用 Web Speech API（webkitSpeechRecognition）
// ============================================================
(function() {
  function inject() {
    const ta = document.getElementById('textFallback');
    if (!ta) return;
    if (document.getElementById('sttBtn')) return;  // already injected

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

    // Find the parent container of textFallback
    const container = ta.parentElement;

    // Find the existing submit button (打字提交) — usually right after textarea
    const submitBtn = container.querySelector('button[onclick*="submitText"]');

    // Build STT button
    const sttBtn = document.createElement('button');
    sttBtn.id = 'sttBtn';
    sttBtn.className = 'btn outline';
    sttBtn.style.cssText = 'border:2px solid #9C27B0;color:#6A1B9A;background:white;margin-left:8px;';
    sttBtn.textContent = '🎙️ 語音輸入';

    // Status div
    const statusDiv = document.createElement('div');
    statusDiv.id = 'sttStatus';
    statusDiv.style.cssText = 'margin-top:6px;font-size:0.82rem;color:#999;min-height:1.2em;';

    if (submitBtn) {
      submitBtn.parentNode.insertBefore(sttBtn, submitBtn.nextSibling);
      submitBtn.parentNode.insertBefore(statusDiv, sttBtn.nextSibling);
    } else {
      container.appendChild(sttBtn);
      container.appendChild(statusDiv);
    }

    if (!SR) {
      sttBtn.disabled = true;
      sttBtn.style.opacity = '0.5';
      sttBtn.title = '你個瀏覽器唔支援語音輸入';
    }

    // === STT logic ===
    let stt = null, listening = false;

    sttBtn.onclick = function() {
      const status = document.getElementById('sttStatus');
      if (!SR) {
        status.innerHTML = '<span style="color:#C62828;">⚠️ 唔支援。請用 Chrome / Edge / Safari。</span>';
        return;
      }
      if (listening) {
        try { stt.stop(); } catch(e) {}
        listening = false;
        sttBtn.textContent = '🎙️ 語音輸入';
        sttBtn.style.background = 'white';
        status.textContent = '';
        return;
      }
      stt = new SR();
      stt.lang = 'yue-Hant-HK';  // Cantonese
      stt.continuous = true;
      stt.interimResults = true;
      let finalTranscript = ta.value;
      let triedFallback = false;

      stt.onstart = () => { status.innerHTML = '🎤 講啦... 撳「⏹ 停止」即停。'; };
      stt.onresult = (e) => {
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const t = e.results[i][0].transcript;
          if (e.results[i].isFinal) finalTranscript += t;
          else interim += t;
        }
        ta.value = finalTranscript + interim;
      };
      stt.onerror = (e) => {
        if (e.error === 'language-not-supported' && !triedFallback) {
          triedFallback = true;
          stt.lang = 'zh-HK';
          try { stt.start(); return; } catch(e2) {}
        }
        if (e.error === 'no-speech') {
          status.innerHTML = '<span style="color:#FB8C00;">🤐 聽唔到聲，講大聲啲？</span>';
          return;
        }
        status.innerHTML = `<span style="color:#C62828;">⚠️ ${e.error}。試吓改用打字。</span>`;
        listening = false;
        sttBtn.textContent = '🎙️ 語音輸入';
        sttBtn.style.background = 'white';
      };
      stt.onend = () => {
        if (listening) {
          try { stt.start(); } catch(e) { listening = false; }
        }
        if (!listening) {
          sttBtn.textContent = '🎙️ 語音輸入';
          sttBtn.style.background = 'white';
        }
      };

      try {
        stt.start();
        listening = true;
        sttBtn.textContent = '⏹ 停止語音輸入';
        sttBtn.style.background = '#FFEBEE';
      } catch(e) {
        status.innerHTML = `<span style="color:#C62828;">⚠️ 開唔到 mic：${e.message}</span>`;
      }
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inject);
  else inject();
})();
