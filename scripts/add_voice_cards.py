"""
Add voice1/2/3 cards + STEP_KEYS entries to ch13/14/15/16 chapter index.
Each voice card mirrors slides/assess pattern (1:1:1 mapping).
"""
import sys
import re
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')

VOICE_LO = {
    13: ['一位小數×整數', '兩位小數×整數', '估算 + 應用'],
    14: ['一位×一位 = 兩位小數', '兩位×一位 + 四捨五入', '生活應用'],
    15: ['體積定義（固液氣）', '直觀比較體積', '照片限制 + 單位'],
    16: ['認識 cm³', '認識 m³ + 換算', '選擇單位 cm³/m³'],
}

VOICE_SUBGROUP_HTML = '''    <div class="subgroup-label" style="margin-top:14px;color:#7B1FA2;">🎤 錄音回答區（3 個簡報嘅錄音題 · 每題最多 3 🪙）</div>
    <div class="region-content">
      <a href="voice1.html" class="card voice" data-key="voice1" style="border-color:#CE93D8;background:linear-gradient(135deg,#ffffff,#F3E5F5);">
        <div class="coin-badge">+3 🪙</div>
        <span class="done-badge">✓</span>
        <div class="card-emoji">🎤</div>
        <div class="card-title" style="color:#6A1B9A;">錄音題 1</div>
        <div class="card-desc">{lo1} · 對應簡報 1</div>
        <span class="arrow">▶</span>
      </a>
      <a href="voice2.html" class="card voice" data-key="voice2" style="border-color:#CE93D8;background:linear-gradient(135deg,#ffffff,#F3E5F5);">
        <div class="coin-badge">+3 🪙</div>
        <span class="done-badge">✓</span>
        <div class="card-emoji">🎤</div>
        <div class="card-title" style="color:#6A1B9A;">錄音題 2</div>
        <div class="card-desc">{lo2} · 對應簡報 2</div>
        <span class="arrow">▶</span>
      </a>
      <a href="voice3.html" class="card voice" data-key="voice3" style="border-color:#CE93D8;background:linear-gradient(135deg,#ffffff,#F3E5F5);">
        <div class="coin-badge">+3 🪙</div>
        <span class="done-badge">✓</span>
        <div class="card-emoji">🎤</div>
        <div class="card-title" style="color:#6A1B9A;">錄音題 3</div>
        <div class="card-desc">{lo3} · 對應簡報 3</div>
        <span class="arrow">▶</span>
      </a>
    </div>
  </div>'''


def patch_chapter(ch):
    base = Path('.')
    f = base / 'assets' / f'ch{ch}' / 'index.html'
    if not f.exists():
        return False, 'NOT_FOUND'
    with open(f, 'r', encoding='utf-8') as fh:
        content = fh.read()

    if 'voice1.html' in content:
        return False, 'ALREADY_HAS_VOICE'

    los = VOICE_LO.get(ch, ['', '', ''])
    voice_block = VOICE_SUBGROUP_HTML.format(lo1=los[0], lo2=los[1], lo3=los[2])

    # Find pattern: assess3 card </a> followed by </div> (close region-content) </div> (close region-section)
    # Replace last </div></div> of 區域 1 with voice block + closing
    # Pattern: </a> then </div> (region-content) then </div> (region-section), all leading 區域 2
    # Simpler: find "<!-- ======== 區域 2" and insert before that
    region2_marker = '<!-- ======== 區域 2 · 總結區 ======== -->'
    if region2_marker not in content:
        return False, 'NO_REGION2_MARKER'

    # Find last </div></div> before region2 marker — this is end of region 1
    # We want to insert voice subgroup BEFORE the </div> that closes region-section of 區域 1
    # Pattern: assess3 link... </a>\n    </div>\n  </div>\n\n  <!-- ====... 區域 2
    # Replace "    </div>\n  </div>\n\n  <!-- ======== 區域 2" → "(voice block)\n  </div>\n\n  <!-- 區域 2"

    # Find the last "</div>\n  </div>\n\n  <!-- ======== 區域 2" pattern
    pattern = re.compile(r'(    </div>\n)(  </div>\n\n  ' + re.escape(region2_marker) + ')')
    m = pattern.search(content)
    if not m:
        # Try without space variations
        pattern2 = re.compile(r'(    </div>\s*\n)(\s*</div>\s*\n\s*\n\s*' + re.escape(region2_marker) + ')')
        m = pattern2.search(content)
        if not m:
            return False, 'PATTERN_NOT_FOUND'

    # Replace: keep first </div> (close last region-content), insert voice block, then close region-section
    new_content = content[:m.start()] + m.group(1) + voice_block + '\n\n  ' + region2_marker + content[m.end():]

    # Also patch STEP_KEYS — add voice1/2/3 entries before summary entry (which is already last)
    # Pattern: { k: 'summary', n: '課程總結', emoji: '📋' },
    step_pattern = re.compile(r"(\s*\{ k: 'summary', n: '課程總結', emoji: '📋' \},)")
    voice_steps = """\n    { k: 'voice1', n: '錄音題 1', emoji: '🎤' }, { k: 'voice2', n: '錄音題 2', emoji: '🎤' }, { k: 'voice3', n: '錄音題 3', emoji: '🎤' },"""
    new_content = step_pattern.sub(voice_steps + r'\1', new_content)

    with open(f, 'w', encoding='utf-8') as fh:
        fh.write(new_content)
    return True, 'OK'


if __name__ == '__main__':
    for ch in [13, 14, 15, 16]:
        ok, msg = patch_chapter(ch)
        print(f'{"OK" if ok else msg}: ch{ch}/index.html')
