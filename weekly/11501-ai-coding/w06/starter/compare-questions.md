# 三道「要搜尋才答得對」的比較題（查核日 2026-10-09，洄瀾用 WebSearch＋GitHub API 核）

> 用法：同一題問三次——①LINE bot（免費 Gemini API，沒搜尋）②本地模型不開搜尋 ③本地模型開搜尋。只看「答對沒、有沒有附來源」。

| # | 題目（中文；英文版給 AA） | 標準答案 | 出處（查核日） |
|---|---|---|---|
| 1 | 2026 年諾貝爾物理獎得主是誰？得獎理由是什麼？ | **Francis Halzen** 一人獨得；理由＝對 IceCube 微中子觀測站的決定性貢獻、偵測到來自天體的高能微中子。2026-10-06 斯德哥爾摩公布。 | nobelprize.org/prizes/physics/2026；Daily Maverick 2026-10-06 |
| 2 | 2026 年諾貝爾生理醫學獎的三位得主是誰？研究什麼？ | **Karl Deisseroth（史丹佛）、Peter Hegemann（柏林洪堡大學）、Georg Nagel（符茲堡大學）**，各三分之一；光遺傳學（光控離子通道，用光開關單一神經元）。2026-10-05 公布。 | nobelprize.org/prizes/medicine/2026；NPR 2026-10-05 |
| 3 | Ollama 目前最新的正式版本號是多少？什麼時候發布的？ | **v0.40.1**，2026-10-07（UTC 23:22）發布。 | `gh api repos/ollama/ollama/releases/latest`（2026-10-09 查） |

英文版（AA 用）：
1. Who won the 2026 Nobel Prize in Physics, and for what?
2. Who are the three laureates of the 2026 Nobel Prize in Physiology or Medicine, and what is their work about?
3. What is the latest stable release version of Ollama, and when was it released?

⚠️ 第 3 題答案會隨時間變：上課前一天用同一支 `gh api` 指令再核一次、改答案與查核日。
