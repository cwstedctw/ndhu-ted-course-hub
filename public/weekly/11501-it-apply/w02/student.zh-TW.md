# 哪一個才是最新版？

資訊科技與應用 W2。AA：2026/09/14；AB：2026/09/15。兩節課共 100 分鐘，休息另計 10 分鐘。

今天把自己的課堂材料收進工作檔案櫃，留得住、看得出差異，也救得回來。你會用到瀏覽器，不必安裝 Git，也不需要付費 AI 或 GitHub 學生方案。

## 1. 課內先起步，W3 前補完整

- 課內最低：一個私有工作檔案櫃、一個公開網站 repo，各留一筆留版紀錄（commit）。帳號或驗證卡住，就當堂登記，走本機等值路徑。
- 完整成果：看得懂至少兩筆 commit 的差異、完成一次改壞再救回，並有可開啟的網址或卡關紀錄。來不及的部分在 W3 上課前補完。
- Pages 網址還沒亮，不算課內沒過。實作通常會超過兩筆 commit，不要求恰好兩筆。

W2 是重週，課內做到跑得起來的半成品就算數，完整版截止到 W3 上課前。這些是同一堂實作的檢核點，不是多份作業；補完本身不另計分。教師當堂巡場確認，或依課堂指示交到 e學苑，不因帳號卡關扣分。

## 2. 起步材料

有 W1 任務分類紀錄就用自己的那份。先拿掉姓名、學號、私訊或同學照片，放進私有櫃。沒有現成材料，以下替代檔同樣可以用。

| 檔案 | 用在哪裡 |
| --- | --- |
| [W1 任務卡替代檔](starter/private-cabinet/w01-task-card.md) | 私有工作檔案櫃 |
| [無個資網站範本](starter/public-site/index.html) | 公開網站。開啟後可用瀏覽器另存，或從起步 ZIP 取出 |
| [起步檔 ZIP](starter.zip) | 下載後先解壓縮；不要把整包上傳公開 repo |
| [空白證據卡](evidence-card.html) | 當堂填寫、列印或下載自己的紀錄 |
| [填寫範例](evidence-example.html) | 虛構本機模擬示例，看看欄位怎麼寫 |
| [本機版本 A](starter/offline/v1/w01-task-card.md) | 無帳號、無網路時的版本比較 |
| [本機版本 B](starter/offline/v2/w01-task-card.md) | 與 A 比較，再練救回 |

公開那側只放你願意讓任何人看的內容。這份網站範本是虛構練習，可以保留原樣或改暱稱與興趣。自己的草稿、作業與資料放私有側；任何一側都不要放密碼。

## 3. 私有工作檔案櫃

檔案櫃（repo，repository）會把檔案與修改歷史放在一起。Git 是記錄版本的工具；GitHub 是可存放 repo 的平台。今天直接用 GitHub 網頁完成。[GitHub 官方說明](https://docs.github.com/en/get-started/using-git/about-git)

1. 登入 GitHub，開 [建立私有櫃](https://github.com/new?name=it-work-cabinet&visibility=private)。若預填沒有生效，自己填 `it-work-cabinet` 並確認 **Private**。
2. 開啟 Add README，再按 Create repository。這會建立一筆初始紀錄。
3. 在剛建立的 repo 選 Add file，再選 Upload files；選自己的 W1 任務卡或替代檔。
4. 檢查待上傳檔案，寫 commit 訊息，例如「放入 W1 任務卡，留作下週修改起點」。本週只在自己新建、沒有協作者的 repo 練習，可提交到目前的 main。
5. 按 Commit changes，回到檔案清單，真正打開檔案確認內容在裡面。

這套按鈕與預填方式依 [建立 repo](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-new-repository)及[上傳檔案](https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository)官方文件核對。若名稱已用過，就加上不含個資的尾碼；不要刪掉舊 repo 重來。

## 4. 公開網站

1. 開 [建立公開網站 repo](https://github.com/new?name=my-course-site&visibility=public)，確認 **Public**，開啟 Add README，再建立。
2. 從起步檔取出 `public-site/index.html`。只上傳這個 `index.html` 到 repo 最外層，不要多包一層資料夾，也不要上傳整份 ZIP。
3. Commit changes，訊息例如「放入可公開的網站首頁」。打開檔案，確認名稱為小寫 `index.html`。
4. 進 Settings，再進 Pages。在 Build and deployment 選 Deploy from a branch；選 `main`、`/ (root)`，按 Save。
5. 等 Pages 顯示網站網址，再開新分頁或用手機查看。第一次部署可能要等候；以實際顯示的網址為準。

GitHub Free 的 Pages 可從公開 repo 發布；私有 repo 的 Pages 需要支援的付費方案。本課用公開的無個資範本，不以付費或 Student Pack 為前提。一般 Pages 網站可被網際網路上的其他人開啟。[Pages 官方設定](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

出現 404 時，先看 Pages 或 Actions 是否仍在部署，再核對 `index.html` 的大小寫、位置與發布來源。網址尚未亮起就填卡關，不要反覆重建 repo。[官方 404 排查](https://docs.github.com/en/pages/getting-started-with-github-pages/troubleshooting-404-errors-for-github-pages-sites)

## 5. 看一次差異

回到私有櫃，打開自己的純文字檔。`w01-task-card.md` 是替代檔的示範名稱；使用自己的材料，就開自己的實際檔名。若原件是 Word、PDF 或圖片，保留原件不動，另摘錄 1–2 句不含個資的文字，存成可編輯的 `.md` 純文字檔並上傳、commit；不是只把原件的副檔名改成 `.md`。

用鉛筆按鈕編輯這份純文字檔的一行。按 Preview 看結果，再 Commit changes，寫清楚你改了什麼。提交後點檔案的最新 commit 訊息，觀察前後差異（diff）。有刪除符號 `−` 的行是這次移除的內容，新增符號 `+` 的行是加入的內容。

請指著畫面說：「我把哪一句改成哪一句，為什麼？」本週用純文字，才容易逐行讀。Word、PDF 等檔案也能存進 repo，但不代表都能顯示同樣的逐字差異。[編輯檔案](https://docs.github.com/en/repositories/working-with-files/managing-files/editing-files)

## 6. 改壞一行，再救回

先確認正常版本已經 commit。只改剛才那份純文字練習檔的一行，不動 Word、PDF 或圖片原件。使用替代材料時，可以把「雨天到圖書館」改成「雨天到操場」，提交訊息標明「練習：故意改壞雨天安排」；使用自己的文字，就挑其中一句做同樣的練習，記下原句與修改理由。

1. 從檔案頁進 History，找到改壞前的版本，打開那一版的檔案。若介面沒有相同位置的 History，可用 Blame 找那一行的版本紀錄，進入修改前的版本。
2. 確認舊內容是你要的那一句，點 Raw，複製內容。不要在歷史版本的畫面按編輯。
3. 回 repo 的 **main**，打開目前的同一份檔案，點鉛筆編輯，把舊內容貼回。
4. 再提交一筆，說明救回哪一句；替代材料可寫「救回雨天安排：恢復圖書館版本」。最後重新打開 main 的檔案，核對自己的那一行真的回來。

這個做法是**取回舊內容，再新增一筆 commit**。改壞與救回都留在歷史中；本週不要求找一個通用 Revert 按鈕，也不刪去先前紀錄。官方提供 [Blame 與舊版本、Raw 檢視](https://docs.github.com/en/repositories/working-with-files/using-files/viewing-and-understanding-files)，本課把它接到一般編輯與提交，完成內容還原。

## 7. 沒有帳號或沒有網路

本機等值路徑也練三件事，同分；它是**版本模擬，不是真正的 Git commit**。

1. 建一個自己的工作資料夾，裡面放 `v1`、`v2` 與 `working`。先把起步檔的版本 A 放進 `v1`，複製到 `working`。
2. 在 `working` 改一行，把這一版另存到 `v2`。在證據卡記下兩版各改了什麼與理由。
3. 有網路時，免登入看 [老師的公開 repo](https://github.com/cwstedctw/git-ai-workshop) 裡的 commit 差異；斷線時打開自己 `v1` 與 `v2` 的同名檔逐行比較。
4. 要救回時，從 `v1` 複製正確內容回 `working`。保留 `v1`、`v2`，打開 `working` 驗證救回的句子。
5. 本機打開網站範本看得到頁面，只代表本機預覽。它不是公開網址。把帳號或部署卡關寫在卡上，依課堂安排補齊。走無帳號路徑的同學，把願意公開的網站檔交到 e學苑，或當堂交給教師；依課程安排由教師每週固定發布一次，在下一次上課前提供網址。網站修改也可以走這條路。

## 8. AI 整理檔案的例子，接在哪裡？

[Campus Agent Lab 任務 A](https://ndhu-campus-agent-lab.tedc.chatgpt.site#a) 用一張任務卡整理社團檔案。本週老師只用它示範「先保留原檔，再看整理後的副本」，接到版本留存。你不需要在這 100 分鐘內多做一整套 Agent 實作。

想課後練，可以選東華版，或用鋼頂叔原版第 01 題替代。東華版有 12 份原檔；原始試玩包的第 01 題有 19 份檔案，按實際盤點檢查，不能套用東華版的 12 檔、manifest 或檢查程式。原包由原作者提供，本週起步檔不含原包。[原作者文章](https://vocus.cc/article/6aa0c9c4fd89780001f377b8)

## 9. 同學互查與下週前補完

- 指出一筆 commit，說明這次改了什麼。
- 指出改壞前、改壞後與救回後的內容。私有櫃由作者在自己的畫面展示，不必把權限交給同學。
- 用另一台裝置打開網站網址，或出示卡關登記。

下課先在 [離堂證據卡](evidence-card.html) 記下目前做到哪裡，空白處可標「W3 前補」。差異與救回來不及，就在 W3 上課前補完整。完整 Git 操作教材可回到 [跟 AI 一起用 Git](https://cwstedctw.github.io/git-ai-workshop/)。下週就用今天的網站，練習讓 AI 照你的規格修改。

操作文件核對日：2026/09/10。按鈕位置可能調整；遇到不同畫面，用上面的官方文件與老師示範定位。
