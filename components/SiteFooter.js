// components/SiteFooter.js — 全站頁尾（server component）
// 內容（設計書 §5-4.13）：四人署名（footerCredits 原字串直出）＋聯絡 email＋
// 「本站零成績、零個資」聲明＋「© 2026 陳文盛」＋學期字樣——後三者由版型固定渲染，不另設欄位。

import { getSite } from '@/lib/content';

export default function SiteFooter() {
  const site = getSite();
  const { about, brand } = site;

  return (
    <footer className="site-foot">
      <div className="container">
        <p>{site.footerCredits}</p>
        <p>
          聯絡：<a href={`mailto:${about.email}`}>{about.email}</a>
        </p>
        <p>
          本站零成績、零個資 ｜ © 2026 {about.name} ｜ {brand.semester} 學期
        </p>
      </div>
    </footer>
  );
}
