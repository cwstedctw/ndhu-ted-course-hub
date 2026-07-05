'use client';
// 「本週」高亮（2026-07-05 學生視角升級）：學期中訪客最常問「這週上什麼」。
// 全站唯一 client component——先前試過 server component 夾 inline <script>，
// 腳本在 HTML 解析時有跑、但 React hydration 會把 DOM 重設回伺服器狀態（實測），
// 所以照正規做法收進 useEffect（hydration 之後執行，改動不會被吃掉）。
// weekOneStart＝site.json 的 W1 週一日期（台灣時區）；未到 W1 或超出範圍不渲染。
import { useEffect, useState } from 'react';

export default function NowWeek({ weekOneStart }) {
  const [label, setLabel] = useState(null);

  useEffect(() => {
    const t0 = new Date(`${weekOneStart}T00:00:00+08:00`).getTime();
    if (Number.isNaN(t0)) return;
    const wk = Math.floor((Date.now() - t0) / 604800000) + 1; // 每 7 天一週
    if (wk < 1 || wk > 30) return; // 學期外（含寒暑假殘留書籤）安靜休眠

    let hit = null;
    document.querySelectorAll('#weeks .weeks [data-w]').forEach((el) => {
      // data-w 可為單週「6」或區間「2–3」（en dash／em dash／連字號都認）
      const m = (el.getAttribute('data-w') || '').match(/^(\d+)\s*[–—-]?\s*(\d+)?$/);
      if (!m) return;
      const a = +m[1];
      const b = m[2] ? +m[2] : a;
      if (wk >= a && wk <= b) {
        el.classList.add('now');
        if (!hit) hit = el;
      }
    });
    setLabel(`本週 W${wk}${hit ? `：${hit.textContent.replace(/^W[\d–—-]+\s*/, '')}` : ''}`);
  }, [weekOneStart]);

  if (!label) return null;
  return <p className="now-week">{label}</p>;
}
