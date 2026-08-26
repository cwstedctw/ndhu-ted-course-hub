import Bi from './Bi';
import { asArray, hasText } from './pending';

// 區塊 10：上課要帶什麼（設計書二章 §4.3 區塊 10）——純清單，無資料 → 整塊隱藏。
export default function WhatToBring({ items, L, en = {} }) {
  const list = asArray(items).filter(hasText);
  if (list.length === 0) return null;
  const enList = asArray(en?.whatToBring);
  return (
    <section id="bring">
      <div className="container">
        <h2>{L.c('headBring', '上課要帶什麼')}</h2>
        <ul style={{ margin: 0, paddingLeft: 22, fontSize: 15 }}>
          {list.map((it, i) => (
            <li key={it}>
              <Bi s={L.t(enList[i], it)} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
