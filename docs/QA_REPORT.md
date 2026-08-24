# 數學 AI 學習區 QA Report

更新日期：2026-06-13

## 本輪新增

- 新增 `tools/fraction-kitchen.html`。
- 新增 `public/tools/fraction-kitchen.js`，提供安全 `window.__TOOL_DEBUG__`。
- 新增 `playwright.config.mjs` 與 `tests/fraction-kitchen.spec.mjs`。
- 新增 premium tool 必需文件。

## 已驗證

| 檢查 | 結果 |
|---|---|
| `npm install` | 通過，0 vulnerabilities |
| `npm run check` | 通過，`public/tools/fraction-kitchen.js` 語法正確 |
| `npm run test:smoke` | 通過，5 個 Playwright tests passed |
| `npm run qa` | 通過，check 與 5 個 smoke tests 全部成功 |
| Premium tool audit | 通過，`Ready for premium claim: True` |
| `npm audit --omit=dev` | 通過，正式依賴 0 個弱點 |
| 內置瀏覽器抽查 | 通過，首頁入口可點入工具頁，工具頁圖片、debug、完成第一題均正常 |

## 已知殘餘風險

- 本輪未部署 production。
- 本輪未接入 Learning Passport；目前只作本機完成狀態保存。
- 首頁內置瀏覽器抽查見到既有隱藏模板圖片空 `src`，屬主站舊有 slide viewer placeholder；分數料理台本身沒有壞圖。

## 注意

本輪未改 production deploy，亦未接入學生登入或學習護照。

## 2026-06-13 Learning Passport 更新

| 驗證 | 結果 |
|---|---|
| 護照 SDK | `tools/fraction-kitchen.html` 已載入正式 Learning Passport SDK，站點 ID 為 `lwwf-math-ai` |
| 答對後回寫 | `public/tools/fraction-kitchen.js` 會在答對挑戰後非同步呼叫 `recordProgress(...)` |
| 本機備援 | 沒有護照登入狀態時仍保留本機 `localStorage` 進度 |
| Debug contract | 已加入 `passportSiteId`、`apiStatus`、`lastPassportSync` |
| Playwright | `npm run qa` 通過，6/6 tests passed，新增護照 mock 進度測試 |
| Premium audit | `Ready for premium claim: True` |
| 正式依賴安全檢查 | `npm audit --omit=dev` 通過，0 vulnerabilities |

部署狀態：本機與測試已準備好；正式 GitHub Pages 目前仍需提交及推送後才會出現分數料理台頁面。

## 2026-06-13 體積建築師更新

| 項目 | 結果 |
|---|---|
| 新工具頁 | 已新增 `tools/volume-architect.html` |
| 舊連結 | `tools/volume-builder.html` 已導向新版工具，保留既有章節入口 |
| 前端邏輯 | 已新增 `public/tools/volume-architect.js` |
| 主頁入口 | 登入頁及學生 topbar 已加入「體積建築師」入口 |
| 核心學習 | 1 cm³ 單位、長方體體積、一層數量 × 層數、同體積不同形狀、缺口修正、1000 cm³ = 1 L |
| Debug contract | 已新增 `window.__TOOL_DEBUG__` 與 `data-tool-debug`，包含長闊高、移走方塊、底面積、體積、目標體積、canvas 狀態與護照狀態 |
| Learning Passport | 答對任務後會送出 `volume-architect-[challengeId]` 安全 metadata |
| Playwright | 已新增 `tests/volume-architect.spec.mjs` |
| `npm run check` | 通過，分數料理台與體積建築師腳本語法正確 |
| `npm run qa` | 通過，13/13 Playwright tests passed |
| Premium tool audit | 通過，`Ready for premium claim: True` |
| 正式依賴安全檢查 | `npm audit --omit=dev` 通過，0 vulnerabilities |
| 內置瀏覽器本機抽查 | 通過，桌面無壞圖、canvas 非空、舊連結導向新版、390px 手機寬度無橫向溢出 |
| 部署 | 已推送 `a5ea089 Add volume architect learning tool`，GitHub Pages run `27478331620` 成功 |

## 2026-06-13 體積建築師本機與正式站驗收摘要

| 驗證 | 結果 |
|---|---|
| 桌面載入 | `體積建築師` 標題、任務一、目標 `1 cm³`、初始體積 `12 cm³` 均正常 |
| Canvas | Debug `canvasNonBlank=true` |
| 圖片 | 壞圖 0 |
| 舊 URL | `/tools/volume-builder.html` 會導向 `/tools/volume-architect.html` |
| 手機 | 390px 寬度 scrollWidth = clientWidth，無橫向溢出 |
| Debug | `siteId=lwwf-math-volume-architect`、`passportSiteId=lwwf-math-ai`、`route=volume-builder` |
| 學習流程 | Playwright 已覆蓋 1 cm³ 任務、缺口任務、Learning Passport mock metadata |
| 正式站 | `https://ykf7103-rgb.github.io/lwwf-math-ai/tools/volume-architect.html` HTTP 200；桌面與 390px 手機瀏覽器抽查通過，控制台錯誤 0 |

## 2026-06-13 面積周界診斷室更新

| 項目 | 結果 |
|---|---|
| 新工具頁 | 已新增 `tools/area-perimeter-lab.html` |
| 前端邏輯 | 已新增 `public/tools/area-perimeter-lab.js` |
| 主頁入口 | 登入頁及學生 topbar 已加入「面積周界診斷室」入口 |
| 核心學習 | 分辨「鋪滿」與「圍邊」、面積與周界公式、同面積不同周界、固定周界最大面積、文字題量度判斷 |
| Debug contract | 已新增 `window.__TOOL_DEBUG__` 與 `data-tool-debug`，包含長闊、學生選擇量度、任務要求量度、面積、周界、目標與護照狀態 |
| Learning Passport | 答對任務後會送出 `area-perimeter-[challengeId]` 安全 metadata |
| Playwright | 已新增 `tests/area-perimeter-lab.spec.mjs` |
| `npm run check` | 通過，三個工具腳本語法正確 |
| `npm run qa` | 通過，19/19 Playwright tests passed |
| Premium tool audit | 通過，`Ready for premium claim: True` |
| 正式依賴安全檢查 | `npm audit --omit=dev` 通過，0 vulnerabilities |
| 內置瀏覽器本機抽查 | 通過，桌面無壞圖、無橫向溢出；可完成 4 × 3 周界任務；375px 手機寬度無橫向溢出 |
| 部署 | 已推送 `6c0ca54 Add area perimeter diagnostic learning tool`，GitHub Pages run `27481818881` 成功 |

## 2026-06-13 面積周界診斷室本機與正式站驗收摘要

| 驗證 | 結果 |
|---|---|
| 本機 QA | `npm run qa` 通過，19/19 Playwright tests passed |
| Premium audit | `Ready for premium claim: True` |
| 正式依賴安全檢查 | `npm audit --omit=dev` 通過，0 vulnerabilities |
| 正式 HTML | `https://ykf7103-rgb.github.io/lwwf-math-ai/tools/area-perimeter-lab.html` HTTP 200，含頁面標題與工具腳本 |
| 正式 JS | `/public/tools/area-perimeter-lab.js` HTTP 200，含 debug ID `lwwf-math-area-perimeter-lab` |
| 正式站桌面 | 標題、任務一、debug、圖片載入正常；4 × 3 選周界後完成 1/5 |
| 正式站手機 | 375px 寬度 scrollWidth = clientWidth，無橫向溢出，無壞圖 |
| 安全 | 正式站 debug 不含 token、password、API key、provider 或 secret |
| GitHub Pages 注意 | run `27481818881` 成功，但 GitHub Actions 提示 Node.js 20 actions 將於 2026-09-16 移除；屬 workflow 依賴提醒，不影響本次部署 |

## 2026-08-22 Learning Passport 安全更新（本機、未部署）

| 驗證 | 結果 |
|---|---|
| 正式來源 | `lwwf-math-ai` GitHub Pages 靜態源碼，source confidence 高；沒有 Wrangler／Worker |
| 帳戶與密碼 | 根頁已移除公開學生名冊、密碼雜湊、教師密碼常量及前端密碼比對 |
| Passport session | 中央 SDK `init()` 處理 one-time handoff；網站只使用記憶體公開狀態，不保存 raw token |
| 巡堂身分 | P1–P6 均須符合 site、grade、role、`teacher-preview`、`readOnly`、`synthetic` 完整合約；錯誤站點、P7 或錯誤角色 fail closed |
| 巡堂儲存 | 根頁、互動工具及既有課題 shell 內的 local/session storage 均為記憶體；IndexedDB 拒絕 |
| 巡堂遠端邊界 | 不寫進度、不連舊 Supabase、不呼叫付費／生成；中央浮動回報仍可使用 |
| 正式學生進度 | 三個互動工具以中央 Passport `recordProgress()` 寫入；payload 不含登入資料或秘密 |
| GitHub Pages build dry-run | `npm run build` 通過 |
| 完整 QA | `npm run qa` 通過，32/32 Playwright tests passed |
| 依賴安全檢查 | `npm audit --audit-level=high` 通過，0 vulnerabilities |
| 手機與圖片 | 三個工具 390px 無水平溢出、broken image 0 |
| 預變更資料備份 | Secure-Backups DPAPI：5 表、2,356 列、484,324 加密位元組；逐頁及 manifest round-trip、雜湊、欄位與列數驗證通過 |
| 備份發布邊界 | 本機備份輔助程式已列入 `.gitignore`，不得提交或隨 GitHub Pages 發布 |
| 部署 | 未部署、未提交、未推送 |

### 殘餘邊界

- 正式站仍是舊版，只有在獲得部署批准並完成 live smoke check 後，才可視為正式切換。
- 純 GitHub Pages 無法提供同源 `/api/passport/context` Worker proxy；本輪以中央 SDK 公開狀態及 strict scope validation 實作。若中央規格改為強制 server-side context，必須先遷移 runtime。
- 正式 GitHub Pages 回應目前沒有 CSP 或 `X-Frame-Options`，而現有大量 inline 教材腳本不能在未重構前直接套用嚴格 CSP；此項須在可控制 response headers 的部署層另行處理。
- 既有教材頁仍保留原有進度程式，但 Learning Passport 正式入口固定進入根頁，再由記憶體 shell 於任何子頁 script 前注入安全層；直接深層 URL 不屬巡堂入口契約。
