"""
Bug #5 fix: 為冇 BGM 嘅 game files 加 BGM toggle + audio
Targets: ch13/game1 + ch14-16/game1-3 (10 files)
"""
import sys
import re
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')

BGM_BLOCK = '''
<!-- Game BGM (auto-injected 2026-05-05 fix Bug #5) -->
<audio id="bgmGame" src="../common/audio/game/bgm_battle.mp3" loop preload="auto"></audio>
<button id="bgmToggle" onclick="toggleBgm()" title="開／關背景音樂" style="position:fixed;top:60px;right:14px;z-index:9999;background:white;border:2px solid #FF8F00;border-radius:50%;width:42px;height:42px;cursor:pointer;font-size:1.2rem;box-shadow:0 4px 10px rgba(0,0,0,0.15);">🔇</button>
<script>
(function(){
  function toggleBgm(){
    var a=document.getElementById('bgmGame');var b=document.getElementById('bgmToggle');
    if(!a)return;
    if(a.paused){a.play().catch(function(){});b.textContent='🔊';}
    else{a.pause();b.textContent='🔇';}
  }
  window.toggleBgm=toggleBgm;
  // First user interaction triggers BGM autoplay (browser policy)
  function autoStart(){
    var a=document.getElementById('bgmGame');var b=document.getElementById('bgmToggle');
    if(a&&a.paused){a.play().catch(function(){});if(b)b.textContent='🔊';}
    document.removeEventListener('click',autoStart);
    document.removeEventListener('keydown',autoStart);
    document.removeEventListener('touchstart',autoStart);
  }
  document.addEventListener('click',autoStart,{once:true});
  document.addEventListener('keydown',autoStart,{once:true});
  document.addEventListener('touchstart',autoStart,{once:true});
})();
</script>
'''


def patch_file(path):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        return False, f'READ_ERROR: {e}'

    # Skip if BGM already injected
    if 'bgmGame' in content or 'bgm_battle.mp3' in content:
        return False, 'ALREADY_HAS_BGM'

    # Inject after first <body...> tag
    new_content, n = re.subn(r'(<body[^>]*>)', r'\1' + BGM_BLOCK, content, count=1)
    if n == 0:
        return False, 'NO_BODY_TAG'

    with open(path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    return True, 'OK'


if __name__ == '__main__':
    base = Path('.')
    targets = [
        base / 'assets' / 'ch13' / 'game1.html',
    ]
    for ch in ['ch14', 'ch15', 'ch16']:
        for g in [1, 2, 3]:
            targets.append(base / 'assets' / ch / f'game{g}.html')

    success = 0
    for p in targets:
        if not p.exists():
            print(f'SKIP (not found): {p}')
            continue
        ok, msg = patch_file(str(p))
        status = 'OK' if ok else msg
        print(f'{status}: {p}')
        if ok:
            success += 1

    print(f'\n{success}/{len(targets)} files patched with BGM')
