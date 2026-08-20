#!/usr/bin/env node
/**
 * check-output.mjs — 舊 URL／輸出完整性掃描（W3-3，build 最後一關新增；npm 接線由洄瀾負責）
 *
 * 依據：《Course Hub v3 設計計畫 v1.1》§4.3（演講區）、C2/C3/C6（命名鐵則／場刊卡三態／
 * 炫的預算）、§8 補強第 1、5、12 條（soft-404 內容 grep、脊椎路由、資產一起驗）、
 * 風險 Top 6 第 5 條（12 場詳情頁路由產出錯誤＝上線日全 404）。
 *
 * 三段檢查（一支腳本跑完，零新依賴、只用 node 內建模組）：
 *
 *   一、路由清單檢查——讀 content（courses.json 的 slug、各 lecture-series 課的
 *       talks.json 的 id）動態組出「這次 build 理論上必須存在」的靜態路由，
 *       逐一驗 out/ 對應的 index.html（或 404.html 本身）存在且非空（size > 0）。
 *
 *   二、soft-404 掃描——對「一」清單裡每一頁（404.html 本身除外）的 HTML，剝掉
 *       <script>/<style>/註解／標籤後只留可視文字，檢查有沒有「找不到頁面／
 *       頁面不存在／404」字樣。先剝殼是必要的：Next App Router 會把 not-found
 *       segment 的 RSC flight data 內嵌進「每一頁」（給前端軟導覽用），且真的
 *       有圖檔叫 boat-404.webp——不剝殼直接對原始 HTML 做字串比對，首頁就會
 *       假陽性中招（實測見下方驗證記錄）。
 *
 *   三、資產參照檢查——掃 out/ 底下遞迴所有 .html 檔案全部 src/href，篩出站內資產（css/js/圖／
 *       字型／ics／deck html），驗檔案真的存在於 out/。basePath 前綴用「錨點
 *       偵測」還原：全站頭部每頁都有 /logo.png 這個已知真實檔案，從它在 HTML
 *       裡實際被引用的字串反推這次建置真正吃到的 basePath，比硬讀
 *       next.config.mjs 再猜 process.env.BASE_PATH 準——建置當下用什麼環境變數
 *       跑，這支腳本事後才跑，兩邊環境不保證一致。相對路徑（如 mc/ 小站的
 *       "assets/logo.png"）則相對「引用它的那個 HTML 檔案所在目錄」解析。
 *
 * 輸出格式照 scripts/validate-content.mjs／scripts/scan-output.mjs 慣例：
 *   逐項 [FAIL]/[WARN] 檔案｜規則｜明細，結尾一行 PASS/FAIL 總結。
 * 退出碼：0＝PASS；1＝發現問題（建置不得出站）；2＝腳本或前置設定錯誤（如 out/ 不存在）。
 *
 * 用法：node scripts/check-output.mjs [out 資料夾路徑]
 *       （參數只給測試用；不帶參數＝repo 根目錄的 out/。跑之前請先 npm run build。）
 */

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(path.join(SCRIPT_DIR, ".."));
const CONTENT_DIR = path.join(ROOT, "content");
const OUT_DIR = path.resolve(process.argv[2] ?? path.join(ROOT, "out"));

const failures = []; // {file, rule, msg}
const warnings = [];
const relOut = (p) => path.relative(OUT_DIR, p).split(path.sep).join("/") || ".";
const fail = (file, rule, msg) => failures.push({ file, rule, msg });
const warn = (file, rule, msg) => warnings.push({ file, rule, msg });

/* ── 前置：out/ 要存在才有得驗（比照 scan-output.mjs 的慣例） ─────── */

if (!existsSync(OUT_DIR)) {
  console.error(`[FAIL] ${OUT_DIR}｜out/ 不存在｜請先跑 next build（npm run build 會自動串 validate → build → scan）`);
  process.exit(2);
}
if (!statSync(OUT_DIR).isDirectory()) {
  console.error(`[FAIL] ${OUT_DIR}｜不是資料夾｜掃描目標必須是建置產物資料夾`);
  process.exit(2);
}

/* ── 讀 content：組出這次建置「理論上必須存在」的路由清單 ──────── */

function readJson(file, { required = true } = {}) {
  if (!existsSync(file)) {
    if (required) {
      console.error(`[設定錯誤] 讀不到必要的 content 檔：${path.relative(ROOT, file)}`);
      process.exit(2);
    }
    return null;
  }
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    console.error(`[設定錯誤] ${path.relative(ROOT, file)} 不是合法 JSON：${e.message}`);
    process.exit(2);
  }
}

const coursesIdx = readJson(path.join(CONTENT_DIR, "courses.json"));
const courses = Array.isArray(coursesIdx?.courses) ? coursesIdx.courses : [];

/**
 * 必須存在的路由清單。每筆：
 *   route       — 給人看的路徑（記錄用）
 *   outRel      — 相對 OUT_DIR 的實際檔案路徑（目錄路由＝".../index.html"；
 *                 404.html 這筆例外，outRel 直接就是檔名本身）
 *   skipSoft404 — true＝跳過二、soft-404 檢查（僅 404.html 本身）
 */
const requiredRoutes = [];
const addDirRoute = (route) => {
  const rel = route === "/" ? "index.html" : `${route.replace(/^\/|\/$/g, "")}/index.html`;
  requiredRoutes.push({ route, outRel: rel, skipSoft404: false });
};

addDirRoute("/");
addDirRoute("/courses/");
addDirRoute("/score/");
addDirRoute("/about/");

for (const c of courses) {
  if (!c || typeof c.slug !== "string") continue;
  addDirRoute(`/courses/${c.slug}/`);
}

// lecture-series 課：talks.json 的每一場 + talks/ 轉址殼索引頁
for (const c of courses) {
  if (!c || c.kind !== "lecture-series" || typeof c.slug !== "string" || typeof c.courseDir !== "string") continue;
  const talksPath = path.join(CONTENT_DIR, "courses", c.courseDir, "talks.json");
  if (!existsSync(talksPath)) {
    fail(talksPath, "R1 路由清單", `courseDir「${c.courseDir}」kind=lecture-series 但缺 talks.json——無法組出場次路由`);
    continue;
  }
  const talksData = readJson(talksPath);
  addDirRoute(`/courses/${c.slug}/talks/`);
  const talks = Array.isArray(talksData?.talks) ? talksData.talks : [];
  for (const t of talks) {
    if (!t || typeof t.id !== "string") continue;
    addDirRoute(`/courses/${c.slug}/talks/${t.id}/`);
  }
}

// 404.html：獨立一筆，直接對到檔案本身、不套「目錄/index.html」規則
requiredRoutes.push({ route: "/404.html", outRel: "404.html", skipSoft404: true });

/* ── 一、路由清單檢查：存在且非空 ─────────────────────────────── */

for (const r of requiredRoutes) {
  const p = path.join(OUT_DIR, r.outRel);
  if (!existsSync(p)) {
    fail(p, "R1 路由存在", `必須存在的路由「${r.route}」缺對應產物（找不到 out/${r.outRel}）`);
    r._missing = true;
    continue;
  }
  if (!statSync(p).isFile()) {
    fail(p, "R1 路由存在", `「${r.route}」對應的 out/${r.outRel} 不是檔案`);
    r._missing = true;
    continue;
  }
  if (statSync(p).size === 0) {
    fail(p, "R1 路由非空", `「${r.route}」對應的 out/${r.outRel} 是空檔案（0 bytes）`);
    r._missing = true;
  }
}

/* ── 二、soft-404 掃描（僅第一段清單裡的頁面，404.html 本身除外） ── */
/*
 * 剝殼規則：先拿掉 <script>…</script>／<style>…</style>／HTML 註解，再拿掉
 * 所有標籤只留文字節點——Next 把 not-found segment 的 RSC flight data
 * 內嵌在每一頁的 <script> 裡（給前端軟導覽備援用），裡面就會出現
 * "children":"404" 這種 JSON 片段；不是頁面正文，剝殼後自然消失。
 */

function stripToVisibleText(html) {
  let s = html;
  s = s.replace(/<script[\s\S]*?<\/script>/gi, " ");
  s = s.replace(/<style[\s\S]*?<\/style>/gi, " ");
  s = s.replace(/<!--[\s\S]*?-->/g, " ");
  s = s.replace(/<[^>]+>/g, " ");
  return s;
}

const SOFT_404_PHRASES = ["找不到頁面", "頁面不存在", "404"];

for (const r of requiredRoutes) {
  if (r._missing || r.skipSoft404) continue;
  const p = path.join(OUT_DIR, r.outRel);
  const html = readFileSync(p, "utf8");
  const text = stripToVisibleText(html);
  const hit = SOFT_404_PHRASES.find((phrase) => text.includes(phrase));
  if (hit) {
    fail(p, "R2 soft-404", `「${r.route}」正文疑似含 404 字樣（命中「${hit}」）——頁面回 200 但內容像找不到頁面，比真 404 難抓`);
  }
}

/* ── 三、資產參照檢查：out/ 底下遞迴所有 .html 全掃 src/href ──────── */

function* walkFiles(dir) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) yield* walkFiles(p);
    else if (ent.isFile()) yield p;
  }
}

const ASSET_EXT = new Set([
  ".css", ".js", ".mjs",
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".svg", ".ico",
  ".woff", ".woff2", ".ttf", ".otf",
  ".ics", ".html", // .html：deck 簡報／mc 小站等站內靜態頁，不是 next 產出的路由（路由沒有副檔名）
]);
const SKIP_PREFIX_RE = /^(https?:\/\/|\/\/|mailto:|tel:|data:|javascript:|#)/i;
const ATTR_RE = /\b(?:href|src)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

function safeDecode(v) {
  try {
    return decodeURIComponent(v);
  } catch {
    return v; // 解不了（壞的 % 序列）就用原字串，交給存在性檢查自己判生死
  }
}

/** 用已知真實檔案 /logo.png 當錨點，從實際被引用的字串反推這次建置的 basePath。 */
function detectBasePath() {
  const anchors = ["index.html", "courses/index.html", "about/index.html", "score/index.html"];
  for (const rel of anchors) {
    const p = path.join(OUT_DIR, rel);
    if (!existsSync(p)) continue;
    const html = readFileSync(p, "utf8");
    const m = html.match(/(?:href|src)="([^"]*)\/logo\.png"/);
    if (m) return m[1]; // 可能是空字串（本機建置、無 basePath）
  }
  return ""; // 偵測不到（極端狀況：連首頁都缺 logo）——當作沒有 basePath
}

const basePath = detectBasePath();

/** 解析一筆 href/src 到 out/ 底下的實體路徑；回傳存在的絕對路徑，或 null＝找不到。 */
function resolveAssetPath(rawValue, currentFile) {
  const clean = rawValue.split("?")[0].split("#")[0];
  if (!clean) return null;
  const decoded = safeDecode(clean);

  if (decoded.startsWith("/")) {
    const candidates = [decoded];
    if (basePath && decoded.startsWith(basePath + "/")) {
      candidates.push(decoded.slice(basePath.length));
    } else if (basePath && decoded === basePath) {
      candidates.push("/");
    }
    for (const c of candidates) {
      const p = path.join(OUT_DIR, c);
      if (existsSync(p) && statSync(p).isFile()) return p;
    }
    return null;
  }

  // 相對路徑（如 mc/ 小站的 "assets/logo.png"、"styles.css"）：相對引用它的檔案所在目錄解析
  const p = path.resolve(path.dirname(currentFile), decoded);
  if (existsSync(p) && statSync(p).isFile()) return p;
  return null;
}

// 去重：同一筆資產參照可能被幾十頁引用（如 logo.png），只報一次、附首見檔案與命中頁數
const assetSeen = new Map(); // key -> { ok, firstFile, count, sampleRaw }

for (const file of walkFiles(OUT_DIR)) {
  if (!file.endsWith(".html")) continue;
  const html = readFileSync(file, "utf8");
  let m;
  ATTR_RE.lastIndex = 0;
  while ((m = ATTR_RE.exec(html)) !== null) {
    const raw = m[1] ?? m[2] ?? "";
    if (!raw || SKIP_PREFIX_RE.test(raw)) continue;
    const cleanForExt = raw.split("?")[0].split("#")[0];
    const ext = path.extname(cleanForExt).toLowerCase();
    if (!ASSET_EXT.has(ext)) continue;

    // 絕對路徑的鍵不依賴引用它的檔案；相對路徑的鍵要連檔案目錄一起算，避免不同目錄的
    // 同名相對路徑（如各自資料夾底下都有的 "styles.css"）被誤判成同一筆
    const isAbsolute = raw.startsWith("/");
    const key = isAbsolute ? `abs::${raw}` : `rel::${path.dirname(file)}::${raw}`;

    if (assetSeen.has(key)) {
      assetSeen.get(key).count += 1;
      continue;
    }
    const resolved = resolveAssetPath(raw, file);
    assetSeen.set(key, { ok: resolved !== null, firstFile: file, count: 1, sampleRaw: raw });
  }
}

for (const [, info] of assetSeen) {
  if (info.ok) continue;
  fail(
    info.firstFile,
    "R3 資產參照存在",
    `引用「${info.sampleRaw}」在 out/ 找不到對應檔案（basePath 偵測值：${JSON.stringify(basePath)}；共 ${info.count} 處引用、僅列首見頁面）`
  );
}

/* ── 結果輸出（照 validate-content.mjs／scan-output.mjs 慣例） ──── */

console.log(`check-output：OUT_DIR＝${OUT_DIR}`);
console.log(`路由清單 ${requiredRoutes.length} 筆（含 404.html）、basePath 偵測值＝${JSON.stringify(basePath)}、資產參照去重後 ${assetSeen.size} 筆`);

if (warnings.length > 0) {
  console.log(`\n── 警告 ${warnings.length} 條（不擋建置）──`);
  for (const w of warnings) console.log(`[WARN] ${path.relative(ROOT, w.file)}｜${w.rule}｜${w.msg}`);
}

if (failures.length > 0) {
  console.error(`\n── 檢查失敗 ${failures.length} 條 ──`);
  for (const f of failures) {
    const shown = f.file.startsWith(OUT_DIR) ? `out/${relOut(f.file)}` : path.relative(ROOT, f.file).split(path.sep).join("/");
    console.error(`[FAIL] ${shown}｜${f.rule}｜${f.msg}`);
  }
  console.error(`\ncheck-output 結果：FAIL（${failures.length} 條錯誤、${warnings.length} 條警告）——不得出站，修正後重跑`);
  process.exit(1);
}

console.log(`\ncheck-output 結果：PASS（0 條錯誤、${warnings.length} 條警告）`);
