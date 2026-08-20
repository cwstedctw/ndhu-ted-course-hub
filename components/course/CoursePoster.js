import Link from 'next/link';
import { asArray, hasText, withBase } from './pending';

// 演講課變體：整門課一張的課程總海報。
// 2026-08-20 起（Ted 拍板）它就是演講區的「唯一入口」：海報上 12 格講者照片可以直接點，
// 點誰就進誰那場的詳情頁——原本「12 張海報牆＋總海報」兩區同頁太吵，同樣的 12 場出現兩次。
// 單場海報沒有消失：各自住在 /talks/tXX/ 詳情頁裡。
//
// 點擊區座標來自 public/images/courses/11501-ai-future-poster-map.json——
// 與海報同一次渲染由 make_course_poster.py 實量產出（百分比，縮放不走位），別手改。
// map 或 talks 缺 → 回退成純靜態海報區（下學期海報還沒出時，課程頁會改租 12 張海報牆）。
//
// ⚠️ 比例與單場海報同規格：A3 直式 297×420，出血後 1400×1969。用 contain 不用 cover——
//    cover 會把左脊那行直排課程名切掉（單場海報踩過這個坑，見 TalksWall 註解）。
// ⚠️ 置中單欄，不要做成「圖左、字右」：Ted 2026-08-18 實看退回——
//    海報是直式長條，旁邊擺三行字會讓整區右半邊塌一大片空白。

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

function mdw(iso) {
  // '2026-09-18' → '09/18（週五）'；解析失敗就原樣回傳，不腦補
  if (!hasText(iso)) return null;
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  const [, m, day] = iso.split('-');
  return `${m}/${day}（週${WEEKDAYS[d.getUTCDay()]}）`;
}

export default function CoursePoster({ poster, courseName, talks, courseSlug, map }) {
  if (!hasText(poster)) return null;
  const src = withBase(poster);

  // 點擊格：map 的 cell 依 id 對回 talks.json（標題、狀態走 talks 真值，海報過期也不會標錯）
  const talkById = new Map(asArray(talks).filter((t) => t && hasText(t.id)).map((t) => [t.id, t]));
  const cells = asArray(map?.cells)
    .map((c) => ({ ...c, talk: talkById.get(c.id) }))
    .filter((c) => c.talk && hasText(courseSlug));
  const interactive = cells.length > 0;

  return (
    <section id={interactive ? 'talks' : 'course-poster'}>
      <style>{`
.cposter { display: block; }
.cposter-fig { position: relative; margin: 0 auto 14px; width: min(680px, 100%); }
.cposter-fig img { display: block; width: 100%; height: auto; aspect-ratio: 1400 / 1969;
  object-fit: contain; background: var(--paper, #FDFAF2);
  border: 1px solid var(--line, #E5DCC3); border-radius: var(--radius, 14px); }
.cposter-hot { position: absolute; display: block; border-radius: 8px; }
.cposter-hot:hover, .cposter-hot:focus-visible {
  outline: 3px solid var(--gold-500, #D9A441); outline-offset: 2px;
  background: rgba(255, 253, 248, 0.16); }
.cposter-chip { position: absolute; right: 4px; top: 4px; font-size: 11px; line-height: 1;
  padding: 4px 7px; border-radius: 999px;
  background: var(--ink-700, #4A463D); color: var(--surface-000, #FFFDF8); opacity: 0.92; }
.cposter-txt { max-width: 44em; margin: 0 auto; text-align: center; }
.cposter-txt p { margin: 0 0 10px; }
.cposter-list { max-width: 44em; margin: 0 auto 12px; text-align: left; }
.cposter-list summary { cursor: pointer; text-align: center; }
.cposter-list ol { margin: 10px 0 0; padding-left: 1.6em; }
.cposter-list li { margin: 5px 0; }
.cposter-list .done { color: var(--ink-60, #5B584F); }
@media (max-width: 560px) { .cposter-fig { width: 100%; } }
      `}</style>
      <div className="container">
        {/* 舊深連結 #course-poster 別斷：互動模式時 section id 讓給 #talks（/talks/ 轉址殼指它） */}
        {interactive ? <span id="course-poster" aria-hidden="true" /> : null}
        <h2>{interactive ? '十二場專題演講' : '課程總海報'}</h2>
        <div className="cposter">
          <figure className="cposter-fig">
            {interactive ? (
              <img
                src={src}
                alt={`${courseName || '本課程'}總海報：十二場專題演講的講者、日期與講題一覽`}
                width="1400"
                height="1969"
              />
            ) : (
              <a href={src} target="_blank" rel="noopener noreferrer">
                <img
                  src={src}
                  alt={`${courseName || '本課程'}總海報：十二場專題演講的講者、日期與講題一覽`}
                  width="1400"
                  height="1969"
                  loading="lazy"
                />
              </a>
            )}
            {interactive
              ? cells.map((c) => {
                  const t = c.talk;
                  const done = t.status === 'done';
                  const title = hasText(t.title) ? t.title : '講題公布中';
                  const label =
                    t.status === 'tba'
                      ? `第 ${t.no} 場：講者確認後公布`
                      : `第 ${t.no} 場：${title}（${mdw(t.date) || '日期待定'}${done ? '・已結束' : ''}）——${t.speaker?.name || ''}`;
                  return (
                    <Link
                      key={c.id}
                      className="cposter-hot"
                      href={`/courses/${courseSlug}/talks/${t.id}/`}
                      aria-label={label}
                      title={label}
                      style={{
                        left: `${c.x}%`,
                        top: `${c.y}%`,
                        width: `${c.w}%`,
                        height: `${c.h}%`,
                      }}
                    >
                      {done ? (
                        <span className="cposter-chip">
                          已結束{asArray(t.materials).length > 0 ? '・有資料' : ''}
                        </span>
                      ) : null}
                    </Link>
                  );
                })
              : null}
          </figure>
          <div className="cposter-txt">
            {interactive ? (
              <p>
                十二場講者、日期與講題，一張看完。
                <strong>點講者照片</strong>看那一場的講題介紹、講者簡歷與單場海報；也可以直接
                <a href={src} target="_blank" rel="noopener noreferrer">開海報大圖</a>。
              </p>
            ) : (
              <p>十二場講者、日期與講題，一張看完。點圖看大圖。</p>
            )}
            <p className="note">
              A3 直式，海報上的 QR 掃回本頁。要轉傳或印出來貼公布欄都可以——
              上面的資訊與本頁同一份來源，講題有更動時海報會跟著重出。
            </p>
          </div>
          {interactive ? (
            <details className="cposter-list">
              <summary>文字版場次表（不想在圖上找的話，從這裡點）</summary>
              <ol>
                {asArray(talks)
                  .filter((t) => t && hasText(t.id))
                  .slice()
                  .sort((a, b) => (a.no || 0) - (b.no || 0))
                  .map((t) => {
                    const done = t.status === 'done';
                    return (
                      <li key={t.id} className={done ? 'done' : undefined}>
                        <Link href={`/courses/${courseSlug}/talks/${t.id}/`}>
                          {mdw(t.date) || '日期待定'}・
                          {t.status === 'tba'
                            ? '講者確認後公布'
                            : `${t.speaker?.name || ''}——${hasText(t.title) ? t.title : '講題公布中'}`}
                        </Link>
                        {done ? '（已結束）' : ''}
                      </li>
                    );
                  })}
              </ol>
            </details>
          ) : null}
        </div>
      </div>
    </section>
  );
}
