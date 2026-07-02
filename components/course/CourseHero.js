import Link from 'next/link';
import { hasText, isPending, withBase } from './pending';

// 區塊 1：課程頁 Hero（設計書二章 §4.3 區塊 1、§4.4 演講課變體）
// 課名／英文名／狀態徽章／該班事實列（選課代碼・學分・週制・時間地點）／教師一句話。
// closed → 選課代碼區灰化＋標「本學期停開」（全案統一措辭）；timeNote pending → 時間旁小字。

const STATUS_BADGE = {
  open: { className: 'badge badge-open', label: '開放選課' },
  conditional: { className: 'badge badge-cond', label: '限量開放，速選' },
  closed: { className: 'badge badge-gray', label: '本學期停開' },
};

export default function CourseHero({ course, section, indexEntry, sibling }) {
  const status = indexEntry?.status || 'open';
  const badge = STATUS_BADGE[status] || STATUS_BADGE.open;
  const closed = status === 'closed';
  const isLecture = (course?.kind || indexEntry?.kind) === 'lecture-series';

  const name = course?.name || indexEntry?.name;
  const nameEn = hasText(course?.nameEn) ? course.nameEn : hasText(indexEntry?.nameEn) ? indexEntry.nameEn : null;
  const credits = course?.credits ?? indexEntry?.credits;
  const instructor = course?.instructor;

  const sectionLabel = hasText(indexEntry?.sectionLabel) ? indexEntry.sectionLabel : null;
  const code = hasText(section?.code) ? section.code : null;
  const systemId = hasText(section?.systemId) ? section.systemId : null;
  const time = hasText(section?.time) ? section.time : null;
  const room = hasText(section?.room) ? section.room : null;
  const timePending = isPending(section?.timeNote);

  const codeParts = [];
  if (sectionLabel) codeParts.push(`${sectionLabel} 班`);
  if (code) codeParts.push(`選課代碼 ${code}`);
  if (systemId) codeParts.push(`系統編號 ${systemId}`);

  // hub.heroImage 有值才鋪主視覺；null → 預設 teal 溪谷底（全域 CSS）
  const heroStyle = hasText(course?.hub?.heroImage)
    ? {
        backgroundImage: `linear-gradient(rgba(14, 124, 123, 0.88), rgba(14, 124, 123, 0.88)), url(${withBase(course.hub.heroImage)})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : undefined;

  return (
    <div className="course-hero" style={heroStyle}>
      <div className="container">
        <span className={badge.className}>{badge.label}</span>
        {isLecture ? (
          <span className="badge badge-lect" style={{ marginLeft: 8 }}>
            演講課・12 場
          </span>
        ) : null}
        <h1>
          {name}
          {nameEn ? (
            <>
              {' '}
              <small className="en">{nameEn}</small>
            </>
          ) : null}
        </h1>
        {isLecture ? <p className="en" style={{ margin: '4px 0 0' }}>教育部計畫・12 場系列演講</p> : null}
        <ul className="facts">
          {codeParts.length > 0 ? (
            <li style={closed ? { opacity: 0.55 } : undefined}>
              {closed ? '本學期停開・' : ''}
              {codeParts.join('・')}
            </li>
          ) : null}
          {credits != null ? (
            <li>
              {credits} 學分
              {hasText(course?.courseType) ? `・${course.courseType}` : ''}
            </li>
          ) : null}
          {hasText(course?.weeksSystem) ? <li>{course.weeksSystem}</li> : null}
          {time ? (
            <li>
              {time}
              {timePending ? <small>（實際上課時刻開學前補）</small> : null}
            </li>
          ) : null}
          {room ? <li>{room}</li> : null}
          {!time && !room ? <li>上課時間地點開學前公布</li> : null}
          {sibling ? (
            <li>
              <Link href={`/courses/${sibling.slug}/`} style={{ color: 'inherit' }}>
                另一班：{sibling.sectionLabel}
                {hasText(sibling.time) ? `（${sibling.time}）` : ''} →
              </Link>
            </li>
          ) : null}
        </ul>
        {hasText(instructor?.promise) ? (
          <p className="promise">
            「{instructor.promise}」{hasText(instructor?.name) ? `——${instructor.name}` : ''}
          </p>
        ) : null}
      </div>
    </div>
  );
}
