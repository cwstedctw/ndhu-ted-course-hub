// components/CourseCard.js — 課程卡（首頁與 /courses/ 卡片牆共用）
// 資料＝courses.json 單筆索引（slug/name/nameEn/sectionLabel/credits/kind/status/tagline/chips）。
// status 三態徽章（必有文字、顏色只是輔助——設計書 §5-1.5 鐵律 3）：
//   open        →「開放選課」（teal-700 on teal-050）
//   conditional →「限量開放，速選」（ink-900 on gold-500＋gold-700 邊框）
//   closed      →「本學期停開」（ink-700 on gray）＋整卡灰化、chips 隱藏——卡片仍可點入課程頁
// kind: "lecture-series" 加「12 場系列演講」角標。
// 整卡單一 <a>（stretched card），accessible name 自然含課名＋班別＋狀態文字。

import Link from 'next/link';

const STATUS_BADGE = {
  open: { className: 'badge badge-open', label: '開放選課' },
  conditional: { className: 'badge badge-cond', label: '限量開放，速選' },
  closed: { className: 'badge badge-closed', label: '本學期停開' },
};

export default function CourseCard({ course }) {
  const { slug, name, nameEn, sectionLabel, credits, kind, status, tagline, chips, timeShort } = course;
  const badge = STATUS_BADGE[status] ?? STATUS_BADGE.open;
  const isClosed = status === 'closed';
  const isLecture = kind === 'lecture-series';
  const cardClass = isClosed ? 'card closed' : 'card';

  return (
    <li>
      <Link className={cardClass} href={`/courses/${slug}/`}>
        {isLecture ? <span className="corner-lect">12 場系列演講</span> : null}
        <span className={badge.className}>{badge.label}</span>
        <h3>
          {name}
          {sectionLabel ? ` ${sectionLabel}` : ''}
          {nameEn ? <span className="en">{nameEn}</span> : null}
        </h3>
        {tagline ? <p className="tagline">{tagline}</p> : null}
        {!isClosed && Array.isArray(chips) && chips.length > 0 ? (
          <ul className="chips">
            {chips.slice(0, 3).map((chip) => (
              <li key={chip}>{chip}</li>
            ))}
          </ul>
        ) : null}
        <span className="meta">
          {/* timeShort＝sections[].time 的節次段（lib getCourseCards）；AA/AB 雙班卡靠它分流 */}
          {[sectionLabel ? `${sectionLabel} 班` : '單班', `${credits} 學分`, timeShort]
            .filter(Boolean)
            .join('・')}
        </span>
      </Link>
    </li>
  );
}
