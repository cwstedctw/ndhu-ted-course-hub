import { notFound } from 'next/navigation';
import {
  getCourses,
  getCourseBySlug,
  getSite,
  getTalks,
  getShowcase,
} from '@/lib/content';
import CourseHero from '@/components/course/CourseHero';
import EnrollBox from '@/components/course/EnrollBox';
import TalksWall from '@/components/course/TalksWall';
import IntroBento from '@/components/course/IntroBento';
import GradingDonut from '@/components/course/GradingDonut';
import Timeline from '@/components/course/Timeline';
import PlatformLinks from '@/components/course/PlatformLinks';
import ScoreButton from '@/components/course/ScoreButton';
import ShowcaseSection from '@/components/course/ShowcaseSection';
import WhatToBring from '@/components/course/WhatToBring';
import FaqList from '@/components/course/FaqList';
import Ripple from '@/components/course/Ripple';
import SectionNav from '@/components/course/SectionNav';
import Fold from '@/components/course/Fold';
import { asArray, hasText, isPending } from '@/components/course/pending';

// 課程頁 /courses/[slug]/（2026-08-02 課程頁重整 R1–R5：首屏決策卡＋折疊瘦身）
// 資料組裝：courses.json 以 slug 查 (courseDir, sectionId) → 載 course.json；
// AA/AB 兩頁吃同一檔；單班課 sectionId=null → 取 sections[0]（lib/content.js 合約）。
// 瘦身分工（R4）：網頁只答「選不選＋第一堂課前需知」——17 週逐週表、AI 使用守則細則、
// 工具教學（AiRules／ToolBelt／weeklyPlan）下放 W1 課程介紹投影片，資料仍留 course.json 不刪。
// emi 班（外籍生，courses.json entry.emi）：EN 在前 zh 在後（R5）；EN 正本＝英文版教學計畫（course.en）。

export const dynamicParams = false;

function courseIndexList() {
  const data = getCourses();
  return Array.isArray(data) ? data : asArray(data?.courses);
}

export function generateStaticParams() {
  // 讀 courses.json 展開 8 條路由（8 個班；AA/AB 各自成頁）
  return courseIndexList().map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const { course, indexEntry } = getCourseBySlug(slug) || {};
  const site = getSite();
  const semester = site?.brand?.semester || course?.semester || '';
  const name = course?.name || indexEntry?.name || '課程';
  const sectionLabel = hasText(indexEntry?.sectionLabel) ? ` ${indexEntry.sectionLabel}` : '';
  const isLecture = (course?.kind || indexEntry?.kind) === 'lecture-series';

  let description = hasText(indexEntry?.tagline)
    ? indexEntry.tagline
    : hasText(course?.intro?.promise)
      ? course.intro.promise
      : `${name}課程介紹`;
  if (isLecture) description = `${description}・12 場系列演講`;
  if (indexEntry?.emi && hasText(course?.en?.tagline)) {
    description = `${course.en.tagline} ${description}`;
  }

  return {
    title: [`${name}${sectionLabel}`, semester].filter(Boolean).join('｜'),
    description: description.slice(0, 155),
  };
}

export default async function CoursePage({ params }) {
  const { slug } = await params;
  const resolved = getCourseBySlug(slug);
  if (!resolved || !resolved.course) notFound();
  const { course, section, indexEntry } = resolved;
  const site = getSite();

  const isLecture = (course.kind || indexEntry?.kind) === 'lecture-series';
  const intro = course.intro;
  const introPending = !intro || isPending(intro); // intro 整包 pending（骨架課）→ 整塊水波
  const hub = course.hub || {};
  const emi = !!indexEntry?.emi;
  const en = emi ? course.en || null : null;

  // AA/AB 兄弟班切換：courses.json 同 courseDir 的另一筆（時間由該班 sections[] 帶出）
  const siblingEntry = indexEntry
    ? courseIndexList().find(
        (c) => c.courseDir === indexEntry.courseDir && c.slug !== indexEntry.slug
      )
    : null;
  const siblingSection = siblingEntry
    ? asArray(course.sections).find((s) => s?.id === siblingEntry.sectionId)
    : null;
  const sibling = siblingEntry
    ? {
        slug: siblingEntry.slug,
        sectionLabel: siblingEntry.sectionLabel,
        time: hasText(siblingSection?.time) ? siblingSection.time : null,
      }
    : null;

  // 演講課：12 場海報牆資料（talks.json）
  let talks = [];
  if (isLecture) {
    const data = getTalks();
    talks = Array.isArray(data) ? data : asArray(data?.talks);
  }

  // 上學期作品：hub.showcaseRefs → showcase/114-2.json items 對照（refs 空＝整區不出現：首次開課的課沒有上學期作品）
  const refs = asArray(hub.showcaseRefs);
  let showcaseItems = [];
  if (refs.length > 0) {
    const data = getShowcase();
    const all = Array.isArray(data) ? data : asArray(data?.items);
    showcaseItems = refs.map((id) => all.find((it) => it?.id === id)).filter(Boolean);
  }

  // 成績查詢真值：hub.scoreUrl 覆寫，否則吃 site.json scoreUrl（V2 Apps Script /exec）
  const scoreUrl = hasText(hub.scoreUrl) ? hub.scoreUrl : site?.scoreUrl;

  // 決策卡（R2）：評分一行摘要——emi 另帶英文行（正本＝英文版教學計畫評分表）
  const gradingItems = introPending
    ? []
    : asArray(intro.grading).filter((g) => typeof g?.pct === 'number' && hasText(g?.label));
  const gradingLine =
    gradingItems.length > 0
      ? `評分：${gradingItems.map((g) => `${g.label} ${g.pct}%`).join('・')}`
      : null;
  const gradingLineEn = emi && hasText(en?.gradingLine) ? en.gradingLine : null;

  // emi 班平台用途標籤加英文（en.platformUse 映射；元件本身不動）
  const useEn = emi && en?.platformUse ? en.platformUse : null;
  const withEnUse = (arr) =>
    useEn
      ? asArray(arr).map((p) =>
          p && hasText(p.use) && hasText(useEn[p.use]) ? { ...p, use: `${useEn[p.use]}・${p.use}` } : p
        )
      : asArray(arr);
  const hubLinksRender = withEnUse(hub.links);
  const platformsRender = introPending ? [] : withEnUse(intro.platforms);

  // 各折疊區的有無（鏡射元件的 return null 守門；Fold 的 id 是錨點真身）
  const hasGrading = !introPending && (isPending(intro.grading) || gradingItems.length > 0);
  const hasWeeks =
    !introPending && (isPending(intro.phases) || asArray(intro.phases).filter((p) => hasText(p?.title)).length > 0);
  const bringList = introPending ? [] : asArray(intro.whatToBring).filter(hasText);
  const hasPlatforms =
    hubLinksRender.some((l) => hasText(l?.label)) || platformsRender.some((p) => hasText(p?.name));
  const hasPrep = !introPending && (bringList.length > 0 || hasPlatforms);
  const hasFaq =
    !introPending &&
    (isPending(intro.faq) ||
      asArray(intro.faq).some((f) => f?.status === 'confirmed' && hasText(f?.q) && hasText(f?.a)));

  const navItems = [
    isLecture && talks.length > 0 ? { href: '#talks', label: '演講海報牆' } : null,
    { href: '#intro', label: '課程介紹' },
    hasGrading ? { href: '#grading', label: '成績怎麼算' } : null,
    hasWeeks ? { href: '#weeks', label: '課程怎麼走' } : null,
    hasPrep ? { href: '#prep', label: '課前準備' } : null,
    hasText(scoreUrl) ? { href: '#score', label: '查成績' } : null,
    showcaseItems.length > 0 ? { href: '#showcase', label: '上學期作品' } : null,
    hasFaq ? { href: '#faq', label: 'FAQ' } : null,
  ];

  return (
    <>
      <CourseHero
        course={course}
        section={section}
        indexEntry={indexEntry}
        sibling={sibling}
        enrollUrl={site?.enrollUrl}
        tagline={indexEntry?.tagline}
        chips={introPending ? [] : asArray(intro.chips).filter(hasText)}
        gradingLine={gradingLine}
        gradingLineEn={gradingLineEn}
        emi={emi}
        en={en}
      />
      {/* v3 W2 加入動線：hero 正下方的課號＋官方入口盒（設計計畫 §4.4） */}
      <EnrollBox
        code={section?.code}
        enrollUrl={site?.enrollUrl}
        isLecture={isLecture}
        sibling={sibling}
        closed={indexEntry?.status === 'closed'}
        emi={emi}
      />
      <SectionNav items={navItems} />
      {isLecture ? <TalksWall talks={talks} courseSlug={slug} /> : null}
      {introPending ? (
        <section id="intro">
          <div className="container">
            <h2>課程介紹</h2>
            <Ripple>課程詳細介紹整理中，開學前公布</Ripple>
          </div>
        </section>
      ) : null}
      {/* 骨架課（intro pending）也要看得到平台連結（hub.links）——沿舊版行為 */}
      {introPending ? (
        <PlatformLinks hubLinks={hubLinksRender} platforms={[]} />
      ) : (
        <>
          <IntroBento intro={intro} />
          {hasGrading ? (
            <Fold id="grading" title={emi ? 'Grading・成績怎麼算' : '成績怎麼算'}>
              <GradingDonut grading={intro.grading} gradingNote={intro.gradingNote} bare />
            </Fold>
          ) : null}
          {hasWeeks ? (
            <Fold
              id="weeks"
              title={emi ? `Course roadmap・${hasText(course.weeksSystem) ? `${course.weeksSystem}` : ''}課程怎麼走` : `${hasText(course.weeksSystem) ? `${course.weeksSystem}・` : ''}課程怎麼走`}
            >
              {/* 逐週表（weeklyPlan）下放 W1 投影片（R4）——只留三段大骨架 */}
              <Timeline
                weeksSystem={course.weeksSystem}
                phases={intro.phases}
                weeklyPlan={[]}
                weekOneStart={null}
                bare
              />
              <p className="v3-fold-note">
                逐週進度與細節，開學第一週老師會用課程介紹投影片說明。
                {emi ? ' Weekly details will be covered in the Week 1 course introduction.' : ''}
              </p>
            </Fold>
          ) : null}
          {hasPrep ? (
            <Fold id="prep" title={emi ? 'Before the first class・課前準備' : '課前準備（要帶什麼・上課平台）'}>
              {bringList.length > 0 ? (
                <>
                  <h3 className="v3-fold-h3">{emi ? 'What to bring・要帶什麼' : '要帶什麼'}</h3>
                  <WhatToBring items={intro.whatToBring} enItems={emi ? en?.whatToBring : null} bare />
                </>
              ) : null}
              {hasPlatforms ? (
                <>
                  <h3 className="v3-fold-h3">{emi ? 'Platforms・上課平台' : '上課平台'}</h3>
                  <PlatformLinks hubLinks={hubLinksRender} platforms={platformsRender} bare />
                </>
              ) : null}
            </Fold>
          ) : null}
        </>
      )}
      <ScoreButton scoreUrl={scoreUrl} />
      <ShowcaseSection items={showcaseItems} />
      {hasFaq ? (
        <Fold id="faq" title={emi ? 'FAQ・常見問題' : '常見問題'}>
          <FaqList faq={intro.faq} bare />
        </Fold>
      ) : null}
    </>
  );
}
