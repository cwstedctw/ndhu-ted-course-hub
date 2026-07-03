// app/score/page.js —— 成績查詢跳轉頁（詳細設計書 IA 章 §4.7）
// 唯一功能：把已修課學生「送去」V2 Apps Script 成績查詢系統。
// 鐵律：Hub 本身零成績、零個資——本頁不出現任何分數、名冊、查詢表單；
//       scoreUrl 真值只住 content/site.json（schema 鎖 script.google.com 網域），本頁只吃欄位。
import { getSite } from '@/lib/content';

export async function generateMetadata() {
  const site = await getSite();
  const title = '成績查詢';
  const description = '使用東華 Google 帳號登入，僅能查詢自己的成績。';
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

export default async function ScorePage() {
  const site = await getSite();
  const { scoreUrl, scoreDemoUrl } = site;
  // scoreDemoUrl 為 null → 整塊不渲染（§4.7 區塊 3；現值即 null）
  const showDemo = typeof scoreDemoUrl === 'string' && scoreDemoUrl.length > 0;

  return (
    <main className="score-main">
      <style>{`
        .score-main { padding: 48px 0 32px; }
        .score-wrap { max-width: 620px; margin: 0 auto; text-align: center; }
        .score-wrap h1 { font-size: clamp(24px, 3.6vw, 32px); margin: 0 0 10px; line-height: 1.4; }
        .score-lead { color: var(--ink-60, #5B584F); font-size: 15.5px; margin: 0 0 28px; }
        .score-cta {
          display: inline-block; background: var(--teal, #0E7C7B); color: #fff;
          font-weight: 700; font-size: 17.5px; text-decoration: none;
          padding: 14px 46px; border-radius: 999px;
        }
        .score-cta:hover { background: var(--teal-dark, #0A5958); }
        .score-open-note { font-size: 13px; color: var(--ink-60, #5B584F); margin: 10px 0 0; }
        .score-zero {
          margin: 30px auto 0; background: var(--teal-tint, #E3F1F0); color: var(--teal-deep, #07403F);
          border-radius: var(--radius, 14px); padding: 14px 18px; font-size: 14px; line-height: 1.8;
        }
        .score-demo {
          margin: 34px auto 0; padding-top: 18px;
          border-top: 1px solid var(--line, #E5DCC3); font-size: 14.5px;
        }
        .score-demo .score-demo-note { color: var(--ink-40, #8B8779); font-size: 12.5px; }
        /* 大按鈕手機通欄（§4.7 RWD：單欄置中） */
        @media (max-width: 759px) { .score-cta { display: block; width: 100%; } }
        @media print { .score-cta { display: none; } }
      `}</style>
      <section>
        <div className="container score-wrap">
          <h1>成績查詢</h1>
          <p className="score-lead">
            查詢需以東華 Google 帳號（@gms.ndhu.edu.tw）登入，登入後只看得到自己的成績。
          </p>
          <a className="score-cta" href={scoreUrl} target="_blank" rel="noopener noreferrer">
            查詢成績
          </a>
          <p className="score-open-note">另開新視窗，需東華帳號登入</p>
          <p className="score-zero">
            <strong>本站不存放任何成績</strong>——按下按鈕後，登入驗證與成績查詢
            都在學校授權的系統上完成，本站不經手、也看不到任何資料。
          </p>
          {showDemo ? (
            <p className="score-demo">
              <a href={scoreDemoUrl} target="_blank" rel="noopener noreferrer">
                AI 建的成績查詢系統
              </a>{' '}
              <span className="score-demo-note">（demo・假資料）</span>
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
