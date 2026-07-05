import { notFound } from 'next/navigation';
import {
  getCourses,
  getCourseBySlug,
  getSite,
  getTalks,
  getShowcase,
} from '@/lib/content';
import CourseHero from '@/components/course/CourseHero';
import TalksWall from '@/components/course/TalksWall';
import IntroBento from '@/components/course/IntroBento';
import GradingDonut from '@/components/course/GradingDonut';
import Timeline from '@/components/course/Timeline';
import AiRules from '@/components/course/AiRules';
import ToolBelt from '@/components/course/ToolBelt';
import PlatformLinks from '@/components/course/PlatformLinks';
import ScoreButton from '@/components/course/ScoreButton';
import ShowcaseSection from '@/components/course/ShowcaseSection';
import WhatToBring from '@/components/course/WhatToBring';
import FaqList from '@/components/course/FaqList';
import Ripple from '@/components/course/Ripple';
import SectionNav from '@/components/course/SectionNav';
import { asArray, hasText, isPending } from '@/components/course/pending';

// 課程頁 /courses/[slug]/（設計書二章 §4.3 一般課程頁；§4.4 演講課變體）
// 資料組裝：courses.json 以 slug 查 (courseDir, sectionId) → 載 course.json；
// AA/AB 兩頁吃同一檔；單班課 sectionId=null → 取 sections[0]（lib/content.js 合約）。
// 區塊順序＝§4.3 區塊 1–11；kind=lecture-series → hero 之後第一個主區塊改 12 場海報牆（#talks）。

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
  const brand = site?.brand?.name || 'NDHU TED Course Hub';
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

  // 上學期作品：hub.showcaseRefs → showcase/114-2.json items 對照（refs 空＝不查檔、直接水波）
  const refs = asArray(hub.showcaseRefs);
  let showcaseItems = [];
  if (refs.length > 0) {
    const data = getShowcase();
    const all = Array.isArray(data) ? data : asArray(data?.items);
    showcaseItems = refs.map((id) => all.find((it) => it?.id === id)).filter(Boolean);
  }

  // 成績查詢真值：hub.scoreUrl 覆寫，否則吃 site.json scoreUrl（V2 Apps Script /exec）
  const scoreUrl = hasText(hub.scoreUrl) ? hub.scoreUrl : site?.scoreUrl;

  // 錨點導覽：條件鏡射各元件的 return null 守門（指向 ripple 佔位 OK、指向不存在 NG）
  const navItems = [
    isLecture && talks.length > 0 ? { href: '#talks', label: '演講海報牆' } : null,
    { href: '#intro', label: '課程介紹' },
    !introPending &&
    (isPending(intro.grading) ||
      asArray(intro.grading).some((g) => typeof g?.pct === 'number' && hasText(g?.label)))
      ? { href: '#grading', label: '成績怎麼算' }
      : null,
    !introPending &&
    (isPending(intro.phases) ||
      isPending(intro.weeklyPlan) ||
      asArray(intro.phases).length > 0 ||
      asArray(intro.weeklyPlan).length > 0)
      ? { href: '#weeks', label: '每週進度' }
      : null,
    !introPending &&
    (asArray(intro.aiRules).length > 0 || asArray(intro.aiPolicyExamples).length > 0)
      ? { href: '#ai-rules', label: 'AI 守則' }
      : null,
    !introPending &&
    (asArray(intro.toolGroups).some((g) => hasText(g?.group)) ||
      asArray(intro.dailyTools).some((t) => hasText(t?.name)))
      ? { href: '#tools', label: '會用的工具' }
      : null,
    hasText(scoreUrl) ? { href: '#score', label: '查成績' } : null,
    { href: '#showcase', label: '上學期作品' },
    !introPending && asArray(intro.whatToBring).some(hasText)
      ? { href: '#bring', label: '要帶什麼' }
      : null,
    !introPending &&
    (isPending(intro.faq) ||
      asArray(intro.faq).some((f) => f?.status === 'confirmed' && hasText(f?.q) && hasText(f?.a)))
      ? { href: '#faq', label: 'FAQ' }
      : null,
  ];

  return (
    <>
      <CourseHero
        course={course}
        section={section}
        indexEntry={indexEntry}
        sibling={sibling}
        enrollUrl={site?.enrollUrl}
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
      ) : (
        <>
          <IntroBento intro={intro} />
          <GradingDonut grading={intro.grading} gradingNote={intro.gradingNote} />
          <Timeline
            weeksSystem={course.weeksSystem}
            phases={intro.phases}
            weeklyPlan={intro.weeklyPlan}
            weekOneStart={site?.weekOneStart}
          />
          <AiRules aiRules={intro.aiRules} aiPolicyExamples={intro.aiPolicyExamples} />
          <ToolBelt
            toolGroups={intro.toolGroups}
            dailyTools={intro.dailyTools}
            toolGroupsNote={intro.toolGroupsNote}
          />
        </>
      )}
      <PlatformLinks hubLinks={hub.links} platforms={introPending ? [] : intro.platforms} />
      <ScoreButton scoreUrl={scoreUrl} />
      <ShowcaseSection items={showcaseItems} />
      {introPending ? null : (
        <>
          <WhatToBring items={intro.whatToBring} />
          <FaqList faq={intro.faq} />
        </>
      )}
    </>
  );
}
