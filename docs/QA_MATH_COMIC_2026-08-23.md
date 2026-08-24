# AI 四格漫畫修復 QA（2026-08-23）

## 正式發布

| 項目 | 結果 |
|---|---|
| GitHub Pages commit | `4edbacd` |
| 數學 AI Worker version | `3a191041-f29a-49e0-81a9-a0248bc47de0` |
| Learning Passport version | `6805a582-cae9-4230-b024-1dd8c38a407e` |
| 正式網址 | `https://ykf7103-rgb.github.io/lwwf-math-ai/tools/ai-comic.html` |

## 已驗證項目

- 前端只會以 Learning Passport `authorizedFetch` 呼叫中央 `/api/site/math-comic`；不會直接呼叫數學 Worker。
- 中央與數學 Worker 都會驗證 `lwwf-math-ai` 的學生工作階段，並只允許 `7A`；非 7A 會在呼叫圖像服務前被拒絕。
- 教師巡堂維持唯讀記憶體沙盒，不會上載圖片或呼叫付費服務。
- 圖像 API 固定使用 `gpt-image-2`、`1024x1024`、PNG、中等品質；圖像代理不可用時停止，不會回退到其他圖像供應商。
- 圖像、腳本、模型、供應商和憑證資訊均不會回傳到學生前端。
- `npm run check`、Learning Passport 全套 `npm run check`、數學 Worker 7A／中等品質契約測試，以及新增的 Playwright 7A／非 7A／巡堂／390px 檢查均通過。
- 正式站健康檢查為 HTTP 200；未附帶學生工作階段的正式 API 請求為 HTTP 401，並維持 GitHub Pages 的合法跨來源設定。

## 尚待真實帳戶驗證

實際付費圖像生成只可由已登入的 7A 學生工作階段觸發。本輪不讀取或使用學生密碼，因此沒有消耗圖像配額；請以 7A 正式登入後生成一張題目漫畫作最終驗收。正式設定會以中等品質生成。

Passport impact: 安全交接與 7A 付費功能授權已加入，未改變學習進度事件 schema。

Teacher impact: none；教師巡堂仍為 synthetic、read-only，並不會產生圖像或寫入進度。
