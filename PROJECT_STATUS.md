# PROJECT_STATUS.md — LWWF Site Status

更新日期：2026-08-22

## Site Identity

| 欄位 | 內容 |
|---|---|
| Site ID | `lwwf-math-ai` |
| Site title | 數學 AI 學習區 |
| Subject | 數學 |
| Live URL | https://ykf7103-rgb.github.io/lwwf-math-ai/ |
| Local source | D:\Google drive sync with T7 Shield\LWWF\Claude code\GitHub\lwwf-math-ai |
| Source confidence | 高 |
| Deployment rule | 可升級；留意 GitHub Pages artifact 體積，較大資產改用 Worker/R2 |

## Current State

| 項目 | 狀態 |
|---|---|
| Live reachable | 是 |
| Last HTTP status | 200 |
| Live title seen | 樂善堂梁黃蕙芳紀念學校 - 數學AI學習區 |
| Git present | 是 |
| Package config | 是 |
| Wrangler config | 否 |
| Tests folder | 是 |
| Docs folder | 是 |
| QA report | 是，見 `docs/QA_REPORT.md` 的 2026-08-22 章節 |
| AGENTS.md | 是 |

## 2026-08-23 AI 四格漫畫正式修復

- GitHub Pages 已發布 commit `4edbacd`；公開漫畫頁已改為中央 Learning Passport 安全 API，沒有直接數學 Worker 呼叫。
- 數學 AI Worker 已發布 version `3a191041-f29a-49e0-81a9-a0248bc47de0`；Learning Passport 已發布 version `6805a582-cae9-4230-b024-1dd8c38a407e`。
- 只有已驗證的 `7A` 學生工作階段可生成；非 7A 與教師巡堂會在圖像 API 前被拒絕。
- 圖像生成固定為 `gpt-image-2` 的中等品質；任何代理失效均停止，不會改用其他圖像供應商。
- 本機全套 QA、後端 7A 契約測試、正式健康檢查及 GitHub Pages 發布檢查均已通過。真實付費圖像驗收交由 7A 學生正式登入後執行，不讀取學生密碼。
- 詳情見 `docs/QA_MATH_COMIC_2026-08-23.md`。

## Risk Level

P1：本機安全更新與 QA 已完成；正式站仍是舊版，部署前須保留回滾與驗證閘門。

## Standard Commands

| 用途 | 指令 |
|---|---|
| Install | `npm install` |
| Build | `npm run build` |
| QA | `npm run qa` |
| Deploy | `未確認；部署前查 source map` |

## AI Backend Boundary

| 問題 | 答案 |
|---|---|
| 是否有 AI 功能 | 是 |
| 是否需要 backend-only proxy | 是 |
| 學生端是否可見 provider / token / prompt | 不可 |

## Learning Passport Boundary

| 問題 | 答案 |
|---|---|
| 是否 Learning Passport 入口 | 是 |
| 是否已有 evidence payload | 是；三個互動工具以中央 Passport `recordProgress` 送出安全學習證據 |
| 教師巡堂 | P1–P6 strict `teacher-preview`、`readOnly`、`synthetic`；記憶體沙盒 |
| 下一步 | 正式部署後抽查中央交接、浮動回報與進度回寫，再移除舊 wrapper |

## Next Actions

- 取得正式部署批准後才可提交／推送；本輪不可部署。
- 部署後先逐項驗證 P1–P6、學生進度與浮動回報，再切換或移除 registry 的舊 wrapper。
- 純 GitHub Pages 沒有同源 Worker `/api/passport/context`；目前使用中央 SDK 公開狀態並在前端做 strict scope 驗證。若中央契約強制要求 server-side context，須先遷移至可提供同源 API 的 runtime。
- 正式 GitHub Pages 回應目前沒有 `Content-Security-Policy` 或 `X-Frame-Options`；現有大量 inline 教材腳本亦未適合直接套用嚴格 CSP。部署本輪安全更新前不可因此移除 Passport wrapper，後續應在可控制 response headers 的主機完成 CSP／嵌入政策遷移。
- Learning Passport 正式入口必須維持在根頁；既有深層教材頁由根頁記憶體 shell 注入保護層。

## Last Verification

| 日期 | 結果 | 證據 |
|---|---|---|
| 2026-06-17 | 初始狀態卡建立 | `_AI_TOOLKIT/ai-education-game-studio/reports/deployment-health-check-2026-06-17.md` |
| 2026-08-22 | 本機 Passport 安全更新、32 項 Playwright、build dry-run 通過；未部署 | `docs/QA_REPORT.md` |

## 2026-08-22 Passport 安全狀態

- 根頁不再發佈學生帳戶、密碼雜湊或教師密碼比對常量；只接受中央 Learning Passport 身分。
- SDK one-time handoff 及 session 只由中央 SDK 在記憶體處理；本網站不讀寫 raw handoff token。
- 根頁維持中央工作階段，所有內部 HTML 由同源記憶體 shell 開啟並先注入安全 runtime。
- 教師巡堂的 `localStorage`、`sessionStorage` 改為記憶體 Map，IndexedDB 會拒絕；進度、舊 Supabase、付費及生成呼叫均不執行。
- 中央浮動回報已啟用；三個互動工具的正式學生進度改由中央 Passport 寫入。
- 正式站舊 Supabase 資料已在不經雲端同步的 Secure-Backups 完成 DPAPI 預變更備份；安全摘要為 5 表、2,356 列、484,324 加密位元組，逐項 round-trip 驗證通過。備份輔助程式已列入 `.gitignore`，不可隨 GitHub Pages 發布。
- 部署狀態：未部署、未推送。
