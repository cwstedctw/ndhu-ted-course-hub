# DEPLOY——一頁部署步驟（給陳文盛老師／立霧）

> 目標：把這個資料夾變成公開 GitHub repo，push 就自動驗證、建置、上線到
> `https://<帳號>.github.io/ndhu-ted-course-hub/`。
>
> **現況（2026-07-03）**：已由洄瀾完成部署上線——repo `cwstedctw/ndhu-ted-course-hub`、
> 網址 `https://cwstedctw.github.io/ndhu-ted-course-hub/`。以下步驟留給重建或搬家時用。

## 0. 前置（本機一次性）

- 需要 git 與 Node.js（本機 20 以上即可；CI 固定用 Node 26）。
- 這個資料夾目前住在 wailan_agent repo 裡面——先把整個 `ndhu-ted-course-hub/` **複製到 wailan_agent 外面**再操作，避免巢狀 repo 打架。
- 在複製出來的資料夾裡跑 `npm install`，會產生 `package-lock.json`——**這個檔要一起 commit**（CI 的 `npm ci` 與快取都靠它）。
- 先本機驗一次 `npm run build` 全綠再上。

## 1. 啟用防線 hooks（第一件事，不要跳過）

```
git init -b main
git config core.hooksPath .githooks
```

- Mac／Linux 再補一行：`chmod +x .githooks/pre-commit .githooks/pre-push`
- 首次 commit 前跑一行，把執行權限寫進 git 索引（讓其他機器 clone 下來 hooks 也能跑）：
  `git update-index --add --chmod=+x .githooks/pre-commit .githooks/pre-push`

hooks 做什麼：commit 與 push 前掃新增內容，擋三種東西——
①學號樣式（4 開頭連續 8-9 碼數字，零例外）②內部註記欄位（internal＋Notes 連寫的鍵）
③Apps Script 部署 ID（AKfyc 開頭的長字串；只有 `content/site.json` 的 `scoreUrl` 那一行放行）。
pre-push 掃的是 `origin/main..HEAD` 整段未推送歷史，別台機器漏掛 hook 的 commit 也抓得到。

## 2. 建公開 repo 並 push

1. GitHub 網頁 → New repository → 名稱 **`ndhu-ted-course-hub`** → **Public** → 什麼初始化檔都不勾。
   （repo 名＝網址子路徑＝`deploy.yml` 裡的 `BASE_PATH`，三者綁死；真要改名，`.github/workflows/deploy.yml` 的 `BASE_PATH` 要同步改。）
2. 回到本機：

```
git add -A
git commit -m "初始化 NDHU TED Course Hub"
git remote add origin https://github.com/<帳號>/ndhu-ted-course-hub.git
git push -u origin main
```

## 3. 開 GitHub Pages（一次性）

repo 頁面 → **Settings → Pages → Build and deployment → Source 選「Deploy from a branch」→ Branch 選 `gh-pages`／`/ (root)`**。

- CI（`deploy.yml`）會在每次 push main 後，把建置產物推上 `gh-pages` 分支（peaceiris/actions-gh-pages），Pages 再吃這個分支。
- ⚠️ 為什麼不用「GitHub Actions」模式：新開站用 `actions/deploy-pages` 連三次秒回 `deployment_failed`（2026-07-03 實戰），改分支模式後一次就過——別改回去。
- 首次把 Source 切到 `gh-pages` 時，若分支已存在但 Pages 沒自動建置，手動點火一次：
  `gh api -X POST repos/<帳號>/ndhu-ted-course-hub/pages/builds`

## 4. 完成、驗收

- Actions 分頁看 `deploy` workflow 綠燈（validate → next build → scan → 推 gh-pages，約 1-2 分鐘），Pages 隨後自動建置。
- 開 `https://<帳號>.github.io/ndhu-ted-course-hub/` 看到首頁即成功。

## 之後的日常

| 動作 | 結果 |
|---|---|
| push 到 main | 自動驗證＋建置＋重新部署（幾分鐘生效） |
| 開 PR | 只跑驗證＋建置、不部署；紅燈不要 merge |
| 站掛了 | `git revert` 出事的 commit 再 push main，就會用上一版重新部署 |
| hook 把 commit／push 擋下 | 照訊息把內容移掉；pre-push 擋下＝已進 commit 歷史，要撤掉該 commit（訊息裡有指令）。**確定誤判找洄瀾，不要用 `--no-verify` 硬繞**（CI 還有一層，繞了也上不去） |

## 疑難排解

- **commit 時 hooks 沒反應**：忘了 `git config core.hooksPath .githooks`（每個 clone 都要設一次）。
- **hooks 報 `\r` 或 command not found**：檔案被轉成 CRLF——`git config core.autocrlf false` 後重新 checkout，或把 `.githooks/` 兩檔存回 LF。
- **Pages 404**：Settings→Pages 的 Source 沒選 `gh-pages` 分支；或切換 Source 後第一次建置沒被觸發（用上面 §3 的手動點火指令）。
- **CI 在 `npm ci` 失敗**：`package-lock.json` 沒 commit（見步驟 0）。
