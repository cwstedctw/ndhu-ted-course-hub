import { hasText, withBase } from './pending';

// 演講課變體：整門課一張的總海報（#course-poster），接在 12 場海報牆之後。
// 定位＝「一張帶得走的」——海報牆是逐場點進去看，這張是拍下來、傳出去、印出來貼公布欄的那份。
// 圖由 talk-course-manager/scripts/make_course_poster.py 本機渲染（文字是真文字不是畫的），
// 過六道閘門（版面／字型／內容／QR／WebP／A3 PDF）才會放進 public/images/courses/。
// ⚠️ 比例與單場海報同規格：A3 直式 297×420，出血後 1400×1969。用 contain 不用 cover——
//    cover 會把左脊那行直排課程名切掉（單場海報踩過這個坑，見 TalksWall 註解）。
export default function CoursePoster({ poster, courseName }) {
  if (!hasText(poster)) return null;
  const src = withBase(poster);
  return (
    <section id="course-poster">
      <style>{`
.cposter { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 26px; }
.cposter-fig { margin: 0; flex: 0 0 auto; width: min(340px, 100%); }
.cposter-fig img { display: block; width: 100%; height: auto; aspect-ratio: 1400 / 1969;
  object-fit: contain; background: var(--paper, #FDFAF2);
  border: 1px solid var(--line, #E5DCC3); border-radius: var(--radius, 14px); }
.cposter-fig a { display: block; }
/* 文字欄要壓寬度：不壓的話在寬螢幕會拉成一行橫跨整頁，右邊留一大片空白 */
.cposter-txt { flex: 1 1 260px; min-width: 240px; max-width: 34em; }
.cposter-txt p { margin: 0 0 10px; }
@media (max-width: 560px) { .cposter-fig { width: 100%; max-width: 340px; margin-inline: auto; } }
      `}</style>
      <div className="container">
        <h2>課程總海報</h2>
        <div className="cposter">
          <figure className="cposter-fig">
            <a href={src} target="_blank" rel="noopener noreferrer">
              <img
                src={src}
                alt={`${courseName || '本課程'}總海報：十二場專題演講的講者、日期與講題一覽`}
                width="1400"
                height="1969"
                loading="lazy"
              />
            </a>
          </figure>
          <div className="cposter-txt">
            <p>十二場講者、日期與講題，一張看完。點圖看大圖。</p>
            <p className="note">
              A3 直式，海報上的 QR 掃回本頁。要轉傳或印出來貼公布欄都可以——
              上面的資訊與本頁同一份來源，講題有更動時海報會跟著重出。
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
