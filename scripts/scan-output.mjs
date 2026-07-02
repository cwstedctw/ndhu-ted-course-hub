#!/usr/bin/env node
/**
 * scan-output.mjs — 建置產物滲漏掃描（npm run scan；build 最後一關）
 *
 * 依據：《詳細設計書 v2.0》第三章第四節 #10／#11、第四章 §3.2–3.3。
 * 掃 out/（next build 的 output: 'export' 產物）全部文字檔，命中任一即 exit 1：
 *
 *   1. "internalNotes" 字串——內部口徑不得出現在任何產物（schema 禁入＋validate
 *      掃 content 之外的最後一道防線，防 builder 或搬移腳本漏剝除）。
 *   2. 學號樣式——「連續 8–9 位數字、開頭 4」（前後不接英數字或底線，避免誤中
 *      content hash 等長字串的一段）。命中值遮罩後才印進 log，不讓 CI log 本身外洩。
 *
 * 白名單（明文允許、不掃）：
 *   - AKfycb…（V2 Apps Script /exec 部署 ID）——它是公開成績查詢網址的一部分，
 *     site.json scoreUrl／hub.scoreUrl 的正式值本來就長這樣（2026-07-02 定案）。
 *
 * 用法：node scripts/scan-output.mjs [產物資料夾]
 *       （參數只給測試用；不帶參數＝repo 根目錄的 out/）
 * 退出碼：0＝乾淨；1＝發現滲漏或 out/ 不存在（每條印 [FAIL] 檔案:行號｜規則｜明細）；2＝腳本錯誤
 */

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(path.join(SCRIPT_DIR, ".."));
const OUT_DIR = path.resolve(process.argv[2] ?? path.join(ROOT, "out"));

// 已知二進位副檔名——跳過不掃（用 utf8 硬讀只會得到雜訊）
const BINARY_EXT = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".ico", ".bmp",
  ".woff", ".woff2", ".ttf", ".otf", ".eot",
  ".mp4", ".webm", ".mov", ".mp3", ".wav", ".ogg",
  ".pdf", ".zip", ".gz", ".br", ".wasm", ".bin", ".jar", ".exe",
]);

// 學號樣式：開頭 4、連續共 8–9 位數字；前後不得緊貼英數字或底線
const STUDENT_ID_RE = /(?<![0-9A-Za-z_])4[0-9]{7,8}(?![0-9A-Za-z_])/g;
const INTERNAL_NOTES = "internalNotes";

if (!existsSync(OUT_DIR)) {
  console.error(`[FAIL] ${OUT_DIR}｜out/ 不存在｜請先跑 next build（npm run build 會自動串 validate → build → scan）`);
  process.exit(1);
}
if (!statSync(OUT_DIR).isDirectory()) {
  console.error(`[FAIL] ${OUT_DIR}｜不是資料夾｜掃描目標必須是建置產物資料夾`);
  process.exit(1);
}

function* walk(dir) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) yield* walk(p);
    else if (ent.isFile()) yield p;
  }
}

const relOut = (p) => path.relative(OUT_DIR, p).split(path.sep).join("/");
const mask = (s) => (s.length <= 4 ? "****" : s.slice(0, 2) + "*".repeat(s.length - 4) + s.slice(-2));

const hits = []; // {file, line, rule, msg}
let scannedText = 0;
let skippedBinary = 0;

for (const file of walk(OUT_DIR)) {
  const ext = path.extname(file).toLowerCase();
  if (BINARY_EXT.has(ext)) {
    skippedBinary += 1;
    continue;
  }
  scannedText += 1;
  const text = readFileSync(file, "utf8");

  // 快篩：整檔先測一次，沒中就不必逐行
  STUDENT_ID_RE.lastIndex = 0;
  const hasInternal = text.includes(INTERNAL_NOTES);
  const hasIdPattern = STUDENT_ID_RE.test(text);
  if (!hasInternal && !hasIdPattern) continue;

  const lines = text.split(/\r?\n/);
  lines.forEach((line, idx) => {
    if (hasInternal) {
      const col = line.indexOf(INTERNAL_NOTES);
      if (col !== -1) {
        const n = line.split(INTERNAL_NOTES).length - 1;
        const snippet = line.slice(Math.max(0, col - 20), col + INTERNAL_NOTES.length + 20).trim();
        hits.push({
          file, line: idx + 1, rule: "internalNotes",
          msg: `內部口徑鍵名出現在產物（本行 ${n} 處）：…${snippet}…`,
        });
      }
    }
    if (hasIdPattern) {
      STUDENT_ID_RE.lastIndex = 0;
      let m;
      while ((m = STUDENT_ID_RE.exec(line)) !== null) {
        hits.push({
          file, line: idx + 1, rule: "學號樣式",
          msg: `疑似學號「${mask(m[0])}」（開頭 4、連續 ${m[0].length} 位數字，位於第 ${m.index + 1} 欄）`,
        });
      }
    }
  });
}

console.log(`scan-output：掃描 ${OUT_DIR}`);
console.log(`文字檔 ${scannedText} 個已掃、二進位 ${skippedBinary} 個略過`);
console.log(`白名單：AKfycb…（公開成績查詢網址的 Apps Script 部署 ID）依規允許，不列滲漏`);

if (scannedText === 0) {
  console.error(`[FAIL] ${OUT_DIR}｜產物為空｜out/ 內沒有任何文字檔——next build 可能沒跑成功`);
  process.exit(1);
}

if (hits.length > 0) {
  console.error(`\n── 滲漏 ${hits.length} 處 ──`);
  for (const h of hits) console.error(`[FAIL] out/${relOut(h.file)}:${h.line}｜${h.rule}｜${h.msg}`);
  console.error(`\nscan-output 結果：FAIL（${hits.length} 處）——產物不得出站，修正來源後重跑 npm run build`);
  process.exit(1);
}

console.log(`\nscan-output 結果：PASS（無 internalNotes、無學號樣式）`);
