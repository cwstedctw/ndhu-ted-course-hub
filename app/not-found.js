// app/not-found.js —— 自訂 404（詳細設計書 IA 章 §4.10）
// output:'export' 會把本頁產成根目錄 404.html，未知路徑（含被拔掉的 /build-log/、
// 不存在的 talk id）一律回傳它。
// 鐵律：零資料檔依賴——不讀 content JSON、不 fetch，純靜態；
//       title 只給主詞「找不到頁面」，品牌尾由 layout 的 %s 模板補上。
import Link from 'next/link';

export const metadata = {
  title: '找不到頁面',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="nf-main">
      <style>{`
        .nf-main { display: flex; justify-content: center; text-align: center; padding: 72px 20px 88px; }
        .nf-box { max-width: 520px; }
        .nf-code {
          margin: 0; font-size: 58px; font-weight: 900; line-height: 1;
          letter-spacing: .05em; color: var(--teal, #0E7C7B);
        }
        .nf-art {
          display: block; width: 300px; max-width: 100%; height: auto;
          margin: 12px auto 6px; border-radius: 12px;
          /* 融進頁面紙紋、去方形接縫：multiply 吃掉插圖自身紙色＋放射 mask 羽化四邊 */
          mix-blend-mode: multiply;
          -webkit-mask-image: radial-gradient(closest-side, #000 62%, transparent 100%);
          mask-image: radial-gradient(closest-side, #000 62%, transparent 100%);
        }
        .nf-box h1 { font-size: 24px; margin: 8px 0 10px; line-height: 1.5; }
        .nf-copy { color: var(--ink-60, #5B584F); font-size: 15px; line-height: 1.9; margin: 0 0 28px; }
        .nf-actions { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
        .nf-btn {
          display: inline-block; text-decoration: none; font-weight: 700;
          border-radius: 999px; padding: 11px 26px; font-size: 15px;
        }
        .nf-btn-primary { background: var(--gold, #D9A441); color: #3D2E0B; }
        .nf-btn-primary:hover { filter: brightness(1.05); }
        .nf-btn-secondary { background: var(--teal, #0E7C7B); color: #fff; }
        .nf-btn-secondary:hover { background: var(--teal-dark, #0A5958); }
        @media print { .nf-actions { display: none; } }
      `}</style>
      <div className="nf-box">
        <p className="nf-code" aria-hidden="true">404</p>
        {/* 立霧水彩插圖：小紙船停在溪石岔口（純裝飾；basePath 於 build 時 inline，維持零資料檔依賴） */}
        <img
          className="nf-art"
          src={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/images/bg/boat-404.webp`}
          alt=""
          aria-hidden="true"
          width="1024"
          height="1024"
        />
        <h1>這條支流不存在</h1>
        <p className="nf-copy">
          溪水在這裡分了岔——你要找的頁面不在這一頭。
          可能是網址打錯了字，也可能這一頁已經改道。
        </p>
        <div className="nf-actions">
          <Link className="nf-btn nf-btn-primary" href="/">回首頁</Link>
          <Link className="nf-btn nf-btn-secondary" href="/courses/">看 115-1 課程</Link>
        </div>
      </div>
    </main>
  );
}
