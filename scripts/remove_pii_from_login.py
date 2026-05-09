"""
移除 root index.html 內 STUDENTS array 嘅所有姓名 (PII)
登入下拉只顯示班別 + 學號（如：5A01 / 5B05）
"""
import re
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')


def patch_index():
    p = Path('index.html')
    if not p.exists():
        print('ERROR: index.html not found')
        return

    content = p.read_text(encoding='utf-8')
    changes = 0

    # === Fix 1: 移除 STUDENTS array 內所有 "name":"XXX", field ===
    # Pattern: "name":"陳曉樂", → (空)
    new_content = re.sub(r'"name":"[^"]*",', '', content)
    name_removed = content.count('"name":"') - new_content.count('"name":"')
    if name_removed > 0:
        content = new_content
        changes += 1
        print(f'  ✓ 移除 STUDENTS 內 {name_removed} 個 name field')

    # === Fix 2: dropdown render — 顯示「{cls}{num}」 instead of「{number} - {name}」===
    # 原: opt.textContent = `${s.number} - ${s.name}`;
    # 新: opt.textContent = `${cls} ${s.number} 號`;
    old_dropdown = "opt.textContent = `${s.number} - ${s.name}`;"
    new_dropdown = "opt.textContent = `${cls} ${s.number} 號`;"
    if old_dropdown in content:
        content = content.replace(old_dropdown, new_dropdown)
        changes += 1
        print('  ✓ 登入下拉只顯示班別 + 學號')

    # === Fix 3: avatar 用班別第 1 個字 (5A → 5) ===
    # 原: document.getElementById('userAvatar').textContent = currentUser.name.charAt(0);
    # 新: document.getElementById('userAvatar').textContent = currentUser.class.charAt(1) || '👤';
    old_avatar = "document.getElementById('userAvatar').textContent = currentUser.name.charAt(0);"
    new_avatar = "document.getElementById('userAvatar').textContent = (currentUser.class || '').charAt(1) || '👤';"
    if old_avatar in content:
        content = content.replace(old_avatar, new_avatar)
        changes += 1
        print('  ✓ Avatar 改用班別字')

    # === Fix 4: 用戶顯示 — 「{class} {number} 同學」 ===
    # 原: `${currentUser.class} ${currentUser.number} ${currentUser.name}`
    # 新: `${currentUser.class} ${currentUser.number} 號`
    old_display = "`${currentUser.class} ${currentUser.number} ${currentUser.name}`"
    new_display = "`${currentUser.class} ${currentUser.number} 號`"
    if old_display in content:
        content = content.replace(old_display, new_display)
        changes += 1
        print('  ✓ 用戶顯示改為「班別 學號 號」')

    # === Fix 5: CSV header 改「姓名」→「班學號」===
    old_csv = "let csv = '\\uFEFF班別,學號,姓名,"
    new_csv = "let csv = '\\uFEFF班別,學號,代號,"
    if old_csv in content:
        content = content.replace(old_csv, new_csv)
        changes += 1
        print('  ✓ CSV header 移除「姓名」欄位')

    # === Fix 6: 教師頁面用 student.name 嘅地方 — 改用 「{class}{number}」 ===
    # 搜尋 currentUser.name + student.name 嘅 reference
    # 但其他地方可能有合理 use case — 用 fallback
    # 因為 STUDENTS 已冇 name field，s.name 會 undefined
    # 加 helper: getStudentLabel(s) = `${s.class}${s.number}`
    # 但 minimum changes 為主，讓 undefined 顯示為空（safer）
    # 實際 teacher dashboard 顯示時，name 變 undefined → 改顯示 「{class}{number}」
    # 用 regex 替換 ${s.name} → ${s.class}${s.number}
    s_name_count = len(re.findall(r'\$\{s\.name\}', content))
    if s_name_count > 0:
        content = re.sub(r'\$\{s\.name\}', '${s.class}${s.number}', content)
        changes += 1
        print(f'  ✓ Teacher 頁面 ${{s.name}} ({s_name_count} 處) 改用班學號')

    student_name_count = len(re.findall(r'\$\{student\.name\}', content))
    if student_name_count > 0:
        content = re.sub(r'\$\{student\.name\}', '${student.class}${student.number}', content)
        changes += 1
        print(f'  ✓ Teacher 頁面 ${{student.name}} ({student_name_count} 處) 改用班學號')

    if changes > 0:
        p.write_text(content, encoding='utf-8')
        print(f'\n✅ Total: {changes} fixes applied to index.html')
    else:
        print('NO_CHANGES')


if __name__ == '__main__':
    patch_index()
