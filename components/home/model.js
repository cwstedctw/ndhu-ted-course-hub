// components/home/model.js — 首頁資料模型（server only，W2）
//
// 鐵律（v3 設計計畫 C7）：**事實只吃 content JSON**。這支檔案不寫任何課程事實，
// 只把 lib/content.js 讀回來的資料「重組成首頁要的形狀」——併班、彙整週課表、
// 數出統計數字。任何一句課名、課號、節次、鐘點、教室都來自 content/，
// 這裡出現的中文常數只有「星期幾的國字」與版面用字，不是課程資料。
//
// ⚠️ 只能在 server component 匯入（底層 lib/content.js 用 node:fs 同步讀檔）。

import {
  getCourseCards,
  getCourseBySlug,
  getCourses,
  getWeekGrid,
  getNextTalk,
  getTalks,
} from '@/lib/content';

/** ISO 曜日（1=週一）→ 國字。索引 0 留空，讓 day 直接當索引用 */
const DAY_CN = ['', '一', '二', '三', '四', '五', '六', '日'];

/** 教室短名：取最後一段（「理工二館 E403」→「E403」、「理工二館 ZT講堂 C101」→「C101」）。
 *  只是版面縮寫，完整教室名照樣掛在 title 屬性與課程頁上。 */
function roomShort(room) {
  if (typeof room !== 'string') return null;
  const parts = room.trim().split(/\s+/);
  return parts.length > 0 ? parts[parts.length - 1] : null;
}

/** 節次段字串：periods [8,10] →「8–10 節」；單節 →「8 節」 */
function periodLabel(periods) {
  if (!Array.isArray(periods) || periods.length === 0) return null;
  const [a, b = a] = periods;
  return a === b ? `${a} 節` : `${a}–${b} 節`;
}

/**
 * 課卡時間 chip：「週一 8–10 節・13:10–16:00・E403」
 * 全部欄位由 sections[].schedule 組出（day／periods／startTime／endTime／room），
 * 缺欄位就少印一段，不補假值。
 */
function timeChip(schedule) {
  if (!schedule) return null;
  const bits = [];
  const day = DAY_CN[schedule.day];
  const periods = periodLabel(schedule.periods);
  if (day && periods) bits.push(`週${day} ${periods}`);
  else if (day) bits.push(`週${day}`);
  if (schedule.startTime && schedule.endTime) bits.push(`${schedule.startTime}–${schedule.endTime}`);
  const rs = roomShort(schedule.room);
  if (rs) bits.push(rs);
  return bits.length > 0 ? bits.join('・') : null;
}

/**
 * 6 門課併班：courses.json 的 8 筆索引依 courseDir 收成 6 組，
 * 同一組內的班次（AA／AB）各自帶自己的課號與時間——卡面用 segmented control 切換。
 */
export function buildCourseGroups() {
  const cards = [...getCourseCards()].sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  const byDir = new Map();
  const groups = [];

  for (const entry of cards) {
    const { section } = getCourseBySlug(entry.slug);
    const sec = {
      slug: entry.slug,
      sectionLabel: entry.sectionLabel ?? null,
      code: typeof section?.code === 'string' ? section.code : null,
      room: typeof section?.room === 'string' ? section.room : null,
      timeChip: timeChip(section?.schedule),
    };

    if (!byDir.has(entry.courseDir)) {
      const group = {
        courseDir: entry.courseDir,
        name: entry.name,
        nameEn: entry.nameEn ?? null,
        credits: entry.credits ?? null,
        kind: entry.kind ?? null,
        status: entry.status ?? 'open',
        tagline: entry.tagline ?? null,
        chips: Array.isArray(entry.chips) ? entry.chips.slice(0, 3) : [],
        cat: entry.cat ?? null,
        filters: Array.isArray(entry.filters) ? entry.filters : [],
        sections: [],
      };
      byDir.set(entry.courseDir, group);
      groups.push(group);
    }
    byDir.get(entry.courseDir).sections.push(sec);
  }
  return groups;
}

/** 決策篩選 chips：把各課的 filters 取聯集，維持「第一次出現」的順序（不另訂清單） */
export function buildFilters(groups) {
  const out = [];
  for (const g of groups) {
    for (const f of g.filters) if (!out.includes(f)) out.push(f);
  }
  return out;
}

/**
 * 週課表模型：把 getWeekGrid() 彙整成「節次列 × 有課的星期欄」。
 * 節次的鐘點**由課本身的 startTime／endTime 推得**（第 4 節的開始＝有課從第 4 節開始那班的
 * startTime），沒有任何一班碰到的節次就沒有鐘點——不套「第 N 節＝(N+5):10」公式硬填，
 * 免得站上出現 content 之外的第二份事實。
 */
export function buildWeek() {
  const grid = getWeekGrid();
  const dayNums = Object.keys(grid)
    .map(Number)
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
  const flat = dayNums.flatMap((d) => grid[d].map((it) => ({ ...it, day: d })));
  if (flat.length === 0) return null;

  const minP = Math.min(...flat.map((it) => it.periods[0]));
  const maxP = Math.max(...flat.map((it) => it.periods[1]));

  const startOf = {};
  const endOf = {};
  const occupied = new Set();
  for (const it of flat) {
    if (!startOf[it.periods[0]]) startOf[it.periods[0]] = it.startTime;
    if (!endOf[it.periods[1]]) endOf[it.periods[1]] = it.endTime;
    for (let p = it.periods[0]; p <= it.periods[1]; p += 1) occupied.add(p);
  }

  const rows = [];
  for (let p = minP; p <= maxP; p += 1) {
    const free = !occupied.has(p);
    rows.push({
      period: p,
      start: startOf[p] ?? null,
      end: endOf[p] ?? null,
      free,
      // 午休帶：整週都沒課的那一節，起訖由前一節下課、後一節上課推得（仍是 content 的鐘點）
      gapFrom: free ? endOf[p - 1] ?? null : null,
      gapTo: free ? startOf[p + 1] ?? null : null,
    });
  }

  const toTile = (it) => ({
    slug: it.slug,
    name: it.name,
    sectionLabel: it.sectionId ?? null,
    cat: it.cat ?? null,
    periodLabel: periodLabel(it.periods),
    periods: it.periods,
    startTime: it.startTime,
    endTime: it.endTime,
    room: it.room,
    roomShort: roomShort(it.room),
  });

  const days = dayNums.map((d) => ({
    day: d,
    cn: DAY_CN[d],
    label: `週${DAY_CN[d]}`,
    items: grid[d].map(toTile),
  }));

  return { days, rows, earliest: flat.map((it) => it.startTime).sort()[0] ?? null };
}

/** 首頁 Hero 答案列的三個數字：全部從資料數出來（6 門課、8 班次、最早幾點、週幾到週幾） */
export function buildHeroStats(groups, week) {
  const sectionCount = groups.reduce((n, g) => n + g.sections.length, 0);
  const dayRange =
    week && week.days.length > 0
      ? week.days.length === 1
        ? week.days[0].label
        : `週${week.days[0].cn}到${week.days[week.days.length - 1].cn}`
      : null;
  return {
    courseCount: groups.length,
    sectionCount,
    dayRange,
    earliest: week?.earliest ?? null,
  };
}

/** #join 全課號表：6 課 8 班攤平（課名＋班別＋課號），課號真值＝sections[].code */
export function buildCodeTable(groups) {
  return groups.flatMap((g) =>
    g.sections.map((s) => ({
      slug: s.slug,
      name: g.name,
      sectionLabel: s.sectionLabel,
      credits: g.credits,
      code: s.code,
    }))
  );
}

/**
 * 演講 spotlight：下一場（getNextTalk，F1 以 11:30 為結束線）＋場次統計。
 * 詳情頁網址靠 talks.json 的 courseDir 反查 courses.json 的 slug，不寫死路徑。
 * 沒有下一場（全 tba 或都過了）→ talk 為 null，卡片整張不渲染。
 */
export function buildTalkSpotlight() {
  const data = getTalks();
  const list = Array.isArray(data?.talks) ? data.talks : [];
  const index = getCourses();
  const entry = (Array.isArray(index?.courses) ? index.courses : []).find(
    (c) => c && c.courseDir === data?.courseDir
  );
  return {
    talk: getNextTalk(),
    courseSlug: entry?.slug ?? null,
    total: list.length,
    confirmed: list.filter((t) => t && t.status === 'confirmed').length,
  };
}

/** 首頁一次組好的模型（app/page.js 只呼叫這支） */
export function buildHomeModel() {
  const groups = buildCourseGroups();
  const week = buildWeek();
  return {
    groups,
    filters: buildFilters(groups),
    week,
    heroStats: buildHeroStats(groups, week),
    codeTable: buildCodeTable(groups),
    spotlight: buildTalkSpotlight(),
  };
}
