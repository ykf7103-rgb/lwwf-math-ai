# 數學 AI 學習區 Safety And Privacy

更新日期：2026-06-13

## 本輪 Golden Slice

分數料理台與體積建築師均是純前端操作型工具，不呼叫 AI API，不使用登入資料，不寫入 Supabase。

體積建築師會在完成任務時嘗試寫入 Learning Passport 進度；沒有護照狀態時仍可用本機 `localStorage` 完成練習。

## 安全規則

- `window.__TOOL_DEBUG__` 不可輸出學生姓名、班別、學號、密碼、token 或 API key。
- 本機保存只記錄完成挑戰 id、嘗試次數與分數。
- Learning Passport metadata 只記錄工具 id、主題、任務 id、學習策略、長闊高、底面積、移走方塊、體積、完成數、嘗試次數與準確率。
- metadata 不可包含學生姓名、登入資料、供應商名稱、proxy 名稱、token、password、apiKey、secret 或原始 provider payload。
- 不建立公開排行榜。

## AI / 後端

- 本輪分數工具與體積工具不需要 AI。
- 若日後新增 AI 錯因診斷，必須經後端 Worker 或 service binding，不可在前端放 provider key。
- 學生 UI 不顯示 GPT、OpenAI、Alibaba、proxy 等供應商名稱。

## Debug 合約

| 工具 | Debug ID | 必要欄位 |
|---|---|---|
| 分數料理台 | `lwwf-math-fraction-kitchen` | 任務、目標分數、學生分數、完成數、護照狀態、私隱旗標 |
| 體積建築師 | `lwwf-math-volume-architect` | 任務、長闊高、底面積、移走方塊、體積、目標體積、canvas 狀態、護照狀態、私隱旗標 |

## 部署前檢查

- `npm run check`
- `npm run test:smoke`
- `npm run qa`
- `npm audit --omit=dev`
- 本機或 live URL 主流程驗證
