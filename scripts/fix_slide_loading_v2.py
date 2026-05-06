"""
2026-05-02 v2 fix: 「下一頁返上頁」bug — 加深層防護
─────────────────────────────────────────────────
Root cause（cb70aab v1 已 fix 但仍有 edge case）：
  學生網慢 → click next → indicator 跳 → 圖未 load → 學生以為冇撳到
  → 撳 prev → 自動「返上頁」感覺。

V2 額外加：
  1. preloadAllOnInit — 首屏並行 preload 全部 15 張圖（v1 只 cover 相鄰 3）
  2. 每次 render() 加 visible loading overlay（學生即時知道「載入中」）
  3. 對 ch17-19 補做 v1 fix（navLock + threshold + adjacent preload）
"""
import os
import sys
import re
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')

V2_MARKER = '__preloadAllOnInit_v2'

LOADING_CSS = """
/* 2026-05-02 v2 fix: visible image loading overlay */
.viewer { position: relative; }
.viewer.img-loading::before {
  content: '⏳ 載入中…';
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  background: rgba(15, 31, 23, 0.55);
  color: white; font-size: 1.4rem; font-weight: 900;
  z-index: 5; pointer-events: none;
  animation: pulseLoad 1s ease-in-out infinite;
}
@keyframes pulseLoad { 0%,100%{opacity:.7} 50%{opacity:1} }
.viewer.img-loading .slide-img { filter: brightness(0.55) blur(3px); transition: filter .25s; }
"""

V1_NAV_HELPER = """// 2026-05-05 fix: 翻頁防誤觸 + preload
let __navLock = false;
function __navUnlock(){ __navLock = false; }
function __preloadAdjacent(){
  const fmt = (n) => String(n).padStart(2, '0');
  for (const offset of [1, -1, 2]) {
    const target = idx + offset + 1;
    if (target < 1 || target > TOTAL) continue;
    const pre = new Image();
    pre.src = `pages/${PREFIX}_p${fmt(target)}.jpg`;
  }
}

"""

# V2 JS — 喺 inline script 末尾 inject。利用 img loadstart/load/error event
# 配合 MutationObserver 唔需要 wrap render()
V2_PRELOAD_AND_LOADING = """
// 2026-05-02 v2 fix: aggressive all-preload + visible loading overlay
(function __preloadAllOnInit_v2(){
  if (typeof TOTAL === 'undefined' || typeof PREFIX === 'undefined') return;
  const fmt = (n) => String(n).padStart(2, '0');
  for (let i = 1; i <= TOTAL; i++) {
    const pre = new Image();
    pre.src = `pages/${PREFIX}_p${fmt(i)}.jpg`;
  }
})();

(function __wireImageLoadingState_v2(){
  const viewer = document.querySelector('.viewer');
  const slideImg = document.getElementById('slide');
  if (!viewer || !slideImg) return;
  let __loadTimer;
  const showLoad = () => {
    clearTimeout(__loadTimer);
    __loadTimer = setTimeout(() => viewer.classList.add('img-loading'), 100);
  };
  const hideLoad = () => {
    clearTimeout(__loadTimer);
    viewer.classList.remove('img-loading');
  };
  slideImg.addEventListener('loadstart', showLoad);
  slideImg.addEventListener('load',      hideLoad);
  slideImg.addEventListener('error',     hideLoad);
  // Edge case: src already set when this code runs
  if (slideImg.complete && slideImg.naturalWidth > 0) hideLoad(); else showLoad();
})();
"""


def patch_v1_nav(content):
    """Apply v1 navLock + threshold + adjacent preload (for ch17-19)."""
    if '__navLock' in content:
        return content, 0
    changes = 0

    new = content.replace(
        "window.scrollTo({top:0, behavior:'smooth'})",
        "window.scrollTo(0, 0)"
    )
    if new != content:
        changes += 1
    content = new

    content2 = re.sub(
        r"if \(Math\.abs\(dx\) > 50 && Math\.abs\(dx\) > Math\.abs\(dy\)\)",
        "if (Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy) * 1.5)",
        content
    )
    if content2 != content:
        changes += 1
    content = content2

    if 'function next()' in content and 'function prev()' in content:
        content = content.replace(
            'function next(){',
            V1_NAV_HELPER + 'function next(){\n  if (__navLock) return;\n  __navLock = true;\n  setTimeout(__navUnlock, 600);'
        )
        content = content.replace(
            'function prev(){\n  if (idx > 0) { idx--; render();',
            'function prev(){\n  if (__navLock) return;\n  __navLock = true;\n  setTimeout(__navUnlock, 600);\n  if (idx > 0) { idx--; render();'
        )
        changes += 1

    if 'function render(){' in content and '__preloadAdjacent' in content:
        content = content.replace(
            'function render(){\n  img.src = `pages/${PREFIX}_p${pad(idx+1)}.jpg`;',
            'function render(){\n  img.src = `pages/${PREFIX}_p${pad(idx+1)}.jpg`;\n  __preloadAdjacent();'
        )
        changes += 1

    return content, changes


def find_inline_render_script(content):
    """Locate the inline <script> block containing 'function render('.
    Returns (open_tag_end_idx, close_pos) or (None, None)."""
    render_pos = content.find('function render(')
    if render_pos == -1:
        return None, None
    open_pos = content.rfind('<script', 0, render_pos)
    if open_pos == -1:
        return None, None
    open_tag_end = content.find('>', open_pos) + 1
    close_pos = content.find('</script>', render_pos)
    if close_pos == -1:
        return None, None
    return open_tag_end, close_pos


def patch_v2_loading(content):
    if V2_MARKER in content:
        return content, 0

    changes = 0

    # CSS inject before first </style>
    if '</style>' in content and 'img-loading' not in content:
        content = content.replace('</style>', LOADING_CSS + '\n</style>', 1)
        changes += 1

    # JS inject at end of inline script (before </script>)
    open_idx, close_idx = find_inline_render_script(content)
    if open_idx and close_idx and V2_MARKER not in content:
        content = content[:close_idx] + V2_PRELOAD_AND_LOADING + '\n' + content[close_idx:]
        changes += 1

    return content, changes


def process(path):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        return f'READ_ERROR: {e}'

    content, v1_changes = patch_v1_nav(content)
    content, v2_changes = patch_v2_loading(content)

    total = v1_changes + v2_changes
    if total == 0:
        return 'SKIP (already fully patched)'

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    return f'OK (v1:{v1_changes} + v2:{v2_changes})'


if __name__ == '__main__':
    base = Path('.')
    targets = []
    for ch in [f'ch{n}' for n in range(13, 20)]:
        for n in [1, 2, 3]:
            p = base / 'assets' / ch / f'slides{n}.html'
            if p.exists():
                targets.append(p)

    for p in targets:
        result = process(str(p))
        print(f'{p}: {result}')

    print(f'\nTotal: {len(targets)} files processed')
