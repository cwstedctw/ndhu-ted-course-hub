#!/usr/bin/env node
/**
 * validate-content.mjs — NDHU TED Course Hub 內容驗證（npm run validate）
 *
 * 依據：《詳細設計書 v2.0》第三章（內容模型）第三節 schema＋第四節 CI 驗證規則表。
 * 兩段式，一支腳本跑完（CI 不用 ajv-cli——跨檔規則 ajv-cli 跑不了）：
 *
 *   一、schema 驗證（ajv draft 2020-12 strict＋ajv-formats）
 *       content/ 各檔對 schema/*.schema.json 逐檔驗。
 *
 *   二、跨檔規則（腳本層；編號對應設計書第三章第四節規則表）
 *       #4  courses.json 的 slug／order 不得重複
 *       #5  courseDir 資料夾與 course.json 必須存在；sectionId 必須命中該 course.json
 *           sections[]（sectionId=null 的單班課 sections 恰一筆）；hub.showcaseRefs 必須
 *           指向存在的 showcase item id；showcase courseDir 必須命中 courses.json
 *       #6  kind=lecture-series 的課必須有 talks.json；talks id 恰為 t01–t12 各一筆、
 *           id ↔ no 一致（t05 ⇔ 5）
 *       #7  showcase 檔名（114-2.json）必須等於其 semester 欄位值
 *       #8  credit 非 null → consent 必須 "obtained"（schema 條件式已擋，此處第二道）
 *       #9  consent: "pending" 的作品不得入檔
 *       #10 content 全檔全文禁 "internalNotes" 字串（鍵名或內文皆擋）
 *       #12 pending 物件必須恰為 {status, note} 且 note 非空（faq 條目的 status 屬
 *           enum 切換、依設計書慣例表豁免）
 *       #16 announcements validUntil 不得早於 date
 *       #18 intro.grading 為真值陣列時，pct 總和必須＝100（pending 物件跳過不驗）
 *
 *   警告（印出但不擋建置）：
 *       #15 引用圖檔（/images/…）在 public/ 找不到——bootstrap 期先警告，圖檔管線
 *           （M4）就位後應提升為 fail
 *       #19 confirmed／done 場次 time／venue 仍為 null（設計書明定警告不 fail）
 *       其他：UTF-8 BOM、未涵蓋的 content JSON、未被 courses.json 引用的課程資料夾
 *
 * 用法：node scripts/validate-content.mjs [repo根目錄]
 *       （參數只給測試用；不帶參數＝腳本所在 repo）
 * 退出碼：0＝通過；1＝內容驗證失敗（每條印 [FAIL] 檔案｜規則｜明細）；2＝腳本或 schema 設定錯誤
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020Mod from "ajv/dist/2020.js";
import addFormatsMod from "ajv-formats";

const Ajv2020 = Ajv2020Mod.default ?? Ajv2020Mod;
const addFormats = addFormatsMod.default ?? addFormatsMod;

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(process.argv[2] ?? path.join(SCRIPT_DIR, ".."));
const CONTENT_DIR = path.join(ROOT, "content");
// 正式位置＝repo 根的 schema/；若被搬進 content/schema/（設計書第三章目錄樹的寫法）也吃得到
const SCHEMA_DIR = existsSync(path.join(ROOT, "schema"))
  ? path.join(ROOT, "schema")
  : path.join(CONTENT_DIR, "schema");
const PUBLIC_DIR = path.join(ROOT, "public");
const SCHEMA_ID_BASE = "https://hub.ndhu-ted/schema/";
const MAX_SCHEMA_ERRORS_PER_FILE = 20;

const failures = []; // {file, rule, msg}
const warnings = [];
const rel = (p) => path.relative(ROOT, p).split(path.sep).join("/") || ".";
const fail = (file, rule, msg) => failures.push({ file: rel(file), rule, msg });
const warn = (file, rule, msg) => warnings.push({ file: rel(file), rule, msg });

/* ── schema 載入 ─────────────────────────────────────────────── */

function setupAjv() {
  if (!existsSync(SCHEMA_DIR)) {
    console.error(`[設定錯誤] 找不到 schema 資料夾：${SCHEMA_DIR}`);
    process.exit(2);
  }
  const ajv = new Ajv2020({
    strict: true,
    strictRequired: false, // course.schema.json 為開放超集，required 欄位不逐一宣告 properties
    allowUnionTypes: true,
    allErrors: true,
  });
  addFormats(ajv);
  const schemaFiles = readdirSync(SCHEMA_DIR).filter((f) => f.endsWith(".schema.json")).sort();
  if (schemaFiles.length === 0) {
    console.error(`[設定錯誤] schema/ 內沒有任何 *.schema.json`);
    process.exit(2);
  }
  const validators = new Map();
  try {
    for (const f of schemaFiles) {
      ajv.addSchema(JSON.parse(readFileSync(path.join(SCHEMA_DIR, f), "utf8")));
    }
    for (const f of schemaFiles) {
      if (f === "_defs.schema.json") continue;
      const v = ajv.getSchema(SCHEMA_ID_BASE + f);
      if (!v) throw new Error(`getSchema(${SCHEMA_ID_BASE + f}) 找不到——$id 與檔名要對上`);
      validators.set(f, v);
    }
  } catch (e) {
    console.error(`[設定錯誤] schema 載入／編譯失敗：${e.message}`);
    process.exit(2);
  }
  return validators;
}

const validators = setupAjv();

function validateAgainst(file, data, schemaFile) {
  const v = validators.get(schemaFile);
  if (!v) {
    console.error(`[設定錯誤] 缺 schema：${schemaFile}`);
    process.exit(2);
  }
  if (v(data)) return true;
  const errs = v.errors ?? [];
  for (const e of errs.slice(0, MAX_SCHEMA_ERRORS_PER_FILE)) {
    let extra = "";
    if (e.keyword === "enum") extra = `（允許值：${(e.params?.allowedValues ?? []).join(" / ")}）`;
    else if (e.keyword === "additionalProperties") extra = `（多出欄位：${e.params?.additionalProperty}）`;
    else if (e.keyword === "const") extra = `（應為：${JSON.stringify(e.params?.allowedValue)}）`;
    else if (e.keyword === "pattern") extra = `（pattern：${e.params?.pattern}）`;
    fail(file, `schema ${schemaFile}`, `${e.instancePath || "(root)"} ${e.message}${extra}`);
  }
  if (errs.length > MAX_SCHEMA_ERRORS_PER_FILE) {
    fail(file, `schema ${schemaFile}`, `……同檔另有 ${errs.length - MAX_SCHEMA_ERRORS_PER_FILE} 條 schema 錯誤（略）`);
  }
  return false;
}

/* ── 檔案讀取 ─────────────────────────────────────────────────── */

const allParsed = []; // {file, data} — 供 pending 形狀與圖檔引用掃描
let filesChecked = 0;

function readContentFile(file, { required = true } = {}) {
  if (!existsSync(file)) {
    if (required) fail(file, "檔案存在", "必要檔案不存在");
    return null;
  }
  filesChecked += 1;
  let raw = readFileSync(file, "utf8");
  if (raw.charCodeAt(0) === 0xfeff) {
    warn(file, "編碼", "偵測到 UTF-8 BOM（規範＝UTF-8 無 BOM；PowerShell 寫檔請用 utf8NoBOM）");
    raw = raw.slice(1);
  }
  try {
    const data = JSON.parse(raw);
    allParsed.push({ file, data });
    return data;
  } catch (e) {
    fail(file, "JSON 解析", e.message);
    return null;
  }
}

function* walkJsonFiles(dir) {
  if (!existsSync(dir)) return;
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    // schema 檔不是內容——尤其 course.schema.json 本身就含「internalNotes」禁令字樣，不能拿 #10 掃它
    if (path.resolve(p) === path.resolve(SCHEMA_DIR)) continue;
    if (ent.isDirectory()) yield* walkJsonFiles(p);
    else if (ent.isFile() && ent.name.endsWith(".json")) yield p;
  }
}

/* ── 規則 #10：content 全檔全文禁 internalNotes ───────────────── */

for (const file of walkJsonFiles(CONTENT_DIR)) {
  const raw = readFileSync(file, "utf8");
  if (raw.includes("internalNotes")) {
    const line = raw.slice(0, raw.indexOf("internalNotes")).split("\n").length;
    fail(file, "#10 internalNotes 禁入", `全文出現 "internalNotes"（第 ${line} 行附近）——內部口徑一律不進 Hub content`);
  }
}

/* ── 三份根檔 ─────────────────────────────────────────────────── */

const sitePath = path.join(CONTENT_DIR, "site.json");
const annPath = path.join(CONTENT_DIR, "announcements.json");
const coursesPath = path.join(CONTENT_DIR, "courses.json");

const site = readContentFile(sitePath);
if (site) validateAgainst(sitePath, site, "site.schema.json");

const ann = readContentFile(annPath);
if (ann) {
  validateAgainst(annPath, ann, "announcements.schema.json");
  if (Array.isArray(ann.items)) {
    ann.items.forEach((it, i) => {
      if (it && typeof it.validUntil === "string" && typeof it.date === "string" && it.validUntil < it.date) {
        fail(annPath, "#16 公告效期", `items[${i}]（${it.id ?? "?"}）validUntil ${it.validUntil} 早於 date ${it.date}——一上架就過期`);
      }
    });
  }
}

const coursesIdx = readContentFile(coursesPath);
if (coursesIdx) validateAgainst(coursesPath, coursesIdx, "courses.schema.json");

/* ── courses.json 跨檔規則（#4、#5）＋ course.json 逐檔驗 ─────── */

const courseDirSet = new Set(); // courses.json 宣告的 courseDir
const courseDataByDir = new Map(); // courseDir -> {data, file}

if (coursesIdx && Array.isArray(coursesIdx.courses)) {
  const slugSeen = new Map();
  const orderSeen = new Map();
  coursesIdx.courses.forEach((c, i) => {
    if (!c || typeof c !== "object") return;
    if (c.slug != null) {
      if (slugSeen.has(c.slug)) fail(coursesPath, "#4 slug 唯一", `courses[${i}] slug「${c.slug}」與 courses[${slugSeen.get(c.slug)}] 重複`);
      else slugSeen.set(c.slug, i);
    }
    if (c.order != null) {
      if (orderSeen.has(c.order)) fail(coursesPath, "#4 order 唯一", `courses[${i}] order「${c.order}」與 courses[${orderSeen.get(c.order)}] 重複`);
      else orderSeen.set(c.order, i);
    }
    if (typeof c.courseDir === "string") courseDirSet.add(c.courseDir);
  });

  for (const dir of courseDirSet) {
    const dirPath = path.join(CONTENT_DIR, "courses", dir);
    const cjPath = path.join(dirPath, "course.json");
    if (!existsSync(dirPath)) {
      fail(coursesPath, "#5 courseDir 存在", `courseDir「${dir}」資料夾不存在（應在 content/courses/${dir}/）`);
      continue;
    }
    const data = readContentFile(cjPath); // 缺檔會記「檔案存在」fail
    if (data) {
      validateAgainst(cjPath, data, "course.schema.json");
      courseDataByDir.set(dir, { data, file: cjPath });
    }
  }

  coursesIdx.courses.forEach((c, i) => {
    if (!c || typeof c !== "object") return;
    const entry = courseDataByDir.get(c.courseDir);
    if (!entry) return; // courseDir 缺檔已在上面報過
    const sections = Array.isArray(entry.data.sections) ? entry.data.sections : [];
    const label = `courses[${i}]（slug ${c.slug ?? "?"}）`;
    if (c.sectionId === null) {
      if (sections.length !== 1) {
        fail(coursesPath, "#5 單班 sections 恰一筆", `${label} sectionId=null（單班課），但 ${c.courseDir}/course.json 的 sections 有 ${sections.length} 筆——loader 取 sections[0] 的前提不成立`);
      }
    } else if (typeof c.sectionId === "string") {
      if (!sections.some((s) => s && s.id === c.sectionId)) {
        fail(coursesPath, "#5 sectionId 命中", `${label} sectionId「${c.sectionId}」不在 ${c.courseDir}/course.json 的 sections[]（現有：${sections.map((s) => s?.id).filter(Boolean).join(", ") || "無"}）`);
      }
    }
  });
}

// 未被 courses.json 引用的課程資料夾：照樣驗 schema、另發警告
const coursesRootDir = path.join(CONTENT_DIR, "courses");
if (existsSync(coursesRootDir)) {
  for (const ent of readdirSync(coursesRootDir, { withFileTypes: true })) {
    if (!ent.isDirectory() || courseDirSet.has(ent.name)) continue;
    const cjPath = path.join(coursesRootDir, ent.name, "course.json");
    warn(path.join(coursesRootDir, ent.name), "涵蓋", "此課程資料夾未被 courses.json 引用（不會出現在站上）");
    if (existsSync(cjPath)) {
      const data = readContentFile(cjPath);
      if (data) {
        validateAgainst(cjPath, data, "course.schema.json");
        courseDataByDir.set(ent.name, { data, file: cjPath });
      }
    }
  }
}

/* ── 規則 #18：grading pct 總和＝100（有真值時） ──────────────── */

for (const [, { data, file }] of courseDataByDir) {
  const g = data?.intro?.grading;
  if (!Array.isArray(g)) continue; // pending 物件或未填＝尚無真值，跳過
  let sum = 0;
  let allNumeric = true;
  g.forEach((item, i) => {
    if (!item || typeof item.pct !== "number" || !Number.isFinite(item.pct)) {
      fail(file, "#18 grading pct", `intro.grading[${i}] 缺數值 pct（label：${item?.label ?? "?"}）`);
      allNumeric = false;
    } else {
      sum += item.pct;
    }
  });
  if (allNumeric && g.length > 0 && sum !== 100) {
    fail(file, "#18 grading 總和", `intro.grading[].pct 總和＝${sum}，必須＝100（評分環才畫得滿一圈）`);
  }
}

/* ── talks.json（#5 對位、#6 t01–t12／id↔no、#19 警告） ───────── */

const lectureDirs = new Set(
  (coursesIdx?.courses ?? [])
    .filter((c) => c && c.kind === "lecture-series" && typeof c.courseDir === "string")
    .map((c) => c.courseDir)
);

const talksFiles = [];
if (existsSync(coursesRootDir)) {
  for (const ent of readdirSync(coursesRootDir, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    const tPath = path.join(coursesRootDir, ent.name, "talks.json");
    if (existsSync(tPath)) talksFiles.push({ dir: ent.name, file: tPath });
  }
}
for (const dir of lectureDirs) {
  if (!talksFiles.some((t) => t.dir === dir)) {
    fail(path.join(coursesRootDir, dir, "talks.json"), "#6 talks 必備", `kind=lecture-series 的課「${dir}」缺 talks.json（海報牆＝課程頁主區塊）`);
  }
}

const EXPECTED_TALK_IDS = Array.from({ length: 12 }, (_, i) => `t${String(i + 1).padStart(2, "0")}`);

for (const { dir, file } of talksFiles) {
  const data = readContentFile(file);
  if (!data) continue;
  validateAgainst(file, data, "talks.schema.json");
  if (typeof data.courseDir === "string" && data.courseDir !== dir) {
    fail(file, "#5 courseDir 對位", `talks.json 的 courseDir「${data.courseDir}」≠ 所在資料夾「${dir}」`);
  }
  if (!Array.isArray(data.talks)) continue;

  const idSeen = new Map();
  data.talks.forEach((t, i) => {
    if (!t || typeof t.id !== "string") return;
    if (idSeen.has(t.id)) fail(file, "#6 talk id 唯一", `talks[${i}] id「${t.id}」與 talks[${idSeen.get(t.id)}] 重複`);
    else idSeen.set(t.id, i);
  });
  for (const idWant of EXPECTED_TALK_IDS) {
    if (!idSeen.has(idWant)) fail(file, "#6 t01–t12 全建", `缺場次 id「${idWant}」——talks 必須恰含 t01–t12 各一筆（tba 也要建占位）`);
  }
  for (const id of idSeen.keys()) {
    if (!EXPECTED_TALK_IDS.includes(id)) fail(file, "#6 t01–t12 全建", `出現非法場次 id「${id}」（只允許 t01–t12）`);
  }
  data.talks.forEach((t, i) => {
    if (!t || typeof t !== "object") return;
    if (typeof t.id === "string" && typeof t.no === "number") {
      const n = Number.parseInt(t.id.slice(1), 10);
      if (n !== t.no) fail(file, "#6 id↔no 一致", `talks[${i}] id「${t.id}」應對序號 ${n}，但 no＝${t.no}`);
    }
    if (t.status === "confirmed" || t.status === "done") {
      if (t.time === null) warn(file, "#19 time 待補", `talks[${i}]（${t.id ?? "?"}）status=${t.status} 但 time 仍為 null——聽眾不知幾點（警告不擋）`);
      if (t.venue === null) warn(file, "#19 venue 待補", `talks[${i}]（${t.id ?? "?"}）status=${t.status} 但 venue 仍為 null——聽眾不知在哪（警告不擋）`);
    }
  });
}

/* ── showcase（#7 檔名、#8 consent 閘、#9 pending 禁入、#5 courseDir） ── */

const showcaseDirPath = path.join(CONTENT_DIR, "showcase");
const showcaseIdToWhere = new Map(); // item id -> "檔名 items[i]"
const showcaseFiles = existsSync(showcaseDirPath)
  ? readdirSync(showcaseDirPath).filter((f) => f.endsWith(".json"))
  : [];

if (showcaseFiles.length === 0) {
  fail(showcaseDirPath, "檔案存在", "content/showcase/ 沒有任何學期檔（V1 至少要有 114-2.json 骨架）");
}

for (const f of showcaseFiles) {
  const file = path.join(showcaseDirPath, f);
  const data = readContentFile(file);
  if (!data) continue;
  validateAgainst(file, data, "showcase.schema.json");
  const base = f.replace(/\.json$/, "");
  if (typeof data.semester === "string" && data.semester !== base) {
    fail(file, "#7 檔名↔semester", `檔名「${f}」與 semester「${data.semester}」不一致（檔名＝semester）`);
  }
  if (!Array.isArray(data.items)) continue;
  data.items.forEach((it, i) => {
    if (!it || typeof it !== "object") return;
    const label = `items[${i}]（${it.id ?? "?"}）`;
    if (typeof it.id === "string") {
      if (showcaseIdToWhere.has(it.id)) fail(file, "#5 showcase id 唯一", `${label} id 重複（另見 ${showcaseIdToWhere.get(it.id)}）`);
      else showcaseIdToWhere.set(it.id, `${f} items[${i}]`);
    }
    if (it.consent === "pending") {
      fail(file, "#9 consent=pending 禁入", `${label} consent="pending"——未取得同意的作品不得進 content/（取得同意改 obtained 再入檔）`);
    }
    if (it.credit !== null && it.credit !== undefined && it.consent !== "obtained") {
      fail(file, "#8 consent 閘", `${label} credit 非 null 但 consent=「${it.consent ?? "缺"}」——具名必須 consent="obtained"`);
    }
    if (typeof it.courseDir === "string" && courseDirSet.size > 0 && !courseDirSet.has(it.courseDir)) {
      fail(file, "#5 courseDir 命中", `${label} courseDir「${it.courseDir}」未命中 courses.json（現有：${[...courseDirSet].join(", ")}）`);
    }
  });
}

/* ── hub.showcaseRefs → showcase id（#5） ─────────────────────── */

for (const [, { data, file }] of courseDataByDir) {
  const refs = data?.hub?.showcaseRefs;
  if (!Array.isArray(refs)) continue;
  refs.forEach((r, i) => {
    if (typeof r === "string" && !showcaseIdToWhere.has(r)) {
      fail(file, "#5 showcaseRefs 斷鏈", `hub.showcaseRefs[${i}]「${r}」不存在於 content/showcase/*.json 的 items id`);
    }
  });
}

/* ── 規則 #12：pending 物件形狀（遞迴掃全 content） ───────────── */

function checkPendingShapes(file, node, jsonPath) {
  if (Array.isArray(node)) {
    node.forEach((v, i) => checkPendingShapes(file, v, `${jsonPath}[${i}]`));
    return;
  }
  if (!node || typeof node !== "object") return;
  const status = node.status;
  if (status === "pending" || status === "pending_ted") {
    // faq 條目的 status 屬 enum 切換（confirmed 才渲染），不是 pending 物件——豁免
    const isFaqEntry = Object.hasOwn(node, "q") && Object.hasOwn(node, "a");
    if (!isFaqEntry) {
      if (typeof node.note !== "string" || node.note.trim() === "") {
        fail(file, "#12 pending 缺 note", `${jsonPath || "(root)"} 標了 status="${status}" 但沒有非空 note——要寫「何時補／誰補」`);
      }
      const extra = Object.keys(node).filter((k) => k !== "status" && k !== "note");
      if (extra.length > 0) {
        fail(file, "#12 pending 形狀", `${jsonPath || "(root)"} pending 物件必須恰為 {status, note}，多出欄位：${extra.join(", ")}`);
      }
    }
  }
  for (const [k, v] of Object.entries(node)) {
    checkPendingShapes(file, v, `${jsonPath}/${k}`);
  }
}

/* ── 規則 #15（警告）：引用圖檔存在 ───────────────────────────── */

function checkImageRefs(file, node, jsonPath) {
  if (Array.isArray(node)) {
    node.forEach((v, i) => checkImageRefs(file, v, `${jsonPath}[${i}]`));
    return;
  }
  if (!node || typeof node !== "object") return;
  for (const [k, v] of Object.entries(node)) {
    if (typeof v === "string" && v.startsWith("/images/")) {
      const p = path.join(PUBLIC_DIR, ...v.split("/").filter(Boolean));
      if (!existsSync(p)) {
        warn(file, "#15 圖檔存在", `${jsonPath}/${k}「${v}」在 public/ 找不到對應檔案（圖檔管線就位後此條應轉 fail）`);
      }
    } else {
      checkImageRefs(file, v, `${jsonPath}/${k}`);
    }
  }
}

for (const { file, data } of allParsed) {
  checkPendingShapes(file, data, "");
  checkImageRefs(file, data, "");
}

/* ── 涵蓋檢查：content 下不在驗證清單內的 JSON ────────────────── */

const coveredFiles = new Set(allParsed.map((p) => rel(p.file)));
for (const file of walkJsonFiles(CONTENT_DIR)) {
  if (!coveredFiles.has(rel(file))) {
    warn(file, "涵蓋", "此 JSON 不在驗證清單內、未經 schema 驗證（content/ 只該放設計書第三章定義的檔；build-log.json 拍板前不先建）");
  }
}

/* ── 結果輸出 ─────────────────────────────────────────────────── */

console.log(`validate-content：ROOT＝${ROOT}`);
console.log(`已檢查 ${filesChecked} 個 content 檔、載入 ${validators.size + 1} 份 schema`);

if (warnings.length > 0) {
  console.log(`\n── 警告 ${warnings.length} 條（不擋建置）──`);
  for (const w of warnings) console.log(`[WARN] ${w.file}｜${w.rule}｜${w.msg}`);
}

if (failures.length > 0) {
  console.error(`\n── 驗證失敗 ${failures.length} 條 ──`);
  for (const f of failures) console.error(`[FAIL] ${f.file}｜${f.rule}｜${f.msg}`);
  console.error(`\nvalidate-content 結果：FAIL（${failures.length} 條錯誤、${warnings.length} 條警告）——建置中止`);
  process.exit(1);
}

console.log(`\nvalidate-content 結果：PASS（0 條錯誤、${warnings.length} 條警告）`);
