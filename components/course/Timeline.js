import Ripple from './Ripple';
import Bi from './Bi';
import { asArray, hasText, isPending } from './pending';

// 區塊 4：週次三部曲時間軸（#weeks，設計書二章 §4.3 區塊 4、五章 §4.6）
// 週數與區塊標題一律動態吃 weeksSystem 與資料列（不硬編 17 週）；
// weeklyPlan 逐列迭代（w 可為區間字串）、milestone 醒目節點；
// weeklyPlan pending → 只畫 phases 三段＋「週次表開學前公布」。
// weekOneStart（site.json，W1 週一日期）有值時掛 NowWeek client component：
// 學期中訪客最常問「這週上什麼」，高亮本週 chip＋標題下出「本週 W6：…」
// 一行（2026-07-05 學生視角升級）。null＝休眠（SSG 靜態不變）。
import NowWeek from './NowWeek';

// scheduleNote＝該「班」專屬的行事曆註記（sections[].scheduleNote），不是全課共用：
// AA 遇國定假日採「停課週與鄰近週合併為一週、內容序不變」（2026-08-26 Ted 拍板），
// AB 正常 17 週故為 null。週次表本身是 AA／AB 共用正本，所以合併規則只能掛在班別層。
export default function Timeline({ weeksSystem, phases, weeklyPlan, weekOneStart, scheduleNote, scheduleNoteEn, L, en = {} }) {
  const phasesPending = isPending(phases);
  const planPending = isPending(weeklyPlan);
  const phaseList = asArray(phases).filter((p) => hasText(p?.title));
  const rows = asArray(weeklyPlan).filter((r) => hasText(r?.label));

  if (!phasesPending && !planPending && phaseList.length === 0 && rows.length === 0) return null;

  const ws = hasText(weeksSystem) ? weeksSystem : null;
  const wsShown = L.isEn && hasText(en?.weeksSystem) ? en.weeksSystem : ws;
  const title = L.isEn
    ? `${wsShown ? `${wsShown} · ` : ''}${L.c('headWeeks', '課程怎麼走')}${
        phaseList.length === 3 ? ` (${L.c('headWeeksParts', '三部曲')})` : ''
      }`
    : `${ws ? `${ws}・` : ''}課程怎麼走${phaseList.length === 3 ? '（三部曲）' : ''}`;

  // 英文週標與中文 weeklyPlan **索引對齊**（validate #20 逐筆比長度，對不齊直接 fail）
  const enWeeks = asArray(en?.weeklyPlan);
  const enPhases = asArray(en?.phases);
  const rowIndexOf = (r) => rows.indexOf(r);

  const weekChip = (r) => (
    <span key={`${r.w}-${r.label}`} className={r.milestone ? 'ms' : undefined} data-w={String(r.w ?? '')}>
      {hasText(String(r.w ?? '')) ? `W${r.w} ` : ''}
      <Bi s={L.t(enWeeks[rowIndexOf(r)], r.label)} />
    </span>
  );

  const nowEnabled = hasText(weekOneStart) && rows.length > 0;

  return (
    <section id="weeks" aria-label={`${ws || ''}課程進度`}>
      <div className="container">
        <h2>{title}</h2>
        {nowEnabled ? <NowWeek weekOneStart={weekOneStart} /> : null}
        {phaseList.length > 0 ? (
          <>
            <div className="phases">
              {phaseList.map((p, pi) => {
                const weekRows = rows.filter((r) => r.part === p.id);
                const ep = enPhases[pi];
                return (
                  <div className="phase" key={p.id ?? p.title}>
                    {hasText(p.weeks) ? <span className="wk">{ep?.weeks || p.weeks}</span> : null}
                    <Bi as="h4" s={L.t(ep?.title, p.title)} />
                    {hasText(p.body) ? <Bi as="p" s={L.t(ep?.body, p.body)} /> : null}
                    {weekRows.length > 0 ? <div className="weeks">{weekRows.map(weekChip)}</div> : null}
                  </div>
                );
              })}
            </div>
            {planPending ? (
              <Ripple style={{ marginTop: 12, padding: '14px 16px' }}>
                {L.c('weeksPending', '週次表開學前公布')}
              </Ripple>
            ) : null}
          </>
        ) : rows.length > 0 ? (
          <div className="weeks">{rows.map(weekChip)}</div>
        ) : (
          <Ripple>{L.c('weeksPending', '週次進度規劃開學前公布')}</Ripple>
        )}
        {hasText(scheduleNote) ? (
          <Bi as="p" className="note" s={L.t(scheduleNoteEn, scheduleNote)} />
        ) : null}
      </div>
    </section>
  );
}
