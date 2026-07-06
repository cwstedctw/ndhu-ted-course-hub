// components/SiteHeader.js — 全站頁首（server component）
// 品牌字標（logo.png＋站名＋學期，連回首頁）＋導覽：課程／成績查詢／關於。
// 「作品展示」導覽項 陳文盛老師 2026-07-03 圈示拿掉（/showcase/ 頁保留，課程頁作品區仍引用）。
// 裁決：導覽列的「成績查詢」直接外連 site.json 的 scoreUrl（V2 Apps Script /exec）新分頁，
// 一律 target="_blank" rel="noopener noreferrer"——Hub 本身零成績、零個資。
// 「施工日誌」唯 buildLog.enabled 為 true 才渲染（現值 false，待拍板）。

import Link from 'next/link';
import { getSite } from '@/lib/content';
import NavMenu from './NavMenu';

// 純 <img> 不會自動吃 basePath（next.config.mjs 有註明），手動補前綴
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '';

export default function SiteHeader() {
  const site = getSite();
  const { brand, buildLog } = site;

  return (
    <header className="site-head">
      <div className="container bar">
        <Link className="brand" href="/">
          {/* 品牌名就在旁邊，圖示不重複報讀 */}
          <img src={`${BASE_PATH}/logo.png`} alt="" width="36" height="36" />
          <span>{brand.name}</span>
          <span className="sem">{brand.semester}</span>
        </Link>
        {/* 導覽：桌機內聯、手機收漢堡（NavMenu client component；見 globals §7）。
            無 JS 後備：關 JS 時強制隱藏漢堡、nav 內聯不失能 */}
        <noscript>
          <style>{`@media (max-width:759px){.nav-toggle{display:none!important}.nav-wrap .site-nav{display:flex!important;position:static!important;flex-direction:row!important;background:none!important;box-shadow:none!important;padding:0!important}}`}</style>
        </noscript>
        <NavMenu scoreUrl={site.scoreUrl} buildLogEnabled={buildLog?.enabled} />
      </div>
    </header>
  );
}
