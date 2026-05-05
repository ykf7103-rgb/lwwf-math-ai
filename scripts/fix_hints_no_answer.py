"""
Fix Bug #2: 簡報 + 評估 selectorErr 答案唔可以洩
Strategy: aggressive replace — 移除任何 "= X.X" / "→ X.X" / "（A/B/C/D）" / "答案 X"
保留 hint 嘅 strategy 文字（思路）但唔包含具體答案數值
"""
import re
import sys
import os
import io
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')


def clean_hint(h):
    """Remove answer leaks but keep strategy thinking."""
    if not h:
        return h
    # 1. 「→ X.X 單位」 → mask whole tail to "。試下計，再 check 估算"
    h = re.sub(r'\s*[→\->]+\s*\d+(?:\.\d+)?\s*(?:元|公斤|公里|克|米|厘米|毫升|升|cm|m|km)', '（試下計，再 check 估算）', h)

    # 2. 「→ X.X」alone (any decimal)
    h = re.sub(r'\s*[→\->]+\s*\d+(?:\.\d+)?(?=[\s，。、（(\)）]|$)', '（自己試吓）', h)

    # 3. 「，一位小數 → X.X」/「兩位小數 → X.X」 patterns
    h = re.sub(r'，\s*[一二三]+位小數[（(]?[^）)]*[）)]?\s*[→\->]\s*\d+(?:\.\d+)?', '，再加返小數位', h)

    # 4. 「= X.X 單位」（具體 final answer）
    h = re.sub(r'=\s*\d+(?:\.\d+)?\s*(?:元|公斤|公里|克|米|厘米|毫升|升|cm|m|km)\b', '（試下計）', h)

    # 5. 「（實際 X.X 接近）」/「（實際 X.X ...）」
    h = re.sub(r'[（(]\s*實際\s*\d+(?:\.\d+)?[^）)]*[）)]', '（再 check 實際答案）', h)

    # 6. 「常錯成 X.X」/「常錯成 5.76」 (錯選提示)
    h = re.sub(r'常錯成\s*\d+(?:\.\d+)?', '小心常見錯誤', h)

    # 7. 「答案 A/B/C/D」/「答案就係 X」/「答案 B：X.X」
    h = re.sub(r'答案[就係是]?\s*[A-D]\s*[：:]?\s*\d*(?:\.\d+)?', '答案自己揀', h)

    # 8. ABCD 字母選項
    h = re.sub(r'[（(]([A-D])[）)]', '（諗下邊個啱）', h)

    # 9. 中段「= 數字 元」full match
    h = re.sub(r'，?\s*=\s*\d+(?:\.\d+)?\s*元', '，自己計幾錢', h)

    # 10. 結尾「。X.X」or 結尾「，X.X」 e.g. "，4.2" "。29.6"
    h = re.sub(r'[，。]\s*\d+\.\d+\s*(?=[\s。]|$)', '。', h)

    # 11. 結尾單獨「= X」/「= X.X」
    h = re.sub(r'=\s*\d+(?:\.\d+)?\s*$', '。試下計', h)

    # 12. clean up 多餘 punctuation
    h = re.sub(r'\s*[，。]\s*[，。]\s*', '。', h)
    h = re.sub(r'\s+', ' ', h).strip()
    return h


def patch_file(path, dry_run=False):
    """Find all hint:'...' patterns and clean them."""
    try:
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        return 0, f'READ_ERROR: {e}'

    # Match hint:'...' or hint:"..." (single line)
    pattern = re.compile(r"hint:\s*'((?:[^'\\]|\\.)*)'")

    changes = []
    def replace(m):
        old = m.group(1)
        # Unescape simple escapes
        new = clean_hint(old)
        if old != new:
            changes.append((old, new))
        # Re-escape single quotes
        new_esc = new.replace("'", "\\'")
        return f"hint:'{new_esc}'"

    new_content = pattern.sub(replace, content)

    # Also match hint:"..."
    pattern_d = re.compile(r'hint:\s*"((?:[^"\\]|\\.)*)"')
    def replace_d(m):
        old = m.group(1)
        new = clean_hint(old)
        if old != new:
            changes.append((old, new))
        new_esc = new.replace('"', '\\"')
        return f'hint:"{new_esc}"'
    new_content = pattern_d.sub(replace_d, new_content)

    if not changes:
        return 0, 'NO_CHANGES'

    if not dry_run:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(new_content)

    return len(changes), changes


if __name__ == '__main__':
    base = Path('.')
    targets = []
    # ch13-16 slides
    for ch in ['ch13', 'ch14', 'ch15', 'ch16']:
        for n in [1, 2, 3]:
            p = base / 'assets' / ch / f'slides{n}.html'
            if p.exists():
                targets.append(p)
    # root index.html (ch12 SLIDE_QUESTIONS + IQ Quiz hints)
    root = base / 'index.html'
    if root.exists():
        targets.append(root)

    total = 0
    dry_run = '--dry' in sys.argv
    show_samples = '--samples' in sys.argv

    for p in targets:
        n, changes = patch_file(str(p), dry_run=dry_run)
        total += n
        print(f'{p}: {n} hints cleaned')
        if show_samples and isinstance(changes, list) and changes[:3]:
            for old, new in changes[:3]:
                print(f'   BEFORE: {old}')
                print(f'   AFTER : {new}')

    print(f'\nTotal: {total} hints cleaned across {len(targets)} files')
    if dry_run:
        print('DRY RUN — no files written')
