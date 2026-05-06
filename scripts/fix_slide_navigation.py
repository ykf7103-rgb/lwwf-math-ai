"""
Fix 簡報翻頁返上一頁 bug:
1. 加 navLock global flag — next/prev 600ms 內唔可以重複觸發
2. 加 image preload (idx+1 + idx-1) — 載入唔再有延遲
3. Touch threshold 50 → 80 px 防誤觸
4. window.scrollTo smooth → instant 避免被 disrupted
"""
import os
import sys
import io
import re
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')


def patch_file(path):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        return f'READ_ERROR: {e}'

    if '__navLock' in content:
        return 'SKIP (already patched)'

    changes = 0

    # FIX 1: smooth scroll → instant (避免被 touch 打斷)
    new = content.replace(
        "window.scrollTo({top:0, behavior:'smooth'})",
        "window.scrollTo(0, 0)"
    )
    if new != content:
        changes += 1
        content = new

    # FIX 2: touch threshold 50 → 80
    content2 = re.sub(
        r"if \(Math\.abs\(dx\) > 50 && Math\.abs\(dx\) > Math\.abs\(dy\)\)",
        "if (Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy) * 1.5)",
        content
    )
    if content2 != content:
        changes += 1
        content = content2

    # FIX 3: 加 navLock + preload helper 喺 render() 之前
    # Match function next(){...} 同 function prev(){...}，加 navLock guard
    if 'function next()' in content and 'function prev()' in content:
        # Inject navLock state vars + preload helper
        nav_helper = '''// 2026-05-05 fix: 翻頁防誤觸 + preload
let __navLock = false;
function __navUnlock(){ __navLock = false; }
function __preloadAdjacent(){
  const fmt = (n) => String(n).padStart(2, '0');
  for (const offset of [1, -1, 2]) {
    const target = idx + offset + 1;  // page numbers are 1-indexed
    if (target < 1 || target > TOTAL) continue;
    const pre = new Image();
    pre.src = `pages/${PREFIX}_p${fmt(target)}.jpg`;
  }
}

'''
        # Inject before "function next()"
        content = content.replace(
            'function next(){',
            nav_helper + 'function next(){\n  if (__navLock) return;\n  __navLock = true;\n  setTimeout(__navUnlock, 600);'
        )
        # Wrap prev() with same guard
        content = content.replace(
            'function prev(){\n  if (idx > 0) { idx--; render();',
            'function prev(){\n  if (__navLock) return;\n  __navLock = true;\n  setTimeout(__navUnlock, 600);\n  if (idx > 0) { idx--; render();'
        )
        changes += 1

    # FIX 4: 喺 render() 之中加 __preloadAdjacent() call
    # 找 'function render(){' 同找最後嘅 } 之前加 call
    if 'function render(){' in content and '__preloadAdjacent' in content:
        # render() 開頭 inject preload call
        content = content.replace(
            'function render(){\n  img.src = `pages/${PREFIX}_p${pad(idx+1)}.jpg`;',
            'function render(){\n  img.src = `pages/${PREFIX}_p${pad(idx+1)}.jpg`;\n  __preloadAdjacent();'
        )
        changes += 1

    if changes == 0:
        return 'NO_CHANGES'

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    return f'OK ({changes} fixes applied)'


if __name__ == '__main__':
    base = Path('.')
    targets = []
    for ch in ['ch13', 'ch14', 'ch15', 'ch16']:
        for n in [1, 2, 3]:
            p = base / 'assets' / ch / f'slides{n}.html'
            if p.exists():
                targets.append(p)

    for p in targets:
        result = patch_file(str(p))
        print(f'{p}: {result}')

    print(f'\nTotal: {len(targets)} files processed')
