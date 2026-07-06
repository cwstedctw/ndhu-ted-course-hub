'use client';
// 頁首導覽（client component）：桌機內聯、手機收漢堡。
// 為何用 client 而非純 CSS details/summary——details 當 flex 子項無法穩定撐開寬度
// （nav 溢出右緣，2026-07-05 實測多次），改回按鈕＋useState 這個業界標準最可靠。
// 無 JS 後備：SiteHeader 掛 <noscript> 樣式，關 JS 時漢堡隱藏、nav 內聯不失能。
// 無障礙：button + aria-expanded + aria-controls；點連結自動收合。
import { useState } from 'react';
import Link from 'next/link';

export default function NavMenu({ scoreUrl, buildLogEnabled }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <div className="nav-wrap">
      <button
        type="button"
        className="nav-toggle"
        aria-expanded={open}
        aria-controls="primary-nav"
        aria-label="主選單"
        onClick={() => setOpen((o) => !o)}
      >
        <span className={open ? 'nav-toggle-icon open' : 'nav-toggle-icon'} aria-hidden="true" />
      </button>
      <nav id="primary-nav" className={open ? 'site-nav open' : 'site-nav'} aria-label="主選單">
        <Link href="/courses/" onClick={close}>課程</Link>
        <a href={scoreUrl} target="_blank" rel="noopener noreferrer" onClick={close}>
          成績查詢<span className="sr-only">（另開新視窗）</span>
        </a>
        {buildLogEnabled ? (
          <Link href="/build-log/" onClick={close}>施工日誌</Link>
        ) : null}
        <Link href="/about/" onClick={close}>關於</Link>
      </nav>
    </div>
  );
}
