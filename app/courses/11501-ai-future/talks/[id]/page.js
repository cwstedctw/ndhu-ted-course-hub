// 單場演講詳情頁 /courses/11501-ai-future/talks/[id]/（t01–t12 十二頁全建）
// 依據：詳細設計書 §4.5（區塊規格）、§3.6（talks.json schema）、§5.4（Event JSON-LD 僅 confirmed 產出）
// 資料一律走 lib/content.js 的 getTalks()／getSite()，頁面不自己讀檔。
//
// v3 W3-2 升級（設計計畫 §4.3、C2／C3／C6）：
//   1. 衍生「已結束」：status 還是 confirmed，但過了當天 11:30（F1 拍板、Asia/Taipei）
//      就顯示已結束＋語氣轉過去式——判斷交給 lib/content.js 的 getTalkDisplayStatus，
//      **一個字都不改 talks.json**（資料只有 confirmed／tba／done 三態）。
//   2. tba 詳情頁 noindex：講者還沒敲定的占位頁不進搜尋結果，confirmed／已結束照常可索引。
//   3. 講者簡介 speaker.bio 有值才渲染（schema 2026-07-25 新增、目前 12 場全 null）。
//   4. 頁底行動：加入行事曆（.ics）＋回海報牆——講者報名頁是講者自薦用、課程網不放候補鈕（Ted 2026-08-02）。
//   5. 海報位：有海報→桌機雙欄（正文 7／海報 5、海報 sticky）；沒海報→單欄自然收，不留空洞。
//   6. W4-F（2026-07-26）加「加入行事曆」連結：只有 display==='confirmed'（講者已敲定、
//      還沒過 F1 拍板的 11:30 結束線）才顯示，指向 scripts/build-ics.mjs 產出的
//      public/ics/{id}.ics（BASE 前綴、中性樣式沿用 tdp-cta-btn，非 gold）。
//      ⚠️ build-ics.mjs 目前**沒有**接進 npm run build 鏈，這顆連結假設 public/ics/
//      底下已經有對應檔案存在——沒跑過那支腳本就先 npm run build，urlcheck
//      （scripts/check-output.mjs 的資產參照檢查）會抓到連結指向不存在的檔案而讓建置失敗。
// 逐欄 fallback（講題整理中／日期待定…）、Event JSON-LD、前後場導覽全部沿用，沒有動。

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSite, getTalks, getTalkDisplayStatus } from '@/lib/content';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || '';
const COURSE_SHORT = 'AI未來應用與趨勢探索';
const COURSE_FULL = 'AI未來應用與趨勢探索：洄瀾的智慧未來';
const WALL_HREF = '/courses/11501-ai-future/#talks';

const MOE_LABELS = {
  b1_ethics: '倫理法律', b1_rights: '權益尊重', b2_risk: '資安風險',
  b2_verify: '資訊查核', b3_impact: '社會影響', b3_account: '人類當責',
  legal: '法律', ethical: '倫理', application: '應用' // 舊資料相容
};
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

function hasText(value) {
  return typeof value === 'string' && value.trim() !== '';
}

/** materials 逐筆檢查 label／url 都有字才收——半筆資料寧可不出，不放假連結 */
function listMaterials(talk) {
  const items = Array.isArray(talk?.materials) ? talk.materials : [];
  return items.filter((m) => m && hasText(m.label) && hasText(m.url));
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
  if (talk.status === 'tba') {
    // 講者還沒敲定的占位頁不進搜尋結果（設計計畫 §4.3「tba 詳情頁 noindex」）：
    // 頁面照樣建、站內連得到，只是不希望有人從 Google 搜到一頁空的。
    // follow 不關——頁內回海報牆、前後場的連結還是希望被跟著走。
    return {
      title: `第 ${no} 場演講（敬請期待）｜${COURSE_SHORT}`,
      description: `「${COURSE_FULL}」12 場系列演講第 ${no} 場，講者與講題確認後於本頁公布。`,
      robots: { index: false },
    };
  }
  // 講者已敲定、講題還沒回來：別再說「講者確認後公布」，那已經不是事實
  if (!talk.title) {
    const who = talk.speaker?.name ? `講者${talk.speaker.name}` : '講者';
    return {
      title: `第 ${no} 場演講（講題公布中）｜${COURSE_SHORT}`,
      description: `「${COURSE_FULL}」12 場系列演講第 ${no} 場，${who}已確認，講題確認後於本頁公布。`,
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
  // 顯示態衍生自資料＋建置當下的時刻（Asia/Taipei 11:30 為界，F1）：
  // 'ended'＝status 還是 confirmed 但已經過了那天 11:30；'done'＝資料上已回填。
  // 靜態站的「現在」＝建置時間，所以每週 cron 重建 main 才會讓這個態自己往前刷（§4.3 管線）。
  const display = getTalkDisplayStatus(talk, new Date());
  const isTba = display === 'tba';
  const isEnded = display === 'ended' || display === 'done';
  const jsonLd = buildEventJsonLd(talk);
  const dateText = formatDate(talk.date);
  const bio = hasText(talk.speaker?.bio) ? talk.speaker.bio.trim() : null;
  const materials = listMaterials(talk);
  const hasPoster = !isTba && hasText(talk.poster);

  return (
    <article className={hasPoster ? 'tdp has-poster' : 'tdp'}>
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
          {isEnded ? <span className="tdp-done">已結束</span> : null}
        </p>
        <h1>
          {talk.title
            ? talk.title
            : isTba
              ? `第 ${no} 場演講（敬請期待）`
              : '講題公布中'}
        </h1>
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

      {/* 有海報＝桌機雙欄（正文 7／海報 5）；沒海報＝這層自然收成單欄，不留空洞 */}
      <div className="tdp-body">
        <div className="tdp-col">
          {/* 已結束：先講一句過去式，讓人一眼知道自己看的是回顧、不是預告 */}
          {isEnded ? (
            <p className="tdp-past">
              {dateText
                ? `這場演講已經在 ${dateText}舉行完畢，這頁留著當天的場次資訊。`
                : '這場演講已經舉行完畢，這頁留著當天的場次資訊。'}
            </p>
          ) : null}

          {isTba || !talk.speaker?.name ? (
            <div className="tdp-ripple" role="status">
              講者確認後公布
              <br />
              <small>講者、講題與摘要確認後，會在本頁更新。</small>
            </div>
          ) : (
            <section className={bio ? 'tdp-speaker with-bio' : 'tdp-speaker'} aria-label="講者介紹">
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
                {/* 講者簡介：有寫才出現，沒寫就整段不渲染（不放「簡介整理中」這種占位空話） */}
                {bio
                  ? bio
                      .split(/\n+/)
                      .filter((p) => p.trim())
                      .map((p, i) => (
                        <p className="tdp-spk-bio" key={i}>{p}</p>
                      ))
                  : null}
                {/* 講者自己的連結（部落格、社群…）：講者主動要求放才有，沒有就整段不渲染 */}
                {talk.speaker.links?.length ? (
                  <ul className="tdp-spk-links">
                    {talk.speaker.links.map((l) => (
                      <li key={l.url}>
                        <a
                          href={l.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`${talk.speaker.name}的${l.label}（另開新分頁）`}
                        >
                          {l.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </section>
          )}

          {/* 已結束就換過去式標題；aria-label 跟著看得見的標題走，別讓報讀的字跟畫面對不上 */}
          {!isTba ? (
            <section aria-label={isEnded ? '這場講了什麼' : '演講摘要'}>
              <h2>{isEnded ? '這場講了什麼' : '演講摘要'}</h2>
              {talk.abstract ? (
                talk.abstract
                  .split(/\n+/)
                  .filter((p) => p.trim())
                  .map((p, i) => (
                    <p className="tdp-abstract" key={i}>{p}</p>
                  ))
              ) : (
                <div className="tdp-ripple">{isEnded ? '摘要整理中' : '摘要整理中，確認後公布'}</div>
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

          {/* 已結束才出講座資料：真的有東西才列清單，沒有就一句話帶過、絕不放假連結 */}
          {isEnded ? (
            <section aria-label="講座資料">
              <h2>講座資料</h2>
              {materials.length > 0 ? (
                <ul className="tdp-materials">
                  {materials.map((m) => (
                    <li key={m.url}>
                      <a href={m.url} target="_blank" rel="noopener noreferrer">{m.label}</a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="tdp-quiet">資料整理中。</p>
              )}
            </section>
          ) : null}
        </div>

        {hasPoster ? (
          <aside className="tdp-side" aria-label="演講海報">
            <div className="tdp-side-inner">
              <h2 className="tdp-side-title">演講海報</h2>
              <a href={`${BASE}${talk.poster}`} target="_blank" rel="noopener noreferrer" title="在新分頁開啟海報原圖">
                <img
                  className="tdp-poster"
                  src={`${BASE}${talk.poster}`}
                  alt={`第 ${no} 場演講海報${talk.title ? `：${talk.title}` : ''}`}
                  loading="lazy"
                />
              </a>
              <p className="tdp-note tdp-note-block">點海報可在新分頁開啟原圖。</p>
            </div>
          </aside>
        ) : null}
      </div>

      {/* 頁底行動：加入行事曆＋回海報牆（講者報名頁是講者自薦用、課程網不放候補鈕—Ted 2026-08-02） */}
      <section className="tdp-cta" aria-label="接下來">
        {/* 加入行事曆：只有講者已敲定且還沒過 11:30 結束線才顯示（W4-F、F1 拍板）。
            中性樣式沿用 tdp-cta-btn，gold 全站只留給教務系統選課那一顆（C6／C9）。 */}
        {display === 'confirmed' ? (
          <a className="tdp-cta-btn" href={`${BASE}/ics/${talk.id}.ics`}>
            加入行事曆（.ics）
          </a>
        ) : null}
                <Link className="tdp-cta-back" href={WALL_HREF}>看 12 場完整場次 →</Link>
      </section>

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
/* 海報進來才把版面加寬讓雙欄站得下；沒海報維持 820 的單欄閱讀寬 */
.tdp.has-poster { max-width: 1060px; }
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
.tdp-speaker.with-bio { align-items: flex-start; }
.tdp-spk-name { margin: 0; font-size: 18px; font-weight: 700; }
.tdp-spk-org { margin: 2px 0 0; font-size: 14px; color: var(--ink-60, #5B584F); }
.tdp-spk-bio { margin: 8px 0 0; font-size: 14.5px; line-height: 1.75; color: var(--ink-60, #5B584F); }
.tdp-spk-links { display: flex; gap: 8px; flex-wrap: wrap; list-style: none; margin: 8px 0 0; padding: 0; }
.tdp-spk-links a { display: inline-block; min-height: 32px; line-height: 24px; padding: 4px 12px; font-size: 13px; border: 1px solid var(--teal, #0E7C7B); color: var(--teal-deep, #07403F); border-radius: 999px; text-decoration: none; }
.tdp-spk-links a:hover { background: var(--teal-tint, #E3F1F0); }
.tdp-abstract { font-size: 15.5px; margin: 0 0 12px; }
.tdp-past { font-size: 14.5px; color: var(--ink-60, #5B584F); background: #ECE7D8; border-radius: var(--radius, 14px); padding: 12px 16px; margin: 0 0 18px; line-height: 1.8; }
.tdp-quiet { font-size: 14.5px; color: var(--ink-40, #8B8779); margin: 0; }
.tdp-worksheet-row { margin: 26px 0 6px; }
.tdp-worksheet { display: inline-block; background: var(--gold, #D9A441); color: #3D2E0B; font-weight: 700; text-decoration: none; padding: 12px 30px; border-radius: 999px; font-size: 16px; }
.tdp-worksheet:hover { filter: brightness(1.05); }
.tdp-note { font-size: 12.5px; color: var(--ink-40, #8B8779); margin-left: 8px; }
.tdp-poster { display: block; width: 100%; max-width: 480px; border: 1px solid var(--line, #E5DCC3); border-radius: var(--radius, 14px); }
.tdp-note-block { display: block; margin: 8px 0 0; }
.tdp-side-title { margin-top: 0 !important; }
.tdp-materials { margin: 0; padding-left: 20px; font-size: 15px; }
.tdp-materials li { margin-bottom: 6px; }
/* 頁底行動：中性樣式——gold 全站只留給「教務系統選課」那一顆（C6／C9） */
.tdp-cta { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 18px; margin: 34px 0 0; padding: 18px; background: var(--paper, #FDFAF2); border: 1px solid var(--line, #E5DCC3); border-radius: var(--radius, 14px); }
.tdp-cta-btn { display: inline-block; font-size: 15px; font-weight: 700; text-decoration: none; color: var(--teal-dark, #0A5958); background: transparent; border: 1.5px solid var(--teal, #0E7C7B); border-radius: 999px; padding: 11px 22px; }
.tdp-cta-btn:hover { background: var(--teal-tint, #E3F1F0); }
.tdp-cta-back { font-size: 14.5px; color: var(--teal-dark, #0A5958); }
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
/* 桌機雙欄：正文 7／海報 5，海報跟著捲動釘住。手機（含這條以下的寬度）維持單欄依序往下 */
@media (min-width: 860px) {
  .tdp.has-poster .tdp-body { display: grid; grid-template-columns: 7fr 5fr; gap: 32px; align-items: start; }
  .tdp.has-poster .tdp-side-inner { position: sticky; top: 76px; }
  .tdp.has-poster .tdp-poster { max-width: 100%; }
}
@media (max-width: 859px) {
  .tdp-side { display: block; margin-top: 26px; }
}
@media (max-width: 759px) {
  .tdp-worksheet { display: block; text-align: center; }
  .tdp-worksheet-row .tdp-note { display: block; margin: 6px 0 0; text-align: center; }
  .tdp-cta { flex-direction: column; align-items: stretch; text-align: center; }
  .tdp-cta-btn { display: block; }
}
@media print {
  .tdp-back, .tdp-worksheet-row, .tdp-cta, .tdp-nav { display: none !important; }
  .tdp-ripple { animation: none; background: none; }
  .tdp.has-poster .tdp-side-inner { position: static; }
}
`;
