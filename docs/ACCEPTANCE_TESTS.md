# 數學 AI 學習區 Acceptance Tests

更新日期：2026-06-13

## 必須通過

- `tools/fraction-kitchen.html` 可載入。
- 首頁登入頁顯示 `分數料理台` 入口，點擊後可進入工具頁。
- 頁面顯示 `分數料理台` 與目標分數。
- 校章與背景圖片不可載入失敗。
- `window.__TOOL_DEBUG__` 與 `data-tool-debug` 必須存在。
- 學生能把 1/4 調整成 3/4，按檢查後完成第一題。
- 錯誤答案要給出交叉乘積提示。
- 390px 手機寬度不可橫向溢出。
- `npm run qa` 必須通過。

## 目前自動化覆蓋

`tests/fraction-kitchen.spec.mjs` 覆蓋：

1. 從首頁入口進入分數料理台。
2. 頁面載入與安全 debug 摘要。
3. 切出 3/4 並完成第一個挑戰。
4. 錯誤答案顯示交叉乘積提示。
5. 390px 手機寬度無橫向溢出。

## 後續更高標準

- 加入主頁入口後，增加從首頁進入工具的 smoke test。
- 加入 Learning Passport mock，驗證只保存必要進度。
- 加入 live URL 驗證及截圖。

## 2026-06-13 護照整合驗收

- 工具頁載入 Learning Passport SDK，`data-site-id="lwwf-math-ai"`。
- 未由護照進入時，工具仍可完成挑戰並保存本機進度。
- 用假護照 SDK 驗證答對 3/4 後會送出 `fraction-kitchen-same-denominator` 進度。
- 進度 payload 包含 `score=100`、`coins=5` 與安全 metadata。
- 測試確認 payload 不包含 token、password、API key、provider 或 secret。
- `window.__TOOL_DEBUG__` 新增 `passportSiteId`、`apiStatus`、`lastPassportSync`。
