// 單場演講詳情頁 /courses/11501-ai-future/talks/[id]/（t01–t12 十二頁全建）
// 依據：詳細設計書 §4.5（區塊規格）、§3.6（talks.json schema）、§5.4（Event JSON-LD 僅 confirmed 產出）
// 資料一律走 lib/content.js 的 getTalks()，頁面不自己讀檔。

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTalks } from '@/lib/content';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || '';
const COURSE_SHORT = 'AI未來應用與趨勢探索';
const COURSE_FULL = 'AI未來應用與趨勢探索：洄瀾的智慧未來';
const WALL_HREF = '/courses/11501-ai-future/#talks';

const MOE_LABELS = { legal: '法律', ethical: '倫理', application: '應用' };
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

/* ── 資料存取（容錯：getTalks() 可能回整份物件或純陣列） ── */

function listTalks() {
  const data = getTalks();
  const talks = Array.isArray(data) ? data : data && Array.isArray(data.talks) ? data.talks : [];
  return [...talks].sort((a, b) => talkNo(a) - talkNo(b));
}

function talkNo(talk) {
  if (typeof talk.no === 'number') return talk.no;
  const digits = String(talk.id || '').replace(/\D/g, '');
  return digits ? Number(digits) : 0;
}

function findTalk(id) {
  const talks = listTalks();
  const index = talks.findIndex((t) => t.id === id);
  if (index === -1) return { talk: null, prev: null, next: null };
  return {
    talk: talks[index],
    prev: index > 0 ? talks[index - 1] : null,
    next: index < talks.length - 1 ? talks[index + 1] : null,
  };
}

/* ── 顯示小工具 ── */

function formatDate(iso) {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return `${iso}（週${WEEKDAYS[d.getUTCDay()]}）`;
}

function squeeze(text, max = 155) {
  if (!text) return '';
  const flat = String(text).replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}

function speakerLine(speaker) {
  if (!speaker) return null;
  const parts = [speaker.title, speaker.org].filter(Boolean);
  return parts.length ? parts.join('・') : null;
}

/* ── schema.org Event JSON-LD（僅 confirmed；欄位不足不產） ── */

function buildEventJsonLd(talk) {
  if (!talk || talk.status !== 'confirmed') return null;
  if (!talk.title || !talk.date || !talk.speaker?.name) return null;

  const performer = { '@type': 'Person', name: talk.speaker.name };
  if (talk.speaker.title) performer.jobTitle = talk.speaker.title;
  if (talk.speaker.org) performer.affiliation = { '@type': 'Organization', name: talk.speaker.org };

  const event = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: talk.title,
    startDate: talk.time ? `${talk.date}T${talk.time}:00+08:00` : talk.date,
    performer,
  };
  if (talk.venue) event.location = { '@type': 'Place', name: talk.venue };
  return event;
}

/* ── 靜態路由：t01–t12 全建（tba 亦建占位詳情頁），其餘 id 落 404 ── */

export const dynamicParams = false;

export function generateStaticParams() {
  return listTalks().map((talk) => ({ id: talk.id }));
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const { talk } = findTalk(id);
  if (!talk) return { title: `找不到場次｜${COURSE_SHORT}` };

  const no = talkNo(talk);
  if (talk.status === 'tba' || !talk.title) {
    return {
      title: `第 ${no} 場演講（敬請期待）｜${COURSE_SHORT}`,
      description: `「${COURSE_FULL}」12 場系列演講第 ${no} 場，講者與講題確認後於本頁公布。`,
    };
  }

  const title = talk.speaker?.name
    ? `${talk.title}｜${talk.speaker.name}｜${COURSE_SHORT}`
    : `${talk.title}｜${COURSE_SHORT}`;
  const description =
    squeeze(talk.abstract) || `「${COURSE_FULL}」12 場系列演講第 ${no} 場。`;

  const openGraph = { title, description };
  if (talk.poster) openGraph.images = [`${BASE}${talk.poster}`];
  return { title, description, openGraph };
}

/* ── 頁面 ── */

export default async function TalkDetailPage({ params }) {
  const { id } = await params;
  const { talk, prev, next } = findTalk(id);
  if (!talk) notFound();

  const no = talkNo(talk);
  const isTba = talk.status === 'tba';
  const isDone = talk.status === 'done';
  const jsonLd = buildEventJsonLd(talk);
  const dateText = formatDate(talk.date);

  return (
    <article className="tdp">
      <style>{tdpCss}</style>
      {jsonLd ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      ) : null}

      <p>
        <Link className="tdp-back" href={WALL_HREF}>← 回演講海報牆</Link>
      </p>
      <p className="tdp-course">{COURSE_FULL}——12 場系列演講</p>

      <header className="tdp-head">
        <p className="tdp-badges">
          <span className="tdp-no">第 {no} 場</span>
          {isDone ? <span className="tdp-done">已結束</span> : null}
        </p>
        <h1>{isTba || !talk.title ? `第 ${no} 場演講（敬請期待）` : talk.title}</h1>
        <ul className="tdp-meta" aria-label="時間與地點">
          <li className={dateText ? '' : 'pending'}>{dateText || '日期待定'}</li>
          <li className={talk.time ? '' : 'pending'}>{talk.time || '時間待定'}</li>
          <li className={talk.venue ? '' : 'pending'}>{talk.venue || '地點待定'}</li>
        </ul>
        {Array.isArray(talk.moe) && talk.moe.length > 0 ? (
          <ul className="tdp-moe" aria-label="教育部指標面向">
            {talk.moe.map((key) => (
              <li key={key}>{MOE_LABELS[key] || key}</li>
            ))}
          </ul>
        ) : null}
      </header>

      {isTba || !talk.speaker?.name ? (
        <div className="tdp-ripple" role="status">
          講者確認後公布
          <br />
          <small>講者、講題與摘要確認後，會在本頁更新。</small>
        </div>
      ) : (
        <section className="tdp-speaker" aria-label="講者介紹">
          {talk.speaker.photo ? (
            <img
              className="tdp-photo"
              src={`${BASE}${talk.speaker.photo}`}
              alt={`講者 ${talk.speaker.name} 照片`}
              width={84}
              height={84}
              loading="lazy"
            />
          ) : (
            <span className="tdp-avatar" aria-hidden="true">{talk.speaker.name.charAt(0)}</span>
          )}
          <div>
            <p className="tdp-spk-name">{talk.speaker.name}</p>
            {speakerLine(talk.speaker) ? <p className="tdp-spk-org">{speakerLine(talk.speaker)}</p> : null}
          </div>
        </section>
      )}

      {!isTba ? (
        <section aria-label="演講摘要">
          <h2>演講摘要</h2>
          {talk.abstract ? (
            talk.abstract
              .split(/\n+/)
              .filter((p) => p.trim())
              .map((p, i) => (
                <p className="tdp-abstract" key={i}>{p}</p>
              ))
          ) : (
            <div className="tdp-ripple">摘要整理中，確認後公布</div>
          )}
        </section>
      ) : null}

      {talk.worksheetUrl ? (
        <p className="tdp-worksheet-row">
          <a className="cta tdp-worksheet" href={talk.worksheetUrl} target="_blank" rel="noopener noreferrer">
            填學習單
          </a>
          <span className="tdp-note">（另開新視窗）</span>
        </p>
      ) : null}

      {!isTba && talk.poster ? (
        <section aria-label="演講海報">
          <h2>演講海報</h2>
          <a href={`${BASE}${talk.poster}`} target="_blank" rel="noopener noreferrer" title="在新分頁開啟海報原圖">
            <img
              className="tdp-poster"
              src={`${BASE}${talk.poster}`}
              alt={`第 ${no} 場演講海報${talk.title ? `：${talk.title}` : ''}`}
              loading="lazy"
            />
          </a>
          <p className="tdp-note">點海報可在新分頁開啟原圖。</p>
        </section>
      ) : null}

      {isDone && Array.isArray(talk.materials) && talk.materials.length > 0 ? (
        <section aria-label="演講回顧資料">
          <h2>演講回顧資料</h2>
          <ul className="tdp-materials">
            {talk.materials.map((m) => (
              <li key={m.url}>
                <a href={m.url} target="_blank" rel="noopener noreferrer">{m.label}</a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <nav className="tdp-nav" aria-label="場次導覽">
        <span>
          {prev ? <Link href={`/courses/11501-ai-future/talks/${prev.id}/`}>← 第 {talkNo(prev)} 場</Link> : null}
        </span>
        <Link href={WALL_HREF}>回海報牆</Link>
        <span>
          {next ? <Link href={`/courses/11501-ai-future/talks/${next.id}/`}>第 {talkNo(next)} 場 →</Link> : null}
        </span>
      </nav>
    </article>
  );
}

/* ── 頁內樣式（吃全站 token、附 fallback 值；水波占位與全站 .ripple 同款） ── */

const tdpCss = `
.tdp { max-width: 820px; margin: 0 auto; padding: 28px 20px 44px; }
.tdp-back { font-size: 14px; color: var(--teal-dark, #0A5958); }
.tdp-course { font-size: 13px; color: var(--ink-40, #8B8779); margin: 10px 0 0; }
.tdp-head { margin: 6px 0 18px; }
.tdp-badges { margin: 0 0 4px; display: flex; gap: 8px; flex-wrap: wrap; }
.tdp-no { font-size: 12.5px; background: var(--gold-tint, #F7EAD1); color: var(--gold-deep, #7A5A1E); border: 1px solid var(--gold, #D9A441); border-radius: 999px; padding: 2px 10px; font-weight: 700; }
.tdp-done { font-size: 12.5px; background: #ECE7D8; color: var(--ink-60, #5B584F); border-radius: 999px; padding: 2px 10px; }
.tdp h1 { font-size: clamp(24px, 4vw, 32px); line-height: 1.4; margin: 8px 0 12px; }
.tdp h2 { font-size: 19px; margin: 26px 0 10px; padding-left: 10px; border-left: 4px solid var(--teal, #0E7C7B); line-height: 1.4; }
.tdp-meta { display: flex; gap: 8px; flex-wrap: wrap; list-style: none; margin: 0; padding: 0; }
.tdp-meta li { background: var(--teal-tint, #E3F1F0); color: var(--teal-deep, #07403F); border-radius: 999px; padding: 3px 12px; font-size: 13.5px; }
.tdp-meta li.pending { background: #ECE7D8; color: var(--ink-40, #8B8779); }
.tdp-moe { display: flex; gap: 6px; flex-wrap: wrap; list-style: none; margin: 10px 0 0; padding: 0; }
.tdp-moe li { font-size: 12px; background: var(--teal-tint, #E3F1F0); color: var(--teal-deep, #07403F); border-radius: 999px; padding: 1px 10px; }
.tdp-speaker { display: flex; gap: 16px; align-items: center; background: var(--paper, #FDFAF2); border: 1px solid var(--line, #E5DCC3); border-radius: var(--radius, 14px); padding: 16px 18px; margin: 18px 0; }
.tdp-photo, .tdp-avatar { width: 84px; height: 84px; border-radius: 50%; flex: 0 0 auto; object-fit: cover; }
.tdp-avatar { display: inline-flex; align-items: center; justify-content: center; background: var(--teal-tint, #E3F1F0); color: var(--teal-deep, #07403F); font-size: 30px; font-weight: 700; }
.tdp-spk-name { margin: 0; font-size: 18px; font-weight: 700; }
.tdp-spk-org { margin: 2px 0 0; font-size: 14px; color: var(--ink-60, #5B584F); }
.tdp-abstract { font-size: 15.5px; margin: 0 0 12px; }
.tdp-worksheet-row { margin: 26px 0 6px; }
.tdp-worksheet { display: inline-block; background: var(--gold, #D9A441); color: #3D2E0B; font-weight: 700; text-decoration: none; padding: 12px 30px; border-radius: 999px; font-size: 16px; }
.tdp-worksheet:hover { filter: brightness(1.05); }
.tdp-note { font-size: 12.5px; color: var(--ink-40, #8B8779); margin-left: 8px; }
.tdp-poster { display: block; width: 100%; max-width: 480px; border: 1px solid var(--line, #E5DCC3); border-radius: var(--radius, 14px); }
.tdp-materials { margin: 0; padding-left: 20px; font-size: 15px; }
.tdp-materials li { margin-bottom: 6px; }
.tdp-nav { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-top: 34px; padding-top: 16px; border-top: 1px solid var(--line, #E5DCC3); font-size: 14.5px; }
.tdp-nav span { min-width: 84px; }
.tdp-nav span:last-child { text-align: right; }
.tdp-ripple {
  border: 1.5px dashed var(--teal-mid, #5FB3B0); border-radius: var(--radius, 14px);
  color: var(--teal-deep, #07403F); font-size: 14.5px; text-align: center;
  padding: 30px 16px; margin: 18px 0; line-height: 1.9;
  background:
    repeating-radial-gradient(circle at 30% 45%, rgba(14,124,123,.10) 0 6px, transparent 6px 26px),
    repeating-radial-gradient(circle at 72% 60%, rgba(14,124,123,.07) 0 5px, transparent 5px 22px);
  animation: tdp-drift 7s ease-in-out infinite alternate;
}
.tdp-ripple small { color: var(--ink-60, #5B584F); font-size: 13px; }
@keyframes tdp-drift { from { background-position: 0 0, 0 0; } to { background-position: 14px 8px, -12px -6px; } }
@media (prefers-reduced-motion: reduce) { .tdp-ripple { animation: none; } }
@media (max-width: 759px) {
  .tdp-worksheet { display: block; text-align: center; }
  .tdp-note { display: block; margin: 6px 0 0; text-align: center; }
}
@media print {
  .tdp-back, .tdp-worksheet-row, .tdp-nav { display: none !important; }
  .tdp-ripple { animation: none; background: none; }
}
`;
