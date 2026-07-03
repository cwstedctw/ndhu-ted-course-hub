// app/page.js — 首頁（詳細設計書二章 §4.1：hero＋8 班卡片牆＋最新公告，僅此三塊、零演講內容）
// 資料一律經 lib/content.js 讀 content/，不 hard-code 課程資訊。
// 公告過濾發生在 build 時（SSG）——validUntil 過期即不出 HTML；公告異動要重新 build。
// title／description 沿用 layout 的預設（＝§4.1 SEO 規格），此處同值補 og 標籤（IA 章 §3 通則）。

import { getSite, getAnnouncements, getCourses } from '@/lib/content';
import CourseCard from '@/components/CourseCard';

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '';

/* ── 公告（§4.1 區塊 3）：build 時過濾與排序 ──────────────────────────
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
  const index = await getCourses();
  const semester = site.brand?.semester || index.semester || '115-1';
  const wallSemester = index.semester || semester;
  // 卡片牆依 courses.json 的 order 排序（§4.1 區塊 2）；缺筆由 validate 在 build 前擋下
  const courses = [...(index.courses || [])].sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  const announcements = pickAnnouncements();

  return (
    <>
      <style>{`
        /* 頁首 sticky（globals §7），錨點跳轉預留頭部高度 */
        #courses, #announcements { scroll-margin-top: 76px; }
        /* 置頂公告：gold 淡底＋圖釘＋sr-only「置頂公告」（設計書 §5-4.3） */
        .ann article.pinned { background: var(--gold-tint); border-radius: 10px; padding: 12px 14px; margin: 8px 0; }
        .ann .pin { margin-right: 4px; }
        /* 公告 body 的少量 markdown（段落與清單） */
        .ann-body p + p { margin-top: 6px; }
        .ann-body ul { margin: 4px 0 0; padding-left: 20px; font-size: 14px; color: var(--ink-60); }
        .ann-body li { margin: 2px 0; }
      `}</style>

      {/* 首頁大圖預先載入（React 19 會把 link 提升進 head；只掛首頁不掛全站） */}
      <link
        rel="preload"
        as="image"
        href={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/images/bg/valley-hero.webp`}
        fetchPriority="high"
      />
      {/* 區塊 1：品牌 hero（立霧水彩溪谷全景＝影片同款畫風；globals §11-1），只掛首頁 */}
      <div className="hero hero-scene">
        <div className="container">
          {/* 文字墊紙板：Ted 2026-07-03 圈示副標壓山景不清楚→半透明 cream 面板保可讀性 */}
          <div className="hero-copy">
            <h1>這學期，把 AI 用在真實任務上</h1>
            <p className="tag">
              八班課程、一個入口——課程介紹、評分方式、平台連結、上學期作品，開學前一次看清楚。
            </p>
            <ul className="chips">
              <li>問得出來</li>
              <li>查得到底</li>
              <li>做得出東西</li>
            </ul>
            <a className="cta" href="#courses">看 {semester} 課程</a>
          </div>
        </div>
      </div>

      {/* 區塊 2：8 班課程卡片牆（courses.json，依 order 排序；徽章三態見 CourseCard） */}
      <section id="courses" aria-labelledby="courses-title">
        <div className="container">
          <h2 id="courses-title">{wallSemester} 開課清單</h2>
          <ul className="cards">
            {courses.map((course) => (
              <CourseCard key={course.slug} course={course} />
            ))}
          </ul>
        </div>
      </section>

      {/* 區塊 3：最新公告（pinned 置頂、date 新→舊、取 5 則；無有效公告＝低調單行） */}
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
    </>
  );
}
