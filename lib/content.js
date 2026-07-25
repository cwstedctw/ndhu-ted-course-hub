// lib/content.js — content/ JSON 的共用讀取介面（A4 實作，全站頁面一律經此讀資料）
// 裁決（2026-07-02）：fs＋path 同步讀、模組層快取即可——本站純 SSG（output: 'export'），
// 這些函式只在 build 時的 server component／generateStaticParams 裡執行。
// 鐵律：content 檔缺漏或格式錯誤時「大聲失敗」（throw），讓 build 掛掉，
// 不吞錯、不腦補預設值——資料正確性由 scripts/validate-content.mjs 在 build 前把關。

import fs from 'node:fs';
import path from 'node:path';

const CONTENT_DIR = path.join(process.cwd(), 'content');

/** 同 process 內同一檔只讀一次（build 時會被多頁重複呼叫） */
const cache = new Map();

function readJson(...segments) {
  const filePath = path.join(CONTENT_DIR, ...segments);
  if (cache.has(filePath)) return cache.get(filePath);

  const relPath = path.relative(process.cwd(), filePath);
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    throw new Error(`[content] 讀不到 ${relPath}：${err.message}`);
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    throw new Error(`[content] ${relPath} 不是合法 JSON：${err.message}`);
  }

  cache.set(filePath, data);
  return data;
}

/** 全站設定：content/site.json（brand、scoreUrl、about、footerCredits、buildLog…） */
export function getSite() {
  return readJson('site.json');
}

/** 首頁公告：content/announcements.json（{ items: [...] }） */
export function getAnnouncements() {
  return readJson('announcements.json');
}

/** 課程總索引：content/courses.json（8 班卡片牆＋slug→(courseDir, sectionId) 對照） */
export function getCourses() {
  return readJson('courses.json');
}

/**
 * 以路由 slug 取單一「班」的完整資料。
 *
 * 流程（設計書第二章 §4.3「資料組裝」）：
 *   1. courses.json 以 slug 查到 indexEntry（含 courseDir＋sectionId）
 *   2. 載入 content/courses/{courseDir}/course.json
 *   3. sectionId 非 null → 取 sections[] 中 id 相符那筆；
 *      sectionId 為 null（單班課）→ 取 sections[0]
 *
 * @param {string} slug 例：'11501-ai-intro-aa'
 * @returns {{ course: object, section: object, indexEntry: object }}
 */
export function getCourseBySlug(slug) {
  const index = getCourses();
  const list = Array.isArray(index.courses) ? index.courses : [];
  const indexEntry = list.find((c) => c && c.slug === slug);
  if (!indexEntry) {
    throw new Error(`[content] courses.json 找不到 slug「${slug}」`);
  }

  const course = readJson('courses', indexEntry.courseDir, 'course.json');
  const sections = Array.isArray(course.sections) ? course.sections : [];

  let section = null;
  if (indexEntry.sectionId == null) {
    section = sections[0] ?? null;
  } else {
    section = sections.find((s) => s && s.id === indexEntry.sectionId) ?? null;
  }
  if (!section) {
    throw new Error(
      `[content] courses/${indexEntry.courseDir}/course.json 的 sections[] 對不上 ` +
        `sectionId=${JSON.stringify(indexEntry.sectionId)}（slug「${slug}」）`
    );
  }

  return { course, section, indexEntry };
}

/**
 * 卡片牆用：courses.json 索引筆＋該班上課節次短版 timeShort。
 * 真值仍是 course.json 的 sections[].time（單一來源，索引不複製時間欄位）；
 * 這裡只取「・」前的節次段（例「週一 第 8–10 節」），AA/AB 雙班卡靠它一眼分流。
 * time 缺或非字串 → timeShort=null（卡片 meta 自動略過）。
 * v3（2026-07-25）：cat／filters 兩欄本來就在 courses.json 索引筆上，`...entry` 展開
 * 已自動帶出——首頁分類 chip／決策篩選 chips 不用另外查表。
 */
export function getCourseCards() {
  const index = getCourses();
  const list = Array.isArray(index.courses) ? index.courses : [];
  return list.map((entry) => {
    const { section } = getCourseBySlug(entry.slug);
    const time = typeof section?.time === 'string' ? section.time.trim() : '';
    return { ...entry, timeShort: time ? time.split('・')[0].trim() : null };
  });
}

/**
 * 週課表：8 班次的 sections[].schedule 彙整成「星期幾 → 這天有哪些班」的清單。
 * 真值仍是各 course.json 的 sections[].schedule（day 1–7＝ISO 曜日，週一起算）；
 * 這裡只做彙整＋依起始節次排序，不重算節次或鐘點。
 * 缺 schedule（尚未結構化，schema 上是 nullable）的班次直接略過、不擋 build。
 * @returns {{ [day: number]: Array<{
 *   courseId: string, sectionId: string|null, name: string,
 *   periods: [number, number], startTime: string, endTime: string,
 *   room: string, cat: string|null, slug: string
 * }> }} key 為數字曜日（1–7），value 已依 periods[0] 由早到晚排序
 */
export function getWeekGrid() {
  const index = getCourses();
  const list = Array.isArray(index.courses) ? index.courses : [];
  const grid = {};
  for (const entry of list) {
    const { section } = getCourseBySlug(entry.slug);
    const schedule = section?.schedule;
    if (!schedule) continue; // 尚未結構化＝合法狀態，週課表先跳過這班

    const day = schedule.day;
    if (!grid[day]) grid[day] = [];
    grid[day].push({
      courseId: entry.courseDir,
      sectionId: entry.sectionId,
      name: entry.name,
      periods: schedule.periods,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      room: schedule.room,
      cat: entry.cat ?? null,
      slug: entry.slug,
    });
  }
  for (const day of Object.keys(grid)) {
    grid[day].sort((a, b) => a.periods[0] - b.periods[0]);
  }
  return grid;
}

/** 演講課 12 場：content/courses/11501-ai-future/talks.json */
export function getTalks() {
  return readJson('courses', '11501-ai-future', 'talks.json');
}

/**
 * 首頁演講 spotlight 用：12 場裡選「最近一場還沒結束的 confirmed」。
 * F1 拍板（2026-07-25）：演講結束時間＝11:30；判斷時區＝Asia/Taipei（不是伺服器時區——
 * 靜態建置機器常是 UTC，直接用 `new Date()` 比會整場提早 8 小時判定「已結束」）。
 * status=tba／done 都不算候選；候選依 date 由早到晚取第一筆；
 * 全 tba 或所有 confirmed 場次都已過 11:30 結束線 → 回傳 null（spotlight 自行處理空狀態，不腦補假資料）。
 * @param {Date} [now] 測試用可指定「現在時刻」；預設 new Date()
 * @returns {object|null} talks.json 的單筆 talk 物件，或 null
 */
export function getNextTalk(now = new Date()) {
  const { talks } = getTalks();
  const list = Array.isArray(talks) ? talks : [];

  // 把「現在」換算成 Asia/Taipei 的牆鐘字串，再用不帶時區的字串建 Date——
  // 這樣兩邊（now 與 date+11:30）都用同一套「naive 本地時間」解讀，比較結果與伺服器實際時區無關。
  const taipeiWallClock = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(now);
  const nowTaipei = new Date(taipeiWallClock.replace(' ', 'T'));

  const upcoming = list
    .filter((t) => t && t.status === 'confirmed' && typeof t.date === 'string')
    .filter((t) => nowTaipei.getTime() < new Date(`${t.date}T11:30:00`).getTime())
    .sort((a, b) => a.date.localeCompare(b.date));

  return upcoming[0] ?? null;
}

/** 上學期精選作品：content/showcase/114-2.json（V1 只有 114-2 一檔） */
export function getShowcase(semester = '114-2') {
  return readJson('showcase', `${semester}.json`);
}
