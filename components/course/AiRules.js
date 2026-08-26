import Ripple from './Ripple';
import Bi from './Bi';
import { asArray, hasText, isPending } from './pending';

// 區塊 5：AI 使用守則（#ai-rules，設計書二章 §4.3 區塊 5、五章 §4.7）
// 上半：三條守則卡（Hub 用 bodyLong，退回 body）；
// 下半：紅黃綠三分類，欄名直接吃 aiPolicyExamples.structure；
// examples pending（現況 pending_ted）→ 三分類標題照渲染、例子區水波占位。

const LIGHT_CLASSES = ['g', 'y', 'r'];

export default function AiRules({ aiRules, aiPolicyExamples, L, en = {} }) {
  const rules = asArray(aiRules).filter((r) => hasText(r?.title));
  const structure = asArray(aiPolicyExamples?.structure).filter(hasText);
  const examples = aiPolicyExamples?.examples;
  const examplesPending = isPending(examples);

  if (rules.length === 0 && structure.length === 0) return null;

  return (
    <section id="ai-rules">
      <div className="container">
        <h2>{L.c('headAiRules', 'AI 使用守則')}</h2>
        {rules.length > 0 ? (
          <div className="rules">
            {rules.map((r, i) => (
              <div className="rule" key={r.title}>
                <Bi as="h4" s={L.t(asArray(en?.aiRules)[i]?.title, r.title)} />
                <Bi
                  s={L.t(
                    asArray(en?.aiRules)[i]?.body,
                    hasText(r.bodyLong) ? r.bodyLong : hasText(r.body) ? r.body : null
                  )}
                />
              </div>
            ))}
          </div>
        ) : null}
        {structure.length > 0 ? (
          <div className="lights">
            {structure.map((name, i) => (
              <div className={`light ${LIGHT_CLASSES[i % LIGHT_CLASSES.length]}`} key={name}>
                <Bi as="b" s={L.t(asArray(en?.aiPolicyStructure)[i], name)} />
                {Array.isArray(examples) && Array.isArray(examples[i]) && examples[i].length > 0 ? (
                  <ul>
                    {examples[i].filter(hasText).map((ex) => (
                      <li key={ex}>{ex}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
        {structure.length > 0 && examplesPending ? (
          <Ripple style={{ marginTop: 12 }}>
            {L.c('aiRulesExamplesPending', '各分類的情境實例，開學前公布')}
          </Ripple>
        ) : null}
      </div>
    </section>
  );
}
