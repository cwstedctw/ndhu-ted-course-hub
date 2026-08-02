// components/course/EnrollBox.js — 課程詳情頁的「加入」盒（hero 正下方）
//
// 設計計畫 §4.4 加入動線元件：課號大字 CopyCode＋「教務系統選課 ↗」gold＋雙班課的另一班捷徑；
// 講者報名頁（netlify 外部表單）是「講者自薦」用的，不是學生候補——課程網不放（Ted 2026-08-02 更正）。
// 官方連結原則（F2–F5、C2）：不寫規則、不寫日期、不解釋候補機制，按鈕命名把去處講清楚。
// 連結真值＝site.json 的 enrollUrl；停開的班不出選課鈕。
// 樣式在 app/v3-home.css（v3-enroll 段）。

import Link from 'next/link';
import CopyCode from '@/components/home/CopyCode';

export default function EnrollBox({
  code,
  enrollUrl,
  isLecture = false,
  sibling = null,
  closed = false,
}) {
  const hasCode = typeof code === 'string' && code.trim() !== '';
  const hasEnroll = !closed && typeof enrollUrl === 'string' && enrollUrl.trim() !== '';
  if (!hasCode && !hasEnroll && !hasWaitlist && !sibling) return null;

  return (
    <div className="v3-enroll" role="group" aria-label="加入這門課">
      <div className="container v3-enroll-box">
        {hasCode ? (
          <div className="v3-enroll-code">
            <span className="v3-enroll-label">選課代碼</span>
            <CopyCode code={code} what="選課代碼" />
          </div>
        ) : null}

        <div className="v3-enroll-actions">
          {hasEnroll ? (
            <a
              className="v3-btn v3-btn-gold"
              href={enrollUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              教務系統選課 ↗<span className="sr-only">（另開新視窗）</span>
            </a>
          ) : null}
                    {sibling?.slug ? (
            <Link className="v3-btn v3-btn-ghost" href={`/courses/${sibling.slug}/`}>
              另一班：{sibling.sectionLabel}
              {sibling.time ? `（${sibling.time}）` : ''} →
            </Link>
          ) : null}
        </div>
      </div>

      {/* 沒有 JS 時：複製鈕按不動就藏起來，課號本身仍可一點全選（v3-home.css user-select:all） */}
      <noscript>
        <style>{`.v3-enroll .v3-copy-btn{display:none!important}.v3-enroll .v3-copy{padding-right:12px}`}</style>
      </noscript>
    </div>
  );
}
