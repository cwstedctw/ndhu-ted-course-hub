# NDHU TED Course Hub

陳文盛老師 115-1 學期課程入口網站：8 班課程頁、演講課互動總海報與單場頁（t01–t12）、作品展、成績查詢跳轉。
純靜態（SSG）、`content/` JSON 驅動、零後端、**零學生個資**。

**repo 位置（2026-08-26 確認）**：`D:\Ted_data\active\ndhu-ted-course-hub`——已搬出 wailan_agent、
自己一個 repo（遠端 `cwstedctw/ndhu-ted-course-hub`）。舊文件寫的「住在 wailan_agent 裡面」已不成立。

跟本站相鄰的兩個 repo（**不在本 repo 裡**，別搞混）：
`D:\Ted_data\active\ndhu-ai-courses`（教材館）、`D:\Ted_data\active\live-deck-kit`（現場回饋）。

來源文件（住在腦 repo `D:\Ted_data\wailan_agent`，本 repo 只引用、不同步）：

- 設計書真值：`workspace/outbox/20260702-wailan-course-hub-詳細設計書.md`
- 視覺基準：`workspace/teaching/tools/course-hub-prototype`（styles.css 設計 token 移植精修）
- 本 repo 根的 `SPEC.md`＝**2026-06-11 的歷史設計稿**，不是現行真值（見該檔首部警語）

## 技術架構（2026-07-02 晚，洄瀾裁決）

- Next.js（App Router）＋純 JavaScript（.js，不用 TypeScript）
- **不用 Tailwind**——全域 CSS 設計 token（`--*` 變數，自原型 styles.css 移植）
- `output: 'export'`、`trailingSlash: true`、`images.unoptimized: true`
- `basePath`／`assetPrefix` 吃環境變數 `BASE_PATH`（本機空字串；CI 設 `/ndhu-ted-course-hub`）
- 共用資料介面＝`lib/content.js`（`getSite()`、`getAnnouncements()`、`getCourses()`、`getCourseBySlug(slug)`、`getTalks()`、`getShowcase()`），頁面一律經它讀 `content/`，不直接 import JSON

### v1 裁決偏離計畫書之註記

計畫書 v1.0（2026-06-23）原訂 Tailwind 4＋Cloudflare Pages；v1 實作裁決改為
**全域 CSS token（無 Tailwind）**、**GitHub Pages 部署**（`BASE_PATH=/ndhu-ted-course-hub`）、
`/talks/` 轉址採靜態轉址殼（meta refresh＋`location.replace`）而非 `_redirects`。
設計書其餘規格照舊為真值。

## 指令

```bash
npm install
npm run dev        # 本機開發 http://localhost:3000/
npm run validate   # ajv 驗 content/ JSON（schema＋跨檔檢查＋班別語言 profile）
npm run ics        # 產演講行事曆 .ics
npm run decks      # 產 9 份課程介紹簡報 → public/decks/（需 Python 3）
npm run scan       # 掃 out/ 輸出（個資／internalNotes 防滲漏）
npm run urlcheck   # 掃 out/ 路由與資產參照是否斷鏈
npm run build      # 一條龍：validate → ics → decks → next build → scan → urlcheck
```

⚠️ `npm run build` 是 **五道閘門串起來**，任一道失敗就停。別只跑 `next build` 就以為過了——
內容錯與斷鏈都是在 next build 前後那幾道才拓得到。

正式建置模擬 CI 子路徑：`BASE_PATH=/ndhu-ted-course-hub npm run build`，輸出在 `out/`。

## content/ 填寫指引

資料都在 `content/`（詳設計書第三章）：

```
content/
  site.json            全站設定（品牌、scoreUrl、頁尾署名、about、buildLog 開關）
  announcements.json   首頁公告
  courses.json         8 班索引＋ slug→(courseDir, sectionId) 路由對照
  courses/<課程>/course.json   一課一檔（6 檔）；AA/AB 由 sections[] 建站展開
  courses/11501-ai-future/talks.json   12 場演講
  showcase/114-2.json  上學期精選作品
```

JSON Schema 實際住在 **repo 根的 `schema/`**（不在 `content/` 裡）；
`scripts/validate-content.mjs` 兩個位置都吃得到，但新檔一律放 `schema/`。

填寫鐵律：

1. **零學生個資**——姓名、學號、成績、私訊內容一律不進 repo。
2. **禁 `internalNotes` 欄位**——任何 content 檔出現即 validate 失敗。
3. **未定資訊不編造**——用 pending 物件 `{"status":"pending","note":"…"}`，前端渲染成水波占位。
4. 繁體中文台灣用語；改完跑 `npm run validate` 再 commit。

### 班別語言 profile（2026-08-26 定案，AA 現在不是純中文了）

`sections[].langProfile` 宣告那一班的語言，兩班同樣吃一份 `course.json`：

| 班 | primary | mode | 頁面長什麼樣 |
|---|---|---|---|
| AI 概論 **AA**（EMI） | `en` | `en-primary-zh-support` | 英文為主、繁中在下方並列支援——**雙欄，不是 en-only** |
| AI 概論 **AB** | `zh-Hant-TW` | `zh-primary-en-terms` | 繁中可獨立完成，技術名詞首次附英文 |
| 其餘六班 | （未宣告） | — | 完全不受影響，DOM 與以前一模一樣 |

- 英文內容＝`course.json` 的 `en` 子樹（**索引對齊**中文本體）；
  共用 chrome（導覽、按鈕、狀態字）＝`site.json` 的 `i18n.en`。
- ⚠️ **fail-closed**：宣告了 `primary: "en"` 却缺任何一條英文字串，
  `npm run validate` 規則 #20 直接 FAIL、build 一起掛，**不會默默回落中文**。
  失敗訊息會把缺字清單逐條列出來，那就是你的待辦清單。
  元件裡那層中文 fallback 只是 runtime 防呆，不是「可以少寫英文」的許可。
- 本輪英文承諾範圍＝**課程殼**（landing、17 週大綱、評量、FAQ、安全守則、求助、頁內導覽）。
  **每週教材包與 showcase 學生作品不在範圍內**；全站 i18n（首頁、演講課、about、
  site header／footer）也另開一輪，別在 `i18n.en` 裡長第二份。
- 實作：`lib/i18n.js`（`makeL()`）、`components/course/Bi.js`（雙欄文字）。

### 一份內容、兩種輸出（2026-07-03 定案）

`content/courses/<課程>/course.json` 是每門課的**單一內容源**，餵兩個輸出：

1. **本站課程頁**——push 即上線。
2. **課程介紹簡報**（19 頁 deck）——老師端簡報產線讀**同一份** course.json 產出，供課堂投影。產線與課程私有備忘（internal notes、講者提醒）不在本 repo。

因此：改課程內容**一律改 course.json**，不要在頁面元件裡硬編；也不要為簡報另開第二份內容檔——內容分兩家一定漂移。schema 已保留 `sections[].deckName` 對應各班簡報名。

## 部署：GitHub Pages

- `npm run build`（CI 設 `BASE_PATH=/ndhu-ted-course-hub`）→ 靜態檔在 `out/`，發佈到 GitHub Pages。
- `public/.nojekyll` 隨輸出帶出，避免 Pages 的 Jekyll 吃掉 `_` 開頭資源。
- 成績查詢按鈕直跳 V2 Apps Script `/exec`（真值在 `site.json` 的 `scoreUrl`），一律
  `target="_blank" rel="noopener noreferrer"`，站上零成績資料。

## 與設計書對應

| 本 repo | 設計書 |
|---|---|
| 路由與各頁規格（`app/`） | 第二章 IA／逐頁規格（含路由表、轉址規則） |
| `content/`＋`schema/`＋`lib/content.js` | 第三章 內容模型與資料工作流 |
| 建置管線、`scripts/`、部署 | 第四章 技術架構（部署改 GitHub Pages，見上註記） |
| 全域 CSS token、元件 | 第五章 設計系統與元件規格 |
| 里程碑與驗收 | 第六章 專案計畫與 QA |

`/build-log/` 頁待拍板（`site.json` 的 `buildLog.enabled=false`），v1 不產出此路由。
