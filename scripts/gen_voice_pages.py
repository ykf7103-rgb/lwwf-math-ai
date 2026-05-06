"""
Generate 15 voice question pages for ch12-16.
Each chapter has 3 voice pages (voice1, voice2, voice3) corresponding to slides1/2/3.
Each voice page:
- Horizontal info image (info1.png / info2.png / info3.png)
- LO display panel
- Voice prompt + RUBRIC tied to slide LO
- AI consolidated transcript display
- AI grading + 1-3 coins
"""
import sys
import io
import os
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')

# ============================================================
# 5 章 × 3 voice = 15 條題目 + RUBRIC（基於每個簡報 LO）
# ============================================================
CHAPTERS = {
    12: {
        'title': '小數乘法',
        'theme_color': '#1565C0',
        'voices': [
            {
                'lo': '簡報 1 — 小數點向右移（×10/×100/×1000）',
                'prompt': '請用粵語講出乘以 10、100、1000 嘅口訣（小數點向邊個方向移幾多位），並舉一個例子（例：0.36 × 10 等如幾多）。',
                'rubric': '×10 小數點向右移 1 位；×100 向右移 2 位；×1000 向右移 3 位。學生應講出方向（右）+ 移位數同 0 嘅個數對應 + 1 個例子。',
            },
            {
                'lo': '簡報 2 — 小數點向左移（×0.1/×0.01/×0.001）',
                'prompt': '請用粵語講出乘以 0.1、0.01、0.001 嘅口訣（小數點向邊個方向移幾多位），並舉一個例子（例：4.5 × 0.1 等如幾多）。',
                'rubric': '×0.1 等如除以 10，小數點向左移 1 位；×0.01 移 2 位；×0.001 移 3 位。學生應講出方向（左）+ 同除法嘅關係 + 1 個例子。',
            },
            {
                'lo': '簡報 3 — 單位換算（公斤↔克 / 米↔厘米 / 升↔毫升）',
                'prompt': '請用粵語講出 1 公斤等如幾多克、1 米等如幾多厘米，並舉一個生活應用例子（例：1.5 公斤蘋果等如幾多克）。',
                'rubric': '1 公斤 = 1000 克；1 米 = 100 厘米；1 升 = 1000 毫升。大單位變細用乘法（×倍率），細變大用除法。學生應講出至少 1 對換算 + 應用例子。',
            },
        ],
    },
    13: {
        'title': '小數乘法（一）',
        'theme_color': '#1565C0',
        'voices': [
            {
                'lo': '簡報 1 — 一位小數乘整數（直式 3 步驟）',
                'prompt': '請用粵語講出一位小數乘整數嘅 3 步驟（直式右對齊、當整數計、點返小數），並舉一個例子（例：0.6 × 7 點計）。',
                'rubric': '步驟 1：直式右對齊（暫時忽略小數點）。步驟 2：當整數計，6 × 7 = 42。步驟 3：點返小數點 1 位，因為一位小數。學生應講出至少 2 步驟 + 1 個例子。',
            },
            {
                'lo': '簡報 2 — 兩位小數乘整數 + 去零斬',
                'prompt': '請用粵語講出兩位小數乘整數嘅做法（例 2.45 × 3），仲有橫式答案末尾嘅 0 點處理（去零斬）。',
                'rubric': '兩位小數乘整數 — 將小數當整數計（245 × 3 = 735），答案點返 2 位小數（7.35）。橫式末尾嘅 0 必須刪去（如 9.90 → 9.9）。學生應講出步驟 + 去零嘅例子。',
            },
            {
                'lo': '簡報 3 — 火眼金睛估算法',
                'prompt': '請用粵語解釋火眼金睛估算法 — 點樣將原本數約成最接近嘅整數，幫你 check 答案合理性。舉一個例子。',
                'rubric': '估算法：將小數約成最接近嘅整數（如 3.8 約成 4），用整數乘法快速得出大概答案範圍。實際答案應該接近估算值；如果差好遠，代表小數點放錯位。學生應講出方法 + 用途 + 例子。',
            },
        ],
    },
    14: {
        'title': '小數乘法（二）',
        'theme_color': '#FB8C00',
        'voices': [
            {
                'lo': '簡報 1 — 一位小數 × 一位小數 = 兩位小數',
                'prompt': '請用粵語講出一位小數乘一位小數嘅 3 大 Combo 法則（靠右對齊、整數狂打、結算位數），並舉一個例子（例：0.4 × 0.2 點計）。',
                'rubric': 'Combo 1：靠右對齊（無視小數點）。Combo 2：當作整數乘法（4 × 2 = 8）。Combo 3：結算小數點位數（一位 + 一位 = 兩位小數），所以 0.4 × 0.2 = 0.08（要補零）。學生應講出至少 2 Combo + 1 個例子。',
            },
            {
                'lo': '簡報 2 — 兩位 × 一位 + 四捨五入',
                'prompt': '請用粵語講出 2.35 × 0.7 嘅算法（包括估算、整數計、點返小數），仲有四捨五入符號 ≈ 嘅意義。',
                'rubric': '估算 2 × 1 = 2，所以答案接近 2。直式 235 × 7 = 1645，兩位 + 一位 = 三位小數，所以 = 1.645。≈ 表示「大約等於」，當需要取近似值時使用（如 1.645 ≈ 1.6 取一位小數）。學生應講出步驟 + ≈ 嘅意思。',
            },
            {
                'lo': '簡報 3 — 應用題（生活情境）',
                'prompt': '請用粵語講出小數乘法嘅生活應用例子（如買嘢計總價、計面積、計距離），同埋為什麼要用四捨五入處理答案。',
                'rubric': '生活應用：買嘢（單價 × 數量 = 總價）、面積（長 × 闊）、距離（速率 × 時間）。錢嘅單位最細到毫子（0.1 元），所以 0.08 元嘅答案要四捨五入到合理單位。學生應講出 1 個應用 + 為何要近似。',
            },
        ],
    },
    15: {
        'title': '體積概念認識',
        'theme_color': '#FB8C00',
        'voices': [
            {
                'lo': '簡報 1 — 體積定義（固液氣三態）',
                'prompt': '請用粵語解釋「體積」嘅意思，講出固體、液體、氣體分別都有體積嘅例子（每種講 1 個）。',
                'rubric': '體積 = 物體所佔空間嘅大小。固體例：火龍果、書本（佔住房間嘅空間）。液體例：葡萄汁喺瓶子裡（佔住瓶內空間）。氣體例：氣球內嘅空氣（撐起氣球）。學生應講出定義 + 至少 2 種狀態嘅例子。',
            },
            {
                'lo': '簡報 2 — 直觀比較體積（不用單位）',
                'prompt': '請用粵語解釋直觀比較體積嘅 3 大訣竅（不用算式 / 不用數字 / 用眼睛觀察），並舉一個例子（例：火龍果同奇異果邊個體積大）。',
                'rubric': '直觀比較：用眼睛觀察邊個物件佔嘅空間多。3 大訣竅 — 不用算式、不用數字、不用工具。例子：火龍果明顯大過奇異果，所以火龍果體積較大。學生應講出方法 + 1 個例子。',
            },
            {
                'lo': '簡報 3 — 照片限制（為何需要單位）',
                'prompt': '請用粵語解釋為什麼唔同照片嘅物件唔可以直接比較體積，要用咩嘢（單位）先可以準確比較。',
                'rubric': '唔同照片有唔同拍攝距離同角度，照片裡嘅大細唔等於實際體積（例：黃豆特寫睇起嚟比西瓜田大）。要準確比較必須用標準單位（如下一課嘅 cm³）。學生應講出原因 + 用單位嘅必要性。',
            },
        ],
    },
    16: {
        'title': '體積的量度',
        'theme_color': '#43A047',
        'voices': [
            {
                'lo': '簡報 1 — cm³ 與量度體積',
                'prompt': '請用粵語解釋 1 cm³ 嘅意思，講出點樣用 cm³ 數粒嚟量度立體嘅體積（記得計埋隱藏方塊）。',
                'rubric': '1 cm³ = 邊長 1 厘米嘅立方體，係體積標準單位。量度方法：將立體拆分成 1 cm³ 數粒，數總數就係體積。要記得計撐起頂層嘅隱藏底層方塊（睇唔到都要計）。學生應講出定義 + 量度方法 + 隱藏方塊提醒。',
            },
            {
                'lo': '簡報 2 — m³ 與單位換算',
                'prompt': '請用粵語解釋 m³ 同 cm³ 嘅關係：1 m³ 等於幾多 cm³，並舉一個生活例子（例：貨櫃 / 大壩用 m³ 量度）。',
                'rubric': '1 m³ = 邊長 1 米嘅立方體，係表示巨大物體體積嘅單位。換算：1 m = 100 cm，所以 1 m³ = 100 × 100 × 100 = 1,000,000 cm³（一百萬倍）。生活例：貨櫃約 77 m³，大壩約 7,000,000 m³。學生應講出換算 + 1 個 m³ 例子。',
            },
            {
                'lo': '簡報 3 — 選擇合適單位',
                'prompt': '請用粵語解釋點樣決定用 cm³ 定 m³ 量度物體，邊啲物件用邊個單位（舉例對比）。',
                'rubric': '單位選擇：細物件用 cm³（如魔方、書包、手機），大物件用 m³（如巴士、貨櫃、房間）。1 m³ 結界 — 物體比一個展開雙臂嘅箱子大就用 m³。如果用錯單位，數字會變得太大或太細，唔方便溝通。學生應講出規則 + 至少 1 對對比例子。',
            },
        ],
    },
}


def voice_html_template(chapter, voice_num, voice_data, theme_color, chapter_title):
    """Generate voice{N}.html file content."""
    lo = voice_data['lo']
    prompt = voice_data['prompt']
    rubric = voice_data['rubric']
    info_img = f'images/info{voice_num}.png'
    title_full = f'第 {chapter} 課 · 錄音題 {voice_num}'

    return f'''<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title_full}</title>
<style>
* {{ box-sizing: border-box; -webkit-tap-highlight-color: transparent; }}
body {{ font-family: -apple-system, 'PingFang TC', 'Microsoft JhengHei', sans-serif; margin: 0; padding: 0; background: linear-gradient(135deg, #FFF9F0, #FFE5D0); min-height: 100vh; color: #222; }}
.wrap {{ max-width: 880px; margin: 0 auto; padding: 18px; }}
.intro {{ background: linear-gradient(135deg, #E3F2FD, #BBDEFB); border-left: 5px solid {theme_color}; padding: 16px 20px; border-radius: 12px; margin-bottom: 14px; line-height: 1.7; color: #0D47A1; }}
.intro b {{ color: {theme_color}; }}
.lo-panel {{ background: linear-gradient(135deg, #FFF8E1, #FFECB3); border-left: 5px solid #FF8F00; padding: 14px 18px; border-radius: 10px; margin-bottom: 14px; line-height: 1.7; color: #5D4037; }}
.lo-panel h3 {{ margin: 0 0 6px; color: #E65100; font-size: 1.05rem; }}
.summary-img {{ width: 100%; max-width: 880px; border-radius: 16px; box-shadow: 0 6px 22px rgba(0,0,0,0.12); margin-bottom: 18px; cursor: zoom-in; transition: transform 0.3s; }}
.summary-img:hover {{ transform: scale(1.01); }}
.recorder {{ background: white; border-radius: 16px; padding: 22px; box-shadow: 0 4px 14px rgba(0,0,0,0.08); border: 3px solid #FFB74D; margin-bottom: 14px; }}
.recorder h2 {{ margin: 0 0 10px; color: #E65100; font-size: 1.15rem; }}
.recorder p {{ color: #666; margin: 4px 0 14px; font-size: 0.92rem; line-height: 1.6; }}
.btn-record {{ padding: 14px 28px; background: linear-gradient(135deg, #FF7043, #E64A19); color: white; border: none; border-radius: 28px; font-size: 1rem; font-weight: 800; cursor: pointer; box-shadow: 0 4px 10px rgba(229,73,25,0.3); display: inline-flex; align-items: center; gap: 8px; }}
.btn-record:hover {{ transform: translateY(-2px); box-shadow: 0 6px 14px rgba(229,73,25,0.4); }}
.btn-record.recording {{ background: linear-gradient(135deg, #C62828, #B71C1C); animation: pulse 1.2s infinite; }}
.btn-record:disabled {{ opacity: 0.5; cursor: not-allowed; }}
@keyframes pulse {{ 0%,100% {{ transform: scale(1); }} 50% {{ transform: scale(1.05); }} }}
.transcript-box {{ margin-top: 14px; padding: 12px 16px; background: #F5F5F5; border-radius: 10px; min-height: 60px; font-size: 0.95rem; color: #333; line-height: 1.6; border: 2px dashed #BDBDBD; }}
.transcript-box.has-content {{ border-color: #4CAF50; background: #E8F5E9; color: #1B5E20; }}
.transcript-box .placeholder {{ color: #999; font-style: italic; }}
.consolidated-box {{ margin-top: 12px; padding: 12px 16px; background: linear-gradient(135deg, #E1F5FE, #B3E5FC); border-radius: 10px; border-left: 4px solid #0288D1; font-size: 0.95rem; color: #01579B; line-height: 1.6; }}
.consolidated-box b {{ color: #0277BD; display: block; margin-bottom: 4px; }}
.btn-submit {{ margin-top: 12px; padding: 12px 28px; background: linear-gradient(135deg, #43A047, #2E7D32); color: white; border: none; border-radius: 24px; font-size: 0.98rem; font-weight: 800; cursor: pointer; }}
.btn-submit:disabled {{ opacity: 0.5; cursor: not-allowed; }}
.fallback-textarea {{ margin-top: 12px; width: 100%; min-height: 80px; padding: 10px 12px; border: 2px solid #BDBDBD; border-radius: 8px; font-family: inherit; font-size: 0.95rem; resize: vertical; }}
.result {{ display: none; background: white; border-radius: 16px; padding: 22px; box-shadow: 0 4px 14px rgba(0,0,0,0.08); }}
.result.show {{ display: block; animation: slideDown 0.4s; }}
@keyframes slideDown {{ from {{ opacity: 0; transform: translateY(-12px); }} to {{ opacity: 1; transform: translateY(0); }} }}
.score-big {{ font-size: 3.4rem; font-weight: 900; text-align: center; margin: 8px 0; }}
.score-big.tier-3 {{ color: #2E7D32; }}
.score-big.tier-2 {{ color: #F57C00; }}
.score-big.tier-1 {{ color: #1976D2; }}
.score-big.tier-0 {{ color: #C62828; }}
.coin-reward {{ text-align: center; font-size: 1.4rem; font-weight: 800; margin: 10px 0; }}
.feedback-box {{ background: linear-gradient(135deg, #FFF8E1, #FFECB3); padding: 14px 18px; border-radius: 10px; margin: 12px 0; border-left: 5px solid #FFB300; line-height: 1.7; color: #5D4037; }}
.tier-info {{ background: #F3E5F5; padding: 12px 16px; border-radius: 10px; font-size: 0.85rem; color: #4A148C; margin: 12px 0; }}
.tier-info table {{ width: 100%; }}
.tier-info td {{ padding: 4px 8px; }}
.btn-back {{ margin-top: 14px; padding: 10px 24px; background: linear-gradient(135deg, #1565C0, #0D47A1); color: white; border: none; border-radius: 22px; text-decoration: none; font-weight: 800; display: inline-block; }}
.loading {{ color: #666; font-style: italic; }}
</style>
</head>
<body>
<script src="../common/chapter-header.js?v=20260505t" data-current-ch="{chapter}"></script>

<div class="wrap">
  <div class="intro">
    <b>🎤 第 {chapter} 課 錄音題 {voice_num} — {chapter_title}</b><br>
    細閱下方資訊圖總結，然後用 <b>20-30 秒粵語</b>回答問題。<br>
    AI 老師會 <b>自動整理你嘅錄音句子</b>（去重複），再俾分。<b>85+ = 3 金幣 · 70+ = 2 金幣 · 60+ = 1 金幣</b>。
  </div>

  <div class="lo-panel">
    <h3>🎯 學習目標</h3>
    <div>{lo}</div>
  </div>

  <img class="summary-img" id="summaryImg" src="{info_img}" alt="第 {chapter} 課 簡報 {voice_num} 資訊圖" onerror="this.onerror=null;this.src='images/summary.png';" onclick="window.open(this.src,'_blank')">

  <div class="recorder" id="recorderPanel">
    <h2>🎤 錄音回答（粵語 · 20-30 秒）</h2>
    <p><b>問題：</b>{prompt}</p>
    <button class="btn-record" id="recordBtn" onclick="toggleRecord()">🎤 開始錄音</button>
    <div class="transcript-box" id="transcript"><span class="placeholder">錄音之後，文字會顯示喺呢度...</span></div>
    <details style="margin-top:12px;">
      <summary style="cursor:pointer;color:#666;font-size:0.88rem;">🖋️ 不能錄音？改用打字</summary>
      <textarea class="fallback-textarea" id="fallbackText" placeholder="如果錄音唔得，可以打字代替（最少 20 字）..."></textarea>
    </details>
    <button class="btn-submit" id="submitBtn" onclick="submitGrade()" disabled>✅ 提交評分</button>
  </div>

  <div class="tier-info">
    <table>
      <tr><td>🏆 <b>85-100 分</b></td><td>= 3 金幣（極佳！清晰理解 + 例子）</td></tr>
      <tr><td>⭐ <b>70-84 分</b></td><td>= 2 金幣（不錯！主要概念清楚）</td></tr>
      <tr><td>👍 <b>60-69 分</b></td><td>= 1 金幣（合格！再進步）</td></tr>
      <tr><td>💪 <b>0-59 分</b></td><td>= 0 金幣（再嘗試，AI 會比提示）</td></tr>
    </table>
    <div style="margin-top:8px;font-size:0.82rem;color:#7B1FA2;">💡 AI 會自動整理你嘅錄音重複句子，唔使擔心口齒不清。</div>
  </div>

  <div class="result" id="resultPanel">
    <div class="score-big" id="scoreBig">--</div>
    <div class="coin-reward" id="coinReward"></div>
    <div class="consolidated-box" id="consolidatedBox" style="display:none;">
      <b>📝 AI 整理後嘅你嘅回答（保持原意，去除重複）：</b>
      <div id="consolidatedText"></div>
    </div>
    <div class="feedback-box" id="feedbackBox"></div>
    <a class="btn-back" href="index.html">← 返回課題</a>
    <button class="btn-submit" onclick="resetForRetry()" style="margin-left:8px;background:linear-gradient(135deg,#7B1FA2,#4A148C);">🔁 再試一次</button>
  </div>
</div>

<script>
const CHAPTER = {chapter};
const VOICE_NUM = {voice_num};
const TITLE = '{chapter_title}';
const QUESTION = `{prompt}`;
const RUBRIC = `{rubric}`;
const WORKER_URL = 'https://lwwf-math-ai.lwwfaiteams.workers.dev';
let recognition = null, isRecording = false, transcript = '';

function getUser(){{ try {{ return JSON.parse(localStorage.getItem('lwwf_auth_user')||'null'); }} catch(e){{ return null; }} }}

function setupRecognition() {{
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;
  const r = new SR();
  r.lang = 'yue-Hant-HK';
  r.continuous = true;
  r.interimResults = true;
  r.onresult = (ev) => {{
    let final = '', interim = '';
    for (let i = ev.resultIndex; i < ev.results.length; i++) {{
      const txt = ev.results[i][0].transcript;
      if (ev.results[i].isFinal) final += txt; else interim += txt;
    }}
    transcript = (transcript + final).trim();
    document.getElementById('transcript').innerHTML = (transcript || '') + '<span style="color:#999;">' + interim + '</span>';
    document.getElementById('transcript').classList.toggle('has-content', !!transcript);
    document.getElementById('submitBtn').disabled = transcript.length < 10;
  }};
  r.onend = () => {{
    if (isRecording) {{ try {{ r.start(); }} catch(e){{}} }}
  }};
  r.onerror = (e) => {{
    console.warn('STT error:', e.error);
    if (e.error === 'not-allowed') {{ alert('請允許 microphone 權限。或用打字代替。'); stopRecord(); }}
  }};
  return r;
}}

function toggleRecord() {{ if (isRecording) stopRecord(); else startRecord(); }}

function startRecord() {{
  if (!recognition) recognition = setupRecognition();
  if (!recognition) {{ alert('你嘅瀏覽器唔支援錄音。請用打字代替（下方 textarea）。'); return; }}
  transcript = '';
  document.getElementById('transcript').innerHTML = '<span class="placeholder">聽緊...</span>';
  document.getElementById('transcript').classList.remove('has-content');
  document.getElementById('submitBtn').disabled = true;
  isRecording = true;
  document.getElementById('recordBtn').textContent = '⏹️ 停止錄音';
  document.getElementById('recordBtn').classList.add('recording');
  try {{ recognition.start(); }} catch(e){{ console.warn(e); }}
}}

function stopRecord() {{
  isRecording = false;
  document.getElementById('recordBtn').textContent = '🎤 重新錄音';
  document.getElementById('recordBtn').classList.remove('recording');
  if (recognition) try {{ recognition.stop(); }} catch(e){{}}
  const fallback = document.getElementById('fallbackText').value.trim();
  if (!transcript && fallback.length >= 10) transcript = fallback;
  document.getElementById('submitBtn').disabled = transcript.length < 10;
}}

async function submitGrade() {{
  const fallback = document.getElementById('fallbackText').value.trim();
  let finalTranscript = transcript || fallback;
  if (!finalTranscript || finalTranscript.length < 10) {{ alert('請錄音或打字最少 10 個字嘅解釋'); return; }}
  if (isRecording) stopRecord();

  const submitBtn = document.getElementById('submitBtn');
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="loading">⏳ AI 整理錄音中... 評分中...</span>';

  try {{
    const resp = await fetch(`${{WORKER_URL}}/voice-grade`, {{
      method: 'POST', headers: {{'Content-Type':'application/json'}},
      body: JSON.stringify({{
        transcript: finalTranscript,
        question: `第 ${{CHAPTER}} 課 簡報 ${{VOICE_NUM}} 錄音題：${{QUESTION}}`,
        rubric: RUBRIC,
        modelAnswer: '',
        chapter: CHAPTER
      }})
    }});
    const data = await resp.json();
    showResult(data, finalTranscript);
  }} catch(e) {{
    submitBtn.disabled = false;
    submitBtn.innerHTML = '✅ 提交評分';
    alert('網絡錯誤，請再試：' + e.message);
  }}
}}

function scoreToCoins(s) {{
  if (s >= 85) return 3;
  if (s >= 70) return 2;
  if (s >= 60) return 1;
  return 0;
}}

function tierClass(s) {{
  if (s >= 85) return 'tier-3';
  if (s >= 70) return 'tier-2';
  if (s >= 60) return 'tier-1';
  return 'tier-0';
}}

function showResult(data, transcriptText) {{
  const score = data.score || 0;
  const feedback = data.feedback || '繼續努力！';
  const consolidated = data.consolidated_transcript || transcriptText;
  const coins = scoreToCoins(score);

  document.getElementById('recorderPanel').style.display = 'none';
  const panel = document.getElementById('resultPanel');
  panel.classList.add('show');

  const sb = document.getElementById('scoreBig');
  sb.textContent = score + ' 分';
  sb.className = 'score-big ' + tierClass(score);

  const cr = document.getElementById('coinReward');
  if (coins > 0) {{
    cr.innerHTML = `🪙 獲得 <b style="color:#F57C00;font-size:1.6rem;">${{coins}}</b> 個金幣！`;
  }} else {{
    cr.innerHTML = `💪 未夠 60 分 — <b style="color:#C62828;">未獲得金幣</b>，可以再試一次！`;
  }}

  // Show AI consolidated transcript (if different from raw)
  if (consolidated && consolidated !== transcriptText) {{
    document.getElementById('consolidatedText').textContent = consolidated;
    document.getElementById('consolidatedBox').style.display = 'block';
  }}

  let fbHtml = `<b>🤖 AI 老師回應：</b><br>${{feedback}}`;
  if (data.key_concepts_mentioned && data.key_concepts_mentioned.length) {{
    fbHtml += `<br><br><b>✓ 你提到嘅重點：</b>${{data.key_concepts_mentioned.join('、')}}`;
  }}
  if (score < 70 && data.missing_concepts && data.missing_concepts.length) {{
    fbHtml += `<br><br><b>💡 提示：</b>建議覆蓋呢啲方向 — ${{data.missing_concepts.join('、')}}（記住唔好抄答案，要自己用粵語講）`;
  }}
  document.getElementById('feedbackBox').innerHTML = fbHtml;

  // Sync progress (rule #19) — voice{voice_num} key
  const u = getUser();
  if (u && u.class && u.number && coins > 0) {{
    const k = `progress_ch${{CHAPTER}}_${{u.class}}_${{u.number}}`;
    let p = {{}};
    try {{ p = JSON.parse(localStorage.getItem(k) || '{{}}'); }} catch(e){{}}
    const voiceKey = `voice${{VOICE_NUM}}`;
    p[voiceKey] = {{
      done: true,
      score: score,
      coins: coins,
      ts: Date.now(),
      transcript: transcriptText.slice(0, 200),
      consolidated: consolidated.slice(0, 200),
      feedback: feedback.slice(0, 200)
    }};
    localStorage.setItem(k, JSON.stringify(p));
    window.dispatchEvent(new CustomEvent('lwwf-progress-changed', {{
      detail: {{ key: k, action: voiceKey + '-done', score, coins }}
    }}));
  }}
}}

function resetForRetry() {{
  transcript = '';
  document.getElementById('transcript').innerHTML = '<span class="placeholder">錄音之後，文字會顯示喺呢度...</span>';
  document.getElementById('transcript').classList.remove('has-content');
  document.getElementById('fallbackText').value = '';
  document.getElementById('submitBtn').disabled = true;
  document.getElementById('submitBtn').innerHTML = '✅ 提交評分';
  document.getElementById('recordBtn').textContent = '🎤 開始錄音';
  document.getElementById('resultPanel').classList.remove('show');
  document.getElementById('recorderPanel').style.display = '';
  document.getElementById('consolidatedBox').style.display = 'none';
}}
</script>
<script src="../common/feedback.js"></script>
</body>
</html>
'''


def main():
    base = Path('.')
    success = 0
    for chapter, data in CHAPTERS.items():
        chapter_dir = base / 'assets' / f'ch{chapter}'
        if not chapter_dir.exists():
            print(f'SKIP ch{chapter} — directory not found')
            continue
        for i, voice_data in enumerate(data['voices'], 1):
            file_path = chapter_dir / f'voice{i}.html'
            content = voice_html_template(
                chapter=chapter,
                voice_num=i,
                voice_data=voice_data,
                theme_color=data['theme_color'],
                chapter_title=data['title'],
            )
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f'OK: {file_path}')
            success += 1
    print(f'\n{success}/15 voice files generated')


if __name__ == '__main__':
    main()
