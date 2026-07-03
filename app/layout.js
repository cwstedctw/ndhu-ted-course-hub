// app/layout.js — 全站根版型
// <html lang="zh-Hant-TW">＋metadata 預設（title template、description、favicon、theme-color）
// ＋skip link＋SiteHeader／SiteFooter。資料一律經 lib/content.js 讀 content/，不 hard-code。

import './globals.css';
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
  themeColor: '#F4ECD8', // cream-100，與頁面底色一致（設計書 §5-5.1）
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-Hant-TW">
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
