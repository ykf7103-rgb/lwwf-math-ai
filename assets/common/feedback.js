// ============================================================
// 回報 / 許願 功能（家長 + 學生 可以提交 bug / feature wish）
// 簡單用法：將本 script include 入任何 page，就會自動加 floating button
//   <script src="path/to/assets/common/feedback.js"></script>
// 需要 Supabase table student_feedback（migration SQL 喺 /supabase/feedback_table_migration.sql）
// ============================================================

(function() {
  const SUPABASE_URL = 'https://ygpsvwughqstubwxhzoe.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlncHN2d3VnaHFzdHVid3hoem9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMTM3NzUsImV4cCI6MjA5MTg4OTc3NX0.DBsx2945F0Vdfhptx-Tr9mVqaa2i9jE4tMQIvjffvII';

  // ---- Inject CSS ----
  const style = document.createElement('style');
  style.textContent = `
    .fb-float-btn {
      position: fixed; bottom: 20px; right: 20px; z-index: 9999;
      background: linear-gradient(135deg, #FF6F00, #E65100);
      color: white; border: none; padding: 12px 18px;
      border-radius: 28px; font-size: 0.95rem; font-weight: 800;
      cursor: pointer; box-shadow: 0 6px 18px rgba(230,81,0,0.4);
      display: flex; align-items: center; gap: 6px;
      transition: all 0.2s;
      font-family: -apple-system, 'PingFang TC', 'Microsoft JhengHei', sans-serif;
    }
    .fb-float-btn:hover { transform: translateY(-2px); box-shadow: 0 10px 24px rgba(230,81,0,0.5); }
    .fb-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.6);
      display: none; align-items: center; justify-content: center;
      z-index: 10000; padding: 20px;
      font-family: -apple-system, 'PingFang TC', 'Microsoft JhengHei', sans-serif;
    }
    .fb-overlay.show { display: flex; animation: fbFade 0.25s; }
    @keyframes fbFade { from {opacity:0} to {opacity:1} }
    .fb-modal {
      background: white; border-radius: 18px; padding: 24px;
      max-width: 480px; width: 100%;
      box-shadow: 0 16px 48px rgba(0,0,0,0.3);
      max-height: 90vh; overflow-y: auto;
    }
    .fb-modal h2 { margin: 0 0 10px; color: #E65100; font-size: 1.3rem; }
    .fb-modal .fb-desc { color: #666; font-size: 0.9rem; margin-bottom: 16px; line-height: 1.5; }
    .fb-type-row { display: flex; gap: 10px; margin-bottom: 14px; }
    .fb-type-btn {
      flex: 1; padding: 12px 10px; border: 2px solid #E0E0E0;
      background: white; border-radius: 12px; cursor: pointer;
      font-weight: 700; color: #333; font-size: 0.95rem;
      display: flex; flex-direction: column; align-items: center; gap: 4px;
      transition: all 0.15s;
    }
    .fb-type-btn:hover { border-color: #FF9800; }
    .fb-type-btn.active { border-color: #E65100; background: linear-gradient(135deg,#FFF3E0,#FFE0B2); color: #E65100; }
    .fb-type-btn .emoji { font-size: 1.5rem; }
    .fb-field { margin-bottom: 12px; }
    .fb-field label { display: block; font-size: 0.85rem; color: #555; font-weight: 700; margin-bottom: 4px; }
    .fb-field input, .fb-field textarea {
      width: 100%; padding: 10px 12px; border: 2px solid #E0E0E0;
      border-radius: 8px; font-size: 0.95rem; font-family: inherit;
      outline: none; transition: border 0.15s;
      box-sizing: border-box;
    }
    .fb-field input:focus, .fb-field textarea:focus { border-color: #FF9800; }
    .fb-field textarea { min-height: 90px; resize: vertical; }
    .fb-row { display: flex; gap: 8px; }
    .fb-row > div { flex: 1; }
    .fb-btn-row { display: flex; gap: 10px; margin-top: 12px; }
    .fb-btn {
      flex: 1; padding: 12px; border: none; border-radius: 10px;
      font-weight: 800; cursor: pointer; font-size: 1rem;
      font-family: inherit; transition: all 0.15s;
    }
    .fb-btn-submit { background: linear-gradient(135deg, #4CAF50, #2E7D32); color: white; }
    .fb-btn-submit:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 10px rgba(46,125,50,0.4); }
    .fb-btn-submit:disabled { opacity: 0.5; cursor: not-allowed; }
    .fb-btn-cancel { background: #F5F5F5; color: #666; }
    .fb-btn-cancel:hover { background: #E0E0E0; }
    .fb-success, .fb-error { padding: 12px; border-radius: 8px; margin-top: 10px; font-weight: 700; }
    .fb-success { background: #E8F5E9; color: #2E7D32; border: 2px solid #4CAF50; }
    .fb-error { background: #FFEBEE; color: #C62828; border: 2px solid #F44336; }
    .fb-hint { background: #FFF8E1; border-left: 4px solid #FFC107; padding: 8px 12px; border-radius: 6px; font-size: 0.82rem; color: #666; margin-top: 8px; line-height: 1.5; }
    @media (max-width: 500px) {
      .fb-float-btn { padding: 10px 14px; font-size: 0.85rem; bottom: 14px; right: 14px; }
    }
  `;
  document.head.appendChild(style);

  // ---- Inject button + modal ----
  const btn = document.createElement('button');
  btn.className = 'fb-float-btn';
  btn.innerHTML = '📨 回報 / 許願';
  btn.onclick = openFeedback;
  document.body.appendChild(btn);

  const overlay = document.createElement('div');
  overlay.className = 'fb-overlay';
  overlay.id = 'fbOverlay';
  overlay.innerHTML = `
    <div class="fb-modal" onclick="event.stopPropagation()">
      <h2>📨 回報 / 許願</h2>
      <p class="fb-desc">見到 bug？想要新功能？話我哋知！楊老師會定期睇。</p>

      <div class="fb-type-row">
        <button class="fb-type-btn active" id="fbTypeBug" onclick="window.__fbSetType('bug')">
          <span class="emoji">🐛</span>
          <span>回報問題<br><span style="font-size:0.75rem;color:#888;font-weight:400;">（網站壞咗）</span></span>
        </button>
        <button class="fb-type-btn" id="fbTypeWish" onclick="window.__fbSetType('wish')">
          <span class="emoji">🌟</span>
          <span>許願<br><span style="font-size:0.75rem;color:#888;font-weight:400;">（想要新功能）</span></span>
        </button>
      </div>

      <div class="fb-row">
        <div class="fb-field">
          <label>班別（可選）</label>
          <input type="text" id="fbClass" placeholder="例：5F" />
        </div>
        <div class="fb-field">
          <label>學號（可選）</label>
          <input type="text" id="fbNumber" placeholder="例：01" />
        </div>
      </div>

      <div class="fb-field">
        <label id="fbContentLabel">問題內容 <span style="color:#C62828">*</span></label>
        <textarea id="fbContent" placeholder="具體描述遇到嘅問題..." maxlength="2000"></textarea>
        <div class="fb-hint" id="fbHint">💡 <b>好嘅回報包括</b>：1) 喺邊一頁？ 2) 按咗乜？ 3) 出現乜錯誤？</div>
      </div>

      <div id="fbResult"></div>

      <div class="fb-btn-row">
        <button class="fb-btn fb-btn-cancel" onclick="window.__fbClose()">取消</button>
        <button class="fb-btn fb-btn-submit" id="fbSubmitBtn" onclick="window.__fbSubmit()">提交</button>
      </div>
    </div>
  `;
  overlay.onclick = () => window.__fbClose();
  document.body.appendChild(overlay);

  // ---- State ----
  let currentType = 'bug';

  // ---- Helpers ----
  window.__fbSetType = function(type) {
    currentType = type;
    document.getElementById('fbTypeBug').classList.toggle('active', type === 'bug');
    document.getElementById('fbTypeWish').classList.toggle('active', type === 'wish');
    const label = document.getElementById('fbContentLabel');
    const hint = document.getElementById('fbHint');
    const textarea = document.getElementById('fbContent');
    if (type === 'bug') {
      label.innerHTML = '問題內容 <span style="color:#C62828">*</span>';
      hint.innerHTML = '💡 <b>好嘅回報包括</b>：1) 喺邊一頁？ 2) 按咗乜？ 3) 出現乜錯誤？';
      textarea.placeholder = '具體描述遇到嘅問題，例：「第13課預習1，按咗開始錄音之後冇反應，screen 一片白」';
    } else {
      label.innerHTML = '你想要乜新功能？ <span style="color:#C62828">*</span>';
      hint.innerHTML = '💡 可以係任何諗法！例：新遊戲、新功能、內容、角色、聲音...';
      textarea.placeholder = '例：「想有一個迷宮遊戲，要答啱小數題先可以走下一步」';
    }
  };

  function openFeedback() {
    // Auto-fill class/number if logged in
    try {
      const user = JSON.parse(localStorage.getItem('mathai_user') || sessionStorage.getItem('mathai_user') || 'null');
      if (user) {
        document.getElementById('fbClass').value = user.class || '';
        document.getElementById('fbNumber').value = user.number || '';
      }
    } catch(e) {}
    document.getElementById('fbContent').value = '';
    document.getElementById('fbResult').innerHTML = '';
    overlay.classList.add('show');
  }

  window.__fbClose = function() {
    overlay.classList.remove('show');
  };

  window.__fbSubmit = async function() {
    const content = document.getElementById('fbContent').value.trim();
    const cls = document.getElementById('fbClass').value.trim();
    const num = document.getElementById('fbNumber').value.trim();
    const resultEl = document.getElementById('fbResult');
    const submitBtn = document.getElementById('fbSubmitBtn');

    if (content.length < 5) {
      resultEl.innerHTML = '<div class="fb-error">⚠️ 請至少寫 5 個字。</div>';
      return;
    }
    if (content.length > 2000) {
      resultEl.innerHTML = '<div class="fb-error">⚠️ 內容太長（最多 2000 字）。</div>';
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = '提交中...';
    resultEl.innerHTML = '';

    const body = {
      type: currentType,
      class: cls || null,
      number: num || null,
      student_name: null,
      page: location.pathname + location.hash,
      content,
      browser_info: `${navigator.userAgent.slice(0,300)} | ${window.innerWidth}x${window.innerHeight}`,
    };

    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/student_feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errTxt = await res.text().catch(() => '');
        // If table missing (404/400 on schema), give friendly message
        if (res.status === 404 || /does not exist|student_feedback/.test(errTxt)) {
          throw new Error('資料表未建立（老師：請去 Supabase 跑一次 /supabase/feedback_table_migration.sql）');
        }
        throw new Error(`HTTP ${res.status}: ${errTxt.slice(0, 120)}`);
      }
      resultEl.innerHTML = `<div class="fb-success">
        ✅ ${currentType === 'bug' ? '已收到你嘅問題回報' : '已收到你嘅許願'}！<br>
        <span style="font-size:0.85rem;font-weight:400;">楊老師會盡快睇。多謝你幫我哋改進網站 🙏</span>
      </div>`;
      submitBtn.textContent = '✓ 已提交';
      setTimeout(() => {
        window.__fbClose();
        submitBtn.disabled = false;
        submitBtn.textContent = '提交';
      }, 2500);
    } catch(e) {
      resultEl.innerHTML = `<div class="fb-error">❌ 提交失敗：${e.message}</div>`;
      submitBtn.disabled = false;
      submitBtn.textContent = '提交';
    }
  };
})();
