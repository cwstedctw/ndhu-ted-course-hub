#!/usr/bin/env node
/**
 * scripts/build-ics.mjs — 單場演講 .ics 產生器（v3 W4-F，設計計畫 §4.3／F1 拍板）
 *
 * 依據：《Course Hub v3 設計計畫 v1.1》F1（演講結束時間＝11:30、Asia/Taipei）、
 * §4.3「單場 .ics（整學期訂閱降級，見 §5 砍單）」。
 *
 * 規則（F1 拍板）：
 *   - 只有 status === 'confirmed' 且尚未過期（Asia/Taipei 當天 11:30 為界，與
 *     lib/content.js 的 getTalkDisplayStatus／getNextTalk 同一套判斷邏輯）的場次
 *     才會產出 .ics；tba／done／已過期的 confirmed 場次一律「不產檔且刪除舊檔」。
 *   - 檔名固定 public/ics/{talk.id}.ics（talk.id 本身已是 t01…t12 這種零填格式）。
 *   - UID 固定格式 `{id}@ndhu-ted-course-hub`，改期理論上該遞增 SEQUENCE，但本腳本
 *     是每次重跑都從 talks.json 現讀現算、沒有任何跨次執行的持久狀態可比對
 *     「這場內容跟上次是否不同」——做不到就照設計計畫的 fallback：SEQUENCE 固定
 *     寫 0（⚠️限制：目前這樣、之後若要精確遞增，需要另外開一個持久化的雜湊/版本
 *     對照檔，這次先不做，避免無謂加大改動範圍）。
 *
 * 為什麼不 import lib/content.js：那支檔案用 ESM `export` 語法但副檔名是 .js，
 * package.json 沒有宣告 "type":"module"，Next.js 建置時是靠它自己的轉譯器吃這種
 * 語法；用純 `node` 直接跑這支 .mjs 腳本 import 它會踩 CJS/ESM 落差。跟
 * scripts/check-output.mjs、scripts/validate-content.mjs 一樣的處理方式：
 * 直接用 fs 讀 content/ 的 JSON 原始檔，時區判斷邏輯照抄一份小函式，不共用模組。
 *
 * 用法：node scripts/build-ics.mjs [--now=<ISO8601 時間，測試用>]
 *       不帶參數＝用系統目前時間判斷「是否過期」。
 *
 * 尚未接進 npm run build 鏈（見 package.json）——是否要接、接在哪一站（validate 之後／
 * next build 之前或之後皆可，因為輸出只給 [id]/page.js 讀連結網址、頁面本身不依賴
 * .ics 檔案是否存在才能建置）由洄瀾決定。
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(path.join(SCRIPT_DIR, ".."));
const CONTENT_DIR = path.join(ROOT, "content");
const PUBLIC_ICS_DIR = path.join(ROOT, "public", "ics");

/* ── 參數：--now=<ISO8601>（測試用，不帶＝系統現在時間） ─────────────── */

function parseNowArg() {
  const arg = process.argv.slice(2).find((a) => a.startsWith("--now="));
  if (!arg) return new Date();
  const iso = arg.slice("--now=".length);
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    console.error(`[FAIL] --now 參數不是合法時間字串：${iso}`);
    process.exit(2);
  }
  return d;
}

const NOW = parseNowArg();

/* ── 讀 content：courses.json 找出所有 lecture-series 課，逐一讀 talks.json ── */

function readJson(filePath, label) {
  if (!existsSync(filePath)) {
    console.error(`[FAIL] 讀不到 ${label}：${path.relative(ROOT, filePath)}`);
    process.exit(2);
  }
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch (e) {
    console.error(`[FAIL] ${label} 不是合法 JSON：${e.message}`);
    process.exit(2);
  }
}

const site = readJson(path.join(CONTENT_DIR, "site.json"), "site.json");
const coursesIdx = readJson(path.join(CONTENT_DIR, "courses.json"), "courses.json");
const courses = Array.isArray(coursesIdx?.courses) ? coursesIdx.courses : [];
const lectureSeriesCourses = courses.filter((c) => c && c.kind === "lecture-series" && typeof c.courseDir === "string");

if (lectureSeriesCourses.length === 0) {
  console.log("build-ics：courses.json 沒有 kind=\"lecture-series\" 的課，沒有場次要處理，結束。");
  process.exit(0);
}

if (!site.baseUrl) {
  console.error("[FAIL] content/site.json 缺 baseUrl，無法組詳情頁網址（DESCRIPTION／URL 都要用到）");
  process.exit(2);
}

/* ── Asia/Taipei「是否已過期」判斷（與 lib/content.js 的 getTalkDisplayStatus 同一套邏輯）── */
/*
 * F1 拍板：演講結束時間＝11:30。靜態建置機器常是 UTC，不能直接拿 `now` 跟
 * `${date}T11:30:00`（無時區、視為本地時間）比——所以先把 now 換算成 Asia/Taipei
 * 的牆鐘字串，再用同一套「不帶時區的 naive 本地時間」比較，兩邊基準一致。
 */
function taipeiWallClock(now) {
  const s = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Taipei",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  }).format(now);
  return new Date(s.replace(" ", "T"));
}

function isExpired(dateStr, now) {
  if (typeof dateStr !== "string" || dateStr.trim() === "") return true; // 沒日期＝不敢排進行事曆
  const endsAt = new Date(`${dateStr.trim()}T11:30:00`); // F1：11:30 為界
  if (Number.isNaN(endsAt.getTime())) return true; // 日期字串壞掉＝當作過期處理，不冒險排錯的事件
  return taipeiWallClock(now).getTime() >= endsAt.getTime(); // 剛好 11:30 算已結束，跟 getTalkDisplayStatus 一致
}

/* ── ICS TEXT 值跳脫（RFC 5545 §3.3.11）＋ 75 octet 換行摺疊（RFC 5545 §3.1） ── */

function escapeText(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

/** 逐行摺疊：超過 75 bytes（UTF-8）的邏輯行，用 CRLF+單一空白續行；不可切斷多位元組字元中間。 */
function foldLine(line) {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;
  const chunks = [];
  let start = 0;
  let first = true;
  while (start < bytes.length) {
    const cap = first ? 75 : 74; // 續行開頭多一個空白，可用內容上限少 1
    let end = Math.min(start + cap, bytes.length);
    while (end > start && (bytes[end] & 0xc0) === 0x80) end -= 1; // 續行斷點別落在 UTF-8 延續位元組上
    chunks.push(bytes.subarray(start, end).toString("utf8"));
    start = end;
    first = false;
  }
  return chunks.join("\r\n ");
}

function formatUtcStamp(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}

/* ── 組單場 VEVENT ── */

function speakerLine(speaker) {
  if (!speaker) return "";
  return [speaker.name, speaker.title, speaker.org].filter((v) => typeof v === "string" && v.trim()).join("・");
}

function buildSummary(talk) {
  if (typeof talk.title === "string" && talk.title.trim()) return talk.title.trim();
  const name = typeof talk.speaker?.name === "string" && talk.speaker.name.trim() ? talk.speaker.name.trim() : "";
  return name ? `第${talk.no}場演講・${name}` : `第${talk.no}場演講`;
}

function buildDescription(talk, detailUrl) {
  const lines = [];
  const line = speakerLine(talk.speaker);
  if (line) lines.push(`講者：${line}`);
  lines.push(`詳情頁：${detailUrl}`);
  return lines.join("\n");
}

function buildIcsFile(talk, courseSlug) {
  const detailUrl = `${site.baseUrl}/courses/${courseSlug}/talks/${talk.id}/`;
  const datePart = talk.date.trim().replace(/-/g, "");

  const veventLines = [
    "BEGIN:VEVENT",
    `UID:${talk.id}@ndhu-ted-course-hub`,
    `DTSTAMP:${formatUtcStamp(NOW)}`,
    `DTSTART;TZID=Asia/Taipei:${datePart}T093000`,
    `DTEND;TZID=Asia/Taipei:${datePart}T113000`,
    `SUMMARY:${escapeText(buildSummary(talk))}`,
    talk.venue ? `LOCATION:${escapeText(talk.venue)}` : null,
    `DESCRIPTION:${escapeText(buildDescription(talk, detailUrl))}`,
    `URL:${detailUrl}`,
    "STATUS:CONFIRMED",
    // ⚠️ SEQUENCE 固定 0：本腳本每次執行都是從 talks.json 現讀現算，沒有跨次執行的
    // 持久狀態能判斷「這場內容跟上次輸出比有沒有變」，改期時理論上該遞增但目前做不到
    // （見檔頭說明）。之後若要做，需要另開一個持久化的雜湊/版本對照檔。
    "SEQUENCE:0",
    "TRANSP:OPAQUE",
    "END:VEVENT",
  ].filter((l) => l !== null);

  const calLines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//NDHU TED Course Hub//Talk Calendar 1.0//ZH-TW",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VTIMEZONE",
    "TZID:Asia/Taipei",
    "BEGIN:STANDARD",
    "DTSTART:19700101T000000",
    "TZOFFSETFROM:+0800",
    "TZOFFSETTO:+0800",
    "TZNAME:CST",
    "END:STANDARD",
    "END:VTIMEZONE",
    ...veventLines,
    "END:VCALENDAR",
  ];

  return calLines.map(foldLine).join("\r\n") + "\r\n";
}

/* ── 主流程：逐課逐場判斷、寫檔或刪舊檔 ── */

mkdirSync(PUBLIC_ICS_DIR, { recursive: true });

const written = [];
const skipped = []; // {id, reason}
const keepFilenames = new Set();

for (const course of lectureSeriesCourses) {
  const talksPath = path.join(CONTENT_DIR, "courses", course.courseDir, "talks.json");
  if (!existsSync(talksPath)) {
    console.error(`[FAIL] courseDir「${course.courseDir}」kind=lecture-series 但缺 talks.json：${path.relative(ROOT, talksPath)}`);
    process.exit(2);
  }
  const talksData = readJson(talksPath, `${course.courseDir}/talks.json`);
  const talks = Array.isArray(talksData?.talks) ? talksData.talks : [];

  for (const talk of talks) {
    if (!talk || typeof talk.id !== "string") continue;
    const filename = `${talk.id}.ics`;
    const filePath = path.join(PUBLIC_ICS_DIR, filename);

    const eligible = talk.status === "confirmed" && !isExpired(talk.date, NOW);
    if (!eligible) {
      const reason = talk.status !== "confirmed" ? `status=${talk.status}` : "已過 11:30 結束線";
      skipped.push({ id: talk.id, reason });
      if (existsSync(filePath)) {
        unlinkSync(filePath);
        console.log(`[刪除] ${filename}｜${reason}，不再產出，移除舊檔`);
      }
      continue;
    }

    const ics = buildIcsFile(talk, course.slug);
    writeFileSync(filePath, ics, "utf8");
    keepFilenames.add(filename);
    written.push(talk.id);
    console.log(`[寫入] ${filename}｜${buildSummary(talk)}`);
  }
}

// 清掃：public/ics/ 底下任何不在這次「應該存在」名單裡的 .ics 都算孤兒檔（例如場次
// 從 talks.json 整筆被移除），一併清掉，別留著誤導。
for (const entry of readdirSync(PUBLIC_ICS_DIR, { withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith(".ics")) continue;
  if (keepFilenames.has(entry.name)) continue;
  unlinkSync(path.join(PUBLIC_ICS_DIR, entry.name));
  console.log(`[刪除] ${entry.name}｜talks.json 已無對應場次（孤兒檔）`);
}

console.log(
  `\nbuild-ics 完成：寫入 ${written.length} 個 .ics（${written.join(", ") || "無"}）、` +
    `略過 ${skipped.length} 場（${skipped.map((s) => `${s.id}:${s.reason}`).join("、") || "無"}）`
);
