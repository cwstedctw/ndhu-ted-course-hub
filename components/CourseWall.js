'use client';

// components/CourseWall.js — 課程卡片牆＋篩選列（首頁與 /courses/ 共用）
// 2026-08-20 設計實驗 R3 移植①：MIT OCW 式篩選 chips＋結果計數器。
// 篩選鍵只用 courses.json 既有欄位（credits／kind），不發明新分類欄位；
// 「全部」恆在且為預設；計數器 aria-live，讀屏跟得上結果數變化。

import { useState } from 'react';
import CourseCard from '@/components/CourseCard';

const FILTERS = [
  { key: 'all', label: '全部', match: () => true },
  { key: 'c3', label: '3 學分', match: (c) => c.credits === 3 },
  { key: 'c2', label: '2 學分', match: (c) => c.credits === 2 },
  { key: 'lecture', label: '系列演講', match: (c) => c.kind === 'lecture-series' },
];

export default function CourseWall({ courses }) {
  const [active, setActive] = useState('all');
  const filter = FILTERS.find((f) => f.key === active) ?? FILTERS[0];
  const shown = courses.filter(filter.match);

  return (
    <>
      <div className="wall-filters" role="group" aria-label="課程篩選">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            aria-pressed={f.key === active}
            onClick={() => setActive(f.key)}
          >
            {f.label}
          </button>
        ))}
        <span className="wall-count" aria-live="polite">
          {shown.length} / {courses.length} 班
        </span>
      </div>
      <ul className="cards">
        {shown.map((course) => (
          <CourseCard key={course.slug} course={course} />
        ))}
      </ul>
    </>
  );
}
