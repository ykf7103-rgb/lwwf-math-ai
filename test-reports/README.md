# LWWF 網站自動測試報告

呢度會每日（凌晨 3 點）自動生成網站健康測試報告。

## Agent
- **Task**: `lwwf-site-health-test`（Claude Sonnet）
- **Run**: 每日一次
- **Log**: 每次 run 生成 `YYYY-MM-DD-HHmm.md`

## 測試範圍
- 所有課文頁 page load (WebFetch)
- JPG/MP3/MP4 檔案存在
- 簡報 TOTAL 同實際頁數對得上
- Quiz afterPage 冇超出 TOTAL
- Math 答案一致性（vertical-math）

## Auto-fix 類別
- ✅ TOTAL 錯 → 更新到實際值
- ✅ Out-of-range quiz → 刪該題
- ✅ Broken image src → 搜 similar 名替代
- ❌ 內容錯、設計錯 → 只留 note 畀老師 review

