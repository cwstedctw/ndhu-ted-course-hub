# scripts/talks/ — 演講課管理台 Sheet → talks.json 一鍵更新腳本

把「115-1 AI法律通識教育演講課管理台（正式）」Sheet 的 `Talks` 分頁，轉成
`content/courses/11501-ai-future/talks.json`（供 course hub 海報牆讀取）。

## 每週一操作三步

1. **跑腳本**（線上模式，會呼叫 `gws` 讀正式 Sheet）：
   ```bash
   PYTHONUTF8=1 python scripts/talks/pull_talks.py
   ```
   預設會覆寫 `content/courses/11501-ai-future/talks.json`。
2. **看終端機印出的 diff 摘要**：逐場列出「哪些欄位變了、舊值→新值」，以及哪些場次
   因為 Sheet 狀態還不是「已確認」或「已完成」而被歸為**占位（不公開）**——這段務必
   看過，確認沒有不該曝光的講者資訊跑出來。
3. **人工核對沒問題後，自己跑 `git diff` / `git add` / `git commit`**。
   **本腳本絕不自動 commit**，也絕不呼叫任何 `git` 指令。

## 隱私鐵律（2026-07-25 Ted 拍板，不可繞過）

Sheet 的 `status` 欄只有兩種值會讓場次「公開」：

| Sheet 狀態原文 | 輸出 status |
|---|---|
| 已確認 | `confirmed` |
| 已完成 | `done` |

**其他任何狀態**（含「邀約中」、「婉拒」、空白……）→ 該場次輸出**全欄 null**（`tba`
占位，`moe: []`）。**即使 Sheet 那一列其實已經填了講者姓名、機構等欄位，也一律不
外流**——因為講者還沒答應公開課表就先曝光是不對的。腳本印的 diff 摘要對這類場次
只會印「Sheet 狀態原文＝『XXX』→ 占位（不公開）」，不會把該列其他欄位內容印出來。

`isDeleted` 為 `TRUE` 的列（軟刪除的重複／作廢草稿）整列跳過，不計入 12 場。

## 兩種執行模式

```bash
# 離線／測試：吃本機 CSV，完全不連網、不呼叫 gws
python scripts/talks/pull_talks.py --csv <talks_raw.csv> [--out <輸出路徑>]

# 線上（預設）：自動查 spreadsheetId 再讀 Talks 分頁
python scripts/talks/pull_talks.py [--out <輸出路徑>]
```

線上模式的兩個 `gws` 呼叫：

1. `gws drive files list` 用試算表名稱「115-1 AI法律通識教育演講課管理台（正式）」
   查 `spreadsheetId`——**ID 屬個資，只在腳本內部流轉，絕不印到 stdout、絕不寫進
   任何檔案**（同名還有 demo／dev／backup 副本，查到不只一筆會直接報錯要求人工確認）。
2. `gws sheets spreadsheets values get --params '{"spreadsheetId":..., "range":"Talks!A1:Z300"}' --format csv`
   讀整張表（範圍給到 `Z300`，別學會被截斷的教訓——見
   `memory/runbooks/talkmgr_sheet_ops.md` 的截斷雷）。

## 欄位對位（用欄名，不是欄序）

固定讀這 11 個欄名（Sheet 上還有 `updatedAt`／`updatedBy`／`version` 等同步欄，
腳本用不到、直接忽略）：

```
id, isDeleted, no, status, date, title, abstract, moeJson,
speakerName, speakerTitle, speakerOrg
```

CSV 欄位可能含半形逗號（例：機構名稱裡的「超過 30,000 人次」），一律用 Python
`csv` 模組解析，不手刻 `split(",")`。

## 值轉換規則

- 空字串或「無」→ `null`（Sheet 用「無」表示「沒有所屬單位」，照字面印到頁面會
  變成「洪岱郁・自由工作者・無」這種怪句子）。
- `time` 固定 `"09:30"`、`venue` 固定 `"理工二館 ZT講堂 C101"`——來源＝管理台
  Settings 分頁 2026-07-25 快照，Sheet 的 `Talks` 分頁本身不管這兩欄。
- `moeJson` 欄位是 JSON 陣列字串（如 `["b1_ethics","b2_risk"]`），解析失敗會直接
  中止並印出是哪個 `no`／`id` 出問題。

## 合併 repo 既有資產欄

`poster`、`worksheetUrl`、`materials`、`speaker.photo` 這四欄 Sheet 不管——腳本
會從**輸出路徑現有的 talks.json**（若存在）依 `id` 撈回這些欄位的值，原樣保留，
不會被 Sheet 匯出的資料覆蓋掉。第一次產生某場次（先前沒有這筆）時，這幾欄預設
`null`／`[]`。

## 輸出排版

手寫縮排以吻合現行 `content/courses/11501-ai-future/talks.json` 的既有排版（2 空格
縮排、`speaker` 與 `moe` 等陣列壓成一行）——**逐位元組相容**，`git diff` 只會顯示
真正的內容變動，不會整檔重排出雜訊。

## 測試（離線、零網路）

```bash
PYTHONUTF8=1 python scripts/talks/test_pull_talks.py
```

跑的內容：

- 把 repo 的 `content/`、`schema/` 複製到暫存目錄，模擬一份乾淨的 repo（**全程只讀
  真正的 repo 內容，從不寫回**，測試跑完不會留下被改動的 content）。
- 用 `fixtures/talks_raw.csv`（涵蓋：邀約中但填了講者姓名、`isDeleted` 列、已確認
  無講題、機構欄＝「無」、欄位含半形逗號、已完成→`done`）跑
  `pull_talks.py --csv ... --out <暫存路徑>`。
- 斷言輸出 JSON 與手動推導的期望值逐欄相等；並且**專門驗證隱私鐵律**——邀約中／
  婉拒等場次即使 Sheet 上填了講者姓名，輸出 JSON 與 stdout 診斷訊息都不能出現這些
  內容的任何一個字。
- 用 `subprocess` 跑 `node scripts/validate-content.mjs <暫存 repo 根目錄>`，確認整
  個內容樹（含剛產生的 talks.json）通過驗證（PASS）。

新增外部連結網域到測試 fixture 時，記得先確認該網域已在
`scripts/validate-content.mjs` 檔頭的 `ALLOWED_URL_HOSTS` 白名單內（目前測試用
`cwstedctw.github.io`），否則會被 `#20` 規則擋下——這是 validate-content.mjs 本身
的規則，不是 pull_talks.py 的問題。

## 已知限制

- 若 Sheet 的 `no` 欄位不是完整涵蓋 1–12（例如漏填、重複、該軟刪除的忘了勾），
  腳本會直接中止並印出實際讀到的 `no` 清單，不會生出殘缺或超過 12 場的 talks.json。
- 若某場「已確認」／「已完成」但 `moeJson` 留空，腳本仍會照樣輸出
  `"moe": []`——這種情況 `node scripts/validate-content.mjs` 會抓到並 FAIL
  （schema 規定已確認／已完成的場次 `moe` 至少 1 項），這是刻意設計：腳本不該
  自己捏造教育部指標，要回頭請 Ted 在 Sheet 補上。
