// components/course/Fold.js — 課程頁折疊區塊（2026-08-02 課程頁重整 R1）
// 原生 <details>：零 JS、LINE 內建瀏覽器可用；重要決策資訊不放折疊（放 CourseHero 決策卡）。
// id 掛外層 section（details 收合時錨點仍捲得到 summary）；emi 班的 title 由呼叫端帶雙語字串。
// 樣式：app/v3-extra.css「課程頁重整 R1」段。
export default function Fold({ id, title, children }) {
  return (
    <section id={id} className="v3-foldsec">
      <div className="container">
        <details className="v3-fold">
          <summary>
            <h2>{title}</h2>
          </summary>
          <div className="v3-fold-body">{children}</div>
        </details>
      </div>
    </section>
  );
}
