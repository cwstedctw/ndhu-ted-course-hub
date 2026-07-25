import Link from 'next/link';
import Ripple from './Ripple';
import { asArray, hasText, withBase } from './pending';
import { getNextTalk, getTalkDisplayStatus } from '@/lib/content';

// 演講區主區塊 #talks（v3 W3-1，設計計畫 §4.3「版式 A 場刊卡」）
//
// 為什麼不是海報牆了：海報現在 0 張，2/3 直式比例撐出來的是 12 個空框。
// 版式 A 先把「場刊該有的字」排好（場次・日期・講題・講者・六面向），
// 海報到齊再切版式 C——globals.css §11-5 那套 .wall/.talk 樣式原封留著，這裡一行都不吃。
//
// 卡面三態（顯示態由 lib/content.js 的 getTalkDisplayStatus 衍生，不改資料）：
//   confirmed／next＝teal 左框＋gold 膠帶角，next 多一圈強調框（12 場裡只有一場）
//   ended／done＝低彩度＋「已結束」，不放任何假按鈕
//   tba＝mist 虛線＋水波占位，只寫「講者與日期確認後由管理台同步更新」，不放預測內容
//
// 時間地點只印一次：牆頭共用資訊列印眾數（每場 09:30・理工二館 ZT講堂 C101），
// 卡內不重複——只有「跟眾數不一樣」的那場才在卡上補印自己的時間／地點（例外才出聲）。

const MOE_LABELS = {
  b1_ethics: '倫理法律', b1_rights: '權益尊重', b2_risk: '資安風險',
  b2_verify: '資訊查核', b3_impact: '社會影響', b3_account: '人類當責',
  legal: '法律', ethical: '倫理', application: '應用' // 舊資料相容
};

// 六面向分三系：顏色分系、**再各配一個圖形符號**，不讓資訊只靠顏色傳達
const MOE_MARK = { b1: '◆', b2: '▲', b3: '●', other: '○' };

const STATE_TEXT = {
  next: '下一場',
  confirmed: '已確認',
  ended: '已結束',
  done: '已結束',
  tba: '講者洽談中',
};

const WEEK_EN = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

/** 'b1_ethics' → 'b1'；不認得的舊 key 歸 other（中性樣式，不假裝它屬於哪一系） */
function moeFamily(key) {
  const head = String(key).slice(0, 2);
  return head === 'b1' || head === 'b2' || head === 'b3' ? head : 'other';
}

/** '2026-10-30' → { md: '10.30', wd: 'FRI' }；用 UTC 解析避開建置機時區把日期算成前一天 */
function railDate(iso) {
  if (!hasText(iso)) return null;
  const m = iso.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const [, y, mo, d] = m;
  const wd = WEEK_EN[new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d))).getUTCDay()];
  return { md: `${Number(mo)}.${Number(d)}`, wd };
}

/** 取眾數（只看有字的值）；全空回 null。牆頭那行時間地點就是這樣算出來的，沒有硬編 */
function modeOf(values) {
  const tally = new Map();
  for (const v of values) {
    if (!hasText(v)) continue;
    const key = v.trim();
    tally.set(key, (tally.get(key) || 0) + 1);
  }
  let best = null;
  let bestCount = 0;
  for (const [key, count] of tally) {
    if (count > bestCount) {
      best = key;
      bestCount = count;
    }
  }
  return best;
}

export default function TalksWall({ talks, courseSlug }) {
  const list = asArray(talks)
    .filter((t) => t && hasText(t.id))
    .slice()
    .sort((a, b) => (a.no || 0) - (b.no || 0));
  if (list.length === 0) return null;

  // 「現在」只取一次，getNextTalk 與 getTalkDisplayStatus 共用同一個時刻，
  // 免得建置剛好跨過 11:30 時兩邊各判各的（一個說已結束、另一個還把它當下一場）
  const now = new Date();
  const nextId = getNextTalk(now)?.id ?? null;

  const total = list.length;
  const confirmedCount = list.filter((t) => t.status === 'confirmed' || t.status === 'done').length;

  // 牆頭共用資訊列：時間與地點的眾數（值來自 talks 資料，不寫死）
  const modeTime = modeOf(list.map((t) => t.time));
  const modeVenue = modeOf(list.map((t) => t.venue));
  const facts = [modeTime ? `每場 ${modeTime}` : null, modeVenue].filter(Boolean).join('・');

  const stateOf = (t) => {
    const state = getTalkDisplayStatus(t, now);
    return state === 'confirmed' && t.id === nextId ? 'next' : state;
  };

  return (
    <section id="talks" className="v3-talks">
      <div className="container">
        <h2>演講海報牆</h2>

        {/* 牆頭：共用資訊一行＋12 顆進度點＋已確認幾場。卡內不再重複印時間地點 */}
        <div className="v3-talks-head">
          {facts ? <p className="v3-talks-facts">{facts}</p> : null}
          <div className="v3-talks-rail">
            <ol className="v3-dots" aria-label={`${total} 場進度`}>
              {list.map((t) => {
                const state = stateOf(t);
                return (
                  <li key={t.id}>
                    <a className="v3-dot" data-state={state} href={`#talk-${t.id}`}>
                      <span className="sr-only">第 {t.no} 場・{STATE_TEXT[state]}</span>
                    </a>
                  </li>
                );
              })}
            </ol>
            <p className="v3-talks-count">
              已確認 <b>{confirmedCount}</b>/{total}
            </p>
          </div>
        </div>

        <ol className="v3-talk-wall">
          {list.map((t) => {
            const state = stateOf(t);
            const href = `/courses/${courseSlug}/talks/${t.id}/`;
            const isTba = state === 'tba';
            const when = railDate(t.date);
            const speaker = t.speaker || {};
            const roleLine = [speaker.title, speaker.org].filter(hasText).join('・');
            const moe = asArray(t.moe).filter(hasText);
            const materials = asArray(t.materials).filter((m) => m && hasText(m.label));
            // 例外才出聲：跟牆頭眾數一樣就不印（時間地點全牆只印一次）
            const oddWhen = [
              hasText(t.time) && t.time.trim() !== modeTime ? t.time.trim() : null,
              hasText(t.venue) && t.venue.trim() !== modeVenue ? t.venue.trim() : null,
            ].filter(Boolean).join('・');

            return (
              <li key={t.id} id={`talk-${t.id}`} className="v3-talk" data-state={state}>
                {/* 日期軌 */}
                <p className="v3-talk-head">
                  <span className="v3-talk-no">
                    T{String(t.no ?? 0).padStart(2, '0')}<i>/{total}</i>
                  </span>
                  {when ? (
                    <time className="v3-talk-when" dateTime={t.date}>
                      {when.md} <i>{when.wd}</i>
                    </time>
                  ) : (
                    <span className="v3-talk-when is-pending">日期待定</span>
                  )}
                  <span className="v3-talk-badge">{STATE_TEXT[state]}</span>
                </p>

                {/* 主資訊 */}
                <h3 className="v3-talk-title">
                  <Link href={href}>
                    {hasText(t.title) ? t.title : isTba ? `第 ${t.no} 場` : '講題公布中'}
                  </Link>
                </h3>

                {isTba ? (
                  <Ripple style={{ margin: 0 }}>講者與日期確認後由管理台同步更新</Ripple>
                ) : (
                  <>
                    {hasText(speaker.name) ? (
                      <p className="v3-talk-spk">
                        <strong>{speaker.name}</strong>
                        {roleLine ? <span className="v3-talk-role">{roleLine}</span> : null}
                      </p>
                    ) : null}
                    {oddWhen ? <p className="v3-talk-odd">{oddWhen}</p> : null}
                    {moe.length > 0 ? (
                      <ul className="v3-talk-tags" aria-label="負責任 AI 面向">
                        {moe.map((m) => (
                          <li key={m} className="v3-talk-tag" data-fam={moeFamily(m)}>
                            <i aria-hidden="true">{MOE_MARK[moeFamily(m)]}</i>
                            {MOE_LABELS[m] || m}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </>
                )}

                {/* 行動列：看詳情永遠在；海報有才給；講座資料只在結束後且真的有東西才顯示 */}
                <p className="v3-talk-acts">
                  <Link className="v3-talk-go" href={href}>
                    看詳情 →<span className="sr-only">：第 {t.no} 場</span>
                  </Link>
                  {hasText(t.poster) ? (
                    <a
                      className="v3-talk-act"
                      href={withBase(t.poster)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      看海報 ↗<span className="sr-only">（第 {t.no} 場，另開新分頁）</span>
                    </a>
                  ) : null}
                  {(state === 'ended' || state === 'done') && materials.length > 0 ? (
                    <span className="v3-talk-mat">講座資料 {materials.length} 份</span>
                  ) : null}
                </p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
