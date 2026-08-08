import Link from 'next/link';
import { asArray, hasText, withBase } from './pending';

// 演講課變體主區塊：12 場海報牆（#talks，設計書二章 §4.4、五章 §4.9）
// 錨點 #talks 承接 /talks/ 轉址殼。三態卡：
//   confirmed＝完整卡（海報／講題／講者／日期；time、venue null → 「時間待定」「地點待定」小字）
//   tba＝水波占位卡（第 N 場＋「講者確認後公布」），仍可點入占位詳情頁（t01–t12 全建）
//   done＝已結束角標＋materials 非空加「講座資料」標
// 整卡連到 /courses/{slug}/talks/{id}/；MOE 指標中文對照：legal 法律／ethical 倫理／application 應用。

const MOE_LABELS = {
  b1_ethics: '倫理法律', b1_rights: '權益尊重', b2_risk: '資安風險',
  b2_verify: '資訊查核', b3_impact: '社會影響', b3_account: '人類當責',
  legal: '法律', ethical: '倫理', application: '應用' // 舊資料相容
};

export default function TalksWall({ talks, courseSlug }) {
  const list = asArray(talks)
    .filter((t) => t && hasText(t.id))
    .slice()
    .sort((a, b) => (a.no || 0) - (b.no || 0));
  if (list.length === 0) return null;

  // 全場皆 tba → 緊湊模式（.wall-tba-all，globals §11-5）：佔位卡不吃 2/3 海報比例，
  // 12 格一屏看完；任何一場公布講者即回滿版海報牆
  const allTba = list.every((t) => t.status === 'tba');

  return (
    <section id="talks">
      <div className="container">
        <h2>演講海報牆</h2>
        {allTba ? <p className="note" style={{ margin: '0 0 10px' }}>12 場講者洽談中——確認一場、揭一張海報。</p> : null}
        <div className={allTba ? 'wall wall-tba-all' : 'wall'}>
          {list.map((t) => {
            const href = `/courses/${courseSlug}/talks/${t.id}/`;

            if (t.status === 'tba') {
              return (
                <Link
                  key={t.id}
                  className="talk tba"
                  href={href}
                  aria-label={`第 ${t.no} 場：講者洽談中`}
                >
                  <div className="ripple" style={{ border: 0 }}>
                    第 {t.no} 場
                    <br />
                    講者確認後公布
                  </div>
                </Link>
              );
            }

            const done = t.status === 'done';
            const dateText = hasText(t.date) ? t.date : '日期待定';
            const title = hasText(t.title) ? t.title : '講題公布中';
            const speakerLine = [t.speaker?.name, t.speaker?.title, t.speaker?.org]
              .filter(hasText)
              .join('・');
            const moe = asArray(t.moe).filter(hasText);

            return (
              <Link
                key={t.id}
                className={`talk${done ? ' done' : ''}`}
                href={href}
                aria-label={`第 ${t.no} 場：${title}（${dateText}${done ? '・已結束' : ''}）`}
              >
                {hasText(t.poster) ? (
                  <img
                    src={withBase(t.poster)}
                    alt={`第 ${t.no} 場講座海報：${title}`}
                    loading="lazy"
                    style={{
                      width: '100%',
                      // A3 直式（297×420，出血後 1400×1969）＝現行海報規格。
                      // ⚠️ 不可用 cover：舊寫法固定 2/3＋cover，把 A3 比例的海報左右各裁掉
                      //    約 2.4%（共 4.6–4.8%），切到左脊的直排課程名與場次序號。
                      //    改 contain：兩種比例都完整顯示，最多留一點留白，不切設計。
                      aspectRatio: '1400 / 1969',
                      objectFit: 'contain',
                      background: 'var(--paper, #FDFAF2)',
                      display: 'block',
                      ...(done ? { filter: 'grayscale(0.35)' } : null),
                    }}
                  />
                ) : null}
                <div className="top">
                  <span>第 {t.no} 場</span>
                  <span>{dateText}</span>
                </div>
                <div className="body">
                  <h4>{title}</h4>
                  {speakerLine ? <span className="spk">{speakerLine}</span> : null}
                  <span className="spk">
                    {hasText(t.time) ? t.time : '時間待定'}・{hasText(t.venue) ? t.venue : '地點待定'}
                  </span>
                  {done ? (
                    <span className="tag-done">
                      已結束{asArray(t.materials).length > 0 ? '・講座資料' : ''}
                    </span>
                  ) : null}
                  {moe.length > 0 ? (
                    <div className="moe">
                      {moe.map((m) => (
                        <span key={m}>{MOE_LABELS[m] || m}</span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
