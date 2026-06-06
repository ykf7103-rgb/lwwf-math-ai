# 數學 AI 學習區 Safety And Privacy

更新日期：2026-06-13

## 本輪 Golden Slice

分數料理台是純前端操作型工具，不呼叫 AI API，不使用登入資料，不寫入 Supabase。

## 安全規則

- `window.__TOOL_DEBUG__` 不可輸出學生姓名、班別、學號、密碼、token 或 API key。
- 本機保存只記錄完成挑戰 id、嘗試次數與分數。
- 若日後接入 Learning Passport，只記錄必要任務進度。
- 不建立公開排行榜。

## AI / 後端

- 本輪分數工具不需要 AI。
- 若日後新增 AI 錯因診斷，必須經後端 Worker 或 service binding，不可在前端放 provider key。
- 學生 UI 不顯示 GPT、OpenAI、Alibaba、proxy 等供應商名稱。

## 部署前檢查

- `npm run check`
- `npm run test:smoke`
- `npm run qa`
- `npm audit --omit=dev`
- 本機或 live URL 主流程驗證
