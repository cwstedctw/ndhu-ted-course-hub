// app/layout.js — 全站根版型
// <html lang="zh-Hant-TW">＋metadata 預設（title template、description、favicon、theme-color）
// ＋skip link＋SiteHeader／SiteFooter。資料一律經 lib/content.js 讀 content/，不 hard-code。

import './globals.css';
import './v3-home.css';
import './v3-talks.css';
import './v3-extra.css';
import { getSite } from '@/lib/content';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '';

const site = getSite();
const { brand, about } = site;

// 首頁 title＝brand.name＋「｜東華大學 陳文盛 115-1 課程入口」（設計書二章 §4.1 SEO）；
// 其他頁提供自己的 title 主詞，套 template「%s｜{brand.name}」。
// brand.description 為 null 時，以 about 資訊組一句中性描述（不編造事實）。
const defaultDescription =
  brand.description ||
  `東華大學通識教育中心 ${about.name} ${brand.semester} 學期課程入口：課程介紹、評分方式、平台連結與上學期精選作品。`;

export const metadata = {
  ...(site.baseUrl ? { metadataBase: new URL(site.baseUrl) } : {}),
  title: {
    default: `${brand.name}｜東華大學 ${about.name} ${brand.semester} 課程入口`,
    template: `%s｜${brand.name}`,
  },
  description: defaultDescription,
  // metadata.icons 不會自動吃 basePath，手動補前綴
  icons: { icon: `${BASE_PATH}/logo.png` },
  openGraph: {
    siteName: brand.name,
    locale: 'zh_TW',
    type: 'website',
    // 預設社群預覽圖（立霧水彩溪谷）。⚠️路徑不加 BASE_PATH：metadataBase（site.json
    // baseUrl）已含 /ndhu-ted-course-hub 子路徑，Next 是「串接」不是 URL 語意解析，
    // 再加會疊兩次（2026-07-03 上線實測踩到）。favicon 是原樣輸出、相反地要手補。
    images: ['/images/og-default.jpg'],
  },
  twitter: { card: 'summary_large_image' },
};

export const viewport = {
  // 兩版各給一支，手機瀏覽器的網址列才會跟著頁面底色走
  // （亮＝cream-100、暗＝night-950；設計書 §5-5.1、globals.css §12）
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F4ECD8' },
    { media: '(prefers-color-scheme: dark)', color: '#083A38' },
  ],
};

// 防閃（FOUC）：first paint 前把使用者上次選的版本寫回 <html data-theme>，
// 免得系統是亮版、使用者選了暗版時先閃一下亮底。
// ・只讀 localStorage、只寫一個屬性，沒有 localStorage（無痕／擋儲存）就靜靜跳過
// ・**沒有 JS 就完全不執行**＝退回純 @media (prefers-color-scheme) 行為，
//   這是 D1 白紙黑字的 fallback，不是意外
const THEME_INIT_SCRIPT =
  "(function(){try{var t=localStorage.getItem('theme');" +
  "if(t==='dark'||t==='light'){document.documentElement.setAttribute('data-theme',t);}" +
  '}catch(e){}})();';

export default function RootLayout({ children }) {
  return (
    // suppressHydrationWarning：上面那支 script 會在 hydrate 之前改 <html> 的屬性，
    // 屬性對不上是預期行為（next-themes 同一套做法），不是真的 hydration 錯誤
    <html lang="zh-Hant-TW" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      {/* 背景圖 URL 統一在此手組 basePath（globals.css 的 url() 不吃 basePath，寫死會 404） */}
      <body
        style={{
          '--bg-hero': `url(${BASE_PATH}/images/bg/valley-hero.webp)`,
          '--bg-flow': `url(${BASE_PATH}/images/bg/flow-teal.webp)`,
          '--bg-texture': `url(${BASE_PATH}/images/bg/contour-cream.webp)`,
        }}
      >
        <a className="skip-link" href="#main">跳到主要內容</a>
        <SiteHeader />
        <main id="main">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
