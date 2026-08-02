// app/page.js — 首頁（v3 W2 全面改版，設計計畫 §4.2）
//
// 由上而下六區塊：Hero → 課程掃視 #courses → 週課表 #week → 演講 spotlight #talk
//                → 怎麼加入 #join → 公告 #announcements；外加手機浮動底欄。
// 公告區與頁尾沿用現制，一行沒動。
//
// 鐵律：
//   ・事實只吃 content JSON——課名／課號／節次／鐘點／教室／講者全部經 lib/content.js，
//     首頁自己不寫第二份課程資料（設計計畫 C7）；重組形狀的工作在 components/home/model.js。
//   ・官方連結原則（F2–F5）：站上不寫選課規則、不寫選課日期、不教怎麼加簽；
//     按鈕命名「教務系統選課 ↗」，網址真值＝site.json。
//   ・炫的預算（C6）：本頁零自動動效，hover 只有升起 4px＋邊線亮。
// 公告過濾發生在 build 時（SSG）——validUntil 過期即不出 HTML；公告異動要重新 build。

import { getSite, getAnnouncements } from '@/lib/content';
import { buildHomeModel } from '@/components/home/model';
import HomeHero from '@/components/home/HomeHero';
import CourseScan from '@/components/home/CourseScan';
import WeekSchedule from '@/components/home/WeekSchedule';
import TalkSpotlight from '@/components/home/TalkSpotlight';
import JoinSection from '@/components/home/JoinSection';
import StickyBar from '@/components/home/StickyBar';
import NoJs from '@/components/home/NoJs';

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '';

/* ── 公告（區塊 6，沿用現制）：build 時過濾與排序 ──────────────────────
   規則：validUntil 早於建置日 → 濾掉；pinned 恆置頂；其餘依 date 新→舊；取前 5 則。
   超過 5 則或逾期即下架＝刻意決策（V1 不做公告歷史頁）。 */
function pickAnnouncements(maxItems = 5) {
  const raw = getAnnouncements();
  const items = Array.isArray(raw) ? raw : Array.isArray(raw?.items) ? raw.items : [];
  // 建置機時區不可靠，一律以台灣時間認定「今天」；ISO 日期字串可直接字典序比較
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(new Date());
  const byDateDesc = (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0);
  const valid = items.filter((it) => it && (!it.validUntil || it.validUntil >= today));
  const pinned = valid.filter((it) => it.pinned).sort(byDateDesc);
  const rest = valid.filter((it) => !it.pinned).sort(byDateDesc);
  return [...pinned, ...rest].slice(0, maxItems);
}

/* ── 公告 body 的少量 markdown（粗體／連結／清單；schema §3.3 註記）──────
   不走 innerHTML：拆成 React 元素渲染，字串一律由 React 轉義（sanitize）。
   連結只認 https?:// 與站內根路徑（/…，補 BASE_PATH）；其他 scheme 當純文字。 */
function renderInline(text) {
  const parts = String(text).split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^\s)]+\))/g);
  return parts.map((part, i) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    const link = part.match(/^\[([^\]]+)\]\(([^\s)]+)\)$/);
    if (link) {
      const [, label, url] = link;
      if (/^https?:\/\//.test(url)) {
        return (
          <a key={i} href={url} target="_blank" rel="noopener noreferrer">
            {label}
          </a>
        );
      }
      if (url.startsWith('/')) {
        return (
          <a key={i} href={`${BASE_PATH}${url}`}>
            {label}
          </a>
        );
      }
      return <span key={i}>{part}</span>;
    }
    return part;
  });
}

function renderBody(body) {
  const blocks = [];
  let list = null;
  String(body)
    .split(/\r?\n/)
    .forEach((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('- ')) {
        if (!list) {
          list = [];
          blocks.push({ type: 'ul', items: list });
        }
        list.push(trimmed.slice(2));
      } else {
        list = null;
        if (trimmed) blocks.push({ type: 'p', text: trimmed });
      }
    });
  return blocks.map((block, i) =>
    block.type === 'ul' ? (
      <ul key={i}>
        {block.items.map((item, j) => (
          <li key={j}>{renderInline(item)}</li>
        ))}
      </ul>
    ) : (
      <p key={i}>{renderInline(block.text)}</p>
    )
  );
}

export async function generateMetadata() {
  const site = await getSite();
  const { brand, about } = site;
  // §4.1 SEO：title＝brand.name＋「｜東華大學 陳文盛 115-1 課程入口」（與 layout 預設同式，
  // 用 absolute 避免被 %s 模板再包一層）；description＝brand.description，null 時以 about 組中性一句。
  const title = `${brand.name}｜東華大學 ${about.name} ${brand.semester} 課程入口`;
  const description =
    brand.description ||
    `東華大學通識教育中心 ${about.name} ${brand.semester} 學期課程入口：課程介紹、評分方式、平台連結與上學期精選作品。`;
  return {
    title: { absolute: title },
    description,
    openGraph: {
      title, description, siteName: brand.name, locale: 'zh_TW', type: 'website',
      // 頁面層 openGraph 會整包蓋掉 layout 的，images 必須跟著帶（Next 淺合併）；
      // 路徑不加 BASE_PATH——metadataBase 已含子路徑（詳 layout.js 註記）
      images: ['/images/og-default.jpg'],
    },
    twitter: { card: 'summary_large_image' },
  };
}

export default async function HomePage() {
  const site = await getSite();
  const model = buildHomeModel();
  const announcements = pickAnnouncements();

  // Hero 第三顆 chip 的「幾月開學」：由 site.json 的 weekOneStart 推，不另外寫死日期
  const monthMatch = /^\d{4}-(\d{2})-\d{2}$/.exec(site.weekOneStart || '');
  const semesterMonth = monthMatch ? Number(monthMatch[1]) : null;

  return (
    <>
      <style>{`
        /* 公告區沿用現制（設計書 §5-4.3）：置頂 gold 淡底＋圖釘＋少量 markdown 版面 */
        #announcements { scroll-margin-top: 76px; }
        .ann article.pinned { background: var(--gold-tint); border-radius: 10px; padding: 12px 14px; margin: 8px 0; }
        .ann .pin { margin-right: 4px; }
        .ann-body p + p { margin-top: 6px; }
        .ann-body ul { margin: 4px 0 0; padding-left: 20px; font-size: 14px; color: var(--ink-60); }
        .ann-body li { margin: 2px 0; }
      `}</style>

      {/* 首頁大圖預先載入（React 19 會把 link 提升進 head；只掛首頁不掛全站） */}
      <link
        rel="preload"
        as="image"
        href={`${BASE_PATH}/images/bg/valley-hero.webp`}
        fetchPriority="high"
      />

      {/* 區塊 1：Hero（承諾句＋答案列三 chip＋雙 CTA；桌機右欄＝下一場演講焦點卡） */}
      <HomeHero
        stats={model.heroStats}
        semesterMonth={semesterMonth}
        spotlight={model.spotlight}
      />

      {/* 區塊 2：課程掃視（決策篩選 chips＋6 張併班課卡） */}
      <CourseScan groups={model.groups} filters={model.filters} />

      {/* 區塊 3：週課表（桌機格線／手機依天 tab） */}
      <WeekSchedule week={model.week} />

      {/* 區塊 4：演講 spotlight（手機版焦點卡的落點＋看完整場次） */}
      <TalkSpotlight spotlight={model.spotlight} />

      {/* 區塊 5：怎麼加入（全課號表＋兩個官方入口） */}
      <JoinSection
        rows={model.codeTable}
        enrollUrl={site.enrollUrl}
      />

      {/* 區塊 6：最新公告（pinned 置頂、date 新→舊、取 5 則；無有效公告＝低調單行） */}
      <section id="announcements" aria-labelledby="announcements-title">
        <div className="container">
          <h2 id="announcements-title">最新公告</h2>
          {announcements.length === 0 ? (
            <p className="note">目前沒有公告</p>
          ) : (
            <div className="ann">
              {announcements.map((item) => (
                <article key={item.id} className={item.pinned ? 'pinned' : undefined}>
                  <time dateTime={item.date}>{item.date}</time>
                  <h3>
                    {item.pinned ? (
                      <>
                        <span className="pin" aria-hidden="true">📌</span>
                        <span className="sr-only">置頂公告：</span>
                      </>
                    ) : null}
                    {item.title}
                  </h3>
                  <div className="ann-body">{renderBody(item.body)}</div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 手機浮動底欄（捲過 Hero 才出現；沒有 JS 就不存在） */}
      <StickyBar enrollUrl={site.enrollUrl} />

      {/* 關掉 JS 時的後備樣式（控制項收起、內容全展開） */}
      <NoJs />
    </>
  );
}
