import Bi from './Bi';
import { asArray, hasText } from './pending';

// 區塊 6：工具帶（#tools，設計書二章 §4.3 區塊 6）
// toolGroups 群組卡＋dailyTools（併成「日常隨身工具」一卡）；
// toolGroupsNote（「工具會換、能力不換」）小字必渲染；無資料 → 整塊隱藏（非必要區塊，不占位）。
//
// intro.dailyToolsLink（2026-09-04）：日常工具卡底下的一條邀請連結。
// ⚠️ 吃的是 webLabel／webNote，不是 label／dailyToolsNote——後兩個是投影片產線在用的，
// 措辭寫給投影幕（「掃右邊 QR」「掃碼註冊」），網頁上沒有 QR、是用點的，照抄會答非所問。
// 沒給 web 版才退回投影片那版（總比整段不見好），但正常情況兩個都要給。
export default function ToolBelt({
  toolGroups,
  dailyTools,
  toolGroupsNote,
  dailyToolsNote,
  dailyToolsLink,
  L,
  en = {},
}) {
  const groups = asArray(toolGroups).filter((g) => hasText(g?.group));
  const daily = asArray(dailyTools).filter((t) => hasText(t?.name));
  if (groups.length === 0 && daily.length === 0) return null;

  const enGroups = asArray(en?.toolGroups);
  const enDaily = asArray(en?.dailyTools);

  // 沒有網址 → 整條不渲染，絕不做假連結（同 PlatformLinks 的規矩）
  const link = hasText(dailyToolsLink?.url) ? dailyToolsLink : null;
  const enLink = en?.dailyToolsLink ?? {};
  const linkLabel = link
    ? L.t(enLink.webLabel ?? enLink.label, link.webLabel ?? link.label)
    : null;
  const linkNote = link
    ? L.t(enLink.webNote ?? en?.dailyToolsNote, link.webNote ?? dailyToolsNote)
    : null;

  const toolItem = (enList) => (it, i) => (
    <li key={it.name}>
      <Bi s={L.t(enList?.[i]?.name, it.name)} />
      {hasText(it.sub) ? <Bi as="small" s={L.t(enList?.[i]?.sub, it.sub)} /> : null}
    </li>
  );

  return (
    <section id="tools">
      <div className="container">
        <h2>{L.c('headTools', '會用到的工具')}</h2>
        <div className="toolgroups">
          {groups.map((g, gi) => (
            <div className="tg" key={g.group}>
              <Bi as="h4" s={L.t(enGroups[gi]?.group, g.group)} />
              <ul>
                {asArray(g.items)
                  .filter((it) => hasText(it?.name))
                  .map(toolItem(asArray(enGroups[gi]?.items)))}
              </ul>
            </div>
          ))}
          {daily.length > 0 ? (
            /* tg-daily＝滿排橫排（globals）：避免 4 欄檔位下孤兒直列卡 */
            <div className="tg tg-daily" key="daily-tools">
              <h4>{L.c('cardDailyTools', '日常隨身工具')}</h4>
              <ul>{daily.map(toolItem(enDaily))}</ul>
              {link && linkLabel?.main ? (
                <div className="daily-link">
                  <a
                    className="daily-link-cta"
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Bi s={linkLabel} />
                  </a>
                  <small className="daily-link-win">
                    {L.c('platformNewWindow', '另開新視窗')}
                  </small>
                  {linkNote?.main ? (
                    <Bi as="p" className="note daily-link-note" s={linkNote} />
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        {hasText(toolGroupsNote) ? (
          <Bi as="p" className="note" s={L.t(en?.toolGroupsNote, toolGroupsNote)} />
        ) : null}
      </div>
    </section>
  );
}
