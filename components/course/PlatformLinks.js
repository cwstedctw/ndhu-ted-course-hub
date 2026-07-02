import { asArray, hasText } from './pending';

// 區塊 7：平台連結（#links，設計書二章 §4.3 區塊 7）
// 名稱與用途吃 hub.links[]（有網址版）；hub.links 空 → 退回 intro.platforms[]（無網址版）。
// url 非 null → 可點按鈕（新分頁）；url null → 只顯示平台名＋用途、絕不做假連結；
// urlStatus pending → 小字「連結開學前補」。
export default function PlatformLinks({ hubLinks, platforms }) {
  let items = asArray(hubLinks)
    .filter((l) => hasText(l?.label))
    .map((l) => ({
      label: l.label,
      use: hasText(l.use) ? l.use : null,
      url: hasText(l.url) ? l.url : null,
      urlStatus: l.urlStatus,
    }));

  if (items.length === 0) {
    items = asArray(platforms)
      .filter((p) => hasText(p?.name))
      .map((p) => ({
        label: p.name,
        use: hasText(p.use) ? p.use : null,
        url: null,
        urlStatus: 'pending',
      }));
  }
  if (items.length === 0) return null;

  return (
    <section id="links">
      <div className="container">
        <h2>上課用哪些平台</h2>
        <div className="platforms">
          {items.map((item) =>
            item.url ? (
              <a
                key={item.label}
                className="plat"
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <b>{item.label}</b>
                <small>{item.use ? `${item.use}・` : ''}另開新視窗</small>
              </a>
            ) : (
              <div key={item.label} className="plat">
                <b>{item.label}</b>
                <small>
                  {item.use || ''}
                  {item.urlStatus === 'pending' ? `${item.use ? '・' : ''}連結開學前補` : ''}
                </small>
              </div>
            )
          )}
        </div>
      </div>
    </section>
  );
}
