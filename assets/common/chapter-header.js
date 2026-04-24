// ============================================================
// Shared chapter header v2 — adds 🏠主頁 + 🔀課堂 dropdown +
//   👤 學生姓名 + 🪙 金幣總數（cross-chapter） + 登入/登出
// Usage: <script src="../common/chapter-header.js" data-current-ch="13"></script>
// ============================================================
(function() {
  const scriptEl = document.currentScript;
  const currentCh = scriptEl?.dataset?.currentCh || (() => {
    const m = location.pathname.match(/\/ch(\d+)\//);
    return m ? m[1] : '12';
  })();

  const CHAPTERS = [
    { id: '12', title: '第12課 · 小數加減', href: '../../index.html?ch=12' },
    { id: '13', title: '第13課 · 小數乘法（一）', href: '../ch13/index.html' },
    { id: '14', title: '第14課 · 小數乘法（二）', href: '../ch14/index.html' },
  ];

  function buildHref(targetCh) {
    const subPageMatch = location.pathname.match(/\/ch\d+\/([^/?]+)$/);
    const subPage = subPageMatch ? subPageMatch[1] : 'index.html';
    if (targetCh === '12') {
      return '../../index.html?ch=12';
    }
    return `../ch${targetCh}/${subPage}`;
  }

  // Read user from storage
  function getUser() {
    try {
      return JSON.parse(localStorage.getItem('mathai_user') || sessionStorage.getItem('mathai_user') || 'null');
    } catch(e) { return null; }
  }

  // Compute total coins across all chapters from localStorage scores
  function getTotalCoins(user) {
    if (!user) return 0;
    let total = 0;
    try {
      const key = `scores_${user.class}_${user.number}`;
      const scores = JSON.parse(localStorage.getItem(key) || '{}');
      Object.values(scores).forEach(s => {
        if (typeof s === 'object' && s !== null) {
          if (typeof s.coins === 'number') total += s.coins;
          else if (typeof s.score === 'number') total += s.score;
        }
      });
    } catch(e) {}
    return total;
  }

  const style = document.createElement('style');
  style.textContent = `
    .ch-header {
      display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
      margin-bottom: 12px; padding: 8px 10px;
      background: rgba(255,255,255,0.96);
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      font-family: -apple-system, 'PingFang TC', 'Microsoft JhengHei', sans-serif;
      position: sticky; top: 0; z-index: 50;
    }
    .ch-header .ch-home {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 6px 11px; background: #1565C0; color: white;
      border-radius: 8px; text-decoration: none; font-weight: 700;
      font-size: 0.85rem; border: none; cursor: pointer;
      font-family: inherit;
    }
    .ch-header .ch-home:hover { background: #0D47A1; }
    .ch-header .ch-select {
      padding: 6px 8px; border-radius: 8px; border: 2px solid #FF9800;
      background: white; font-weight: 700; font-size: 0.85rem;
      color: #E65100; cursor: pointer; font-family: inherit;
      outline: none;
      max-width: 160px;
    }
    .ch-header .ch-select:focus { border-color: #E65100; box-shadow: 0 0 0 3px rgba(255,152,0,0.2); }
    .ch-header .ch-spacer { flex: 1; min-width: 8px; }
    .ch-header .ch-user {
      display: inline-flex; align-items: center; gap: 5px;
      font-size: 0.82rem; color: #333; background: linear-gradient(135deg,#FFF3E0,#FFE0B2);
      padding: 5px 11px; border-radius: 16px;
      border: 1.5px solid #FFB74D;
      font-weight: 700;
    }
    .ch-header .ch-coins {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: 0.82rem; color: #E65100; background: linear-gradient(135deg,#FFF8E1,#FFECB3);
      padding: 5px 10px; border-radius: 16px;
      border: 1.5px solid #FFC107;
      font-weight: 800;
    }
    .ch-header .ch-coins img { width: 16px; height: 16px; }
    .ch-header .ch-login {
      padding: 5px 12px; background: #4CAF50; color: white;
      border: none; border-radius: 8px; font-weight: 700;
      font-size: 0.82rem; cursor: pointer; font-family: inherit;
    }
    .ch-header .ch-login:hover { background: #2E7D32; }
    .ch-header .ch-logout {
      padding: 4px 8px; background: transparent; color: #999;
      border: 1px solid #ccc; border-radius: 6px;
      font-size: 0.72rem; cursor: pointer; font-family: inherit;
    }
    .ch-header .ch-logout:hover { background: #F5F5F5; color: #666; }
    @media (max-width: 640px) {
      .ch-header { padding: 6px 8px; gap: 5px; }
      .ch-header .ch-home { padding: 5px 9px; font-size: 0.78rem; }
      .ch-header .ch-select { font-size: 0.78rem; padding: 5px 6px; max-width: 130px; }
      .ch-header .ch-user { font-size: 0.75rem; padding: 4px 8px; }
      .ch-header .ch-coins { font-size: 0.75rem; padding: 4px 8px; }
      .ch-header .ch-coins img { width: 14px; height: 14px; }
    }
    @media (max-width: 420px) {
      .ch-header .ch-home span.lbl { display: none; }
    }

    /* Login modal */
    .ch-login-ov {
      position: fixed; inset: 0; background: rgba(0,0,0,0.5);
      display: none; align-items: center; justify-content: center;
      z-index: 9999; padding: 16px;
    }
    .ch-login-ov.show { display: flex; animation: chFade 0.2s; }
    @keyframes chFade { from { opacity: 0; } to { opacity: 1; } }
    .ch-login-modal {
      background: white; border-radius: 16px; padding: 20px;
      max-width: 360px; width: 100%;
      box-shadow: 0 10px 30px rgba(0,0,0,0.25);
    }
    .ch-login-modal h3 { margin: 0 0 10px; color: #1565C0; font-size: 1.1rem; }
    .ch-login-modal .row { margin-bottom: 10px; }
    .ch-login-modal label { display: block; font-size: 0.82rem; color: #555; font-weight: 700; margin-bottom: 4px; }
    .ch-login-modal input {
      width: 100%; padding: 9px 10px; border: 2px solid #E0E0E0;
      border-radius: 8px; font-size: 0.95rem; outline: none;
      font-family: inherit;
    }
    .ch-login-modal input:focus { border-color: #1565C0; }
    .ch-login-modal .btn-row { display: flex; gap: 8px; margin-top: 14px; }
    .ch-login-modal .btn-row button {
      flex: 1; padding: 9px; border: none; border-radius: 8px;
      font-weight: 800; cursor: pointer; font-size: 0.9rem; font-family: inherit;
    }
    .ch-login-modal .ch-btn-ok { background: #1565C0; color: white; }
    .ch-login-modal .ch-btn-cancel { background: #F5F5F5; color: #666; }
  `;
  document.head.appendChild(style);

  const header = document.createElement('div');
  header.className = 'ch-header';

  const home = document.createElement('a');
  home.className = 'ch-home';
  home.href = '../../index.html';
  home.innerHTML = '🏠 <span class="lbl">主頁</span>';
  header.appendChild(home);

  const select = document.createElement('select');
  select.className = 'ch-select';
  CHAPTERS.forEach(ch => {
    const opt = document.createElement('option');
    opt.value = ch.id;
    opt.textContent = ch.title;
    if (ch.id === currentCh) opt.selected = true;
    select.appendChild(opt);
  });
  select.addEventListener('change', () => {
    const target = select.value;
    if (target === currentCh) return;
    location.href = buildHref(target);
  });
  header.appendChild(select);

  const spacer = document.createElement('div');
  spacer.className = 'ch-spacer';
  header.appendChild(spacer);

  // User info + coins — rendered dynamically
  const userSlot = document.createElement('div');
  userSlot.id = 'chUserSlot';
  userSlot.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;align-items:center;';
  header.appendChild(userSlot);

  function renderUserSlot() {
    const user = getUser();
    userSlot.innerHTML = '';
    if (user && (user.class || user.number)) {
      // Try to find chapter-specific coin image
      const chImg = (currentCh >= '12') ? `../ch${currentCh}/images/coin_new.png` : '../ch12/images/coin_new.png';
      const coins = getTotalCoins(user);
      const nameStr = user.name ? `${user.name} (${user.class || ''}${user.number || ''})` : `${user.class || ''}${user.number || ''}`;
      userSlot.innerHTML = `
        <span class="ch-user">👤 ${nameStr}</span>
        <span class="ch-coins"><img src="${chImg}" alt="🪙" onerror="this.src='../ch12/images/coin_new.png'"> ${coins}</span>
        <button class="ch-logout" onclick="window.__chLogout()">登出</button>
      `;
    } else {
      userSlot.innerHTML = `<button class="ch-login" onclick="window.__chLoginOpen()">👤 登入</button>`;
    }
  }

  // Build login modal
  const loginOv = document.createElement('div');
  loginOv.className = 'ch-login-ov';
  loginOv.innerHTML = `
    <div class="ch-login-modal" onclick="event.stopPropagation()">
      <h3>👤 登入</h3>
      <p style="margin:4px 0 12px;color:#666;font-size:0.85rem;">輸入班別 + 學號，你的進度同金幣會同步。</p>
      <div class="row">
        <label>班別</label>
        <input type="text" id="chLoginClass" placeholder="例：5F" maxlength="10">
      </div>
      <div class="row">
        <label>學號</label>
        <input type="text" id="chLoginNum" placeholder="例：01" maxlength="5">
      </div>
      <div class="row">
        <label>暱稱（可選）</label>
        <input type="text" id="chLoginName" placeholder="例：小明" maxlength="20">
      </div>
      <div class="btn-row">
        <button class="ch-btn-cancel" onclick="window.__chLoginClose()">取消</button>
        <button class="ch-btn-ok" onclick="window.__chLoginSubmit()">✓ 登入</button>
      </div>
    </div>
  `;
  loginOv.addEventListener('click', () => window.__chLoginClose());
  document.body.appendChild(loginOv);

  window.__chLoginOpen = function() {
    loginOv.classList.add('show');
    setTimeout(() => document.getElementById('chLoginClass')?.focus(), 100);
  };
  window.__chLoginClose = function() { loginOv.classList.remove('show'); };
  window.__chLoginSubmit = function() {
    const cls = document.getElementById('chLoginClass').value.trim().toUpperCase();
    const num = document.getElementById('chLoginNum').value.trim();
    const name = document.getElementById('chLoginName').value.trim();
    if (!cls || !num) { alert('班別同學號都要填！'); return; }
    const user = { class: cls, number: num, name: name || null };
    localStorage.setItem('mathai_user', JSON.stringify(user));
    sessionStorage.setItem('mathai_user', JSON.stringify(user));
    loginOv.classList.remove('show');
    renderUserSlot();
    // Reload page to refresh any chapter-specific logic
    setTimeout(() => location.reload(), 300);
  };
  window.__chLogout = function() {
    if (!confirm('確定要登出？進度仍會保留喺本機。')) return;
    localStorage.removeItem('mathai_user');
    sessionStorage.removeItem('mathai_user');
    renderUserSlot();
    setTimeout(() => location.reload(), 300);
  };

  // Listen for storage changes (e.g. another tab logs in/out)
  window.addEventListener('storage', e => {
    if (e.key === 'mathai_user' || e.key?.startsWith('scores_')) renderUserSlot();
  });

  function mount() {
    const wrap = document.querySelector('.wrap');
    const parent = wrap || document.body;
    if (parent.firstChild) parent.insertBefore(header, parent.firstChild);
    else parent.appendChild(header);

    // Hide old "← 返回主頁" button (replaced)
    document.querySelectorAll('a.back, a.back-btn, .back-home').forEach(el => {
      if (/index\.html$/.test(el.getAttribute('href') || '')) el.style.display = 'none';
    });

    renderUserSlot();
    // Refresh coin count every 2 seconds (in case student earns coins while on page)
    setInterval(renderUserSlot, 2000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
