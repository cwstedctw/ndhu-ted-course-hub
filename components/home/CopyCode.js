'use client';
// components/home/CopyCode.js — 課號複製藥丸（設計計畫 C9）
//
// 中性工具色（teal outline）——**絕不用 gold**：gold 全站只留給「離站加入」的主 CTA。
// 降級鏈（三層，缺一層就往下掉）：
//   ① navigator.clipboard.writeText 成功 →「已複製」短暫回饋
//   ② clipboard 不存在或被拒（http、權限、舊瀏覽器）→ 幫使用者把課號選起來，提示自己按 Ctrl+C
//   ③ 完全沒有 JS → 按鈕由 NoJs 的 <noscript> 樣式隱藏，剩下的 <code> 有 user-select:all，
//      點一下就整串選取（樣式在 app/v3-home.css）
// 回饋文字放 role="status"，讀螢幕的人也聽得到；計時器在 state 變動與卸載時清掉。

import { useEffect, useRef, useState } from 'react';

export default function CopyCode({ code, what = '課號' }) {
  const [state, setState] = useState('idle'); // idle | copied | selected | failed
  const codeRef = useRef(null);

  useEffect(() => {
    if (state === 'idle') return undefined;
    const timer = setTimeout(() => setState('idle'), 2000);
    return () => clearTimeout(timer);
  }, [state]);

  if (typeof code !== 'string' || code.trim() === '') return null;

  async function handleCopy() {
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(code);
        setState('copied');
        return;
      }
      throw new Error('clipboard unavailable');
    } catch {
      // 降級②：選取文字，讓使用者自己複製
      const el = codeRef.current;
      const sel = typeof window !== 'undefined' ? window.getSelection() : null;
      if (el && sel && typeof document !== 'undefined') {
        const range = document.createRange();
        range.selectNodeContents(el);
        sel.removeAllRanges();
        sel.addRange(range);
        setState('selected');
        return;
      }
      setState('failed');
    }
  }

  const flash =
    state === 'copied'
      ? '已複製'
      : state === 'selected'
        ? '已選取，請按 Ctrl+C'
        : state === 'failed'
          ? '請手動選取複製'
          : '';

  return (
    <span className="v3-copy">
      <code className="v3-copy-code" ref={codeRef}>
        {code}
      </code>
      <button
        type="button"
        className="v3-copy-btn"
        onClick={handleCopy}
        aria-label={`複製${what} ${code}`}
      >
        <span aria-hidden="true">⧉</span>
      </button>
      <span className="v3-copy-flash" role="status">
        {flash}
      </span>
    </span>
  );
}
