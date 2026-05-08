"""
Fix 錄音題兩個 painpoints:
1. 加 MediaRecorder fallback — 所有機都可以錄音（即使唔支援 Web Speech API）
2. 大幅放寬評分 threshold (85/70/60 → 80/65/50) + 加慷慨評分

Apply to:
- assets/ch{12-19}/summary.html (8 files)
- assets/ch{12-16}/voice{1,2,3}.html (15 files)
Total: 23 files
"""
import os
import sys
import re
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')


# ===== Fix 1: scoreToCoins 寬鬆 threshold (50/65/80) =====
OLD_SCORE_FN = """function scoreToCoins(s) {
  if (s >= 85) return 3;
  if (s >= 70) return 2;
  if (s >= 60) return 1;
  return 0;
}"""

NEW_SCORE_FN = """function scoreToCoins(s) {
  // 2026-05-05 大幅放寬: 50+ = 1 / 65+ = 2 / 80+ = 3
  if (s >= 80) return 3;
  if (s >= 65) return 2;
  if (s >= 50) return 1;
  return 0;
}"""

# ===== Fix 2: tier-info table 改為新 threshold =====
OLD_TIER_TABLE = """      <tr><td>🏆 <b>85-100 分</b></td><td>= 3 金幣（極佳！完整理解）</td></tr>
      <tr><td>⭐ <b>70-84 分</b></td><td>= 2 金幣（不錯！主要概念清楚）</td></tr>
      <tr><td>👍 <b>60-69 分</b></td><td>= 1 金幣（合格！再進步）</td></tr>
      <tr><td>💪 <b>0-59 分</b></td><td>= 0 金幣（再嘗試，AI 會比提示）</td></tr>"""

NEW_TIER_TABLE = """      <tr><td>🏆 <b>80-100 分</b></td><td>= 3 金幣（極佳！完整理解）</td></tr>
      <tr><td>⭐ <b>65-79 分</b></td><td>= 2 金幣（不錯！主要概念清楚）</td></tr>
      <tr><td>👍 <b>50-64 分</b></td><td>= 1 金幣（合格！繼續努力）</td></tr>
      <tr><td>💪 <b>0-49 分</b></td><td>= 0 金幣（再試一次，會更好）</td></tr>"""

# ===== Fix 3: intro tier text =====
OLD_INTRO = "AI 老師會評分：<b>85 分以上 = 3 金幣 · 70 分以上 = 2 金幣 · 60 分以上 = 1 金幣 · 不足 60 分沒有金幣</b>。"
NEW_INTRO = "AI 老師會評分：<b>80 分以上 = 3 金幣 · 65 分以上 = 2 金幣 · 50 分以上 = 1 金幣</b>。寬鬆友善評分標準。"

# ===== Fix 4: 加 MediaRecorder fallback (audio blob → worker /voice-grade) =====
# 喺 setupRecognition() 函數之前加新 helper

MEDIA_RECORDER_INJECT = """// 2026-05-05 fix: MediaRecorder fallback (Web Speech API 不支援嘅機都可以錄音)
let __mediaRecorder = null;
let __audioChunks = [];
let __useMediaRecorder = false;  // toggled if Web Speech 不支援

async function startMediaRecorder() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    __audioChunks = [];
    __mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
    __mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) __audioChunks.push(e.data); };
    __mediaRecorder.onstop = () => stream.getTracks().forEach(t => t.stop());
    __mediaRecorder.start(1000);  // 每秒 chunk
    return true;
  } catch (e) {
    console.error('MediaRecorder failed:', e.message);
    alert('錄音失敗：請允許 microphone 權限，或者改用打字。');
    return false;
  }
}

async function stopMediaRecorderAndGetBlob() {
  return new Promise((resolve) => {
    if (!__mediaRecorder) return resolve(null);
    __mediaRecorder.onstop = () => {
      const blob = new Blob(__audioChunks, { type: 'audio/webm' });
      resolve(blob);
    };
    __mediaRecorder.stop();
  });
}

async function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]);  // strip data:... prefix
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

"""

# ===== Fix 5: setupRecognition() 加 fallback 到 MediaRecorder =====
OLD_SETUP_RECOGNITION_FAIL = """function setupRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;"""

NEW_SETUP_RECOGNITION_FAIL = """function setupRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    // 2026-05-05 fix: 不支援 Web Speech → 自動切換 MediaRecorder
    __useMediaRecorder = true;
    return null;
  }"""

# ===== Fix 6: startRecord() 加 fallback path =====
OLD_START_RECORD = """function startRecord() {
  if (!recognition) recognition = setupRecognition();
  if (!recognition) {
    alert('你嘅瀏覽器唔支援錄音。請用打字代替（下方 textarea）。');
    return;
  }
  transcript = '';
  document.getElementById('transcript').innerHTML = '<span class="placeholder">聽緊...</span>';
  document.getElementById('transcript').classList.remove('has-content');
  document.getElementById('submitBtn').disabled = true;
  isRecording = true;
  document.getElementById('recordBtn').textContent = '⏹️ 停止錄音';
  document.getElementById('recordBtn').classList.add('recording');
  try { recognition.start(); } catch(e){ console.warn(e); }
}"""

NEW_START_RECORD = """function startRecord() {
  if (!recognition) recognition = setupRecognition();
  // 2026-05-05 fix: Web Speech 不支援 → 用 MediaRecorder fallback (audio blob → worker Whisper)
  if (!recognition && __useMediaRecorder) {
    startMediaRecorder().then(ok => {
      if (!ok) return;
      transcript = '';
      isRecording = true;
      document.getElementById('transcript').innerHTML = '<span class="placeholder">🎤 錄音中（用 AI 識別模式）...</span>';
      document.getElementById('transcript').classList.remove('has-content');
      document.getElementById('recordBtn').textContent = '⏹️ 停止錄音';
      document.getElementById('recordBtn').classList.add('recording');
      // 用 MediaRecorder 模式時 submit 提早可用（學生需要 click 停止然後 submit）
      document.getElementById('submitBtn').disabled = false;
    });
    return;
  }
  if (!recognition) {
    alert('你嘅瀏覽器唔支援錄音。請用打字代替（下方 textarea）。');
    return;
  }
  transcript = '';
  document.getElementById('transcript').innerHTML = '<span class="placeholder">聽緊...</span>';
  document.getElementById('transcript').classList.remove('has-content');
  document.getElementById('submitBtn').disabled = true;
  isRecording = true;
  document.getElementById('recordBtn').textContent = '⏹️ 停止錄音';
  document.getElementById('recordBtn').classList.add('recording');
  try { recognition.start(); } catch(e){ console.warn(e); }
}"""

# ===== Fix 7: stopRecord() 加 MediaRecorder support =====
OLD_STOP_RECORD = """function stopRecord() {
  isRecording = false;
  document.getElementById('recordBtn').textContent = '🎤 重新錄音';
  document.getElementById('recordBtn').classList.remove('recording');
  if (recognition) try { recognition.stop(); } catch(e){}
  const fallback = document.getElementById('fallbackText').value.trim();
  if (!transcript && fallback.length >= 10) transcript = fallback;
  document.getElementById('submitBtn').disabled = transcript.length < 10;
}"""

NEW_STOP_RECORD = """function stopRecord() {
  isRecording = false;
  document.getElementById('recordBtn').textContent = '🎤 重新錄音';
  document.getElementById('recordBtn').classList.remove('recording');
  if (recognition) try { recognition.stop(); } catch(e){}
  // MediaRecorder 模式停止後，blob 會喺 submitGrade() 內 upload
  if (__mediaRecorder && __mediaRecorder.state === 'recording') {
    try { __mediaRecorder.stop(); } catch(e){}
    document.getElementById('transcript').innerHTML = '<span style="color:#1565C0;">✅ 錄音完成！按「提交評分」上傳俾 AI 識別。</span>';
  }
  const fallback = document.getElementById('fallbackText').value.trim();
  if (!transcript && fallback.length >= 10) transcript = fallback;
  // MediaRecorder 模式 submit 永遠可按
  if (!__useMediaRecorder) {
    document.getElementById('submitBtn').disabled = transcript.length < 10;
  }
}"""

# ===== Fix 8: submitGrade() 加 audio blob upload 邏輯 =====
OLD_SUBMIT_GRADE = """async function submitGrade() {
  const fallback = document.getElementById('fallbackText').value.trim();
  let finalTranscript = transcript || fallback;
  if (!finalTranscript || finalTranscript.length < 10) {
    alert('請錄音或打字最少 10 個字嘅解釋');
    return;
  }
  if (isRecording) stopRecord();

  const submitBtn = document.getElementById('submitBtn');
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="loading">⏳ AI 評分中...</span>';

  try {
    const resp = await fetch(`${WORKER_URL}/voice-grade`, {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        transcript: finalTranscript,
        question: `第 ${CHAPTER} 課課程總結 — 講解你對「${TITLE}」嘅理解`,
        rubric: RUBRIC,
        modelAnswer: '',
        chapter: CHAPTER
      })
    });
    const data = await resp.json();
    showResult(data, finalTranscript);
  } catch(e) {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '✅ 提交評分';
    alert('網絡錯誤，請再試：' + e.message);
  }
}"""

NEW_SUBMIT_GRADE = """async function submitGrade() {
  const fallback = document.getElementById('fallbackText').value.trim();
  let finalTranscript = transcript || fallback;
  let audioPayload = null;

  // 2026-05-05 fix: 如果用緊 MediaRecorder 模式，攞返 audio blob
  if (__useMediaRecorder && __mediaRecorder && __audioChunks.length > 0) {
    if (__mediaRecorder.state === 'recording') {
      try { __mediaRecorder.stop(); } catch(e){}
    }
    const blob = new Blob(__audioChunks, { type: 'audio/webm' });
    if (blob.size > 1000) {  // 至少 1KB（防靜音）
      try {
        const base64 = await blobToBase64(blob);
        audioPayload = { data: base64, mimeType: 'audio/webm' };
      } catch(e) { console.error('Blob → base64 failed:', e); }
    }
  }

  if (!audioPayload && (!finalTranscript || finalTranscript.length < 10)) {
    alert('請錄音或打字最少 10 個字嘅解釋');
    return;
  }
  if (isRecording) stopRecord();

  const submitBtn = document.getElementById('submitBtn');
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="loading">⏳ AI ' + (audioPayload ? '識別錄音 + ' : '') + '評分中...</span>';

  try {
    const reqBody = {
      question: `第 ${CHAPTER} 課課程總結 — 講解你對「${TITLE}」嘅理解`,
      rubric: RUBRIC,
      modelAnswer: '',
      chapter: CHAPTER
    };
    if (audioPayload) {
      reqBody.audio = audioPayload;  // 後端用 Whisper STT
    } else {
      reqBody.transcript = finalTranscript;
    }
    const resp = await fetch(`${WORKER_URL}/voice-grade`, {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify(reqBody)
    });
    const data = await resp.json();
    if (data.error) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '✅ 提交評分';
      alert('AI 評分失敗：' + (data.error || '未知錯誤') + '\\n請改用打字輸入。');
      return;
    }
    // 用 worker 回傳嘅 transcript（如果係 Whisper STT，會更準確）
    showResult(data, data.transcript || finalTranscript);
  } catch(e) {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '✅ 提交評分';
    alert('網絡錯誤，請再試：' + e.message);
  }
}"""


def patch_file(path):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        return f'READ_ERROR: {e}'

    if '__useMediaRecorder' in content:
        return 'SKIP (already patched)'

    changes = 0

    # Fix 1: scoreToCoins
    if OLD_SCORE_FN in content:
        content = content.replace(OLD_SCORE_FN, NEW_SCORE_FN)
        changes += 1

    # Fix 2: tier table
    if OLD_TIER_TABLE in content:
        content = content.replace(OLD_TIER_TABLE, NEW_TIER_TABLE)
        changes += 1

    # Fix 3: intro tier text
    if OLD_INTRO in content:
        content = content.replace(OLD_INTRO, NEW_INTRO)
        changes += 1

    # Fix 4-8: MediaRecorder injection
    if OLD_SETUP_RECOGNITION_FAIL in content:
        # Inject MediaRecorder helpers BEFORE setupRecognition
        content = content.replace(
            OLD_SETUP_RECOGNITION_FAIL,
            MEDIA_RECORDER_INJECT + NEW_SETUP_RECOGNITION_FAIL
        )
        changes += 1

    # Fix 6: startRecord
    if OLD_START_RECORD in content:
        content = content.replace(OLD_START_RECORD, NEW_START_RECORD)
        changes += 1

    # Fix 7: stopRecord
    if OLD_STOP_RECORD in content:
        content = content.replace(OLD_STOP_RECORD, NEW_STOP_RECORD)
        changes += 1

    # Fix 8: submitGrade
    if OLD_SUBMIT_GRADE in content:
        content = content.replace(OLD_SUBMIT_GRADE, NEW_SUBMIT_GRADE)
        changes += 1

    if changes == 0:
        return 'NO_CHANGES (pattern mismatch)'

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    return f'OK ({changes} fixes applied)'


if __name__ == '__main__':
    base = Path('.')
    targets = []
    # ch12-19 summary.html
    for ch in range(12, 20):
        p = base / 'assets' / f'ch{ch}' / 'summary.html'
        if p.exists():
            targets.append(p)
    # ch12-16 voice{1,2,3}.html
    for ch in range(12, 17):
        for n in [1, 2, 3]:
            p = base / 'assets' / f'ch{ch}' / f'voice{n}.html'
            if p.exists():
                targets.append(p)

    ok_count = 0
    for p in targets:
        result = patch_file(str(p))
        print(f'{p.relative_to(base)}: {result}')
        if 'OK' in result:
            ok_count += 1

    print(f'\nTotal: {ok_count}/{len(targets)} files patched')
