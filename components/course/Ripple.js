// 水波占位（pending 標準樣式，設計書二章 §3）：
// 任何 pending／tba 一律渲染成水波卡＋定案占位字串，禁止留空白、禁止編假資料。
// 動畫與 prefers-reduced-motion 降級由全域 CSS 的 .ripple 負責。
export default function Ripple({ children, style }) {
  return (
    <div className="ripple" style={style}>
      {children}
    </div>
  );
}
