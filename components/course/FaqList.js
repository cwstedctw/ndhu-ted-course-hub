import Ripple from './Ripple';
import { asArray, hasText, isPending } from './pending';

// 區塊 11：常見問題 FAQ（#faq，設計書二章 §4.3 區塊 11、五章 §4.12）
// 原生 <details>/<summary> 手風琴（零 JS、no-JS 降級天生成立）。
// status 是渲染過濾器：只渲染 status="confirmed"；source 屬內部溯源，不對外渲染；
// exampleAssets pending → 答案照渲染、素材位置水波占位。
export default function FaqList({ faq }) {
  const pending = isPending(faq);
  const items = asArray(faq).filter(
    (f) => f?.status === 'confirmed' && hasText(f?.q) && hasText(f?.a)
  );
  if (!pending && items.length === 0) return null;

  return (
    <section id="faq">
      <div className="container">
        <h2>常見問題</h2>
        {pending ? (
          <Ripple>FAQ 整理中，開學前公布</Ripple>
        ) : (
          <div className="faq">
            {items.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
                {isPending(f.exampleAssets) ? (
                  <Ripple style={{ padding: '12px 16px', marginBottom: 10, fontSize: 13 }}>
                    範例作品素材整理中，開學前補上
                  </Ripple>
                ) : null}
              </details>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
