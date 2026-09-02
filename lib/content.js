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
 * 卡片牆用：courses.json 索引筆＋該班上課節次短版 timeShort ＋授課語言短版 langShort。
 * 真值仍是 course.json 的 sections[]（單一來源，索引不複製時間與語言欄位）；
 * timeShort 只取「・」前的節次段（例「週一 第 8–10 節」），AA/AB 雙班卡靠它一眼分流。
 * time 缺或非字串 → timeShort=null（卡片 meta 自動略過）。
 *
 * langShort（2026-09-02 新增）：由 sections[].langProfile.mode 衍生。
 * 起因＝memory/course-conventions.md 明文要求「AA 卡標『全英語 EMI』、AB 標中文」，
 * 而兩張卡當時逐字相同、全站掃 EMI 零命中——外籍生從公開入口看不出 AA 是全英語班。
 * 同一節規則上方還警告「AA/AB 不可當『同內容挑一班』呈現，選課關鍵在語言」。
 * mode 沒對到已知值 → langShort=null（單班課本來就沒有 langProfile，卡片自動略過）。
 */
const LANG_SHORT = {
  'en-primary-zh-support': '全英語 EMI',
  'zh-primary-en-terms': '中文授課',
};

export function getCourseCards() {
  const index = getCourses();
  const list = Array.isArray(index.courses) ? index.courses : [];
  return list.map((entry) => {
    const { section } = getCourseBySlug(entry.slug);
    const time = typeof section?.time === 'string' ? section.time.trim() : '';
    const mode = section?.langProfile?.mode;
    return {
      ...entry,
      timeShort: time ? time.split('・')[0].trim() : null,
      langShort: (typeof mode === 'string' && LANG_SHORT[mode]) || null,
    };
  });
}

/** 演講課 12 場：content/courses/11501-ai-future/talks.json */
export function getTalks() {
  return readJson('courses', '11501-ai-future', 'talks.json');
}

/** 上學期精選作品：content/showcase/114-2.json（V1 只有 114-2 一檔） */
export function getShowcase(semester = '114-2') {
  return readJson('showcase', `${semester}.json`);
}

/**
 * 課程總海報點擊地圖：public/images/courses/11501-ai-future-poster-map.json
 * 由 talk-course-manager/scripts/make_course_poster.py 與海報「同一次渲染」產出——
 * 12 格照片牆的百分比座標，課程頁拿來在海報上鋪「點講者照片進場次頁」的透明連結。
 * 別手改這個檔：海報重出時地圖會一併重出。
 *
 * 與 readJson 的鐵律差一點：檔案「不存在」回 null（課程頁自動退回 12 張海報牆，
 * 下學期海報還沒出時就是這個狀態）；存在但格式壞仍大聲失敗，讓 build 掛掉。
 */
export function getPosterMap() {
  const filePath = path.join(
    process.cwd(), 'public', 'images', 'courses', '11501-ai-future-poster-map.json'
  );
  if (cache.has(filePath)) return cache.get(filePath);

  if (!fs.existsSync(filePath)) {
    cache.set(filePath, null);
    return null;
  }

  const relPath = path.relative(process.cwd(), filePath);
  let data;
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    throw new Error(`[content] ${relPath} 不是合法 JSON：${err.message}`);
  }
  const cells = Array.isArray(data?.cells) ? data.cells : [];
  const ok = (n) => typeof n === 'number' && Number.isFinite(n);
  if (
    cells.length === 0 ||
    cells.some((c) => !c || typeof c.id !== 'string' || ![c.x, c.y, c.w, c.h].every(ok))
  ) {
    throw new Error(`[content] ${relPath} 的 cells 格式不對——請用 make_course_poster.py 重出，別手改`);
  }

  cache.set(filePath, data);
  return data;
}
