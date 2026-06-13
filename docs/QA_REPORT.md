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
| 部署 | 待提交及推送後由 GitHub Pages 更新 |

## 2026-06-13 體積建築師本機驗收摘要

| 驗證 | 結果 |
|---|---|
| 桌面載入 | `體積建築師` 標題、任務一、目標 `1 cm³`、初始體積 `12 cm³` 均正常 |
| Canvas | Debug `canvasNonBlank=true` |
| 圖片 | 壞圖 0 |
| 舊 URL | `/tools/volume-builder.html` 會導向 `/tools/volume-architect.html` |
| 手機 | 390px 寬度 scrollWidth = clientWidth，無橫向溢出 |
| Debug | `siteId=lwwf-math-volume-architect`、`passportSiteId=lwwf-math-ai`、`route=volume-builder` |
| 學習流程 | Playwright 已覆蓋 1 cm³ 任務、缺口任務、Learning Passport mock metadata |
