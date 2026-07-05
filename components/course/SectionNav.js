// 課程頁錨點導覽（hero 下第一條）：學生帶著單一問題來（成績怎麼算？要用啥工具？），
// 一排膠囊直達各區塊，免捲 4000px。非 sticky、零 JS、純 <a href="#…">。
// items 由 page 層依「該區塊實際會渲染」的條件組好傳入（鏡射各元件 return null 守門，
// 指向 ripple 佔位區塊可以、指向不存在的區塊不行）；不足兩項不值得佔一條，整列不出。
export default function SectionNav({ items }) {
  const list = (items || []).filter(Boolean);
  if (list.length < 2) return null;

  return (
    <nav className="section-nav" aria-label="頁內導覽">
      <div className="container">
        <ul>
          {list.map((it) => (
            <li key={it.href}>
              <a href={it.href}>{it.label}</a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
