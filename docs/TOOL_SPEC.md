# 數學 AI 學習區 Tool Spec

更新日期：2026-06-13

## 1. 工具定位

`lwwf-math-ai` 是 LWWF 數學 AI 學習區，現有主站包含章節學習流程、簡報、評估、遊戲、錄音題及多個輔助工具。本輪新增的 Golden Slice 是：

**分數料理台 `tools/fraction-kitchen.html`**

它是一個 P3-P4 分數操作型學習工具，讓學生用可視化分數盤切出目標分數、比較等值分數，並透過即時回饋理解「分母代表平均分成幾份，分子代表取幾份」。

## 2. 主要使用者

| 使用者 | 需要完成的事 |
|---|---|
| 學生 | 切分分數盤、調整分子分母、完成目標分數挑戰 |
| 教師 | 觀察學生是否理解分數大小與等值分數 |
| Codex / QA | 透過 `window.__TOOL_DEBUG__` 與 Playwright 驗證主要流程 |

## 3. 主要學習流程

1. 學生打開 `tools/fraction-kitchen.html`。
2. 學生查看目標分數。
3. 學生選分母，決定平均切成幾份。
4. 學生調整分子，決定取幾份。
5. 學生按「檢查分數」取得等值或錯誤提示。
6. 完成後進入下一個挑戰。

## 4. Debug Contract

前端會暴露安全、無敏感資料的：

```js
window.__TOOL_DEBUG__
```

必要欄位包括：

| 欄位 | 用途 |
|---|---|
| `siteId` | 固定為 `lwwf-math-fraction-kitchen` |
| `route` | 固定為 `fraction-kitchen` |
| `mode` | 目前工具模式 |
| `numerator` / `denominator` | 目前學生切出的分數 |
| `selectedActivityId` | 目前挑戰 id |
| `targetFraction` | 目標分數 |
| `completedCount` | 完成挑戰數 |
| `score` / `attempts` / `accuracy` | 基本表現摘要 |
| `loadedAssets` | 校章、背景與分數盤狀態 |
| `saveStatus` | 本機保存狀態 |
| `lastFeedback` / `lastError` | 安全回饋與錯誤 |

不可包含學生姓名、完整帳號、密碼、token、API key 或 Supabase service-role 資料。

## 5. 驗收要求

| Gate | 要求 |
|---|---|
| Check | `npm run check` 必須通過 |
| Smoke QA | `npm run test:smoke` 必須通過 |
| Full QA | `npm run qa` 必須通過 |
| Debug | `window.__TOOL_DEBUG__` 與 `data-tool-debug` 必須存在 |
| 操作 | 學生能切出 3/4 並完成第一題 |
| 錯因 | 錯誤答案要顯示交叉乘積提示 |
| 手機 | 390px 寬度不可橫向溢出 |
| 安全 | 不在前端暴露密鑰或學生敏感資料 |

## 6. 下一步

- 把 `tools/fraction-kitchen.html` 接入主頁或指定章節。
- 接入 Learning Passport 時，只記錄任務 id、分數、完成狀態，不保存不必要個人資料。
- 延伸至「分數料理台二」：異分母比較與通分。

## 7. Learning Passport 整合

更新日期：2026-06-13

分數料理台已加入 Learning Passport SDK，正式護照站點 ID 使用 `lwwf-math-ai`，工具內部 debug ID 保留 `lwwf-math-fraction-kitchen`。

| 項目 | 設計 |
|---|---|
| 進度觸發 | 學生答對每一道分數挑戰後觸發 |
| taskId | `fraction-kitchen-[challengeId]` |
| taskTitle | `分數料理台：目標分數` |
| score | 答對挑戰記錄為 100 |
| coins | 每道挑戰 5 金幣 |
| 離線備援 | 未由護照進入時仍保存本機進度 |
| 安全 metadata | 只送出工具 ID、分數目標、學生切出的分數、完成數、嘗試數、準確率、策略類型與視覺模型，不包含 token、password、API key、provider 或學生姓名 |

畫面新增 `passport-pill` 狀態：`護照未連線`、`護照已連線`、`護照記錄中`、`護照已記錄`、`護照暫未同步`。
