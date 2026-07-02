# NDHU_TED_Course_Hub 專案規格書 v1

> 狀態：**草稿、待 Ted 拍板**（拍板後可派秀姑巒覆核，再開工 M0）
> 作者：洄瀾｜2026-06-11｜放置：`workspace/teaching/tools/ndhu-ted-course-hub/`
> 三項已定決策：①技術底＝**B 案（codex-site 基底：vinext＋Cloudflare）** ②格局＝**多課平台** ③名稱＝**NDHU_TED_Course_Hub**（Ted 2026-06-11 拍板）

---

## 0. 一句話

Ted 所有課的**課程管理平台**：對學生是課程門面（課綱、演講、公告、查成績入口），對 Ted 是一套「加一門課＝加一筆資料」的營運系統；第一個進駐的課＝115-1「AI未來應用與趨勢探索：洄瀾的智慧未來」（12 場專家講座）。

## 1. 定位與邊界

### 1.1 三個站各司其職

| 站 | 本質 | 關係 |
|---|---|---|
| **NDHU_TED_Course_Hub（本案）** | 課程營運平台：門面＋演講專區＋成績入口 | 主站，學生記這一個網址 |
| ndhu-ai-courses（現站，GitHub Pages） | 教材館：講義、工作坊（跨學期不過期） | 不動；之後首頁互放連結 |
| V2 成績查詢（Apps Script，已上線） | 私有資料層：學生憑校帳號只看自己 | Hub 掛入口連過去 |

### 1.2 範圍（in / out）

**做**：
- 平台首頁（學期 × 課程卡）、課程主頁、課綱與評分頁
- 演講專區：海報牆＋單場頁（海報、講者介紹、時地、講義下載、課程照片精選）
- 成績／出席查詢「入口」（導向 Apps Script V2，伺服器端認身分）
- 海報產製管線：同一筆演講資料 → 網頁卡片＋A4 印刷海報
- 期末教育部「課程紀錄」匯出（本地腳本，吃同一份資料）

**不做（明確排除，避免範圍爬行）**：
- ❌ 老師端網頁後台——成績管理沿用既有 production 管線（course-prep／attendance／gradebook-sync ＋ Google Sheets），網站只負責「呈現＋學生自助查詢」。要碰真資料寫入權限，工程與資安風險翻倍，留待平台站穩後另案評估。
- ❌ 站上任何學生個資（名冊、成績、學號、出席原始檔）——紅線，見 §8。
- ❌ 選課、報名、作業繳交（學校系統與 Google Classroom 的事）。

## 2. 系統架構

```
┌──────────────────────────────────────────────────────┐
│  NDHU_TED_Course_Hub（公開、新 GitHub repo）            │
│  vinext (Next 16 App Router) + React 19 + Tailwind 4  │
│  └─ 內容全部 SSG 預先渲染（content/ 的 JSON 進 repo）    │
│  └─ Cloudflare Workers 部署（wrangler）                │
│     首頁 ・ 課程主頁 ・ 演講牆 ・ 單場頁 ・ 課綱 ・ /score │
└──────────────┬───────────────────────────────────────┘
               │ 「查成績」連結（不經 Hub 傳資料）
               ▼
┌──────────────────────────────────────────────────────┐
│  Apps Script V2（已上線）：校帳號登入、伺服器端認身分、    │
│  只回該生本人資料 ←── Google Sheets 成績簿（Drive）      │
└──────────────▲───────────────────────────────────────┘
               │ 寫入（與 Hub 無關，照舊）
   老師端管線（brain repo skills，production）：
   course-prep 名冊→成績簿 ・ attendance Zuvio 點名 ・ gradebook-sync 成績寫入
```

**關鍵原則：Hub 與真實學生資料零接觸。** Hub 是純靜態產物（SSG），repo 裡只有公開內容；成績查詢是「跳轉」不是「代理」，身分驗證發生在 Apps Script 那端。將來若要站內嵌查詢（iframe／API），另案做資安評估，不在 M1–M4。

### 2.1 從 codex-site 繼承什麼、丟什麼

| 項目 | 處置 |
|---|---|
| vinext＋Cloudflare 殼（package.json、worker/index.ts、vite/tsconfig） | ✅ 繼承（版本鎖定：vinext 0.0.50、next 16.2.6、react 19.2.6、tailwind 4.2.1、wrangler 4.92、node ≥22.13） |
| 校徽、東華品牌 assets、RWD 概念 | ✅ 繼承 |
| 假成績查詢 demo（data.js、查詢 UI） | ❌ 不搬——查詢交給 V2，Hub 只做入口頁 |
| `.openai/hosting.json`（Codex 的部署設定） | ❌ 不搬——部署改走 Ted 自己的 Cloudflare 帳號 |
| drizzle-orm／D1 資料庫接線 | ⏸️ 暫不用（內容走檔案、版本化、零 PII）；留著當未來選項（如演講回饋統計等非個資營運數據） |
| codex-site repo 本身 | 原地保留當存證，不動 |

## 3. 資料模型（平台的合約，最重要的一節）

內容即檔案（content as files）：全部進 repo、git 版本化、無資料庫。**加一門課＝加一個資料夾；加一場演講＝加一筆 JSON。**

```
content/
  courses.json                     ← 平台索引：所有課程清單
  courses/
    11501-ai-future/               ← courseId＝<學期>-<slug>（民國學期 11501＝115-1）
      course.json                  ← 課程主檔（課綱、評分、課表）
      talks.json                   ← 演講清單（演講課才有）
      announcements.json           ← 公告（可選）
public/
  courses/11501-ai-future/
    posters/  t01.png …            ← 海報成品（網頁用）
    speakers/ t01.jpg …            ← 講者照（公開宣傳照）
    photos/   t01-1.jpg …          ← 課程照片精選（見 §8 同意原則）
```

### 3.1 courses.json（平台索引）

```jsonc
[
  {
    "id": "11501-ai-future",
    "semester": "11501",                    // 民國學年+學期，排序/分組用
    "name": "AI未來應用與趨勢探索：洄瀾的智慧未來",
    "shortName": "AI未來應用與趨勢探索",
    "credits": "3 學分 ・ 通識選修",
    "kind": "lecture-series",               // lecture-series=演講課｜regular=一般課
    "status": "active",                     // upcoming｜active｜archived
    "organizer": "國立東華大學 通識教育中心",
    "program": "教育部「大專校院 AI 法律通識教育推動計畫」合作課程",
    "cover": null                           // 課程卡封面圖；null=生成式封面
  }
]
```

### 3.2 course.json（課程主檔）

```jsonc
{
  "id": "11501-ai-future",
  "intro": "課程簡介 2–3 段（白話、給學生看）",
  "themes": ["AI", "跨域", "倫理", "法律"],
  "schedule": { "weekday": "待定", "time": "待定", "location": "教室待定" },
  "weeks": 18,
  "grading": [                               // 評分方式（總和=100）
    { "item": "出席與參與", "pct": 40, "note": "12 場演講出席為主" },
    { "item": "演講學習單", "pct": 30, "note": "每場演講後繳交" },
    { "item": "期末成果",   "pct": 30, "note": "成果分享活動（計畫要求）" }
  ],                                         // ↑ 佔位示意，開學前 Ted 給真值
  "weeklyPlan": [                            // 18 週課表；演講週用 talkId 連動
    { "week": 1, "topic": "課程導論", "talkId": null },
    { "week": 3, "topic": null,       "talkId": "t01" }
  ],
  "ta": { "name": "待定", "contact": "待定" },
  "links": { "score": "https://cwstedctw.github.io/ndhu-ai-courses/score" }
}
```

### 3.3 talks.json（演講清單——已在前一輪定稿，整批沿用）

```jsonc
[
  {
    "id": "t01",                    // 必填唯一；路由 /courses/<courseId>/talks/t01
    "week": 3,
    "date": "2026-09-21",           // 未定 null
    "time": "14:10–16:00",          // 未定 null
    "location": "教室待定",
    "status": "confirmed",          // confirmed=已確認｜tba=待公布｜done=已結束
    "talk": { "title": "講題", "abstract": "白話簡介 2–4 句" },
    "speaker": {
      "name": "講者姓名", "title": "職稱", "org": "服務單位",
      "bio": "公開經歷 1–3 句", "photo": null      // null=姓名字首圓徽
    },
    "poster": null,                 // "posters/t01.png"；null=生成式封面（自動）
    "materials": { "slides": null, "handout": null, "video": null },  // 演講後補
    "photos": []                    // 課程照片精選檔名（演講後補）
  }
  // … 12 筆；未確認講者的場次整筆 status:"tba"，前端自動顯示「敬請期待」
]
```

**Schema 三承諾**：①未來欄位只加不改名（向下相容）②`null`＝「還沒有」，前端一律優雅降級（生成式封面／隱藏區塊／敬請期待）③這份 schema 同時餵網頁、海報管線、教育部匯出——**一筆資料、三個出口**。

## 4. 頁面規格（sitemap ＋ 每頁內容塊）

| # | 路由 | 頁面 | 內容塊 |
|---|---|---|---|
| P1 | `/` | 平台首頁 | 品牌列（NDHU TED Course Hub）、hero 一句話、**本學期課程卡**（依 courses.json status=active）、過往學期摺疊區、頁尾 |
| P2 | `/courses/[courseId]` | 課程主頁 | 課名＋學期＋學分 chips、課程簡介、四主軸標籤、**「下一場演講」聚焦卡**（自動挑最近 confirmed 未過期場次）、演講專區入口、課綱入口、查成績入口、TA 資訊 |
| P3 | `/courses/[courseId]/talks` | 演講牆 | 12 張直式海報卡（grid，海報圖或生成式封面＋週次＋日期＋講題＋講者）、狀態徽章（已確認／敬請期待／已結束）、依 week 排序 |
| P4 | `/courses/[courseId]/talks/[talkId]` | 單場頁 | 大海報（左）＋資訊（右）：講題、abstract、日期時間地點 chips、講者區塊（照片／字首徽、姓名職稱單位、bio）、教材下載區（slides/handout/video，null 隱藏；都 null 且未結束顯示「演講後提供」）、課程照片列（有才顯示）、上一場/下一場導覽 |
| P5 | `/courses/[courseId]/syllabus` | 課綱與評分 | 18 週課表（演講週自動帶入講題連結）、評分圓環圖＋逐項說明、修課須知 |
| P6 | `/score` | 成績查詢入口 | 說明「校帳號登入、只看得到自己」＋大按鈕 →V2 短網址；常見問題三條（登不進去／看不到成績／要複查） |

**共用元件**（React components，M1 隨頁面長出、不另開元件階段）：`CourseCard`、`TalkCard`（含生成式封面 fallback）、`StatusBadge`、`InfoChips`、`SpeakerBlock`、`MaterialsList`、`WeeklyTable`、`GradingRing`、`SiteHeader/Footer`。

## 5. 視覺系統

- **色票**＝現有品牌（與 ndhu-ai-courses、洄瀾數位溪谷規格一致）：洄瀾水青 `#0E7C7B`（主）、深水青 `#0a5e5d`、金 `#D9A441`（強調）、米 `#F4ECD8`（底）、墨 `#1A1A1A`。
- 字型：Noto Sans TC（網頁載入 400/500/700/900）。
- 卡片語言沿用現站：圓角 20、細邊框、hover 上浮＋teal 陰影；溪谷水紋當裝飾母題（生成式封面的底紋）。
- 動畫：GSAP 捲動進場（CDN 掛了照常顯示、尊重 prefers-reduced-motion）——與現站同款守則。
- RWD：手機單欄優先（學生主要用手機開）、桌機 grid。
- 生成式封面規則：無海報的場次用「teal 漸層＋週次大字＋講題＋水紋」自動封面，**整面牆永遠不開天窗**。

## 6. 海報管線（M2）

```
talks.json（同一筆資料）
   ├→ 網頁：TalkCard／單場頁（自動）
   └→ tools/poster/template.html ＋ poster.css
        └→ headless Chrome 渲染（course-intro 同款管線、已驗證）
             ├→ A4 直式 PNG（2480×3508，印刷／公告欄）
             └→ 社群版方圖（1080×1080，可選）
```

- 模板做 1–2 款（teal 主視覺＋金色強調），12 場換資料不換版型——系列感就是品牌感。
- 講者照規格：建議 800px 以上方圖；沒照片用字首徽版型。
- 產出物：印刷檔交 Ted 送印；web 版裁壓後進 `public/.../posters/`。

## 7. 教育部交付（M4，計畫硬需求）

每學期結束 1 個月內要交：修課統計、課程紀錄（課表＋每週重點＋出席統計）、課程照片、外聘講師教材。對應：

| 交付項 | 來源 | 怎麼出 |
|---|---|---|
| 課表＋每週授課重點 | course.json weeklyPlan ＋ talks.json | 本地匯出腳本 → docx/md 草稿 |
| 出席統計（彙總、非個人明細） | attendance 管線（data-root，本地） | 同腳本合併；**個資不離開本地** |
| 課程照片 | photos/（站上精選）＋ OneDrive 全集 | 引用路徑清單 |
| 講師教材 | materials 欄連結 ＋ OneDrive 歸檔 | 引用路徑清單 |
| 修課統計 | course-prep 名冊（本地） | 彙總數字（人數、系所分布） |

匯出腳本住 brain repo（會碰 data-root），不進 Hub 公開 repo。

## 8. 個資與安全（紅線）

1. **Hub repo 公開**（品牌＋學生免登入看內容）；公開的前提＝**repo 裡永遠沒有**：名冊、成績、學號、出席原始檔、Apps Script scriptId／部署 ID、任何 `.env`。
2. **PII git hooks**：把 brain repo 的內容式 pre-commit／pre-push hooks（掃學號格式）複製進新 repo，M0 就裝、不是事後補。
3. 講者資料＝**公開宣傳資訊**，上站前取得講者同意（邀請函附一句「簡介與照片將用於課程網站與海報」）。
4. **課程照片**：站上只放「精選＋已處理」——學生臉部可辨識的照片需課堂告知同意（開學第一週講明＋學習單勾選），不願入鏡者避開或模糊；教育部交付用全集走 OneDrive 不上站。⚠️ 此條執行細節待 Ted 確認校內慣例。
5. 成績查詢零經手：Hub 只放連結，不 iframe、不代理 API（M1–M4）。

## 9. 部署與環境

- **Repo**：GitHub 新公開 repo `cwstedctw/NDHU_TED_Course_Hub`（名稱照 Ted 拍板）。
- **部署**：Cloudflare Workers（wrangler deploy）→ 預設網址 `*.workers.dev`；要好記可加自訂網域或先用短網址服務。**待決：Ted 的 Cloudflare 帳號**（免費方案即夠：靜態資產＋Workers 免費額度遠超這量級）。
- **本地開發**：`npm run dev`（vinext dev）；node ≥22.13（msi 26.3 ✓、mbp 26.0 ✓、c306 26.2 ✓——三台都能跑）。
- **CI**：第一版不上 CI，手動 `wrangler deploy`（跟 V2 的 clasp 節奏一致）；穩定後再考慮 GitHub Actions 自動部署。
- 開發痕跡（dist/、.wrangler/、node_modules/）一律 gitignore。

## 10. 里程碑（含驗收條件）

| 里程碑 | 內容 | 驗收（過了才算完成） | 時程錨 |
|---|---|---|---|
| **M0 殼** | 新 repo、從 codex-site 搬殼清 demo、PII hooks、content/ 骨架 | `npm run dev` 首頁起得來；hooks 擋得住測試學號 | 6 月下旬 |
| **M1 平台骨架＋prototype** | 資料模型落地（示意 3 場＋9 場 tba）、P1–P4 四頁可點 | Ted 本地走完「首頁→課程→演講牆→單場」並拍板視覺 | 6 月底–7 月初 |
| **M2 海報管線** | 模板＋render、12 張生成式封面、首批真海報 | 同一筆 JSON 出「網頁卡＋A4 PNG」兩出口 | 7 月（講者名單到位後換真資料） |
| **M3 課綱＋成績入口** | P5、P6、V2 綁 115-1 成績簿（開學名冊） | 真學生或 TA 實測：查得到自己、看不到別人 | 8 月底–9 月初 |
| **M4 營運＋交付** | 講義/照片更新 SOP、教育部匯出腳本 | 用前 2 場真實演講出一份「課程紀錄」草稿 | 學期中 |
| 部署節點 | M1 後即可掛上 Cloudflare 試營運（內容無 PII） | 手機實機開過 | 開學前全站正式發布 |

## 11. 團隊分工

| 誰 | 扛什麼 | 備註 |
|---|---|---|
| 洄瀾 | 規格、資訊架構、文案語氣、整合把關、拍板前收尾 | 本規格書；M0 可自做 |
| 立霧 | vinext／React 施工主力（殼是他建的，最熟） | ⚠️ msi 無額度——**從 mbp／c306 派**（兩台 codex 0.136 ✅），或 Ted 儲值後 msi 復派 |
| 秀姑巒 | **本規格書覆核**（盲點掃描）、視覺概念比較、講者公開資料彙整 | msi agy 1.0.6 ✅ 隨時可派 |

## 12. 風險與待決事項（要 Ted 給 input 的都在這）

| # | 事項 | 影響 | 需要什麼 |
|---|---|---|---|
| R1 | **Cloudflare 帳號** | M1 後的部署 | Ted 開一個免費帳號（或提供既有帳號）＋本機 `wrangler login` 親跑一次 |
| R2 | **12 位講者名單／日期** | M2 真海報、課表真值 | 有幾位先給幾位（schema 支援逐場補） |
| R3 | 課程時段／教室／評分比例 | course.json 真值 | 課綱定案後給（目前佔位標示意） |
| R4 | 學生照片公開原則 | §8.4 | Ted 確認校內慣例＋開學告知方式 |
| R5 | vinext 0.0.50 很年輕 | 升版可能破壞 | 鎖版本；不追新、能跑就不動 |
| R6 | 立霧 msi 無額度 | 施工速度 | 走 mbp/c306 派工，或儲值 |

## 13. 下一步流程

1. **Ted 看本規格書** → 批註／拍板（特別是 §12 的 R1–R4）
2. （建議）**派秀姑巒覆核**規格書盲點——平台 schema 是合約，值得第二雙眼睛
3. 拍板後 → **M0 開工**（建 repo、搬殼、hooks），M1 prototype 給 Ted 點

---
【洄瀾草稿】請 Ted 讀過再用
