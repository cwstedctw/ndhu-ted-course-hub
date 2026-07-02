import { asArray, hasText } from './pending';

// 區塊 6：工具帶（#tools，設計書二章 §4.3 區塊 6）
// toolGroups 群組卡＋dailyTools（併成「日常隨身工具」一卡）；
// toolGroupsNote（「工具會換、能力不換」）小字必渲染；無資料 → 整塊隱藏（非必要區塊，不占位）。
export default function ToolBelt({ toolGroups, dailyTools, toolGroupsNote }) {
  const groups = asArray(toolGroups).filter((g) => hasText(g?.group));
  const daily = asArray(dailyTools).filter((t) => hasText(t?.name));
  if (groups.length === 0 && daily.length === 0) return null;

  const toolItem = (it) => (
    <li key={it.name}>
      {it.name}
      {hasText(it.sub) ? <small>{it.sub}</small> : null}
    </li>
  );

  return (
    <section id="tools">
      <div className="container">
        <h2>會用到的工具</h2>
        <div className="toolgroups">
          {groups.map((g) => (
            <div className="tg" key={g.group}>
              <h4>{g.group}</h4>
              <ul>{asArray(g.items).filter((it) => hasText(it?.name)).map(toolItem)}</ul>
            </div>
          ))}
          {daily.length > 0 ? (
            <div className="tg" key="daily-tools">
              <h4>日常隨身工具</h4>
              <ul>{daily.map(toolItem)}</ul>
            </div>
          ) : null}
        </div>
        {hasText(toolGroupsNote) ? <p className="note">{toolGroupsNote}</p> : null}
      </div>
    </section>
  );
}
