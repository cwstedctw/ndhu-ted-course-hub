import Ripple from './Ripple';
import { asArray, hasText, isPending } from './pending';

// 區塊 4：週次三部曲時間軸（#weeks，設計書二章 §4.3 區塊 4、五章 §4.6）
// 週數與區塊標題一律動態吃 weeksSystem 與資料列（不硬編 17 週）；
// weeklyPlan 逐列迭代（w 可為區間字串）、milestone 醒目節點；
// weeklyPlan pending → 只畫 phases 三段＋「週次表開學前公布」。
export default function Timeline({ weeksSystem, phases, weeklyPlan }) {
  const phasesPending = isPending(phases);
  const planPending = isPending(weeklyPlan);
  const phaseList = asArray(phases).filter((p) => hasText(p?.title));
  const rows = asArray(weeklyPlan).filter((r) => hasText(r?.label));

  if (!phasesPending && !planPending && phaseList.length === 0 && rows.length === 0) return null;

  const ws = hasText(weeksSystem) ? weeksSystem : null;
  const title = `${ws ? `${ws}・` : ''}課程怎麼走${phaseList.length === 3 ? '（三部曲）' : ''}`;

  const weekChip = (r) => (
    <span key={`${r.w}-${r.label}`} className={r.milestone ? 'ms' : undefined}>
      {hasText(String(r.w ?? '')) ? `W${r.w} ` : ''}
      {r.label}
    </span>
  );

  return (
    <section id="weeks" aria-label={`${ws || ''}課程進度`}>
      <div className="container">
        <h2>{title}</h2>
        {phaseList.length > 0 ? (
          <>
            <div className="phases">
              {phaseList.map((p) => {
                const weekRows = rows.filter((r) => r.part === p.id);
                return (
                  <div className="phase" key={p.id ?? p.title}>
                    {hasText(p.weeks) ? <span className="wk">{p.weeks}</span> : null}
                    <h4>{p.title}</h4>
                    {hasText(p.body) ? <p>{p.body}</p> : null}
                    {weekRows.length > 0 ? <div className="weeks">{weekRows.map(weekChip)}</div> : null}
                  </div>
                );
              })}
            </div>
            {planPending ? (
              <Ripple style={{ marginTop: 12, padding: '14px 16px' }}>週次表開學前公布</Ripple>
            ) : null}
          </>
        ) : rows.length > 0 ? (
          <div className="weeks">{rows.map(weekChip)}</div>
        ) : (
          <Ripple>週次進度規劃開學前公布</Ripple>
        )}
      </div>
    </section>
  );
}
