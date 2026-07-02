// components/SiteHeader.js — 全站頁首（server component）
// 品牌字標（logo.png＋站名＋學期，連回首頁）＋導覽：課程／作品展示／成績查詢／關於。
// 裁決：導覽列的「成績查詢」直接外連 site.json 的 scoreUrl（V2 Apps Script /exec）新分頁，
// 一律 target="_blank" rel="noopener noreferrer"——Hub 本身零成績、零個資。
// 「施工日誌」唯 buildLog.enabled 為 true 才渲染（現值 false，待拍板）。

import Link from 'next/link';
import { getSite } from '@/lib/content';

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
        <nav className="site-nav" aria-label="主選單">
          <Link href="/courses/">課程</Link>
          <Link href="/showcase/">作品展示</Link>
          <a href={site.scoreUrl} target="_blank" rel="noopener noreferrer">
            成績查詢<span className="sr-only">（另開新視窗）</span>
          </a>
          {buildLog?.enabled ? <Link href="/build-log/">施工日誌</Link> : null}
          <Link href="/about/">關於</Link>
        </nav>
      </div>
    </header>
  );
}
