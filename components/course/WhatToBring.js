import { asArray, hasText } from './pending';

// 區塊 10：上課要帶什麼——純清單，無資料 → 整塊隱藏。
// bare＝放進 Fold 折疊內、不出自己的 section/h2（2026-08-02 課程頁重整 R1）。
// enItems（emi 外籍生班）＝與 items 逐條對齊的英文行，EN 在前 zh 在後（R5；正本＝英文版教學計畫）。
export default function WhatToBring({ items, enItems = null, bare = false }) {
  const enList = asArray(enItems);
  // 先按原始索引配對、再過濾——zh 有空項時 EN 行才不會整批錯位
  const pairs = asArray(items)
    .map((it, i) => ({ zh: it, en: hasText(enList[i]) ? enList[i] : null }))
    .filter((p) => hasText(p.zh));
  if (pairs.length === 0) return null;
  const body = (
    <ul style={{ margin: 0, paddingLeft: 22, fontSize: 15 }}>
      {pairs.map((p) => (
        <li key={p.zh}>
          {p.en ? (
            <>
              <span className="en" lang="en">{p.en}</span>
              <br />
            </>
          ) : null}
          {p.zh}
        </li>
      ))}
    </ul>
  );
  if (bare) return body;
  return (
    <section id="bring">
      <div className="container">
        <h2>上課要帶什麼</h2>
        {body}
      </div>
    </section>
  );
}
