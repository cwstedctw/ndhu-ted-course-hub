import Ripple from './Ripple';
import { asArray, hasText, withBase } from './pending';

// 區塊 9：上學期作品（#showcase，設計書二章 §4.3 區塊 9、五章 §4.11）
// hub.showcaseRefs 解析後的 items 傳入；空 → 水波占位。
// 預設匿名（組別＋作品名）；credit 僅 consent="obtained" 渲染（CI 已擋，元件當第二道保險）；
// consent="pending" 的作品一律過濾不渲染（縱深防線）；image 缺 → teal 底紋占位。
export default function ShowcaseSection({ items }) {
  const safeItems = asArray(items).filter(
    (it) => it && it.consent !== 'pending' && hasText(it.title)
  );

  return (
    <section id="showcase">
      <div className="container">
        <h2>上學期作品</h2>
        {safeItems.length === 0 ? (
          <Ripple>114-2 精選作品選件中，開學前上架（預設匿名：組別＋作品名）</Ripple>
        ) : (
          <ul className="cards">
            {safeItems.map((it) => (
              <li className="card" key={it.id}>
                {hasText(it.image) ? (
                  <img
                    src={withBase(it.image)}
                    alt={`作品截圖：${it.title}`}
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
                <h3>{it.title}</h3>
                {hasText(it.group) ? <span className="en">{it.group}</span> : null}
                {hasText(it.summary) ? <p style={{ margin: 0, fontSize: 14 }}>{it.summary}</p> : null}
                {hasText(it.credit) && it.consent === 'obtained' ? (
                  <span className="en">作者：{it.credit}</span>
                ) : null}
                {hasText(it.link) ? (
                  <a href={it.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 14 }}>
                    看作品（另開新視窗）
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
