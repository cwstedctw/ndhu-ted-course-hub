// /courses/11501-ai-future/talks/ 議程索引頁（W4-G 升級：轉址殼 → 真頁面）
//
// 舊版（2026-07-02 定案）是純轉址殼：JS location.replace／meta refresh／手動連結三層保險，
// 一律跳回課程頁海報牆錨點 ../#talks，不建索引子頁。這次升級成真正的頁面：
//   ・頁首＝課名＋「已確認 N/12」＋候補 CTA（官方連結原則 F2–F5、C2：只把去處講清楚，
//     不解釋候補機制）。
//   ・12 場直式時間軸清單：每列＝日期軌（場次編號＋日期）＋「講題・講者」一行＋狀態徽章，
//     整列可點連到單場詳情頁——資料語彙沿用 components/course/TalksWall.js 的三態場刊卡，
//     但排成緊湊的清單版（設計計畫 §4.3、C2/C6）。
//   ・不再是轉址殼：拿掉 noindex 與 meta refresh，這頁本身可被索引、也可被分享。
//
// 資料一律走 lib/content.js 的 getTalks()／getCourses()／getTalkDisplayStatus()／getNextTalk()，
// 頁面不自己讀檔、不寫第二份場次事實（C7）。
//
// 樣式全部在 app/v3-extra.css（本軌新檔，class 前綴 .v3-agenda-*／.v3-search-*）——
// 這支頁面只掛 className，不內嵌 <style>；v3-extra.css 需要 app/layout.js 補一行
// import（那份檔案本軌不能動，交給洄瀾接線，見回報）。

import Link from 'next/link';
import { getSite, getTalks, getCourses, getTalkDisplayStatus, getNextTalk } from '@/lib/content';
import { asArray, hasText } from '@/components/course/pending';

const COURSE_SHORT = 'AI未來應用與趨勢探索';
const COURSE_FULL = 'AI未來應用與趨勢探索：洄瀾的智慧未來';
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

const STATE_TEXT = {
  next: '下一場',
  confirmed: '已確認',
  ended: '已結束',
  done: '已結束',
  tba: '講者洽談中',
};

/* ── 資料存取（容錯：getTalks() 可能回整份物件或純陣列，同 [id]/page.js 的做法） ── */

function listTalks() {
  const data = getTalks();
  const talks = Array.isArray(data) ? data : data && Array.isArray(data.talks) ? data.talks : [];
  return talks
    .filter((t) => t && hasText(t.id))
    .slice()
    .sort((a, b) => talkNo(a) - talkNo(b));
}

function talkNo(talk) {
  if (typeof talk.no === 'number') return talk.no;
  const digits = String(talk.id || '').replace(/\D/g, '');
  return digits ? Number(digits) : 0;
}

/** courses.json 反查 talks.json 的 courseDir 對到哪個 slug（單班課，這裡固定會查到 11501-ai-future，
 *  但不寫死路徑——跟 components/home/model.js 的 buildTalkSpotlight() 同一個查法）。 */
function courseSlugOf(courseDir) {
  const index = getCourses();
  const list = asArray(index?.courses);
  const entry = list.find((c) => c && c.courseDir === courseDir);
  return entry?.slug ?? courseDir;
}

/** '2026-10-30' → { md: '10.30', wd: '五' }；用 UTC 解析避開建置機時區把日期算成前一天
 *  （同 TalksWall.js 的 railDate，這裡回中文週幾字方便清單直接印） */
function railDate(iso) {
  if (!hasText(iso)) return null;
  const m = String(iso).trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const [, y, mo, d] = m;
  const wd = WEEKDAYS[new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d))).getUTCDay()];
  return { md: `${Number(mo)}.${Number(d)}`, wd };
}

/** 清單一行的主文字：「講題・講者」；tba／講題還沒回來就退回中性占位（不腦補預測內容） */
function mainLine(talk, state) {
  const no = talkNo(talk);
  const title = hasText(talk.title) ? talk.title : state === 'tba' ? `第 ${no} 場` : '講題公布中';
  const speakerName = talk.speaker?.name;
  if (state === 'tba' || !hasText(speakerName)) return title;
  return `${title}・${speakerName}`;
}

export function generateMetadata() {
  return {
    title: `議程總覽｜${COURSE_SHORT}`,
    description: `「${COURSE_FULL}」12 場系列演講完整議程：日期、講者與確認狀態一覽。`,
  };
}

export default async function TalksIndexPage() {
  const data = getTalks();
  const talks = listTalks();
  const site = getSite();
  const courseSlug = courseSlugOf(data?.courseDir);
  const courseHref = `/courses/${courseSlug}/`;

  // 「現在」只取一次，getNextTalk 與 getTalkDisplayStatus 共用同一個時刻
  // （同 TalksWall.js 的做法，免得建置剛好跨過 11:30 兩邊各判各的）
  const now = new Date();
  const nextId = getNextTalk(now)?.id ?? null;
  const total = talks.length;
  const confirmed = talks.filter((t) => t.status === 'confirmed' || t.status === 'done').length;
  const waitlistUrl = site?.waitlistUrl;
  const hasWaitlist = hasText(waitlistUrl);

  const stateOf = (t) => {
    const state = getTalkDisplayStatus(t, now);
    return state === 'confirmed' && t.id === nextId ? 'next' : state;
  };

  return (
    <article className="v3-agenda">
      <p>
        <Link className="v3-agenda-back" href={courseHref}>← 回課程頁</Link>
      </p>

      <header className="v3-agenda-head">
        <p className="v3-agenda-course">{COURSE_FULL}</p>
        <h1>議程總覽</h1>
        <p className="v3-agenda-stat">
          已確認 <b>{confirmed}</b>/{total} 場
        </p>
        {hasWaitlist ? (
          <a className="v3-btn v3-btn-outline" href={waitlistUrl} target="_blank" rel="noopener noreferrer">
            演講課候補登記 ↗（外部表單）<span className="sr-only">（另開新視窗）</span>
          </a>
        ) : null}
      </header>

      <ol className="v3-agenda-list">
        {talks.map((t) => {
          const state = stateOf(t);
          const no = talkNo(t);
          const href = `/courses/${courseSlug}/talks/${t.id}/`;
          const rail = railDate(t.date);

          return (
            <li key={t.id} className="v3-agenda-row" data-state={state}>
              <Link className="v3-agenda-link" href={href}>
                <span className="v3-agenda-when">
                  <span className="v3-agenda-no">T{String(no).padStart(2, '0')}</span>
                  {rail ? (
                    <time className="v3-agenda-date" dateTime={t.date}>
                      {rail.md}
                      <i> 週{rail.wd}</i>
                    </time>
                  ) : (
                    <span className="v3-agenda-date is-pending">日期待定</span>
                  )}
                </span>
                <span className="v3-agenda-title">{mainLine(t, state)}</span>
                <span className="v3-agenda-badge">{STATE_TEXT[state]}</span>
              </Link>
            </li>
          );
        })}
      </ol>

      <p className="v3-agenda-foot">
        <Link href={courseHref}>回課程頁 →</Link>
      </p>
    </article>
  );
}
