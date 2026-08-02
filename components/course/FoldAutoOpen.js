'use client';
import { useEffect } from 'react';

// 錨點導覽點進折疊區時自動展開（2026-08-02 課程頁重整第二輪）。
// 漸進增強：無 JS 時錨點照樣捲到折疊列、手動點開；有 JS 時直接展開內容。
export default function FoldAutoOpen() {
  useEffect(() => {
    const open = () => {
      const id = decodeURIComponent((window.location.hash || '').slice(1));
      if (!id) return;
      const sec = document.getElementById(id);
      const details = sec && sec.querySelector ? sec.querySelector('details.v3-fold') : null;
      if (details) details.open = true;
    };
    open();
    window.addEventListener('hashchange', open);
    return () => window.removeEventListener('hashchange', open);
  }, []);
  return null;
}
