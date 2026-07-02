// 課程頁元件共用小工具（A6）
// pending 慣例（設計書第三章）：未定的物件型欄位＝{"status":"pending"|"pending_ted","note":"…"}。
// note 屬編輯註記（何時補／誰補），一律不對外渲染——占位文字用各區塊的定案字串。

export function isPending(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    (value.status === 'pending' || value.status === 'pending_ted')
  );
}

export function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function asArray(value) {
  return Array.isArray(value) ? value : [];
}

// GitHub Pages 子路徑：/images/… 這類手寫 <img> 路徑要自己補 basePath
// （next/link 會自動補、<img> 不會——見 next.config.mjs 的 NEXT_PUBLIC_BASE_PATH 註解）
export function withBase(path) {
  if (!hasText(path)) return path;
  return `${process.env.NEXT_PUBLIC_BASE_PATH || ''}${path}`;
}
