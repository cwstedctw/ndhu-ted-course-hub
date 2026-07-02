import { hasText } from './pending';

// 區塊 8：成績查詢大按鈕（#score，設計書二章 §4.3 區塊 8）
// 一律 target="_blank" rel="noopener noreferrer" 新分頁直跳 V2 Apps Script /exec；
// 真值吃 hub.scoreUrl（無則 site.json scoreUrl，由 page 層決定後傳入）。Hub 本身零成績。
export default function ScoreButton({ scoreUrl }) {
  if (!hasText(scoreUrl)) return null;
  return (
    <section id="score">
      <div className="container">
        <h2>查成績</h2>
        <p>
          <a className="score-btn" href={scoreUrl} target="_blank" rel="noopener noreferrer">
            查詢成績（另開新視窗）
          </a>
        </p>
        <p className="note">另開新視窗，需東華帳號登入。本站不存放任何成績；查詢由既有系統提供。</p>
      </div>
    </section>
  );
}
