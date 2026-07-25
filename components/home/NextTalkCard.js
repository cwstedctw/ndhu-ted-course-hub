// components/home/NextTalkCard.js — 「下一場演講」焦點卡（server component）
//
// 外層 <aside data-scene="stage">：W1 的場景 token 層自動把 semantic 色重映成暗場
// （globals.css §1d），所以這裡只寫版面、不寫顏色 hex。
// 內容全部吃 talks.json 的單筆 talk（getNextTalk 已用 F1 的 11:30 結束線挑好）：
//   場次號・日期・講者姓名職稱單位・講題（null →「講題公布中」）・連到該場詳情頁。
// ⚠️ 結束時間 11:30 是拍板事實但 content 沒有這個欄位 → 卡面不寫，只印 talks.json 有的 time。
// talk 為 null（全 tba 或都結束了）→ 整卡不渲染（呼叫端負責）。

import Link from 'next/link';

const WEEK_CN = ['日', '一', '二', '三', '四', '五', '六'];

/** ISO 日期 →「9/18（五）」；用 UTC 解析避開建置機時區把日期算成前一天 */
function formatDate(iso) {
  if (typeof iso !== 'string') return null;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const [, y, mo, d] = m;
  const wd = WEEK_CN[new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d))).getUTCDay()];
  return `${Number(mo)}/${Number(d)}（${wd}）`;
}

export default function NextTalkCard({ talk, courseSlug, className = '' }) {
  if (!talk) return null;

  const dateText = formatDate(talk.date);
  const speaker = talk.speaker || {};
  const href = courseSlug && talk.id ? `/courses/${courseSlug}/talks/${talk.id}/` : null;
  const metaBits = [dateText, talk.time, talk.venue].filter(
    (v) => typeof v === 'string' && v.trim() !== ''
  );

  return (
    <aside
      data-scene="stage"
      className={`v3-focus ${className}`.trim()}
      aria-label="下一場演講"
    >
      <p className="v3-focus-kicker">
        下一場演講
        {typeof talk.no === 'number' ? <span className="v3-focus-no">第 {talk.no} 場</span> : null}
      </p>

      <p className="v3-focus-when">
        {dateText ? <time dateTime={talk.date}>{dateText}</time> : null}
        {typeof talk.time === 'string' && talk.time.trim() !== '' ? (
          <span className="v3-focus-clock">{talk.time}</span>
        ) : null}
      </p>

      <h3 className="v3-focus-title">
        {typeof talk.title === 'string' && talk.title.trim() !== '' ? talk.title : '講題公布中'}
      </h3>

      {typeof speaker.name === 'string' && speaker.name.trim() !== '' ? (
        <p className="v3-focus-speaker">
          <strong>{speaker.name}</strong>
          {typeof speaker.title === 'string' && speaker.title.trim() !== '' ? (
            <span className="v3-focus-role">{speaker.title}</span>
          ) : null}
          {typeof speaker.org === 'string' && speaker.org.trim() !== '' ? (
            <span className="v3-focus-org">{speaker.org}</span>
          ) : null}
        </p>
      ) : null}

      {typeof talk.venue === 'string' && talk.venue.trim() !== '' ? (
        <p className="v3-focus-venue">{talk.venue}</p>
      ) : null}

      {href ? (
        <Link className="v3-focus-link" href={href}>
          這場的詳情 →
          <span className="sr-only">
            （{metaBits.join('、')}）
          </span>
        </Link>
      ) : null}
    </aside>
  );
}
