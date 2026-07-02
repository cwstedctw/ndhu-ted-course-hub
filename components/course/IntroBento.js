import Ripple from './Ripple';
import { asArray, hasText, isPending } from './pending';

// 區塊 2：課程介紹 Bento（#intro，設計書二章 §4.3 區塊 2、五章 §4.4）
// 卡片：① promise 主卡（含 chips 核心技能）② 終點三步驟 ③ 作業量預告卡。
// 任一來源 pending → 該卡水波占位；全部缺 → 整區不渲染。
export default function IntroBento({ intro }) {
  const promise = hasText(intro?.promise) ? intro.promise : null;
  const promisePending = isPending(intro?.promise);
  const chips = asArray(intro?.chips).filter(hasText);

  const destination = intro?.destination;
  const destinationPending = isPending(destination);
  const steps = asArray(destination?.steps).filter((s) => hasText(s?.label));

  // 作業量預告：優先引 FAQ 的作業量條目（status=confirmed），其次由 grading 的作業占比組句
  const faqHomework = asArray(intro?.faq).find(
    (f) => f?.status === 'confirmed' && hasText(f?.q) && f.q.includes('作業量') && hasText(f?.a)
  );
  const gradingHomework = asArray(intro?.grading).find(
    (g) => hasText(g?.label) && g.label.includes('作業') && typeof g?.pct === 'number'
  );
  const homeworkText = faqHomework
    ? faqHomework.a
    : gradingHomework
      ? `${gradingHomework.label}佔總成績 ${gradingHomework.pct}%${hasText(gradingHomework.sub) ? `，${gradingHomework.sub}` : ''}。`
      : null;
  const homeworkPending = !homeworkText && (isPending(intro?.grading) || isPending(intro?.faq));

  const cards = [];

  if (promise || chips.length > 0) {
    cards.push(
      <div className="card" key="promise">
        {promise ? <h4>{promise}</h4> : null}
        {chips.length > 0 ? (
          <ul className="chips">
            {chips.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        ) : null}
        {hasText(intro?.phasesNote) ? <p>{intro.phasesNote}</p> : null}
      </div>
    );
  } else if (promisePending) {
    cards.push(<Ripple key="promise">課程主軸開學前公布</Ripple>);
  }

  if (destinationPending) {
    cards.push(<Ripple key="destination">課程終點說明開學前公布</Ripple>);
  } else if (destination && (hasText(destination.title) || steps.length > 0)) {
    cards.push(
      <div className="card" key="destination">
        {hasText(destination.title) ? <h4>{destination.title}</h4> : null}
        {hasText(destination.sub) ? <p>{destination.sub}</p> : null}
        {steps.length > 0 ? (
          <ol className="steps">
            {steps.map((s) => (
              <li key={s.label}>
                <b>{s.label}</b>
                {hasText(s.sub) ? s.sub : null}
              </li>
            ))}
          </ol>
        ) : null}
      </div>
    );
  }

  if (homeworkText) {
    cards.push(
      <div className="card" key="homework">
        <h4>作業量預告</h4>
        <p>{homeworkText}</p>
      </div>
    );
  } else if (homeworkPending) {
    cards.push(<Ripple key="homework">作業量預告開學前公布</Ripple>);
  }

  if (cards.length === 0) return null;

  return (
    <section id="intro">
      <div className="container">
        <h2>這門課帶你去哪</h2>
        <div className="bento">{cards}</div>
      </div>
    </section>
  );
}
