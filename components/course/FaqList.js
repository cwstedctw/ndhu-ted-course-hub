import Ripple from './Ripple';
import Bi from './Bi';
import { asArray, hasText, isPending } from './pending';

// 區塊 11：常見問題 FAQ（#faq，設計書二章 §4.3 區塊 11、五章 §4.12）
// 原生 <details>/<summary> 手風琴（零 JS、no-JS 降級天生成立）。
// status 是渲染過濾器：只渲染 status="confirmed"；source 屬內部溯源，不對外渲染；
// exampleAssets pending → 答案照渲染、素材位置水波占位。
export default function FaqList({ faq, L, en = {} }) {
  const pending = isPending(faq);
  const enAll = asArray(en?.faq);
  // 英文鏡像跟**未過濾前**的 faq 索引對齊（validate #20 比的是整條陣列長度），
  // 所以先記住原索引再過濾，別用過濾後的位置去查英文——那會整批錯位。
  const items = asArray(faq)
    .map((f, i) => ({ f, en: enAll[i] }))
    .filter(({ f }) => f?.status === 'confirmed' && hasText(f?.q) && hasText(f?.a));
  if (!pending && items.length === 0) return null;

  return (
    <section id="faq">
      <div className="container">
        <h2>{L.c('headFaq', '常見問題')}</h2>
        {pending ? (
          <Ripple>{L.c('faqPending', 'FAQ 整理中，開學前公布')}</Ripple>
        ) : (
          <div className="faq">
            {items.map(({ f, en: ef }) => (
              <details key={f.q}>
                <Bi as="summary" s={L.t(ef?.q, f.q)} />
                <Bi as="p" s={L.t(ef?.a, f.a)} />
                {isPending(f.exampleAssets) ? (
                  <Ripple style={{ padding: '12px 16px', marginBottom: 10, fontSize: 13 }}>
                    {L.c('faqExamplePending', '範例作品素材整理中，開學前補上')}
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
