'use client';
// components/home/WeekSchedule.js — 區塊 3「週課表」（client component）
//
// 雙模板（設計計畫 C5）：
//   桌機 ≥768px：全週格線——真節次列（鐘點由 content 的 startTime／endTime 推得）、
//                午休帶、分類色左條、課磚可點進課程頁。
//   手機 <768px：依天 tab（只列有課的日子），預設「今天」；今天沒課或週末 → 退回第一天。
// 「今天」必須在瀏覽器端決定（本站是靜態產出，build 當天不等於瀏覽當天），
// 所以初始 state 一律取第一天、掛載後再用 useEffect 換成今天——這樣不會 hydration 不一致。
//
// 無 JS 後備：tab 列隱藏、四天面板全部依序攤開（樣式在 NoJs 的 <noscript>）。
// 資料全部來自 props（model.buildWeek ← lib/content.getWeekGrid），此檔不寫課程事實。

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function WeekSchedule({ week }) {
  const days = week?.days ?? [];
  const rows = week?.rows ?? [];
  const [activeDay, setActiveDay] = useState(days[0]?.day ?? 1);

  useEffect(() => {
    const js = new Date().getDay(); // 0=週日
    const iso = js === 0 ? 7 : js;
    if (days.some((d) => d.day === iso)) setActiveDay(iso);
  }, [days]);

  if (days.length === 0 || rows.length === 0) return null;

  const rowIndex = (period) => rows.findIndex((r) => r.period === period);

  return (
    <section id="week" className="v3-sec" aria-labelledby="v3-week-title">
      <div className="container">
        <h2 id="v3-week-title">看時間</h2>

        {/* ── 桌機：全週格線 ── */}
        <div
          className="v3-week-grid"
          style={{
            gridTemplateColumns: `72px repeat(${days.length}, minmax(0, 1fr))`,
            gridTemplateRows: `34px ${rows.map((r) => (r.free ? '30px' : '48px')).join(' ')}`,
          }}
          aria-label="一週課表"
        >
          {/* ⚠️ 不掛 role="table"：CSS grid 沒有 row／cell 的對應結構，硬掛 ARIA 表格角色
              會讓輔具讀出殘缺的表——改成每塊課磚自己用 sr-only 帶星期，語意才完整 */}
          <span className="v3-week-corner" style={{ gridColumn: 1, gridRow: 1 }} aria-hidden="true" />
          {days.map((d, i) => (
            <span
              key={`h-${d.day}`}
              className="v3-week-head"
              style={{ gridColumn: i + 2, gridRow: 1 }}
            >
              {d.label}
            </span>
          ))}

          {rows.map((r, ri) => (
            <span
              key={`t-${r.period}`}
              className={r.free ? 'v3-week-time is-free' : 'v3-week-time'}
              style={{ gridColumn: 1, gridRow: ri + 2 }}
            >
              {r.free ? (
                <>
                  <b>午休</b>
                  {r.gapFrom && r.gapTo ? (
                    <small>
                      {r.gapFrom}–{r.gapTo}
                    </small>
                  ) : null}
                </>
              ) : (
                <>
                  <b>{r.period}</b>
                  {r.start ? <small>{r.start}</small> : null}
                </>
              )}
            </span>
          ))}

          {/* 底格（畫格線用）；課磚之後才渲染，會疊在底格上面 */}
          {rows.map((r, ri) =>
            days.map((d, di) => (
              <span
                key={`c-${r.period}-${d.day}`}
                className={r.free ? 'v3-week-cell is-free' : 'v3-week-cell'}
                style={{ gridColumn: di + 2, gridRow: ri + 2 }}
                aria-hidden="true"
              />
            ))
          )}

          {days.map((d, di) =>
            d.items.map((it) => {
              const start = rowIndex(it.periods[0]);
              const span = it.periods[1] - it.periods[0] + 1;
              if (start < 0) return null;
              return (
                <Link
                  key={`k-${d.day}-${it.slug}`}
                  className="v3-week-tile"
                  data-cat={it.cat || undefined}
                  href={`/courses/${it.slug}/`}
                  style={{ gridColumn: di + 2, gridRow: `${start + 2} / span ${span}` }}
                >
                  <span className="sr-only">{d.label}・</span>
                  <span className="v3-tile-name">
                    {it.name}
                    {it.sectionLabel ? <i> {it.sectionLabel}</i> : null}
                  </span>
                  <span className="v3-tile-meta">
                    {it.startTime}–{it.endTime}
                  </span>
                  <span className="v3-tile-meta">
                    {it.periodLabel}
                    {it.roomShort ? `・${it.roomShort}` : ''}
                  </span>
                </Link>
              );
            })
          )}
        </div>

        {/* ── 手機：依天 tab ── */}
        <div className="v3-week-mobile">
          <div className="v3-day-tabs" role="tablist" aria-label="選擇星期">
            {days.map((d) => (
              <button
                key={`tab-${d.day}`}
                type="button"
                role="tab"
                id={`v3-tab-${d.day}`}
                aria-selected={activeDay === d.day}
                aria-controls={`v3-day-${d.day}`}
                className={activeDay === d.day ? 'v3-day-tab is-on' : 'v3-day-tab'}
                onClick={() => setActiveDay(d.day)}
              >
                {d.cn}
              </button>
            ))}
          </div>

          {days.map((d) => (
            <div
              key={`panel-${d.day}`}
              id={`v3-day-${d.day}`}
              role="tabpanel"
              aria-labelledby={`v3-tab-${d.day}`}
              className={activeDay === d.day ? 'v3-day-panel is-on' : 'v3-day-panel'}
            >
              <h3 className="v3-day-title">{d.label}</h3>
              <ul className="v3-day-list">
                {d.items.map((it) => (
                  <li key={`m-${d.day}-${it.slug}`}>
                    <Link className="v3-day-row" data-cat={it.cat || undefined} href={`/courses/${it.slug}/`}>
                      <span className="v3-day-time">
                        <b>
                          {it.startTime}–{it.endTime}
                        </b>
                        <small>{it.periodLabel}</small>
                      </span>
                      <span className="v3-day-name">
                        {it.name}
                        {it.sectionLabel ? <i> {it.sectionLabel}</i> : null}
                        <small>{it.room}</small>
                      </span>
                      <span className="v3-day-go" aria-hidden="true">
                        →
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="v3-week-push">
          看好時間了？<a href="#join">怎麼加入 →</a>
        </p>
      </div>
    </section>
  );
}
