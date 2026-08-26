// 雙欄文字（工單第 21 項，2026-08-26）：英文班的每個內容欄位＝英文為主、繁中在下方支援。
// 繁中班只輸出繁中一行，DOM 不多包東西（避免 AB 頁被英文班的結構污染）。
//
// 用法：const s = L.t(en, zh);  <Bi s={s} />          → 行內文字
//       <Bi s={s} as="h4" />                          → 換成別的標籤
//       <Bi s={s} subAs="span" />                     → 支援語的標籤（預設 <span>）
// s.sub 為 null（繁中班、或英文缺漏走防呆）時只出 main，不會留空節點。

export default function Bi({ s, as: Tag = 'span', subAs: SubTag = 'span', className, ...rest }) {
  if (!s || s.main == null || s.main === '') return null;
  const cls = ['bi', className].filter(Boolean).join(' ');
  return (
    <Tag className={cls} {...rest}>
      <span className="bi-main">{s.main}</span>
      {s.sub ? <SubTag className="bi-zh" lang="zh-Hant-TW">{s.sub}</SubTag> : null}
    </Tag>
  );
}

/** 只要主語言那一段純文字（用在 alt／aria-label／title 等不能放兩行的地方） */
export function biText(s) {
  return s && s.main != null ? String(s.main) : '';
}
