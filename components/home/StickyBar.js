'use client';
// components/home/StickyBar.js — 手機浮動底欄（設計計畫 C8＋確認輪第 4 條 gold 互斥）
//
// 規則：
//   ・只在手機（<720px，CSS 控制）出現；56px＋safe-area-inset-bottom
//   ・捲過 Hero 才出現——用**同一個** IntersectionObserver 同時盯三個目標：
//       #v3-hero      → 整段離開視口才顯示底欄
//       #v3-hero-cta  → Hero 主 CTA 還看得到時，底欄右鈕不上 gold（gold 互斥）
//       #join         → 已經捲到「怎麼加入」了，底欄整條收起來
//         （#join 裡面本來就有一顆 gold「教務系統選課」，收起來才守得住「每視口 ≤1 顆 gold」）
//   ・沒有 JS（或瀏覽器沒有 IntersectionObserver）→ 初始 state 就是不顯示，
//     靜態 HTML 裡連元素都沒有，不會出現按不動的浮條。

import { useEffect, useState } from 'react';

export default function StickyBar({ enrollUrl }) {
  const [pastHero, setPastHero] = useState(false);
  const [ctaVisible, setCtaVisible] = useState(true);
  const [joinVisible, setJoinVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return undefined;
    const hero = document.getElementById('v3-hero');
    const cta = document.getElementById('v3-hero-cta');
    const join = document.getElementById('join');
    const targets = [hero, cta, join].filter(Boolean);
    if (targets.length === 0) return undefined;

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.target === hero) setPastHero(!e.isIntersecting);
          else if (e.target === cta) setCtaVisible(e.isIntersecting);
          else if (e.target === join) setJoinVisible(e.isIntersecting);
        }
      },
      { threshold: 0 }
    );
    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, []);

  const hasEnroll = typeof enrollUrl === 'string' && enrollUrl.trim() !== '';
  if (!pastHero || joinVisible) return null;

  return (
    <div className="v3-sticky" role="group" aria-label="快速加入">
      <a className="v3-sticky-left" href="#join">
        查看課號
      </a>
      {hasEnroll ? (
        <a
          className={ctaVisible ? 'v3-sticky-right' : 'v3-sticky-right is-gold'}
          href={enrollUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          去選課 ↗<span className="sr-only">（教務系統，另開新視窗）</span>
        </a>
      ) : null}
    </div>
  );
}
