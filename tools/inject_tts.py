"""Inject Cantonese TTS narration into ch13-16 slides{1,2,3}.html files."""
import re
from pathlib import Path

ROOT = Path("G:/My Drive/LWWF/Claude code/NotebookLM/website/assets")

# Narration text for every slide deck (15 pages each, indexed 1-15)
# Format: (chapter, deck_idx) -> {pageNum: narration_text}
# All narrations are Traditional Chinese Cantonese, ≤50 characters per page
NARRATIONS = {
    (13, 1): {  # 一位小數 × 整數
        1: "歡迎嚟到第十三課簡報一，今集學一位小數乘以整數。",
        2: "睇下哆啦A夢嘅介紹：先當整數計，再加返小數點。",
        3: "重點：先去掉小數點，當普通乘法計，記住答案要點返小數位。",
        4: "睇例題：0.6 乘 7 點計？6 乘 7 等如四十二，加返一位小數。",
        5: "請睇清題目，揀啱嘅答案。記住先當整數計。",
        6: "答啱啦！0.6 乘 7 等如 4.2，估算用 1 乘 7 約等如 7。",
        7: "輪到 1.4 乘 5。請揀啱答案，記得估算 check 小數點位置。",
        8: "1.4 乘 5 等如 7.0，14 乘 5 等如七十，加一位小數。",
        9: "下一題填充題：3.7 乘 8 等於幾？自己列直式計。",
        10: "答案 29.6，37 乘 8 等如 296，加返一位小數。",
        11: "應用題：悟空買 5 條香蕉每條 2.3 元，共幾錢？",
        12: "答 11.5 元，2.3 乘 5 等如十一點五。估算 2 乘 5 等如十蚊。",
        13: "陷阱題！6.4 乘 9 嘅答案要小心，估算下先。",
        14: "答 57.6，64 乘 9 等如 576，唔係 5.76 呀！估算 6 乘 9 約 54。",
        15: "簡報一完成！記住：估算可以幫你 check 小數點位置啱唔啱。"
    },
    (13, 2): {  # 兩位小數 × 整數
        1: "歡迎嚟到第十三課簡報二，今集學兩位小數乘以整數。",
        2: "兩位小數即係小數點後有兩個位，例如 0.25 同 1.36。",
        3: "重點：去掉小數點當整數計，答案要保留兩位小數。",
        4: "睇例題：0.25 乘 4。25 乘 4 等如 100，加返兩位小數。",
        5: "請睇清題目，揀啱答案。記得數小數位。",
        6: "答啱啦！記住小數位數要對齊。",
        7: "下一題：兩位小數乘整數，要小心進位。",
        8: "睇答案解釋：先當整數乘，再點返小數點。",
        9: "輪到填充題，自己嚟。記得列直式。",
        10: "答案核對啦，估算可以驗證答案合理性。",
        11: "應用題：購物題目要分清單價同數量。",
        12: "悟空買嘢嘅例子：兩位小數元乘張數。",
        13: "陷阱題！小數點要點啱位置，唔好少咗或多咗。",
        14: "用估算驗證：原本數約嘅大細乘以整數，check 答案有冇錯。",
        15: "簡報二完成！繼續做預習鞏固兩位小數乘法。"
    },
    (13, 3): {  # 估算技巧深化 + 整合應用
        1: "歡迎嚟到第十三課簡報三，今集深化估算技巧同整合應用。",
        2: "估算嘅用途：check 小數點位置啱唔啱、預測答案合理範圍。",
        3: "重點口訣：原本數約成接近嘅整數，再做乘法計算。",
        4: "示範例題：3.8 乘 6 估算 4 乘 6 等如二十四，實際接近。",
        5: "請揀啱估算答案。記住：估算唔係要求精確值。",
        6: "答啱！估算同實際值要相近，差太遠就要再 check。",
        7: "下一題挑戰：用估算捉錯位嘅小數點。",
        8: "答案解釋：原本數同估算數要互相驗證。",
        9: "整合應用題：將估算同實際計算結合。",
        10: "完整解題流程：先估算，再計算，最後 check 合理性。",
        11: "應用題：買嘢、計尺寸都要用估算驗證答案。",
        12: "得到答案後，問自己：呢個數合唔合理？",
        13: "陷阱題！用估算識破小數點放錯嘅錯誤。",
        14: "重點總結：估算係小數乘法嘅救命繩，永遠記得用。",
        15: "第十三課完成！恭喜你掌握咗小數乘法同估算技巧。"
    },
    (14, 1): {  # 一位小數 × 一位小數
        1: "歡迎嚟到第十四課簡報一，今集學一位小數乘以一位小數。",
        2: "兩個小數相乘，小數位數要相加。一位乘一位等如兩位小數。",
        3: "重點：先當整數計，最後答案要點返兩位小數位。",
        4: "睇例題：0.3 乘 0.4。3 乘 4 等如 12，兩位小數即係 0.12。",
        5: "請揀啱答案。記得數埋兩個小數位。",
        6: "答啱！0.3 乘 0.4 等如 0.12，唔係 0.012 或者 1.2。",
        7: "下一題：兩個一位小數相乘，小心唔好搞亂位數。",
        8: "答案核對：答案要係兩位小數，唔係一位。",
        9: "填充題：自己列直式計，唔好心算錯。",
        10: "估算技巧：兩個細過 1 嘅數相乘，答案會更細。",
        11: "應用題：細路面積計算 0.5 米乘 0.8 米。",
        12: "答案 0.4 平方米，5 乘 8 等如 40，兩位小數即 0.40。",
        13: "陷阱題！小數位數加錯就會差十倍或一百倍。",
        14: "用估算驗證：兩個細過 1 嘅數相乘，答案要細過兩個原數。",
        15: "簡報一完成！記住：小數位數要相加先得啱答案。"
    },
    (14, 2): {  # 兩位小數 × 一位小數
        1: "歡迎嚟到第十四課簡報二，今集學兩位小數乘以一位小數。",
        2: "兩位乘一位，答案小數位數要係三位。",
        3: "重點：去掉所有小數點當整數計，最後加返三位小數。",
        4: "睇例題：0.25 乘 0.3。25 乘 3 等如 75，三位小數即 0.075。",
        5: "請揀啱答案。記住三位小數即係小數點後三個位。",
        6: "答啱！呢類題小數位最易計錯，慢慢數。",
        7: "下一題：兩位乘一位，估算下答案大細範圍。",
        8: "答案解釋：原本數細過 1，相乘結果更細。",
        9: "填充題：列直式時要對齊每個位。",
        10: "估算驗證：先估嚟看答案大細，發現異常即重計。",
        11: "應用題：日常生活中如尺寸、價錢都會用到。",
        12: "答案核對：跟估算對比，差太遠就要查錯位。",
        13: "陷阱題！前面零唔可以漏寫，0.075 唔係 0.75。",
        14: "用估算 check：0.25 約 0.3，乘 0.3 約 0.09，所以 0.075 合理。",
        15: "簡報二完成！繼續練習兩位乘一位嘅小數計算。"
    },
    (14, 3): {  # 兩位小數 × 兩位小數 + 應用題
        1: "歡迎嚟到第十四課簡報三，今集學兩位小數乘以兩位小數加應用題。",
        2: "兩位乘兩位，答案小數位數係四位。最易計錯就係呢類。",
        3: "重點：先當整數做完先，最後一次過點返四位小數。",
        4: "睇例題：0.12 乘 0.34。12 乘 34 等如 408，四位即 0.0408。",
        5: "請揀啱答案。記住四位小數即係小數點後四個位。",
        6: "答啱！呢類題答案會非常細，要好細心點小數點。",
        7: "應用題一：面積計算用咗小數乘法。",
        8: "答案解釋：邊長兩位小數，面積就係四位小數。",
        9: "應用題二：金錢計算同物資購買都會出現。",
        10: "估算技巧：兩個細數相乘，答案一定更細。",
        11: "陷阱題：易俾零數搞亂，前面零唔可以省略。",
        12: "答案核對：用估算 check 大細範圍合唔合理。",
        13: "綜合應用題：解多步驟嘅問題要慢慢嚟。",
        14: "重點總結：小數位數規律 = 兩數小數位之和。",
        15: "第十四課完成！恭喜你完整掌握咗小數乘法。"
    },
    (15, 1): {  # 體積概念認識
        1: "歡迎嚟到第十五課簡報一，今集學體積概念認識。",
        2: "體積即係物件佔幾多空間。物件越大，體積越大。",
        3: "哆啦A夢拎出縮小燈，將大細變化展示體積概念。",
        4: "重點：體積係三維嘅，有長闊高三個方向。",
        5: "請睇清題目：邊個物件體積最大？比較大細。",
        6: "答啱！體積大細要從整體睇，唔係淨係睇一個面。",
        7: "下一題：認識日常生活中嘅體積例子。",
        8: "解釋：杯水、書本、波都有自己嘅體積。",
        9: "估算題：估下呢個盒子嘅體積有幾大。",
        10: "答案：估算唔需要好精確，知道大概範圍就得。",
        11: "應用題：擺嘢入箱要考慮體積。",
        12: "答啱！體積概念幫我哋解決日常嘅空間問題。",
        13: "陷阱題！體積唔係面積，唔可以混淆。",
        14: "重點：面積係兩維，體積係三維，記住分清楚。",
        15: "簡報一完成！繼續做預習鞏固體積概念。"
    },
    (15, 2): {  # 直觀比較體積
        1: "歡迎嚟到第十五課簡報二，今集學直觀比較體積。",
        2: "直觀比較即係用眼睇就估到大細。",
        3: "重點：將物件並排比較，先睇邊個明顯較大。",
        4: "示範：兩個盒子放埋一齊，邊個體積大？",
        5: "請揀體積較大嘅物件。記住睇整體唔係單面。",
        6: "答啱！比較體積要睇長闊高三方面。",
        7: "下一題：相同形狀但唔同大細嘅物件比較。",
        8: "解釋：相似形狀嘅物件，體積按比例變化。",
        9: "估算題：唔同形狀嘅物件點比較體積？",
        10: "答案：可以將物件分成同樣單位嚟比較。",
        11: "應用題：揀邊個盒裝得多嘢入面？",
        12: "答啱！日常買嘢揀嘢都用到體積比較。",
        13: "陷阱題！高嘅物件唔一定體積大，要全面睇。",
        14: "重點：高、闊、深三方面都要睇齊。",
        15: "簡報二完成！比較體積要綜合評估三個方向。"
    },
    (15, 3): {  # 照片限制 + 概念整合
        1: "歡迎嚟到第十五課簡報三，今集學照片限制同概念整合。",
        2: "照片只睇到二維，淨係睇照片有時估錯體積。",
        3: "重點：照片睇到嘅大細未必反映實際體積。",
        4: "示範：近啲嘅嘢喺照片睇起嚟大過遠啲嘅嘢。",
        5: "請揀啱答案：邊個比較合理估計？",
        6: "答啱！照片限制要記住，唔可以淨睇大細。",
        7: "下一題：點樣超越照片限制做估算？",
        8: "解釋：要參考參照物，例如旁邊嘅人或者尺。",
        9: "估算題：用參照物嚟估計實際體積。",
        10: "答案：參照物幫我哋掌握真實大細比例。",
        11: "整合應用：將前兩堂概念用嚟解現實題。",
        12: "答啱！體積概念要結合視角同參照物嚟用。",
        13: "陷阱題！單純睇照片大細容易俾誤導。",
        14: "重點總結：體積、視角、參照物三者結合先準。",
        15: "第十五課完成！恭喜你掌握體積概念同照片限制。"
    },
    (16, 1): {  # 認識 cm³ + 量度
        1: "歡迎嚟到第十六課簡報一，今集學認識立方厘米同量度。",
        2: "一個邊長一厘米嘅立方體就係一個立方厘米。",
        3: "重點：立方厘米寫做 cm 三次方，係細嘅體積單位。",
        4: "示範：一粒骰仔大約等如一立方厘米。",
        5: "請揀啱：立方厘米適合量邊類物件？",
        6: "答啱！立方厘米適合量細物件，例如骰仔同小波。",
        7: "下一題：點數一個物件嘅立方厘米數？",
        8: "解釋：將物件分成 1cm³ 細格，數總數。",
        9: "估算題：估下呢個盒含幾多立方厘米。",
        10: "答案：用長乘闊乘高就係體積總立方厘米。",
        11: "應用題：細盒子嘅體積點計算？",
        12: "答啱！立方厘米適合日常細物件量度。",
        13: "陷阱題！立方厘米唔係厘米，三維唔係一維。",
        14: "重點：立方厘米係體積單位，唔好同長度單位混淆。",
        15: "簡報一完成！記住立方厘米嘅大細同用法。"
    },
    (16, 2): {  # 估計 + 認識 m³
        1: "歡迎嚟到第十六課簡報二，今集學估計同認識立方米。",
        2: "立方米係邊長一米嘅立方體，比立方厘米大百萬倍。",
        3: "重點：立方米寫做 m 三次方，係大嘅體積單位。",
        4: "示範：一架細車嘅貨櫃大約幾個立方米。",
        5: "請揀啱：立方米適合量邊類物件？",
        6: "答啱！立方米適合量大物件，例如房間同貨櫃。",
        7: "下一題：點估計大物件嘅立方米數？",
        8: "解釋：分清楚 1m³ 嘅大細，再用嚟估算。",
        9: "估算題：估下教室有幾多立方米。",
        10: "答案：教室大約 200 立方米左右。",
        11: "應用題：搬屋運貨要用立方米計算。",
        12: "答啱！立方米係日常裝載量度嘅單位。",
        13: "陷阱題！立方米同立方厘米換算要記住係百萬倍。",
        14: "重點：1 立方米等如 1,000,000 立方厘米。",
        15: "簡報二完成！記住立方米同立方厘米嘅換算關係。"
    },
    (16, 3): {  # 選擇單位 + 應用
        1: "歡迎嚟到第十六課簡報三，今集學選擇單位同應用。",
        2: "唔同物件用唔同單位，先簡單先準確。",
        3: "重點：細物件用立方厘米，大物件用立方米。",
        4: "示範：杯水用毫升，房間用立方米。",
        5: "請揀啱單位：呢個物件用咩單位最合理？",
        6: "答啱！單位選擇睇物件大細，避免太多零或太細數。",
        7: "下一題：物件單位轉換點計？",
        8: "解釋：1 立方米等如 1,000,000 立方厘米，要記實。",
        9: "估算題：將立方厘米換成立方米要除一百萬。",
        10: "答案：單位轉換用倍數計算，唔好計錯小數位。",
        11: "應用題：搬家、入箱、買水都要識單位選擇。",
        12: "答啱！單位選擇影響數字長短同方便程度。",
        13: "陷阱題！立方厘米同立方米換算最易錯。",
        14: "重點總結：選對單位 = 數字簡單 + 計算方便 + 答案合理。",
        15: "第十六課完成！恭喜你掌握體積單位同實際應用。"
    },
}


def make_narration_js(narrations):
    """Build JS object literal from narrations dict {1:'text', 2:'text'...}."""
    lines = []
    for page_num in sorted(narrations.keys()):
        text = narrations[page_num].replace("'", "\\'")
        lines.append(f"  {page_num}: '{text}'")
    return "{\n" + ",\n".join(lines) + "\n}"


def inject_tts(file_path: Path, narrations: dict) -> bool:
    """Inject TTS code, mute button, and PAGE_NARRATION into the slides HTML file."""
    content = file_path.read_text(encoding='utf-8')

    # Skip if already injected
    if 'PAGE_NARRATION' in content:
        print(f"  ALREADY INJECTED, skipping: {file_path.name}")
        return False

    # Build PAGE_NARRATION JS literal
    narration_js = make_narration_js(narrations)

    # Build TTS script block (placed before `buildThumbs();`)
    tts_block = f"""
// === Cantonese TTS Narration (zh-HK) ===
const PAGE_NARRATION = {narration_js};

let isMuted = false;
let _yueVoice = null;

function pickYueVoice() {{
  if (!window.speechSynthesis) return null;
  const voices = speechSynthesis.getVoices();
  return voices.find(v => v.lang === 'yue-HK')
      || voices.find(v => v.lang === 'zh-HK')
      || voices.find(v => v.lang && v.lang.startsWith('zh-'))
      || null;
}}

if (window.speechSynthesis) {{
  speechSynthesis.onvoiceschanged = () => {{ _yueVoice = pickYueVoice(); }};
  setTimeout(() => {{ if (!_yueVoice) _yueVoice = pickYueVoice(); }}, 500);
}}

function speakPage(pageNum) {{
  if (isMuted || !window.speechSynthesis) return;
  speechSynthesis.cancel();
  const text = PAGE_NARRATION[pageNum];
  if (!text) return;
  try {{
    const u = new SpeechSynthesisUtterance(text);
    if (!_yueVoice) _yueVoice = pickYueVoice();
    if (_yueVoice) u.voice = _yueVoice;
    u.lang = 'zh-HK';
    u.rate = 1.0;
    u.pitch = 1.0;
    speechSynthesis.speak(u);
  }} catch(e) {{ /* ignore TTS errors */ }}
}}

function toggleMute() {{
  isMuted = !isMuted;
  const btn = document.getElementById('muteBtn');
  if (btn) btn.textContent = isMuted ? '\\ud83d\\udd07' : '\\ud83d\\udd0a';
  if (isMuted) speechSynthesis.cancel();
  else speakPage(idx + 1);
}}
// === End TTS ===

"""

    # Mute button HTML (placed right after </header>)
    mute_btn_html = (
        '\n<button id="muteBtn" onclick="toggleMute()" '
        'title="開／關廣東話講解" '
        'style="position:fixed;top:64px;right:14px;z-index:99;background:white;'
        'border:2px solid #1565C0;border-radius:50%;width:42px;height:42px;'
        'cursor:pointer;font-size:1.2rem;box-shadow:0 2px 8px rgba(0,0,0,0.2);">'
        '\U0001F50A</button>\n'
    )

    # 1. Insert mute button after </header>
    if '</header>' not in content:
        print(f"  ERROR: no </header> in {file_path.name}")
        return False
    content = content.replace('</header>', '</header>' + mute_btn_html, 1)

    # 2. Inject TTS block before `buildThumbs();` line
    # Find the line "buildThumbs();" near end of script
    if 'buildThumbs();' not in content:
        print(f"  ERROR: no buildThumbs(); in {file_path.name}")
        return False
    # Insert before buildThumbs();
    content = content.replace('buildThumbs();', tts_block + 'buildThumbs();', 1)

    # 3. Add `speakPage(idx+1);` call inside render() function
    # Find pattern: "  // Hide quiz when rendering a new page" and add speakPage before it
    quiz_hide_marker = '  // Hide quiz when rendering a new page\n  quizOv.classList.remove(\'show\');'
    if quiz_hide_marker in content:
        new_marker = '  speakPage(idx + 1);\n\n' + quiz_hide_marker
        content = content.replace(quiz_hide_marker, new_marker, 1)
    else:
        # Fallback: add after `pfill.style.width = ...`
        pattern = r"(pfill\.style\.width\s*=\s*Math\.round\(\(idx\+1\)/TOTAL\*100\)\s*\+\s*'%';)"
        match = re.search(pattern, content)
        if match:
            content = content.replace(match.group(0), match.group(0) + '\n  speakPage(idx + 1);', 1)
        else:
            print(f"  WARN: could not find render() injection point in {file_path.name}")

    # 4. Trigger first speak after page load — append after `render();` (last occurrence near end of script)
    # The line "render();" appears multiple times. We want the last one before </script> just after buildThumbs();
    # Since render() now calls speakPage on every render, the initial render() call will trigger it.
    # But voices may not be loaded yet. Add explicit retry after voice load.
    # Actually render() will call speakPage(1) on initial load. The onvoiceschanged handler ensures voices are loaded.
    # If voices not loaded yet during first render, speakPage will not find _yueVoice but TTS browser default may work.
    # Add a small retry to call speakPage(1) once voices loaded.
    init_speak_retry = """
// Initial speak retry once voices are loaded
if (window.speechSynthesis) {
  setTimeout(() => { if (!isMuted) speakPage(idx + 1); }, 800);
}
"""
    # Append before </script> after render();
    # Find "buildThumbs();\nrender();" pattern
    if 'buildThumbs();\nrender();\n</script>' in content:
        content = content.replace(
            'buildThumbs();\nrender();\n</script>',
            'buildThumbs();\nrender();\n' + init_speak_retry + '</script>',
            1
        )
    elif 'render();\n</script>' in content:
        content = content.replace(
            'render();\n</script>',
            'render();\n' + init_speak_retry + '</script>',
            1
        )

    file_path.write_text(content, encoding='utf-8')
    print(f"  OK injected: {file_path.name}")
    return True


def main():
    total_files = 0
    total_narrations = 0
    for ch in [13, 14, 15, 16]:
        for n in [1, 2, 3]:
            file_path = ROOT / f"ch{ch}" / f"slides{n}.html"
            if not file_path.exists():
                print(f"MISS: {file_path}")
                continue
            narrations = NARRATIONS.get((ch, n))
            if not narrations:
                print(f"NO NARRATION DEFINED for ch{ch} slides{n}")
                continue
            print(f"ch{ch} slides{n}.html ({len(narrations)} pages):")
            ok = inject_tts(file_path, narrations)
            if ok:
                total_files += 1
                total_narrations += len(narrations)
    print(f"\nTotal files updated: {total_files}")
    print(f"Total narration entries: {total_narrations}")


if __name__ == "__main__":
    main()
