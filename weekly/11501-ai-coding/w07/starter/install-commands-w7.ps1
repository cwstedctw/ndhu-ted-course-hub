# W7 第 0 段：一進教室先貼的指令（PowerShell）
# 這份是 W6 的 install-commands.ps1 改的（2026-10-17）：
#   改了什麼：① 新加 C 拿 cloudflared（Cloudflare 的通道程式，免帳號）——不用 winget：它的安裝程式要系統管理員權限
#              （10/17 實測沒按 UAC 就以代碼 1602 失敗），改成把官方單一執行檔下載進 %USERPROFILE%\line-relay、免安裝；
#              轉接站 line-search-relay.mjs 之後也放進同一個資料夾。Node 開程式不會在目前資料夾找（10/17 實測 ENOENT），
#              所以要 $env:PATH += 那一行，而且每開一個新的 PowerShell 視窗都要再貼一次
#            ② 拿掉 B 裡「npm 裝 gws」那一行（這週用不到 gws）
#            ③ 版本檢查拿掉 gws --version
#   沒改的：A、B 的 winget 與 PATH 那幾行、D 的 Modelfile 內容，跟 W6 一字不差
# A. 本地模型（另開一個視窗跑；6.6 GB，教室網路快的話 3–5 分鐘）
winget install --id Ollama.Ollama -e --accept-package-agreements --accept-source-agreements --silent
$env:PATH += ";$env:LOCALAPPDATA\Programs\Ollama"
Start-Process powershell -ArgumentList '-NoExit','-Command','ollama pull gemma4:e4b'
# B. Node.js（轉接站 line-search-relay.mjs 要靠它跑）
winget install --id OpenJS.NodeJS.LTS -e --accept-package-agreements --accept-source-agreements --silent
$env:PATH += ";$env:ProgramFiles\nodejs;$env:APPDATA\npm"
# C. cloudflared（給轉接站一個外面連得到的臨時網址；本週新加；免安裝、不用管理員）
New-Item -ItemType Directory -Force "$env:USERPROFILE\line-relay" | Out-Null
Set-Location "$env:USERPROFILE\line-relay"
Invoke-WebRequest -Uri https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe -OutFile cloudflared.exe
$env:PATH += ";$env:USERPROFILE\line-relay"
cloudflared --version
#    自己筆電有管理員權限的，用 winget 裝也可以（要按 UAC；裝完新開視窗、不用 PATH 那行）：
#    winget install --id Cloudflare.cloudflared -e --accept-package-agreements --accept-source-agreements
# 版本檢查（新開一個 PowerShell 視窗再跑，PATH 才會更新；cloudflared 在新視窗要先貼上面那行 $env:PATH += ";$env:USERPROFILE\line-relay"）
ollama --version      # 0.40.x
node -v               # v24.x
ollama list           # 等 pull 完會看到 gemma4:e4b
# D.（選做；主線用不到——轉接站自己用 gemma4:e4b、「不確定先搜」的規矩寫在它程式裡）想在 Ollama app 直接問對照的才做：做出 gemma4-search（不會重新下載）
$mf = @'
FROM gemma4:e4b
SYSTEM """你是研究助理。你有網路搜尋與讀網頁的工具。今天的日期可能在你的訓練資料之後，所以遇到「最近發生的事、某一年的得獎名單、版本號、價格、新聞」或任何你不確定的事實，一律先用搜尋工具查，查到再回答，並附上來源網址；不要以「還沒發生」為理由拒絕查詢。回答用繁體中文（台灣用語）。"""
PARAMETER num_ctx 16384
'@
[IO.File]::WriteAllText("$env:USERPROFILE\Modelfile", $mf)
ollama create gemma4-search -f "$env:USERPROFILE\Modelfile"
ollama list
