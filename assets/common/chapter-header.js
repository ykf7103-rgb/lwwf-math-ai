// ============================================================
// Shared chapter header — adds "返回主頁" + chapter selector
// Usage: <script src="../common/chapter-header.js" data-current-ch="13"></script>
// Injects at the very top of .wrap (or body if no .wrap)
// ============================================================
(function() {
  const scriptEl = document.currentScript;
  const currentCh = scriptEl?.dataset?.currentCh || (() => {
    const m = location.pathname.match(/\/ch(\d+)\//);
    return m ? m[1] : '12';
  })();

  // All available chapters. For Ch12 (legacy), go to main index with ?ch=12.
  // For Ch13/14+, each chapter has its own index.html inside assets/chN/
  const CHAPTERS = [
    { id: '12', title: '第12課 · 小數加減', href: '../../index.html?ch=12' },
    { id: '13', title: '第13課 · 小數乘法（一）', href: '../ch13/index.html' },
    { id: '14', title: '第14課 · 小數乘法（二）', href: '../ch14/index.html' },
  ];

  // Figure out target for a given chapter — try to preserve sub-page name
  function buildHref(targetCh) {
    const subPageMatch = location.pathname.match(/\/ch\d+\/([^/?]+)$/);
    const subPage = subPageMatch ? subPageMatch[1] : 'index.html';
    if (targetCh === '12') {
      // Ch12 is flat in root index.html, all sub-pages also via ?ch=12
      return '../../index.html?ch=12';
    }
    // Try to go to same sub-page in target chapter
    return `../ch${targetCh}/${subPage}`;
  }

  const style = document.createElement('style');
  style.textContent = `
    .ch-header {
      display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
      margin-bottom: 12px; padding: 8px 10px;
      background: rgba(255,255,255,0.95); border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      font-family: -apple-system, 'PingFang TC', 'Microsoft JhengHei', sans-serif;
    }
    .ch-header .ch-home {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 7px 13px; background: #1565C0; color: white;
      border-radius: 8px; text-decoration: none; font-weight: 700;
      font-size: 0.88rem; border: none; cursor: pointer;
      font-family: inherit;
    }
    .ch-header .ch-home:hover { background: #0D47A1; }
    .ch-header .ch-sep { color: #bbb; font-size: 0.85rem; }
    .ch-header .ch-label { font-size: 0.85rem; color: #555; font-weight: 700; }
    .ch-header .ch-select {
      padding: 7px 10px; border-radius: 8px; border: 2px solid #FF9800;
      background: white; font-weight: 700; font-size: 0.9rem;
      color: #E65100; cursor: pointer; font-family: inherit;
      outline: none;
    }
    .ch-header .ch-select:focus { border-color: #E65100; box-shadow: 0 0 0 3px rgba(255,152,0,0.2); }
    .ch-header .ch-spacer { flex: 1; }
    .ch-header .ch-user {
      font-size: 0.82rem; color: #555; background: #F5F5F5;
      padding: 5px 10px; border-radius: 16px;
    }
    @media (max-width: 500px) {
      .ch-header { padding: 6px 8px; gap: 6px; }
      .ch-header .ch-home { padding: 6px 10px; font-size: 0.8rem; }
      .ch-header .ch-label { display: none; }
      .ch-header .ch-select { font-size: 0.82rem; padding: 6px 8px; }
      .ch-header .ch-user { font-size: 0.72rem; padding: 3px 8px; }
    }
  `;
  document.head.appendChild(style);

  // Build header
  const header = document.createElement('div');
  header.className = 'ch-header';

  const home = document.createElement('a');
  home.className = 'ch-home';
  home.href = '../../index.html';
  home.innerHTML = '🏠 主頁';
  header.appendChild(home);

  const sep = document.createElement('span');
  sep.className = 'ch-sep';
  sep.textContent = '|';
  header.appendChild(sep);

  const label = document.createElement('span');
  label.className = 'ch-label';
  label.textContent = '🔀 切換課堂：';
  header.appendChild(label);

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

  // Show logged-in user if any
  try {
    const user = JSON.parse(localStorage.getItem('mathai_user') || sessionStorage.getItem('mathai_user') || 'null');
    if (user && (user.class || user.number)) {
      const u = document.createElement('span');
      u.className = 'ch-user';
      u.textContent = `👤 ${user.class || ''}${user.number || ''}`;
      header.appendChild(u);
    }
  } catch(e) {}

  // Mount: inject at start of .wrap, or body if no .wrap
  function mount() {
    const wrap = document.querySelector('.wrap');
    const parent = wrap || document.body;
    if (parent.firstChild) parent.insertBefore(header, parent.firstChild);
    else parent.appendChild(header);

    // Hide original "← 返回主頁" button (now replaced by our header)
    document.querySelectorAll('a.back, a.back-btn, .back-home').forEach(el => {
      // only hide if they point to main index
      if (/index\.html$/.test(el.getAttribute('href') || '')) {
        el.style.display = 'none';
      }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
