// components/Ripple.js — pending 水波占位（全站標準樣式）
// content 欄位為 {"status":"pending","note":"…"} 或 tba 時渲染本元件——
// 顯示占位說明文字（如「開學前公布」「講者確認後公布」），禁止渲染成空白或假資料。
// 水波紋是純 CSS 背景（.ripple），prefers-reduced-motion 時自動改靜態（globals.css）。
//
// 用法：<Ripple note={course.intro.grading.note} />
//       <Ripple>第 5 場｜講者洽談中</Ripple>（children 優先於 note）

export default function Ripple({ note, children, className = '' }) {
  const content = children ?? (note && String(note).trim() ? note : '開學前公布');
  return <div className={className ? `ripple ${className}` : 'ripple'}>{content}</div>;
}
