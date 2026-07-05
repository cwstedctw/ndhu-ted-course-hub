// app/courses/page.js — 課程牆（詳細設計書二章 §4.2：頁標＋學期下拉＋8 班卡片牆）
// V1 學期下拉只有「115-1」單一選項（不堆 Tab；多學期資料結構列本章未決事項，V2 再議）。
// 卡片牆與首頁共用 CourseCard；資料一律經 lib/content.js 讀 content/courses.json。

import { getSite, getCourses, getCourseCards } from '@/lib/content';
import CourseCard from '@/components/CourseCard';

function sortedCourses(index) {
  return [...(index.courses || [])].sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
}

export async function generateMetadata() {
  const site = await getSite();
  const index = await getCourses();
  const semester = index.semester || site.brand.semester;
  const courses = sortedCourses(index);
  // 同名課（AA/AB）去重後組 description（§4.2 SEO：「本學期開設 8 班：人工智慧概論、…」build 時生成）
  const names = [...new Set(courses.map((c) => c.name))];
  // title 主詞＝「115-1 開課清單」（全站頁面命名對照表），品牌尾由 layout 的 %s 模板補上
  const pageTitle = `${semester} 開課清單`;
  const fullTitle = `${pageTitle}｜${site.brand.name}`;
  const description = `本學期開設 ${courses.length} 班：${names.join('、')}。`;
  return {
    title: pageTitle,
    description,
    openGraph: {
      title: fullTitle, description, siteName: site.brand.name, locale: 'zh_TW', type: 'website',
      images: ['/images/og-default.jpg'],
    },
    twitter: { card: 'summary_large_image' },
  };
}

export default async function CoursesPage() {
  const site = await getSite();
  const index = await getCourses();
  const semester = index.semester || site.brand.semester;
  // 牆面卡片走 getCourseCards（索引筆＋timeShort 節次短版）；metadata 仍用純索引即可
  const courses = [...getCourseCards()].sort((a, b) => (a.order ?? 99) - (b.order ?? 99));

  return (
    <>
      <style>{`
        .courses-hero { padding: 44px 0 0; }
        .courses-picker { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .courses-picker label { font-size: 14px; color: var(--ink-60); }
        .sem-select {
          font: inherit; font-size: 14px; color: var(--ink);
          background: var(--paper); border: 1px solid var(--teal-mid);
          border-radius: var(--radius-sm); padding: 5px 12px;
        }
        /* 手機：下拉置頂全寬（§4.2 RWD） */
        @media (max-width: 759px) {
          .courses-picker { flex-direction: column; align-items: stretch; gap: 6px; }
          .sem-select { width: 100%; }
        }
      `}</style>

      {/* 區塊 1：頁標＋學期下拉（V1 僅 115-1 一項）＋資料更新日小字 */}
      <div className="hero courses-hero">
        <div className="container">
          <h1 id="courses-title">{semester} 開課清單</h1>
          <p className="tag">這學期的 8 班課程總覽——點進卡片看課程介紹、評分方式與平台連結。</p>
          <div className="courses-picker">
            <label htmlFor="semester-select">學期</label>
            <select id="semester-select" className="sem-select" defaultValue={semester}>
              <option value={semester}>{semester}</option>
            </select>
            {index.updated ? <span className="note">資料更新日 {index.updated}</span> : null}
          </div>
        </div>
      </div>

      {/* 區塊 2：8 班課程卡片牆（與首頁同元件、同排序） */}
      <section aria-labelledby="courses-title">
        <div className="container">
          <ul className="cards">
            {courses.map((course) => (
              <CourseCard key={course.slug} course={course} />
            ))}
          </ul>
          <p className="note" style={{ marginTop: 14 }}>
            選課、上課時刻與教室請以學校教務系統公告為準。
          </p>
        </div>
      </section>
    </>
  );
}
