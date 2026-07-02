# NDHU TED Course Hub

Ted 115-1 學期課程入口網站：8 班課程頁、演講課海報牆（t01–t12）、作品展、成績查詢跳轉。
純靜態（SSG）、`content/` JSON 驅動、零後端、**零學生個資**。

- 設計書真值：`workspace/outbox/20260702-wailan-course-hub-詳細設計書.md`
- 視覺基準：`workspace/teaching/tools/course-hub-prototype`（styles.css 設計 token 移植精修）

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
npm run validate   # ajv 驗 content/ JSON（schema＋跨檔檢查）
npm run scan       # 掃 out/ 輸出（個資／internalNotes 防滲漏）
npm run build      # validate → next build → scan（一條龍）
```

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
  schema/              JSON Schema（validate 用）
```

填寫鐵律：

1. **零學生個資**——姓名、學號、成績、私訊內容一律不進 repo。
2. **禁 `internalNotes` 欄位**——任何 content 檔出現即 validate 失敗。
3. **未定資訊不編造**——用 pending 物件 `{"status":"pending","note":"…"}`，前端渲染成水波占位。
4. 繁體中文台灣用語；改完跑 `npm run validate` 再 commit。

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
