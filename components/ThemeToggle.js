'use client';
// components/ThemeToggle.js — 亮／暗版面切換鈕（v3 W4-D，設計計畫 §2 D1）
//
// 雙態切換（不是三態循環）：點一下就在「亮」「暗」之間翻面，選擇寫進
// localStorage('theme')，之後每次進站都照使用者那次的選擇走、不再看系統設定。
// 三態（自動／亮／暗）在使用者研究上要多解釋一個「自動」的概念，而 D1 只要求
// 「初始跟系統、手動覆蓋優先」——雙態就達成了，所以照計畫的「擇簡」取雙態。
//
// 為什麼圖示不是 React state 畫的：first paint 的時候 JS 還沒 hydrate，
// 用 state 畫會先閃一個錯的圖示。改成兩個 <svg> 都印出來、由 CSS
// （globals.css §12-6 的 prefers-color-scheme／data-theme 規則）決定誰現身，
// 沒有 JS 也不會顯示錯的圖示。
//
// 無障礙：
//   ・aria-label 用**不隨狀態變**的「切換亮／暗版面」——狀態沒 hydrate 完之前
//     講不準，講不準的標籤比沒標籤更糟。
//   ・aria-pressed 只在 JS 讀到目前是哪一版之後才掛（掛上去就一定是真的）。
//   ・兩個 svg 都是 aria-hidden，讀螢幕的人只會聽到一個按鈕。

import { useEffect, useState } from 'react';

/** 目前實際生效的版本：手動選過就是選的那個，沒選過就看系統 */
function readTheme() {
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr === 'dark' || attr === 'light') return attr;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

export default function ThemeToggle() {
  // null＝JS 還沒接手。伺服器端與第一次 render 都是 null，hydrate 才不會對不上。
  const [theme, setTheme] = useState(null);

  useEffect(() => {
    setTheme(readTheme());
    // 使用者「沒手動選過」時才跟著系統走（跟 CSS 的 :not([data-theme="light"]) 同一套規矩）
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onSystemChange = () => {
      if (!document.documentElement.getAttribute('data-theme')) setTheme(readTheme());
    };
    mq.addEventListener('change', onSystemChange);
    return () => mq.removeEventListener('change', onSystemChange);
  }, []);

  const toggle = () => {
    const next = readTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    // 無痕視窗／擋第三方儲存的瀏覽器會丟例外：記不起來就算了，當次切換照樣有效
    try {
      window.localStorage.setItem('theme', next);
    } catch {
      /* 記不住不影響本次切換 */
    }
    setTheme(next);
  };

  return (
    <button
      type="button"
      className="v3-theme-toggle"
      onClick={toggle}
      aria-label="切換亮／暗版面"
      {...(theme ? { 'aria-pressed': theme === 'dark' } : {})}
    >
      {/* 亮版時顯示月亮＝按下去會變暗版 */}
      <svg className="v3-theme-moon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
      {/* 暗版時顯示太陽＝按下去會變亮版 */}
      <svg className="v3-theme-sun" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}
