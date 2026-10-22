# W6 第 0 段：一進教室先貼的指令（PowerShell；2026-10-09 在 msi 實測版本）
# A. 本地模型（另開一個視窗跑；6.6 GB，教室網路快的話 3–5 分鐘）
winget install --id Ollama.Ollama -e --accept-package-agreements --accept-source-agreements --silent
$env:PATH += ";$env:LOCALAPPDATA\Programs\Ollama"
Start-Process powershell -ArgumentList '-NoExit','-Command','ollama pull gemma4:e4b'
# B. 命令列工具（gws 需要 Node.js）
winget install --id OpenJS.NodeJS.LTS -e --accept-package-agreements --accept-source-agreements --silent
$env:PATH += ";$env:ProgramFiles\nodejs;$env:APPDATA\npm"
npm install -g --allow-scripts=@googleworkspace/cli @googleworkspace/cli
# C. 第 2 段開頭測一下（新開一個 PowerShell 視窗再跑，PATH 才會更新）
ollama --version      # 0.40.1
node -v               # v24.x
gws --version         # gws 0.22.5
ollama list           # 等 pull 完會看到 gemma4:e4b
# D. 第 3 段開頭（A 拉完才跑得動）：把「不確定就先搜」的規矩寫進模型設定，做出 gemma4-search（不會重新下載）
$mf = @'
FROM gemma4:e4b
SYSTEM """你是研究助理。你有網路搜尋與讀網頁的工具。今天的日期可能在你的訓練資料之後，所以遇到「最近發生的事、某一年的得獎名單、版本號、價格、新聞」或任何你不確定的事實，一律先用搜尋工具查，查到再回答，並附上來源網址；不要以「還沒發生」為理由拒絕查詢。回答用繁體中文（台灣用語）。"""
PARAMETER num_ctx 16384
'@
[IO.File]::WriteAllText("$env:USERPROFILE\Modelfile", $mf)
ollama create gemma4-search -f "$env:USERPROFILE\Modelfile"
ollama list
