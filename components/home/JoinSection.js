// components/home/JoinSection.js — 區塊 5「怎麼加入」#join（server component）
//
// 官方連結原則（F2–F5、C2）：本站只給課程資訊＋官方連結——
//   ❌ 不寫選課規則、不寫選課／加退選日期、不教怎麼加簽、不解釋候補機制
//   ✅ 按鈕命名把去處講清楚：「教務系統選課 ↗」
// 連結真值＝site.json 的 enrollUrl；缺網址就整顆不渲染（不留死按鈕）。
// gold 只給「教務系統選課」這一顆；CopyCode 是中性 teal（C9）。

import CopyCode from './CopyCode';

export default function JoinSection({ rows, enrollUrl }) {
  const hasEnroll = typeof enrollUrl === 'string' && enrollUrl.trim() !== '';

  return (
    <section id="join" className="v3-sec v3-join-sec" aria-labelledby="v3-join-title">
      <div className="container">
        <h2 id="v3-join-title">怎麼加入</h2>

        <div className="v3-join">
          <div className="v3-codes">
            <h3 className="v3-codes-title">全部課號</h3>
            <ul className="v3-code-list">
              {rows.map((r) => (
                <li key={r.slug}>
                  <span className="v3-code-name">
                    {r.name}
                    {r.sectionLabel ? <i> {r.sectionLabel} 班</i> : null}
                  </span>
                  <CopyCode code={r.code} what="課號" />
                </li>
              ))}
            </ul>
          </div>

          <div className="v3-join-actions">
            {hasEnroll ? (
              <a
                className="v3-btn v3-btn-gold v3-btn-block"
                href={enrollUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                教務系統選課 ↗<span className="sr-only">（另開新視窗）</span>
              </a>
            ) : null}
                      </div>
        </div>
      </div>
    </section>
  );
}
