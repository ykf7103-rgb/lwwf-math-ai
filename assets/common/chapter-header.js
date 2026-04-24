// ============================================================
// Shared chapter topbar v3 — matches Ch12's topbar exactly
//   數學AI學習區 | 📚 Ch.NN 標題 ▾ | ..... 🪙 N 🏅 N 測 5F 05 姓名 | 登出
// Usage: <script src="../common/chapter-header.js" data-current-ch="13"></script>
// ============================================================
(function() {
  const scriptEl = document.currentScript;
  const currentCh = scriptEl?.dataset?.currentCh || (() => {
    const m = location.pathname.match(/\/ch(\d+)\//);
    return m ? m[1] : '12';
  })();

  const CHAPTERS = [
    { id: '12', title: 'Ch.12 有趣的乘法', emoji: '📚', href: '../../index.html?ch=12' },
    { id: '13', title: 'Ch.13 小數乘法（一）', emoji: '📘', href: '../ch13/index.html' },
    { id: '14', title: 'Ch.14 小數乘法（二）', emoji: '🥟', href: '../ch14/index.html' },
  ];

  function buildHref(targetCh) {
    const subPageMatch = location.pathname.match(/\/ch\d+\/([^/?]+)$/);
    const subPage = subPageMatch ? subPageMatch[1] : 'index.html';
    if (targetCh === '12') return '../../index.html?ch=12';
    return `../ch${targetCh}/${subPage}`;
  }

  function getUser() {
    try {
      // Main index uses 'lwwf_auth_user'. 'mathai_user' is legacy fallback.
      return JSON.parse(localStorage.getItem('lwwf_auth_user') || localStorage.getItem('mathai_user') || sessionStorage.getItem('lwwf_auth_user') || sessionStorage.getItem('mathai_user') || 'null');
    } catch(e) { return null; }
  }

  // Coin total across ALL chapters from ALL possible keys:
  //   Ch12 main index:  scores_{cls}_{num}           → { activityKey: { coins:N, ... } }
  //   Ch13/14 per-user: progress_ch{N}_{cls}_{num}   → { stepKey: { coins:N, done:true, ... } }
  //   Ch13/14 shared (legacy): progress_ch{N}        → same structure but全機共享（應該停用）
  function getTotalCoins(user) {
    if (!user) return 0;
    let total = 0;
    try {
      // 1) Ch12 scores_{cls}_{num}
      const scoresKey = `scores_${user.class}_${user.number}`;
      const scores = JSON.parse(localStorage.getItem(scoresKey) || '{}');
      Object.values(scores).forEach(s => {
        if (typeof s === 'object' && s !== null) {
          if (typeof s.coins === 'number') total += s.coins;
          else if (typeof s.score === 'number') total += s.score;
        }
      });
      // 2) Ch13+ progress_ch{N}_{cls}_{num}  (per-user)
      for (let ch = 13; ch <= 21; ch++) {
        const perUserKey = `progress_ch${ch}_${user.class}_${user.number}`;
        const perUser = JSON.parse(localStorage.getItem(perUserKey) || '{}');
        Object.values(perUser).forEach(s => {
          if (typeof s === 'object' && s !== null && typeof s.coins === 'number') total += s.coins;
        });
      }
      // 3) Ch13+ legacy shared progress_ch{N} — only if no per-user key found (avoid double-count)
      for (let ch = 13; ch <= 21; ch++) {
        const perUserKey = `progress_ch${ch}_${user.class}_${user.number}`;
        const sharedKey = `progress_ch${ch}`;
        // skip shared if per-user exists
        if (localStorage.getItem(perUserKey)) continue;
        const shared = JSON.parse(localStorage.getItem(sharedKey) || '{}');
        Object.values(shared).forEach(s => {
          if (typeof s === 'object' && s !== null && typeof s.coins === 'number') total += s.coins;
        });
      }
    } catch(e) {}
    return total;
  }

  // EDX = converted coins (1 EDX = 10 coins typically). Check ../../ for mathai_edx_{cls}_{num}
  function getEdx(user) {
    if (!user) return 0;
    try {
      return parseInt(localStorage.getItem(`edx_${user.class}_${user.number}`) || '0', 10) || 0;
    } catch(e) { return 0; }
  }

  const chInfo = CHAPTERS.find(c => c.id === currentCh) || CHAPTERS[0];
  const coinImg = `../ch${currentCh}/images/coin_new.png`;
  const coinFallback = '../ch12/images/coin_new.png';

  const style = document.createElement('style');
  style.textContent = `
    .mathai-topbar {
      background: white;
      padding: 10px 18px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 2px 10px rgba(0,0,0,0.06);
      position: sticky;
      top: 0;
      z-index: 100;
      font-family: -apple-system, 'PingFang TC', 'Microsoft JhengHei', sans-serif;
      margin: -12px -12px 14px;  /* counter body padding */
      border-radius: 0 0 12px 12px;
    }
    .mathai-topbar .tb-left { display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0; }
    .mathai-topbar .tb-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
    .mathai-topbar .tb-logo {
      font-size: 1.05rem;
      font-weight: 800;
      color: #1565C0;
      white-space: nowrap;
    }
    .mathai-topbar .tb-chapter-btn {
      font-size: 0.85rem;
      color: #555;
      background: #F0F4F8;
      padding: 6px 12px;
      border-radius: 20px;
      border: none;
      cursor: pointer;
      font-family: inherit;
      font-weight: 700;
      transition: all 0.2s;
      display: inline-flex; align-items: center; gap: 4px;
      max-width: 220px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .mathai-topbar .tb-chapter-btn:hover {
      background: linear-gradient(135deg, #1565C0, #1976D2);
      color: white;
      transform: translateY(-1px);
      box-shadow: 0 3px 10px rgba(21,101,192,0.3);
    }
    .mathai-topbar .tb-coin {
      display: flex; align-items: center; gap: 4px;
      background: linear-gradient(135deg,#FFF8E1,#FFE082);
      padding: 4px 12px; border-radius: 20px;
      font-weight: 700; color: #F57F17; font-size: 0.9rem;
      box-shadow: 0 2px 8px rgba(255,193,7,0.3);
    }
    .mathai-topbar .tb-coin img { width: 20px; height: 20px; }
    .mathai-topbar .tb-edx {
      display: flex; align-items: center; gap: 4px;
      background: linear-gradient(135deg,#E3F2FD,#90CAF9);
      padding: 4px 12px; border-radius: 20px;
      font-weight: 700; color: #0D47A1; font-size: 0.9rem;
      box-shadow: 0 2px 8px rgba(33,150,243,0.3);
      cursor: pointer;
    }
    .mathai-topbar .tb-user-info {
      display: flex; align-items: center; gap: 6px;
      font-size: 0.88rem; color: #333;
    }
    .mathai-topbar .tb-avatar {
      width: 34px; height: 34px; border-radius: 50%;
      background: linear-gradient(135deg, #FFB300 0%, #FFE082 100%);
      display: flex; align-items: center; justify-content: center;
      font-weight: 800; font-size: 0.85rem; color: #333;
    }
    .mathai-topbar .tb-btn-logout {
      padding: 6px 12px; font-size: 0.8rem;
      background: #F0F4F8; border: none; border-radius: 8px;
      cursor: pointer; font-family: inherit; color: #666; font-weight: 700;
      transition: all 0.15s;
    }
    .mathai-topbar .tb-btn-logout:hover { background: #E0E7EE; color: #C62828; }
    .mathai-topbar .tb-btn-login {
      padding: 6px 14px; font-size: 0.85rem;
      background: linear-gradient(135deg,#4CAF50,#2E7D32);
      color: white; border: none; border-radius: 20px;
      font-weight: 800; cursor: pointer; font-family: inherit;
      box-shadow: 0 2px 8px rgba(46,125,50,0.3);
    }
    .mathai-topbar .tb-btn-login:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(46,125,50,0.45); }

    @media (max-width: 720px) {
      .mathai-topbar { padding: 8px 12px; gap: 6px; flex-wrap: wrap; }
      .mathai-topbar .tb-left { gap: 8px; }
      .mathai-topbar .tb-logo { font-size: 0.9rem; }
      .mathai-topbar .tb-chapter-btn { font-size: 0.78rem; padding: 5px 10px; max-width: 150px; }
      .mathai-topbar .tb-coin, .mathai-topbar .tb-edx { font-size: 0.8rem; padding: 3px 9px; }
      .mathai-topbar .tb-coin img { width: 16px; height: 16px; }
      .mathai-topbar .tb-avatar { width: 28px; height: 28px; font-size: 0.75rem; }
      .mathai-topbar .tb-btn-logout { padding: 5px 9px; font-size: 0.72rem; }
      .mathai-topbar .tb-user-info span.tb-name { max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    }
    @media (max-width: 460px) {
      .mathai-topbar .tb-logo { font-size: 0.8rem; }
      .mathai-topbar .tb-user-info span.tb-name { display: none; }
    }

    /* Chapter selector popup */
    .mathai-ch-pop {
      position: fixed; inset: 0; background: rgba(0,0,0,0.45);
      display: none; align-items: flex-start; justify-content: center;
      z-index: 10000; padding: 80px 20px 20px;
    }
    .mathai-ch-pop.show { display: flex; animation: mathaiFade 0.2s; }
    @keyframes mathaiFade { from { opacity: 0; } to { opacity: 1; } }
    .mathai-ch-pop .mathai-ch-panel {
      background: white; border-radius: 16px; padding: 20px;
      max-width: 420px; width: 100%;
      box-shadow: 0 10px 30px rgba(0,0,0,0.25);
    }
    .mathai-ch-pop h3 { margin: 0 0 14px; color: #1565C0; font-size: 1.1rem; }
    .mathai-ch-pop .mathai-ch-item {
      display: flex; align-items: center; gap: 12px;
      padding: 12px 14px; border-radius: 12px; cursor: pointer;
      border: 2px solid transparent;
      font-family: inherit;
      background: #F7FAFC;
      margin-bottom: 6px;
      text-decoration: none;
      color: #333;
      transition: all 0.15s;
    }
    .mathai-ch-pop .mathai-ch-item:hover { background: #E3F2FD; border-color: #1565C0; transform: translateX(3px); }
    .mathai-ch-pop .mathai-ch-item.current { background: linear-gradient(135deg,#E3F2FD,#BBDEFB); border-color: #1565C0; }
    .mathai-ch-pop .mathai-ch-item .emo { font-size: 1.8rem; }
    .mathai-ch-pop .mathai-ch-item .info { flex: 1; }
    .mathai-ch-pop .mathai-ch-item .title { font-weight: 800; font-size: 0.95rem; color: #1565C0; }
    .mathai-ch-pop .mathai-ch-item .sub { font-size: 0.78rem; color: #666; margin-top: 2px; }
    .mathai-ch-pop .mathai-ch-item .badge { background: #1565C0; color: white; padding: 3px 10px; border-radius: 12px; font-size: 0.72rem; font-weight: 800; }

    /* Login modal */
    .mathai-login-ov {
      position: fixed; inset: 0; background: rgba(0,0,0,0.5);
      display: none; align-items: center; justify-content: center;
      z-index: 10001; padding: 16px;
    }
    .mathai-login-ov.show { display: flex; animation: mathaiFade 0.2s; }
    .mathai-login-modal { background: white; border-radius: 16px; padding: 22px; max-width: 360px; width: 100%; box-shadow: 0 10px 30px rgba(0,0,0,0.25); font-family: inherit; }
    .mathai-login-modal h3 { margin: 0 0 10px; color: #1565C0; font-size: 1.15rem; }
    .mathai-login-modal .row { margin-bottom: 10px; }
    .mathai-login-modal label { display: block; font-size: 0.82rem; color: #555; font-weight: 700; margin-bottom: 4px; }
    .mathai-login-modal input { width: 100%; padding: 9px 10px; border: 2px solid #E0E0E0; border-radius: 8px; font-size: 0.95rem; outline: none; font-family: inherit; }
    .mathai-login-modal input:focus { border-color: #1565C0; }
    .mathai-login-modal .btn-row { display: flex; gap: 8px; margin-top: 14px; }
    .mathai-login-modal .btn-row button { flex: 1; padding: 9px; border: none; border-radius: 8px; font-weight: 800; cursor: pointer; font-size: 0.9rem; font-family: inherit; }
    .mathai-login-modal .ok { background: #1565C0; color: white; }
    .mathai-login-modal .cancel { background: #F5F5F5; color: #666; }
  `;
  document.head.appendChild(style);

  const bar = document.createElement('div');
  bar.className = 'mathai-topbar';
  bar.innerHTML = `
    <div class="tb-left">
      <span class="tb-logo">數學AI學習區</span>
      <button class="tb-chapter-btn" onclick="window.__mathaiOpenChapter()" title="切換課題">
        <span>${chInfo.emoji} ${chInfo.title}</span>
        <span style="opacity:0.7;">▾</span>
      </button>
    </div>
    <div class="tb-right" id="mathaiTbRight"></div>
  `;

  function renderRight() {
    const user = getUser();
    const right = bar.querySelector('#mathaiTbRight');
    right.innerHTML = '';
    if (!user || (!user.class && !user.number)) {
      right.innerHTML = `<button class="tb-btn-login" onclick="window.__mathaiLoginOpen()">👤 登入</button>`;
      return;
    }
    const coins = getTotalCoins(user);
    const edx = getEdx(user);
    const avatarChar = (user.name || '測').trim().charAt(0) || '測';
    const nameStr = user.name ? `${user.class || ''} ${user.number || ''} ${user.name}` : `${user.class || ''} ${user.number || ''}`;
    right.innerHTML = `
      <div class="tb-coin" title="金幣（可換 EDX）"><img src="${coinImg}" onerror="this.src='${coinFallback}'"><span>${coins}</span></div>
      <div class="tb-edx" title="已換取的 EDX 分"><span>🏅</span><span>${edx}</span></div>
      <div class="tb-user-info">
        <div class="tb-avatar">${avatarChar}</div>
        <span class="tb-name">${nameStr}</span>
      </div>
      <button class="tb-btn-logout" onclick="window.__mathaiLogout()">登出</button>
    `;
  }

  // Chapter popup
  const popup = document.createElement('div');
  popup.className = 'mathai-ch-pop';
  popup.innerHTML = `
    <div class="mathai-ch-panel" onclick="event.stopPropagation()">
      <h3>📚 切換課題</h3>
      ${CHAPTERS.map(ch => `
        <a href="${buildHref(ch.id)}" class="mathai-ch-item ${ch.id === currentCh ? 'current' : ''}">
          <span class="emo">${ch.emoji}</span>
          <div class="info">
            <div class="title">${ch.title}</div>
            <div class="sub">${ch.id === currentCh ? '✓ 當前課題' : '點擊去到呢一課'}</div>
          </div>
          ${ch.id === currentCh ? '<span class="badge">當前</span>' : ''}
        </a>
      `).join('')}
    </div>
  `;
  popup.addEventListener('click', () => popup.classList.remove('show'));
  document.body.appendChild(popup);
  window.__mathaiOpenChapter = () => popup.classList.add('show');

  // Login modal
  const loginOv = document.createElement('div');
  loginOv.className = 'mathai-login-ov';
  loginOv.innerHTML = `
    <div class="mathai-login-modal" onclick="event.stopPropagation()">
      <h3>👤 登入</h3>
      <p style="margin:4px 0 12px;color:#666;font-size:0.85rem;">輸入班別 + 學號，你的進度同金幣會跟住你。</p>
      <div class="row"><label>班別</label><input type="text" id="mathaiLoginCls" placeholder="例：5F" maxlength="10"></div>
      <div class="row"><label>學號</label><input type="text" id="mathaiLoginNum" placeholder="例：01" maxlength="5"></div>
      <div class="row"><label>暱稱（可選）</label><input type="text" id="mathaiLoginName" placeholder="例：小明" maxlength="20"></div>
      <div class="btn-row">
        <button class="cancel" onclick="window.__mathaiLoginClose()">取消</button>
        <button class="ok" onclick="window.__mathaiLoginSubmit()">✓ 登入</button>
      </div>
    </div>
  `;
  loginOv.addEventListener('click', () => window.__mathaiLoginClose());
  document.body.appendChild(loginOv);

  window.__mathaiLoginOpen = () => { loginOv.classList.add('show'); setTimeout(() => document.getElementById('mathaiLoginCls')?.focus(), 100); };
  window.__mathaiLoginClose = () => loginOv.classList.remove('show');
  window.__mathaiLoginSubmit = () => {
    const cls = document.getElementById('mathaiLoginCls').value.trim().toUpperCase();
    const num = document.getElementById('mathaiLoginNum').value.trim();
    const name = document.getElementById('mathaiLoginName').value.trim() || `${cls}${num}`;
    if (!cls || !num) { alert('班別同學號都要填！'); return; }
    const user = { class: cls, number: num, name, role: 'student' };
    // Write to BOTH keys for compat with main index
    localStorage.setItem('lwwf_auth_user', JSON.stringify(user));
    localStorage.setItem('mathai_user', JSON.stringify(user));
    sessionStorage.setItem('lwwf_auth_user', JSON.stringify(user));
    try { localStorage.setItem('lwwf_auth_lastActive', String(Date.now())); } catch(e) {}
    loginOv.classList.remove('show');
    renderRight();
    setTimeout(() => location.reload(), 300);
  };
  window.__mathaiLogout = () => {
    if (!confirm('確定要登出？進度仍會保留喺本機。')) return;
    localStorage.removeItem('lwwf_auth_user');
    localStorage.removeItem('mathai_user');
    localStorage.removeItem('lwwf_auth_lastActive');
    sessionStorage.removeItem('lwwf_auth_user');
    sessionStorage.removeItem('mathai_user');
    renderRight();
    // Redirect back to main login
    setTimeout(() => { location.href = '../../index.html'; }, 300);
  };

  // Listen for storage changes to refresh coins
  window.addEventListener('storage', () => renderRight());

  function mount() {
    // Check if we're on a game page — if so, use minimal mode (smaller bar, no sticky)
    const isGamePage = /\/game\d*\.html/.test(location.pathname);
    if (isGamePage) {
      bar.classList.add('minimal');
      // Add CSS for minimal game mode
      const s2 = document.createElement('style');
      s2.textContent = `
        .mathai-topbar.minimal {
          position: static;
          padding: 4px 8px;
          margin: 0 0 6px;
          border-radius: 8px;
          box-shadow: 0 1px 4px rgba(0,0,0,0.1);
          font-size: 0.8rem;
        }
        .mathai-topbar.minimal .tb-logo { display: none; }
        .mathai-topbar.minimal .tb-chapter-btn { font-size: 0.75rem; padding: 4px 8px; max-width: 140px; }
        .mathai-topbar.minimal .tb-coin, .mathai-topbar.minimal .tb-edx { font-size: 0.72rem; padding: 3px 7px; }
        .mathai-topbar.minimal .tb-coin img { width: 14px; height: 14px; }
        .mathai-topbar.minimal .tb-avatar { width: 22px; height: 22px; font-size: 0.68rem; }
        .mathai-topbar.minimal .tb-user-info { font-size: 0.72rem; }
        .mathai-topbar.minimal .tb-btn-logout { padding: 3px 6px; font-size: 0.65rem; }
        @media (max-width: 500px) {
          .mathai-topbar.minimal .tb-user-info span.tb-name { display: none; }
          .mathai-topbar.minimal .tb-edx { display: none; }
        }
      `;
      document.head.appendChild(s2);
    }

    // Insert topbar at the very top of body (before .wrap)
    if (document.body.firstChild) document.body.insertBefore(bar, document.body.firstChild);
    else document.body.appendChild(bar);

    // Hide old back buttons that pointed to main index
    document.querySelectorAll('a.back, a.back-btn, .back-home').forEach(el => {
      if (/index\.html/.test(el.getAttribute('href') || '')) el.style.display = 'none';
    });
    // Hide Ch13/14 old "header" with chapter title if exists
    const oldHeader = document.querySelector('body > header, .wrap > header');
    if (oldHeader) oldHeader.style.display = 'none';

    renderRight();
    setInterval(renderRight, 2000);  // refresh coins
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
