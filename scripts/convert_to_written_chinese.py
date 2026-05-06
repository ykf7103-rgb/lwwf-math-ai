"""
Convert 粵語 → 書面中文 (繁體) — Conservative version
全網站 HTML / JS / MD files。
Strategy: 只換「100% 粵語特有」字 + safe compound。
唔換 ambiguous 字（落/細/擺/同/個/落/啊/嗎/啦標準中文都用）
"""
import os
import sys
import re
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')


# Tier 2: COMPOUND（必須先 apply, longest first）
COMPOUND = [
    ('我哋', '我們'),
    ('你哋', '你們'),
    ('佢哋', '他們'),
    ('即係', '即是'),
    ('而家', '現在'),
    ('依家', '現在'),
    ('一齊', '一起'),
    ('鍾意', '喜歡'),
    ('知唔知', '知不知道'),
    ('得唔得', '可不可以'),
    ('係咪', '是不是'),
    ('係唔係', '是不是'),
    ('唔知', '不知道'),
    ('唔識', '不會'),
    ('唔好', '不要'),
    ('唔同', '不同'),
    ('唔係', '不是'),
    ('唔啱', '不對'),
    ('唔得', '不可以'),
    ('唔到', '不到'),
    ('唔可以', '不可以'),
    ('唔可', '不可'),
    ('唔需要', '不需要'),
    ('唔再', '不再'),
    ('再唔', '不再'),
    ('唔會', '不會'),
    ('唔過', '不過'),
    ('唔但', '不但'),
    ('唔一定', '不一定'),
    ('點解', '為什麼'),
    ('點樣', '怎樣'),
    ('點知', '怎麼知道'),
    ('點先', '怎樣才'),
    ('邊個', '哪一個'),
    ('邊度', '哪裡'),
    ('邊樣', '哪一種'),
    ('邊種', '哪一種'),
    ('搵到', '找到'),
    ('搵唔到', '找不到'),
    ('搵返', '找回'),
    ('做嘢', '做事'),
    ('搞掂', '辦妥'),
    ('多謝晒', '十分感謝'),
    ('多謝', '謝謝'),
    ('辛苦晒', '辛苦了'),
    ('嗰啲', '那些'),
    ('呢啲', '這些'),
    ('呢個', '這個'),
    ('嗰個', '那個'),
    ('呢度', '這裡'),
    ('嗰度', '那裡'),
    ('成日', '經常'),
    ('一陣間', '一會兒'),
    ('好彩', '幸好'),
    ('唔該', '請'),
    ('喺度', '在這裡'),
    ('喺呢度', '在這裡'),
    ('喺嗰度', '在那裡'),
    ('返學', '上學'),
    ('返工', '上班'),
    ('好似', '好像'),
    ('幾大', '多大'),
    ('幾多', '多少'),
    ('幾耐', '多久'),
    ('幾時', '何時'),
    ('啱啱', '剛剛'),
    ('啱先', '剛才'),
    ('得閒', '有空'),
    ('話晒', '畢竟'),
    ('細個', '小時候'),
    ('細路', '小朋友'),
    ('做咗', '做了'),
    ('學咗', '學了'),
    ('講咗', '說了'),
    ('話咗', '說過'),
    ('用咗', '用了'),
    ('食咗', '吃了'),
    ('放咗', '放了'),
    ('搵咗', '找了'),
    ('成咗', '成了'),
    ('變咗', '變了'),
    ('來咗', '來了'),
    ('去咗', '去了'),
    ('開咗', '開了'),
    ('完咗', '完了'),
    ('攞嚟', '拿來'),
    ('攞返', '拿回'),
    ('攞咗', '拿了'),
    ('擺埋一齊', '放在一起'),
    # 數學 context — 「返」表示重複動作
    ('等如', '等於'),
    ('點返', '點回'),
    ('加返', '加回'),
    ('減返', '減回'),
    ('補返', '補回'),
    ('搬返', '搬回'),
    ('放返', '放回'),
    ('扣返', '扣回'),
    ('收返', '收回'),
    ('返嚟', '回來'),
    ('返去', '回去'),
    ('幾重', '多重'),
    ('幾大', '多大'),
    ('幾遠', '多遠'),
    ('幾長', '多長'),
    ('幾闊', '多闊'),
    ('幾高', '多高'),
    ('幾深', '多深'),
    ('幾錢', '多少錢'),
    ('幾蚊', '多少元'),
    ('幾隻', '多少隻'),
    ('幾個', '多少個'),
    ('幾粒', '多少粒'),
    # 數學常見粵語連詞
    ('當作', '當作'),  # keep
    ('暫時', '暫時'),  # keep
]

# Tier 1: INDIVIDUAL chars — 100% 粵語特有（書面中文絕不用）
INDIVIDUAL = [
    ('嘅', '的'),
    ('咗', '了'),
    ('喺', '在'),
    ('唔', '不'),
    ('冇', '沒有'),
    ('啲', '些'),
    ('嗰', '那'),
    ('嚟', '來'),
    ('嘢', '東西'),
    ('揀', '選'),
    ('諗', '想'),
    ('佢', '他'),
    ('啱', '對'),
    ('哋', '們'),
    ('㗎', '的'),
    ('嘞', '了'),
    ('喇', '了'),
    ('喎', ''),
    ('啩', ''),
    ('呢', '這'),  # remaining individual after compound (e.g. 呢張卡 → 這張卡)
    ('搵', '找'),
    ('攞', '拿'),
    ('俾', '給'),
    ('畀', '給'),
    ('係', '是'),  # apply LAST (compound first)
]


def convert(text):
    """Apply all conversions to text."""
    for old, new in COMPOUND:
        text = text.replace(old, new)
    for old, new in INDIVIDUAL:
        text = text.replace(old, new)
    return text


def patch_file(path, dry_run=False):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        return f'READ_ERROR: {e}', 0

    new_content = convert(content)
    if new_content == content:
        return 'NO_CHANGES', 0

    diff_count = sum(1 for a, b in zip(content, new_content) if a != b)
    if len(new_content) != len(content):
        diff_count += abs(len(new_content) - len(content))

    if not dry_run:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(new_content)
    return f'OK ({diff_count} chars changed)', diff_count


if __name__ == '__main__':
    base = Path('.')
    dry_run = '--dry' in sys.argv

    targets = []
    targets.append(base / 'index.html')
    for ch in ['ch12', 'ch13', 'ch14', 'ch15', 'ch16', 'ch17', 'ch18', 'ch19']:
        for pattern in ['*.html', '*.md']:
            for p in (base / 'assets' / ch).glob(pattern):
                targets.append(p)
    for p in (base / 'assets' / 'common').glob('*.js'):
        targets.append(p)
    for p in (base / 'tools').glob('*.html'):
        targets.append(p)

    total_changed = 0
    total_chars = 0
    for p in targets:
        if not p.exists():
            continue
        result, count = patch_file(str(p), dry_run=dry_run)
        if 'OK' in result:
            total_changed += 1
            total_chars += count
            # print(f'{p.name}: {result}')

    print(f'\nTotal: {total_changed}/{len(targets)} files | {total_chars} chars changed')
    if dry_run:
        print('DRY RUN — no files written')
