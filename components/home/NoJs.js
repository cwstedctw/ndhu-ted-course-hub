// components/home/NoJs.js — 關掉 JavaScript 時的首頁後備樣式（server component）
//
// 沿用 SiteHeader 既有的做法：<noscript> 裡塞一段 <style>，沒有 JS 才生效。
// 原則是「靜態 HTML 已經有全部內容，只是互動控制項按不動」——所以：
//   ① 把按不動的控制項藏起來（篩選 chips、班次切換、星期 tab、複製鈕）
//   ② 把被互動收起來的內容全部攤開（AA/AB 兩班並列、四天課表依序展開）
//   ③ 課號改用 CSS user-select:all，點一下就整串選起來（設計計畫 C9 的最後一層降級）
// 首頁的浮動底欄不必處理——它初始就不渲染，沒 JS 等於不存在。

export default function NoJs() {
  return (
    <noscript>
      <style>{`
        .v3-filters, .v3-seg, .v3-day-tabs, .v3-copy-btn { display: none !important; }
        .v3-pane { display: block !important; }
        .v3-pane + .v3-pane { border-top: 1px dashed var(--line); padding-top: 8px; margin-top: 8px; }
        .v3-day-panel { display: block !important; }
        .v3-day-panel + .v3-day-panel { margin-top: 14px; }
        .v3-day-title {
          position: static !important; width: auto !important; height: auto !important;
          margin: 0 0 6px !important; clip-path: none !important; white-space: normal !important;
          font-size: 15px;
        }
        .v3-copy { padding-right: 10px; }
      `}</style>
    </noscript>
  );
}
