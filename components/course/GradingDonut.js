import Ripple from './Ripple';
import { asArray, hasText, isPending } from './pending';

// 區塊 3：評分比例環（#grading，設計書二章 §4.3 區塊 3、五章 §4.5）
// SVG 甜甜圈用 stroke-dasharray 畫扇區（aria-hidden，純視覺）；
// 可見圖例清單才是語意真身（色點＋pct＋label＋sub）。grading pending → 水波占位。

const SEGMENT_COLORS = [
  'var(--teal-mid, #5FB3B0)',
  'var(--teal, #0E7C7B)',
  'var(--gold, #D9A441)',
  'var(--teal-deep, #07403F)',
];
const R = 60;
const CIRC = 2 * Math.PI * R; // 約 376.99

export default function GradingDonut({ grading, gradingNote }) {
  const pending = isPending(grading);
  const items = asArray(grading).filter((g) => typeof g?.pct === 'number' && hasText(g?.label));
  if (!pending && items.length === 0) return null;

  let acc = 0;
  const segments = items.map((g, i) => {
    const len = (g.pct / 100) * CIRC;
    const seg = { ...g, len, offset: -acc, color: SEGMENT_COLORS[i % SEGMENT_COLORS.length] };
    acc += len;
    return seg;
  });
  const total = items.reduce((sum, g) => sum + g.pct, 0);

  return (
    <section id="grading">
      <div className="container">
        <h2>成績怎麼算</h2>
        {pending ? (
          <Ripple>評分方式開學前公布</Ripple>
        ) : (
          <>
            <div className="grading">
              <svg width="170" height="170" viewBox="0 0 170 170" aria-hidden="true" focusable="false">
                <g transform="rotate(-90 85 85)">
                  {segments.map((s, i) => (
                    <circle
                      key={i}
                      cx="85"
                      cy="85"
                      r={R}
                      fill="none"
                      stroke={s.color}
                      strokeWidth="26"
                      strokeDasharray={`${s.len.toFixed(2)} ${(CIRC - s.len).toFixed(2)}`}
                      strokeDashoffset={s.offset.toFixed(2)}
                    />
                  ))}
                </g>
                <text
                  x="85"
                  y="90"
                  textAnchor="middle"
                  fontSize="15"
                  fill="var(--ink, #1A1A1A)"
                  fontWeight="bold"
                >
                  {total}%
                </text>
              </svg>
              <ul className="legend">
                {segments.map((s, i) => (
                  <li key={i}>
                    <span className="sw" style={{ background: s.color }} aria-hidden="true" />
                    <span>
                      <b>{s.pct}%</b> {s.label}
                      {hasText(s.sub) ? (
                        <>
                          {' '}
                          <small>{s.sub}</small>
                        </>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            {hasText(gradingNote) ? <p className="note">{gradingNote}</p> : null}
          </>
        )}
      </div>
    </section>
  );
}
