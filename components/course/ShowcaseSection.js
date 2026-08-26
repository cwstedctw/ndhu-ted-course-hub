import Ripple from './Ripple';
import Bi, { biText } from './Bi';
import { asArray, hasText, withBase } from './pending';

// 區塊 9：上學期作品（#showcase，設計書二章 §4.3 區塊 9、五章 §4.11）
// hub.showcaseRefs 解析後的 items 傳入；空 → 回傳 null 整區不渲染（首次開課的課沒有「上學期作品」，別掛「選件中」空頭支票——Ted 2026-08-02）。
// 預設匿名（組別＋作品名）；credit 僅 consent="obtained" 渲染（CI 已擋，元件當第二道保險）；
// consent="pending" 的作品一律過濾不渲染（縱深防線）；image 缺 → teal 底紋占位。
// en＝course.json 的 en.showcase，**以 showcase id 為鍵**（作品本體住在 content/showcase/，
// 靠 hub.showcaseRefs 引用；用 id 對才不會因為選件換人就整批錯位）。
// 2026-08-26 陳文盛 拍板：showcase 由英文例外改回承諾範圍內，validate #20 一併 fail-closed。
export default function ShowcaseSection({ items, L, en = {}, note, noteEn }) {
  const safeItems = asArray(items).filter(
    (it) => it && it.consent !== 'pending' && hasText(it.title)
  );

  if (safeItems.length === 0) return null;

  const c = (key, zh) => (L ? L.c(key, zh) : zh);
  const t = (enVal, zh) => (L ? L.t(enVal, zh) : { main: zh, sub: null });

  return (
    <section id="showcase">
      <div className="container">
        <h2>{L ? L.c('headShowcase', '上學期作品') : '上學期作品'}</h2>
        {safeItems.length === 0 ? (
          <Ripple>114-2 精選作品選件中，開學前上架（預設匿名：組別＋作品名）</Ripple>
        ) : (
          <ul className="cards">
            {safeItems.map((it) => {
              const e = (en && en[it.id]) || {};
              const titleS = t(e.title, it.title);
              const altText =
                L && L.isEn
                  ? `${c('showcaseImageAltPrefix', '作品截圖：')}${biText(titleS)}`
                  : `作品截圖：${it.title}`;
              return (
              <li className="card" key={it.id}>
                {hasText(it.image) ? (
                  <img
                    src={withBase(it.image)}
                    alt={altText}
                    loading="lazy"
                    style={{
                      width: '100%',
                      aspectRatio: '16 / 9',
                      objectFit: 'cover',
                      borderRadius: 8,
                      display: 'block',
                    }}
                  />
                ) : (
                  <div
                    aria-hidden="true"
                    style={{
                      width: '100%',
                      aspectRatio: '16 / 9',
                      borderRadius: 8,
                      background: 'var(--teal-tint, #E3F1F0)',
                    }}
                  />
                )}
                <Bi as="h3" s={titleS} />
                {hasText(it.group) ? <Bi className="en" s={t(e.group, it.group)} /> : null}
                {hasText(it.summary) ? (
                  <Bi as="p" style={{ margin: 0, fontSize: 14 }} s={t(e.summary, it.summary)} />
                ) : null}
                {hasText(it.credit) && it.consent === 'obtained' ? (
                  <span className="en">作者：{it.credit}</span>
                ) : null}
                {hasText(it.link) ? (
                  <a href={it.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 14 }}>
                    {c('showcaseViewWork', '看作品（另開新視窗）')}
                  </a>
                ) : null}
              </li>
              );
            })}
          </ul>
        )}
        {/* 免責句（2026-08-26 美崙溪複驗）：上學期選件偏公開 repo／上線網址／
            命令列，跟本課「不要求公開、部署不加分」容易被讀成及格標準。 */}
        {hasText(note) ? <Bi as="p" className="note" s={t(noteEn, note)} /> : null}
      </div>
    </section>
  );
}
