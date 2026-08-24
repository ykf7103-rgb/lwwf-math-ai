# AGENTS.md — LWWF Site Agent Instructions

更新日期：2026-06-17

## Site Identity

| 欄位 | 內容 |
|---|---|
| Site ID | `lwwf-math-ai` |
| Site title | 數學 AI 學習區 |
| Subject | 數學 |
| Live URL | https://ykf7103-rgb.github.io/lwwf-math-ai/ |
| Local source | D:\Google drive sync with T7 Shield\LWWF\Claude code\GitHub\lwwf-math-ai |
| Source confidence | 高 |

## Work Rules

1. 先讀 `PROJECT_STATUS.md`，再改任何檔案。
2. 先確認本機源碼與正式網址對應，不確定時不可部署。
3. 題目、對話、任務、回饋和 learning objectives 必須放在 content JSON 或可維護資料模組，不要硬寫在單一 component。
4. 學生端不可顯示 AI provider、API key、proxy token、prompt 或 backend route。
5. 涉及 AI 生成、圖片、研究或評分時，只可經 backend Worker 或 `lwwf-ai-proxy` 類安全路由。
6. 修改後必須跑站點 QA；沒有 QA 時至少跑共用 smoke check。
7. 部署後必須抽查 live URL、手機版、console error 和 broken image。
8. 完成後更新 `PROJECT_STATUS.md` 和第二大腦。

## Deployment Boundary

| 項目 | 狀態 |
|---|---|
| Runtime | GitHub Pages / static |
| Deploy command | `未確認；部署前查 source map` |
| QA command | `npm run qa` |
| Uses AI backend | 是 |
| Uses Learning Passport | 是 |
| Uses student data | 視登入與作品提交而定，修改前必須確認 |

## Required Checks

| 檢查 | 指令或方法 |
|---|---|
| Install | `npm install` |
| Build | `npm run build` |
| QA | `npm run qa` |
| Shared health check | `python _AI_TOOLKIT/ai-education-game-studio/scripts/deployment_health_check.py` |

## Completion Criteria

- 本機測試通過。
- 正式網址可連線。
- 手機版沒有水平溢出。
- console 沒有阻斷錯誤。
- broken image 數量為 0。
- AI backend 沒有暴露 secrets。
- Learning Passport evidence payload 已保留或明確標示不適用。
## Learning Passport Single Sign-On

- 經 Learning Passport 進入本網站時，學生只可在 Learning Passport 主站登入一次，本網站不可要求學生重複輸入同一組登入資料。
- 接入方式以 `_AI_TOOLKIT/ai-education-game-studio/LEARNING_PASSPORT_SINGLE_SIGN_ON_STANDARD.md` 為準。
- metadata、log、測試報告和第二大腦不可保存 password、handoff token、API key、AI prompt 或 provider。

