// /courses/11501-ai-future/talks/ 轉址殼
// 定案（詳細設計書 §4.4、決策紀錄 2026-07-02）：不做 /talks/ 索引子頁，
// 一律跳回課程頁「十二場演講」錨點 ../#talks（2026-08-20 起＝互動總海報區）（相對路徑，天生吃得住 basePath）。
// 三層保險：JS location.replace（不留歷史紀錄）→ meta refresh（no-JS 也會跳）→ 一行手動連結。

'use client';

import { useEffect } from 'react';

const TARGET = '../#talks';

export default function TalksRedirectShell() {
  useEffect(() => {
    window.location.replace(TARGET);
  }, []);

  return (
    <>
      {/* React 19 會把 title／meta 提升進 <head>；轉址殼不進索引 */}
      <title>前往十二場演講｜AI未來應用與趨勢探索</title>
      <meta name="robots" content="noindex" />
      <meta httpEquiv="refresh" content={`0;url=${TARGET}`} />
      <main style={{ maxWidth: 640, margin: '0 auto', padding: '72px 20px', textAlign: 'center' }}>
        <p style={{ fontSize: 15.5 }}>十二場演講已併入課程頁，正在為你轉頁…</p>
        <p style={{ fontSize: 15.5 }}>
          沒有自動跳轉的話，請點：<a href={TARGET}>前往十二場演講</a>
        </p>
      </main>
    </>
  );
}
