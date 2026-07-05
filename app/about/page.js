// app/about/page.js —— 關於頁（詳細設計書 IA 章 §4.9）
// 區塊 1：陳文盛老師 名片卡（site.json about.{name,title,email,office,contact}；email 用 mailto）
//         phone 一律不渲染——渲染白名單排除（IA 章 §3），site.schema.json 亦無此欄。
// 區塊 2：AI 團隊聯名（footerCredits 原字串直出，頁尾署名的放大版）
//         ＋團隊水彩合繪（出自團隊首作影片，2026-07-03 陳文盛老師 定調全站視覺跟影片走）。
import { getSite } from '@/lib/content';

const BP = process.env.NEXT_PUBLIC_BASE_PATH || '';

export async function generateMetadata() {
  const site = await getSite();
  const { about } = site;
  const title = '關於';
  const description = `國立東華大學 ${about.title} ${about.name}——聯絡方式、研究室位置與 AI 協作團隊介紹。`;
  return {
    title,
    description,
    openGraph: {
      title: `${title}｜${site.brand.name}`, description,
      images: ['/images/og-default.jpg'],
    },
    twitter: { card: 'summary_large_image' },
  };
}

export default async function AboutPage() {
  const site = await getSite();
  const { about, footerCredits } = site;

  return (
    <main className="about-main">
      <style>{`
        .about-main { padding: 48px 0 32px; }
        .about-wrap { max-width: 620px; margin: 0 auto; }
        .about-wrap h1 { font-size: clamp(24px, 3.6vw, 32px); margin: 0 0 18px; text-align: center; line-height: 1.4; }
        .about-card {
          background: var(--paper, #FDFAF2); border: 1px solid var(--line, #E5DCC3);
          border-radius: var(--radius, 14px); padding: 24px 28px;
        }
        .about-card h2 { margin: 0; font-size: 22px; line-height: 1.4; }
        .about-title-line { margin: 2px 0 16px; color: var(--ink-60, #5B584F); font-size: 14.5px; }
        .about-facts { display: grid; grid-template-columns: 6em 1fr; gap: 8px 14px; margin: 0; font-size: 15px; }
        .about-facts dt { font-weight: 700; color: var(--teal-deep, #07403F); }
        .about-facts dd { margin: 0; overflow-wrap: anywhere; }
        .about-contact-note { display: block; margin-top: 3px; font-size: 13px; color: var(--ink-40, #8B8779); }
        .about-credits {
          margin-top: 26px; text-align: center;
          background: var(--teal-deep, #07403F); color: var(--teal-tint, #E3F1F0);
          border-radius: var(--radius, 14px); padding: 24px 22px 26px;
        }
        .about-credits h2 { margin: 0 0 8px; font-size: 17px; color: #fff; }
        .about-team-art { width: 100%; height: auto; border-radius: 10px; margin: 6px 0 12px; display: block; }
        .about-credits p { margin: 4px 0; font-size: 14px; }
        .about-credits-line { font-size: 16.5px; font-weight: 700; letter-spacing: .02em; line-height: 1.9; }
        @media (max-width: 479px) {
          .about-facts { grid-template-columns: 1fr; gap: 2px; }
          .about-facts dd { margin-bottom: 10px; }
        }
      `}</style>
      <section>
        <div className="container about-wrap">
          <h1>關於</h1>

          <div className="about-card">
            <h2>{about.name}</h2>
            <p className="about-title-line">{about.title}</p>
            <dl className="about-facts">
              <dt>Email</dt>
              <dd>
                <a href={`mailto:${about.email}`}>{about.email}</a>
              </dd>
              <dt>研究室</dt>
              <dd>{about.office}</dd>
              <dt>聯絡方式</dt>
              <dd>
                {about.contact}
                {typeof about.contactNote === 'string' && about.contactNote.trim() ? (
                  <span className="about-contact-note">{about.contactNote}</span>
                ) : null}
              </dd>
            </dl>
          </div>

          <div className="about-credits">
            <h2>AI 協作團隊</h2>
            <img
              className="about-team-art"
              src={`${BP}/images/team-watercolor.webp`}
              alt="水彩合繪：陳文盛老師與三位溪流化身的 AI 夥伴——洄瀾、立霧、秀姑巒——在花蓮的辮狀溪床邊一同工作"
              width="1280"
              height="720"
              loading="lazy"
            />
            <p>這個網站由 {about.name} 老師與 AI 協作團隊共同打造——團隊以花蓮的三條溪為名。</p>
            <p className="about-credits-line">{footerCredits}</p>
          </div>
        </div>
      </section>
    </main>
  );
}
