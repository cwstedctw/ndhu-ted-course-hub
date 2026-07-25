// components/home/TalkSpotlight.js — 區塊 4「演講 spotlight」（server component）
//
// 手機版 Hero 焦點卡的落點：同一個 NextTalkCard 元件，class 換成 v3-focus-spot，
// 由 CSS 決定哪個寬度顯示哪一張（任一寬度只有一張進無障礙樹，見 v3-home.css）。
// 另外一行場次概況與「看 12 場完整場次 →」連到演講課頁的 #talks 錨點。
// 場次數字（12 場／已公布講者幾場）由 talks.json 數出來，不寫死；tba 場次不揭露任何內容。

import Link from 'next/link';
import NextTalkCard from './NextTalkCard';

export default function TalkSpotlight({ spotlight }) {
  const { talk, courseSlug, total, confirmed } = spotlight;
  if (!courseSlug || total === 0) return null;

  return (
    <section id="talk" className="v3-sec" aria-labelledby="v3-talk-title">
      <div className="container">
        <h2 id="v3-talk-title">看演講</h2>

        <div className="v3-spot">
          <NextTalkCard talk={talk} courseSlug={courseSlug} className="v3-focus-spot" />

          <div className="v3-spot-side">
            <p className="v3-spot-count">
              <b>{total}</b> 場專家演講
              {confirmed > 0 ? <span>已公布講者 {confirmed} 場</span> : null}
            </p>
            <Link className="v3-btn v3-btn-outline" href={`/courses/${courseSlug}/#talks`}>
              看 {total} 場完整場次 →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
