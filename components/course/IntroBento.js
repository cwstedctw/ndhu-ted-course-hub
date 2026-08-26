import Ripple from './Ripple';
import Bi from './Bi';
import { asArray, hasText, isPending } from './pending';

// 區塊 2：課程介紹 Bento（#intro，設計書二章 §4.3 區塊 2、五章 §4.4）
// 卡片：① promise 主卡（含 chips 核心技能）② 終點三步驟 ③ 作業量預告卡。
// 任一來源 pending → 該卡水波占位；全部缺 → 整區不渲染。
export default function IntroBento({ intro, L, en = {} }) {
  const promise = hasText(intro?.promise) ? intro.promise : null;
  const promisePending = isPending(intro?.promise);
  const chips = asArray(intro?.chips).filter(hasText);
  const enChips = asArray(en?.chips);

  const destination = intro?.destination;
  const destinationPending = isPending(destination);
  const steps = asArray(destination?.steps).filter((s) => hasText(s?.label));
  const enSteps = asArray(en?.destination?.steps);

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
  // 英文版同樣優先引 FAQ 的作業量條目（索引對齊由 validate #20 保證）
  const faqIdx = asArray(intro?.faq).findIndex((f) => f === faqHomework);
  const homeworkTextEn = faqHomework && faqIdx >= 0 ? asArray(en?.faq)[faqIdx]?.a : null;
  const homeworkPending = !homeworkText && (isPending(intro?.grading) || isPending(intro?.faq));

  const cards = [];

  if (promise || chips.length > 0) {
    cards.push(
      <div className="card" key="promise">
        {promise ? <Bi as="h4" s={L.t(en?.promise, promise)} /> : null}
        {chips.length > 0 ? (
          <ul className="chips">
            {chips.map((c, i) => (
              <li key={c}>
                <Bi s={L.t(enChips[i], c)} />
              </li>
            ))}
          </ul>
        ) : null}
        {hasText(intro?.phasesNote) ? <Bi as="p" s={L.t(en?.phasesNote, intro.phasesNote)} /> : null}
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
        {hasText(destination.title) ? (
          <Bi as="h4" s={L.t(en?.destination?.title, destination.title)} />
        ) : null}
        {hasText(destination.sub) ? (
          <Bi as="p" s={L.t(en?.destination?.sub, destination.sub)} />
        ) : null}
        {steps.length > 0 ? (
          <ol className="steps">
            {steps.map((s, i) => (
              <li key={s.label}>
                <Bi as="b" s={L.t(enSteps[i]?.label, s.label)} />
                {hasText(s.sub) ? <Bi s={L.t(enSteps[i]?.sub, s.sub)} /> : null}
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
        <h4>{L.c('cardHomework', '作業量預告')}</h4>
        <Bi as="p" s={L.t(homeworkTextEn, homeworkText)} />
      </div>
    );
  } else if (homeworkPending) {
    cards.push(<Ripple key="homework">作業量預告開學前公布</Ripple>);
  }

  if (cards.length === 0) return null;

  return (
    <section id="intro">
      <div className="container">
        <h2>{L.c('headIntro', '這門課帶你去哪')}</h2>
        <div className="bento">{cards}</div>
      </div>
    </section>
  );
}
