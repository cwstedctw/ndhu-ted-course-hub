// NDHU TED Course Hub — Next.js 設定（洄瀾 2026-07-02 技術裁決）
// 純靜態輸出（SSG）＋ GitHub Pages 子路徑部署：
//   本機：BASE_PATH 不設（空字串），http://localhost:3000/ 直接跑
//   CI：BASE_PATH=/ndhu-ted-course-hub（GitHub Pages 專案頁子路徑）
const basePath = process.env.BASE_PATH || '';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  basePath,
  assetPrefix: basePath || undefined,
  env: {
    // 給元件端手動組 URL 用（例如 <img>、meta refresh 轉址殼）——
    // next/link 與 next/image 會自動吃 basePath，這個變數是給「不會自動吃」的地方
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

export default nextConfig;
