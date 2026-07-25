'use client';
// components/home/CourseScan.js — 區塊 2「課程掃視」（client component）
//
// 三件事：①搜尋框（課名／英文名／課號／tagline／chips 全文比對，W4-G 加）
//        ②決策篩選 chips 橫滑列（全部＋content 裡的 filters 聯集）
//        ③6 張課卡（AA/AB 併卡，卡內 segmented control 切班次）
// 資料全部由 server 端的 model.js 從 content JSON 組好後當 props 傳進來，
// 這支檔案一句課程事實都不寫（設計計畫 C7）；搜尋只是「對已組好的欄位做字串比對」，
// 不另外查表、不生第二份事實。
//
// 無 JS 後備：預設狀態＝「全部」且每張卡顯示第一個班次，靜態 HTML 已經含全部 6 張卡與
// 全部 8 個班次的內容；搜尋框／篩選 chips／segmented 由各自的 <noscript> 樣式隱藏（按了
// 或打了字都沒反應的控制項不留在畫面上），同時把兩個班次的內容一起攤開。
// 搜尋框的 noscript 樣式跟著搜尋框本身放在這支檔案（見下方 <noscript>），
// chips／segmented 沿用既有的 components/home/NoJs.js（沒有動它）。

import { useId, useState } from 'react';
import Link from 'next/link';
import CopyCode from './CopyCode';

const STATUS_BADGE = {
  open: { className: 'v3-badge v3-badge-open', label: '開放選課' },
  conditional: { className: 'v3-badge v3-badge-cond', label: '限量開放，速選' },
  closed: { className: 'v3-badge v3-badge-closed', label: '本學期停開' },
};

/** 一張課卡搜得到的全部欄位攤成一段小寫字串：課名／英文名／tagline／chips／各班課號。
 *  只吃已經傳進來的 group 形狀（model.js 組好的），不另外讀 content。 */
function haystackOf(group) {
  const codes = group.sections.map((s) => s.code).filter(Boolean).join(' ');
  return [group.name, group.nameEn, group.tagline, group.chips.join(' '), codes]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export default function CourseScan({ groups, filters }) {
  const [active, setActive] = useState(null); // null＝全部
  const [picked, setPicked] = useState({}); // { courseDir: 班次索引 }
  const [query, setQuery] = useState(''); // 搜尋字串，空字串＝不過濾
  const baseId = useId();

  const byFilter = active ? groups.filter((g) => g.filters.includes(active)) : groups;
  const q = query.trim().toLowerCase();
  const shown = q === '' ? byFilter : byFilter.filter((g) => haystackOf(g).includes(q));

  return (
    <section id="courses" className="v3-sec" aria-labelledby="v3-courses-title">
      <div className="container">
        <h2 id="v3-courses-title">看課程</h2>

        <div className="v3-search">
          <label className="sr-only" htmlFor={`${baseId}-q`}>
            搜尋課程（課名、英文名、課號或關鍵字）
          </label>
          <input
            id={`${baseId}-q`}
            type="search"
            className="v3-search-input"
            placeholder="搜尋課名、英文名、課號…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />
          {query !== '' ? (
            <button
              type="button"
              className="v3-search-clear"
              onClick={() => setQuery('')}
              aria-label="清除搜尋文字"
            >
              <span aria-hidden="true">✕</span>
            </button>
          ) : null}
        </div>
        {/* 無 JS：打字沒反應的搜尋框藏起來，直接看下面已攤開的全部課卡（同 NoJs.js 的原則） */}
        <noscript>
          <style>{`.v3-search{display:none!important}`}</style>
        </noscript>

        <div className="v3-filters" role="group" aria-label="依需求篩選課程">
          <button
            type="button"
            className={active === null ? 'v3-fchip is-on' : 'v3-fchip'}
            aria-pressed={active === null}
            onClick={() => setActive(null)}
          >
            全部
          </button>
          {filters.map((f) => (
            <button
              key={f}
              type="button"
              className={active === f ? 'v3-fchip is-on' : 'v3-fchip'}
              aria-pressed={active === f}
              onClick={() => setActive((cur) => (cur === f ? null : f))}
            >
              {f}
            </button>
          ))}
        </div>

        <p className="sr-only" role="status">
          目前顯示 {shown.length} 門課
        </p>

        {shown.length === 0 ? (
          <p className="v3-search-empty">沒有符合的課程，換個關鍵字或清除搜尋試試。</p>
        ) : null}

        <ul className="v3-cards">
          {shown.map((g) => {
            const badge = STATUS_BADGE[g.status] ?? STATUS_BADGE.open;
            const cur = picked[g.courseDir] ?? 0;
            const multi = g.sections.length > 1;

            return (
              <li key={g.courseDir}>
                <article
                  className={g.status === 'closed' ? 'v3-card is-closed' : 'v3-card'}
                  data-cat={g.cat || undefined}
                >
                  {g.kind === 'lecture-series' ? (
                    <span className="v3-card-corner">12 場系列演講</span>
                  ) : null}
                  <span className={badge.className}>{badge.label}</span>

                  <h3 className="v3-card-title">
                    <Link href={`/courses/${g.sections[cur]?.slug ?? g.sections[0].slug}/`}>
                      {g.name}
                    </Link>
                    {g.nameEn ? <span className="v3-card-en">{g.nameEn}</span> : null}
                  </h3>

                  {g.tagline ? <p className="v3-card-tagline">{g.tagline}</p> : null}

                  {g.chips.length > 0 && g.status !== 'closed' ? (
                    <ul className="v3-card-chips">
                      {g.chips.map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                    </ul>
                  ) : null}

                  {multi ? (
                    <div
                      className="v3-seg"
                      role="group"
                      aria-label={`${g.name}：選擇班次`}
                    >
                      {g.sections.map((s, i) => (
                        <button
                          key={s.slug}
                          type="button"
                          className={i === cur ? 'v3-seg-btn is-on' : 'v3-seg-btn'}
                          aria-pressed={i === cur}
                          aria-controls={`${baseId}-${g.courseDir}-${i}`}
                          onClick={() => setPicked((p) => ({ ...p, [g.courseDir]: i }))}
                        >
                          {s.sectionLabel ? `${s.sectionLabel} 班` : '本班'}
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {g.sections.map((s, i) => (
                    <div
                      key={s.slug}
                      id={`${baseId}-${g.courseDir}-${i}`}
                      className={i === cur ? 'v3-pane is-on' : 'v3-pane'}
                    >
                      <p className="v3-card-time" title={s.room || undefined}>
                        {multi && s.sectionLabel ? (
                          <span className="v3-pane-label">{s.sectionLabel} 班</span>
                        ) : null}
                        {s.timeChip || '上課時間開學前公布'}
                        {g.credits != null ? (
                          <span className="v3-card-credits">{g.credits} 學分</span>
                        ) : null}
                      </p>
                      <div className="v3-card-foot">
                        <Link className="v3-detail-link" href={`/courses/${s.slug}/`}>
                          看詳情 →
                        </Link>
                        <CopyCode code={s.code} what="課號" />
                      </div>
                    </div>
                  ))}
                </article>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
