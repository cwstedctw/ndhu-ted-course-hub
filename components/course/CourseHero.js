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

// 教室 →「地圖 ↗」：取 room 第一段（建物名）組 Google Maps 搜尋連結——
// 純查詢字串、不寫死座標；新生第一週找教室的真實痛點（2026-07-05 學生視角升級）
function roomMapUrl(room) {
  const building = String(room).trim().split(/\s+/)[0];
  if (!building) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`國立東華大學 ${building}`)}`;
}

export default function CourseHero({ course, section, indexEntry, sibling, enrollUrl }) {
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
          {room ? (
            <li>
              {room}
              {roomMapUrl(room) ? (
                <>
                  {'　'}
                  <a href={roomMapUrl(room)} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>
                    地圖 ↗
                  </a>
                </>
              ) : null}
            </li>
          ) : null}
          {!time && !room ? <li>上課時間地點開學前公布</li> : null}
          {/* 怎麼選課（site.json enrollUrl；停開班不出） */}
          {!closed && hasText(enrollUrl) ? (
            <li>
              <a href={enrollUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>
                怎麼選課 ↗
              </a>
            </li>
          ) : null}
          {/* 課程介紹簡報（sections[].deckUrl，站內 public/decks/ 自足單檔；2026-07-05 Ted 拍板掛上站） */}
          {hasText(section?.deckUrl) ? (
            <li>
              <a href={withBase(section.deckUrl)} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>
                課程介紹簡報 ↗
              </a>
            </li>
          ) : null}
          {hasText(section?.deckUrlEn) ? (
            <li>
              <a href={withBase(section.deckUrlEn)} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>
                簡報英文雙語版 ↗
              </a>
            </li>
          ) : null}
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
            {/* 名人金句自帶「引號＋——出處」（五課，2026-07-03 拍板）→ 原樣輸出，
                不再外包「」也不補教師署名（否則雙引號雙署名）；教師本人句照舊格式 */}
            {instructor.promise.includes('——')
              ? instructor.promise
              : `「${instructor.promise}」${hasText(instructor?.name) ? `——${instructor.name}` : ''}`}
          </p>
        ) : null}
      </div>
    </div>
  );
}
