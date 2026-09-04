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
 *       #20 班別語言 profile（2026-08-26）：sections[].langProfile 必填欄位齊備、
 *           一門課不得半套；**primary=en 的班，英文課程殼與共用 chrome 字典缺一條
 *           就 FAIL（fail-closed），不准 runtime 默默回落中文**。缺字清單逐條列印。
 *           範圍含 showcase 上學期作品（2026-08-26 陳文盛 拍板由例外改回範圍內）。
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
const showcaseItemById = new Map(); // item id -> item（規則 #20 要拿它比中英文欄位）
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
      showcaseItemById.set(it.id, it);
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

/* ── 規則 #20：班別語言 profile 與英文字串完整性（fail-closed） ──
 *
 * 2026-08-26 加（工單第 21 項）。115-1《人工智慧概論》AA 是 EMI、AB 是繁中授課，
 * 兩班吃同一份 course.json，語言差異靠 sections[].langProfile 宣告：
 *   AA＝en-primary-zh-support（英文完整＋繁中並列支援，不是 en-only）
 *   AB＝zh-primary-en-terms（繁中可獨立完成，技術名詞附英文）
 *
 * 這條規則的重點是 **fail-closed**：宣告了 primary=en，course.json 的 en 子樹與
 * site.json 的 i18n.en chrome 字典就得備齊；**缺一條就 FAIL、build 一起掛**，
 * 不准靠 runtime 默默回落中文。元件裡的中文 fallback 只是最後一道防呆，
 * 不是「可以少寫英文」的許可——正常情況下它永遠不會被觸發。
 *
 * 缺字清單逐條印在 [FAIL] 行，直接就是「還要補哪幾句英文」的工單。
 */

// 課程頁自己的導覽／按鈕／狀態字（工單第 22 項刻意縮範圍：不做全站 i18n）
const CHROME_KEYS_REQUIRED = [
  "navIntro", "navGrading", "navWeeks", "navAiRules", "navTools", "navScore",
  "navShowcase", "navBring", "navFaq", "navTalks", "navTalkWall", "navCoursePoster", "navAria",
  "headIntro", "headGrading", "headWeeks", "headWeeksParts", "headAiRules", "headTools",
  "headPlatforms", "headScore", "headShowcase", "headBring", "headFaq",
  "showcaseViewWork", "showcaseImageAltPrefix",
  "cardDailyTools", "cardHomework",
  "badgeOpen", "badgeConditional", "badgeClosed", "badgeLecture",
  "factSection", "factCode", "factSystemId", "factCredits", "factClosedPrefix",
  "factTimePending", "factTbaTimeRoom",
  "linkMap", "linkEnrol", "linkDeck", "linkDeckEn", "linkSibling",
  "scoreButton", "scoreNote", "platformNewWindow", "platformPending",
  "faqPending", "faqExamplePending", "gradingPending", "weeksPending", "aiRulesExamplesPending",
  "qrTitle", "qrSub", "qrAlt",
];

const isFilled = (v) => typeof v === "string" && v.trim().length > 0;
const asRefs = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string") : []);
const getPath = (obj, dotted) =>
  dotted.split(".").reduce((acc, k) => (acc == null ? undefined : acc[k]), obj);

/**
 * 英文鏡像的必填清單。**由中文本體驅動**——中文有這一欄、英文就得有對應那一欄，
 * 這樣以後中文加內容時英文不會靜靜漏掉（清單寫死才會漂移）。
 *   scalar   單一字串
 *   strList  字串陣列（長度須相同、每筆非空）
 *   objList  物件陣列（長度須相同、每筆的 keys 都要非空）；zhKeys 只用來判斷「中文有值才要求」
 *   deepList 巢狀物件陣列（toolGroups → items）
 */
const EN_MIRROR_SPEC = [
  { kind: "scalar", zh: "courseType", en: "courseType" },
  { kind: "scalar", zh: "weeksSystem", en: "weeksSystem" },
  { kind: "scalar", zh: "instructor.promise", en: "instructorPromise" },

  { kind: "scalar", zh: "intro.promise", en: "intro.promise" },
  { kind: "scalar", zh: "intro.phasesNote", en: "intro.phasesNote" },
  { kind: "scalar", zh: "intro.weeklyPlanNote", en: "intro.weeklyPlanNote" },
  { kind: "scalar", zh: "intro.gradingNote", en: "intro.gradingNote" },
  { kind: "scalar", zh: "intro.toolGroupsNote", en: "intro.toolGroupsNote" },
  { kind: "scalar", zh: "intro.showcaseNote", en: "intro.showcaseNote" },
  { kind: "scalar", zh: "intro.destination.title", en: "intro.destination.title" },
  { kind: "scalar", zh: "intro.destination.sub", en: "intro.destination.sub" },
  // 日常工具卡底下的邀請連結：課程網站渲染的是 web* 這兩句（label／qrAlt 是投影片在用的，
  // 網頁上不出現，所以不列進來強制翻譯）。中文有、英文缺＝EMI 班的頁面會漏字。
  { kind: "scalar", zh: "intro.dailyToolsLink.webLabel", en: "intro.dailyToolsLink.webLabel" },
  { kind: "scalar", zh: "intro.dailyToolsLink.webNote", en: "intro.dailyToolsLink.webNote" },

  { kind: "strList", zh: "intro.chips", en: "intro.chips" },
  { kind: "strList", zh: "intro.whatToBring", en: "intro.whatToBring" },
  { kind: "strList", zh: "intro.aiPolicyExamples.structure", en: "intro.aiPolicyStructure" },

  { kind: "objList", zh: "intro.destination.steps", en: "intro.destination.steps", keys: ["label", "sub"] },
  { kind: "objList", zh: "intro.phases", en: "intro.phases", keys: ["title", "body", "weeks"] },
  // 週次表：中文是 {w,label} 物件、英文是純字串陣列（w 是數字、不必翻）
  { kind: "objList", zh: "intro.weeklyPlan", en: "intro.weeklyPlan", keys: [] },
  { kind: "objList", zh: "intro.grading", en: "intro.grading", keys: ["label", "sub"] },
  { kind: "objList", zh: "intro.dailyTools", en: "intro.dailyTools", keys: ["name", "sub"] },
  { kind: "objList", zh: "intro.platforms", en: "intro.platforms", keys: ["use", "name"] },
  { kind: "objList", zh: "intro.aiRules", en: "intro.aiRules", keys: ["title", "body"] },
  { kind: "objList", zh: "intro.faq", en: "intro.faq", keys: ["q", "a"] },
  { kind: "objList", zh: "hub.links", en: "hub.links", keys: ["use"] },

  { kind: "deepList", zh: "intro.toolGroups", en: "intro.toolGroups", keys: ["group"],
    child: { list: "items", keys: ["name", "sub"] } },
];

function collectMissingEn(course) {
  const missing = [];
  const en = course?.en ?? {};

  for (const rule of EN_MIRROR_SPEC) {
    const zhVal = getPath(course, rule.zh);
    const enVal = getPath(en, rule.en);

    if (rule.kind === "scalar") {
      if (!isFilled(zhVal)) continue; // 中文本來就沒這欄 → 不強迫英文有
      if (!isFilled(enVal)) missing.push(`en.${rule.en}（對應 ${rule.zh}）`);
      continue;
    }

    if (!Array.isArray(zhVal) || zhVal.length === 0) continue;

    if (!Array.isArray(enVal)) {
      missing.push(`en.${rule.en}（整段缺；${rule.zh} 有 ${zhVal.length} 筆）`);
      continue;
    }
    if (enVal.length !== zhVal.length) {
      missing.push(
        `en.${rule.en} 有 ${enVal.length} 筆、${rule.zh} 有 ${zhVal.length} 筆——` +
          `索引對不齊，頁面會配錯行`
      );
      continue;
    }

    zhVal.forEach((zhItem, i) => {
      const enItem = enVal[i];
      if (rule.kind === "strList" || (rule.kind === "objList" && rule.keys.length === 0)) {
        if (!isFilled(enItem)) missing.push(`en.${rule.en}[${i}]`);
        return;
      }
      if (!enItem || typeof enItem !== "object") {
        missing.push(`en.${rule.en}[${i}]（整筆缺）`);
        return;
      }
      for (const k of rule.keys) {
        // 中文那一欄有值才要求英文（例如 grading[].sub 可能為 null）
        if (isFilled(zhItem?.[k]) && !isFilled(enItem[k])) missing.push(`en.${rule.en}[${i}].${k}`);
      }
      if (rule.kind === "deepList" && rule.child) {
        const zhKids = Array.isArray(zhItem?.[rule.child.list]) ? zhItem[rule.child.list] : [];
        const enKids = Array.isArray(enItem[rule.child.list]) ? enItem[rule.child.list] : null;
        if (zhKids.length === 0) return;
        if (!enKids || enKids.length !== zhKids.length) {
          missing.push(
            `en.${rule.en}[${i}].${rule.child.list} 應有 ${zhKids.length} 筆、實際 ` +
              `${enKids ? enKids.length : "缺整段"}`
          );
          return;
        }
        zhKids.forEach((zhKid, j) => {
          for (const k of rule.child.keys) {
            if (isFilled(zhKid?.[k]) && !isFilled(enKids[j]?.[k])) {
              missing.push(`en.${rule.en}[${i}].${rule.child.list}[${j}].${k}`);
            }
          }
        });
      }
    });
  }
  return missing;
}

{
  let anyEnPrimary = false;

  for (const [dir, { data, file }] of courseDataByDir) {
    const sections = Array.isArray(data?.sections) ? data.sections : [];
    const withProfile = sections.filter((s) => s && s.langProfile);
    if (withProfile.length === 0) continue; // 這門課還沒導入語言 profile——不強迫

    // 一門課要嘛全班都宣告、要嘛都不宣告；半套最危險（漏掉的那班語言由誰決定？）
    if (withProfile.length !== sections.length) {
      const missingIds = sections.filter((s) => s && !s.langProfile).map((s) => s.id ?? "?");
      fail(
        file,
        "#20 profile 全班齊備",
        `sections[] 有 ${withProfile.length}/${sections.length} 筆宣告 langProfile，` +
          `缺：${missingIds.join(", ")}——同一門課不得半套（漏的那班語言無人決定）`
      );
    }

    for (const s of withProfile) {
      const p = s.langProfile;
      // schema 已擋型別；這裡是第二道，兼顧「schema 被改鬆」的情況
      for (const k of ["primary", "support", "mode"]) {
        if (p[k] == null) fail(file, "#20 profile 必填欄位", `sections[${s.id ?? "?"}].langProfile 缺 ${k}`);
      }
      if (p.primary !== "en") continue;

      anyEnPrimary = true;

      // ① 該班自己的欄位（時間、教室、行事曆註記）
      //    順便連兵弟班一起要：英文頁的 hero 會插一行「另一班（上課時間）」，
      //    兄弟班沒英文時間就會在英文頁面中間跳出一行中文。
      for (const other of sections) {
        if (!other || other.id === s.id) continue;
        const enOther = getPath(data, `en.sections.${other.id}`);
        if (isFilled(other.time) && !isFilled(enOther?.time)) {
          fail(
            file,
            "#20 缺英文字串",
            `en.sections.${other.id}.time——${s.id} 是英文班，它的 hero 會顯示兄弟班 ` +
              `${other.id} 的上課時間，那一行不能只有中文`
          );
        }
      }
      const enSec = getPath(data, `en.sections.${s.id}`);
      if (!enSec || typeof enSec !== "object") {
        fail(file, "#20 缺英文字串", `en.sections.${s.id} 整段缺——primary=en 的班必須有英文時間與教室`);
      } else {
        for (const k of ["time", "room"]) {
          if (isFilled(s[k]) && !isFilled(enSec[k])) {
            fail(file, "#20 缺英文字串", `en.sections.${s.id}.${k}（對應 sections[].${k}）`);
          }
        }
        if (isFilled(s.scheduleNote) && !isFilled(enSec.scheduleNote)) {
          fail(file, "#20 缺英文字串", `en.sections.${s.id}.scheduleNote——行事曆註記是評量時序的一部分，不得只有中文`);
        }
      }

      // ② 上學期作品（hub.showcaseRefs 指到的那幾件）
      //    英文以 **showcase id 為鍵**，不是索引——選件換人時才不會整批錯位。
      const enShowcase = getPath(data, "en.showcase") || {};
      for (const ref of asRefs(data?.hub?.showcaseRefs)) {
        const item = showcaseItemById.get(ref);
        if (!item) continue; // 斷鏈已由 #5 報過，這裡不重複喳
        const enItem = enShowcase[ref];
        if (!enItem || typeof enItem !== "object") {
          fail(file, "#20 缺英文字串（fail-closed）", `en.showcase["${ref}"] 整筆缺——${s.id} 是英文班，上學期作品也在承諾範圍內`);
          continue;
        }
        for (const k of ["title", "summary", "group"]) {
          if (isFilled(item[k]) && !isFilled(enItem[k])) {
            fail(file, "#20 缺英文字串（fail-closed）", `en.showcase["${ref}"].${k}（對應 showcase 作品的 ${k}）`);
          }
        }
      }

      // ③ 課程殼英文鏡像
      const missing = collectMissingEn(data);
      if (missing.length > 0) {
        fail(
          file,
          "#20 缺英文字串（fail-closed）",
          `班別 ${s.id} 宣告 primary=en，但英文課程殼缺 ${missing.length} 條，build 中止。` +
            `缺字清單：\n         - ${missing.join("\n         - ")}`
        );
      }
    }
  }

  // ③ 共用 chrome 字典（只要站上有任一 en 班就必須齊備）
  if (anyEnPrimary) {
    const dict = site?.i18n?.en;
    if (!dict || typeof dict !== "object") {
      fail(sitePath, "#20 缺英文字串", "site.json 缺 i18n.en——有 primary=en 的班就必須備齊課程頁共用 chrome 字典");
    } else {
      const missingKeys = CHROME_KEYS_REQUIRED.filter((k) => !isFilled(dict[k]));
      if (missingKeys.length > 0) {
        fail(
          sitePath,
          "#20 缺英文字串（fail-closed）",
          `i18n.en 缺 ${missingKeys.length} 個 chrome 鍵，build 中止。缺字清單：\n         - ${missingKeys.join("\n         - ")}`
        );
      }
      const unknown = Object.keys(dict).filter((k) => !CHROME_KEYS_REQUIRED.includes(k));
      if (unknown.length > 0) {
        warn(sitePath, "#20 chrome 多餘鍵", `i18n.en 有清單外的鍵（沒人用到就該刪，免得誤以為有翻）：${unknown.join(", ")}`);
      }
    }
  }
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
