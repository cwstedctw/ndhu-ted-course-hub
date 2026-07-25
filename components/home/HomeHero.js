// components/home/HomeHero.js — 首頁 Hero（區塊 1，server component）
//
// 版面（設計計畫 §4.2）：中文承諾句＋答案列三 chip（各自帶錨點）＋主 CTA gold「怎麼加入 ↓」
// ＋次 CTA outline「先看看課程」；桌機右欄＝「下一場演講」暗場焦點卡。
// 手機把焦點卡收起（display:none），改由區塊 4 的 spotlight 呈現——同一個元件、兩個落點，
// 任一寬度下只有一張進得了無障礙樹。
//
// 三個 chip 的數字全部由 model.js 從 content 數出來（6 門課／8 班次／週幾到週幾／最早幾點／
// 幾月開學）；官方連結原則（F2–F5）：這裡不寫選課規則、不寫選課日期、不教怎麼加簽。

import NextTalkCard from './NextTalkCard';

export default function HomeHero({ stats, semesterMonth, spotlight }) {
  const chips = [
    stats.courseCount && stats.sectionCount
      ? { href: '#courses', text: `${stats.courseCount} 門課・${stats.sectionCount} 班次` }
      : null,
    stats.dayRange
      ? {
          href: '#week',
          text: stats.earliest ? `${stats.dayRange}・最早 ${stats.earliest}` : stats.dayRange,
        }
      : null,
    {
      href: '#join',
      text: semesterMonth ? `${semesterMonth} 月開學・教務系統選課` : '教務系統選課',
    },
  ].filter(Boolean);

  return (
    <section id="v3-hero" className="v3-hero" aria-labelledby="v3-hero-title">
      <div className="container v3-hero-grid">
        <div className="v3-hero-copy">
          <h1 id="v3-hero-title">這學期，把 AI 排進你的課表</h1>

          <ul className="v3-answers">
            {chips.map((c) => (
              <li key={c.href}>
                <a className="v3-chip" href={c.href}>
                  {c.text}
                </a>
              </li>
            ))}
          </ul>

          <p className="v3-hero-actions">
            <a id="v3-hero-cta" className="v3-btn v3-btn-gold" href="#join">
              怎麼加入 ↓
            </a>
            <a className="v3-btn v3-btn-outline" href="#courses">
              先看看課程
            </a>
          </p>
        </div>

        {/* 桌機右欄視覺鉤子；手機隱藏（區塊 4 有同一張卡） */}
        <NextTalkCard
          talk={spotlight.talk}
          courseSlug={spotlight.courseSlug}
          className="v3-focus-hero"
        />
      </div>
    </section>
  );
}
