// lib/i18n.js — 班別語言 profile（工單第 21–22 項，2026-08-26）
//
// 為什麼有這一層：115-1《人工智慧概論》AA 是 EMI、AB 是繁中授課，兩班吃同一份
// course.json。v4 課程計畫第三節把兩班語言寫成不同的「profile」，不是同一份內容翻兩次：
//
//   AA＝en-primary-zh-support：所有任務、評分、期限、安全警語、救援與備援都有**完整英文**，
//        繁中在旁邊提供理解支援（雙欄並列，**不是 en-only**）。
//   AB＝zh-primary-en-terms：繁中可獨立完成任務，技術名詞第一次出現附英文。
//
// 三條鐵律：
//   1. **fail-closed**：英文字串缺一條，`npm run validate` 就 FAIL、build 一起掛。
//      這裡的中文 fallback 是 runtime 最後一道防線（防呆），不是「可以少寫英文」的許可。
//      驗證邏輯在 scripts/validate-content.mjs 的規則 #20，缺字清單會逐條印出來。
//   2. **範圍到課程殼加上學期作品**：landing、17 週大綱、評量、FAQ、安全守則、
//      求助、導覽 chrome，以及 showcase 上學期作品（2026-08-26 陳文盛 拍板納回）。
//      目前只剩**每週教材包**不在本輪承諾範圍內。
//   3. **共用 chrome 只做課程頁自己的導覽／按鈕／狀態**（site.json 的 i18n.en），
//      全站 i18n（首頁、演講課、about、site header／footer）另開一輪，不在這裡長。

/** 語言 profile 的合法值——schema 與 validate 用同一組常數，別各寫一份 */
export const LANG_PRIMARY = ['en', 'zh-Hant-TW'];
export const LANG_MODES = ['en-primary-zh-support', 'zh-primary-en-terms'];

/**
 * 依該班的 langProfile 組出頁面用的語言工具箱。
 *
 * @param {object} section  course.json sections[] 中的那一筆（帶 langProfile）
 * @param {object} site     content/site.json（帶 i18n.en 共用 chrome 字典）
 * @returns {{profile: object|null, primary: string, isEn: boolean,
 *            c: (key: string, zh: string) => string,
 *            t: (en: any, zh: any) => {main: any, sub: any}}}
 */
export function makeL(section, site) {
  const profile = section?.langProfile ?? null;
  const primary = profile?.primary === 'en' ? 'en' : 'zh-Hant-TW';
  const isEn = primary === 'en';
  const dict = (site?.i18n && site.i18n.en) || {};

  return {
    profile,
    primary,
    isEn,

    /** chrome 字串（區塊標題、按鈕、狀態字）：英文班查字典，查不到才退回中文 */
    c(key, zh) {
      if (!isEn) return zh;
      const v = dict[key];
      return typeof v === 'string' && v.trim() ? v : zh;
    },

    /**
     * 內容字串：回 {main, sub}。
     * 英文班 → main＝英文、sub＝繁中支援（雙欄）；繁中班 → main＝繁中、sub＝null。
     * 英文缺漏時 main 退回繁中且不重複輸出 sub（防呆；正常情況 validate 早就擋下了）。
     */
    t(en, zh) {
      if (!isEn) return { main: zh, sub: null };
      const hasEn = typeof en === 'string' ? en.trim().length > 0 : en != null;
      return hasEn ? { main: en, sub: zh ?? null } : { main: zh, sub: null };
    },
  };
}

/** 取 course.json 的英文鏡像子樹（en.intro…）；沒有就回空物件，讓 t() 走防呆分支 */
export function enTree(course) {
  return (course && typeof course.en === 'object' && course.en) || {};
}

/** 陣列取第 i 筆的英文鏡像（長度由 validate #20 保證對齊，這裡只做邊界防呆） */
export function enAt(list, i) {
  return Array.isArray(list) && i < list.length ? list[i] : undefined;
}
