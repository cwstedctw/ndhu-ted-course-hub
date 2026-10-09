# W6 第 0 段：一進教室先貼的指令（PowerShell；2026-10-09 在 msi 實測版本）
# A. 本地模型（另開一個視窗跑；6.6 GB，教室網路快的話 3–5 分鐘）
winget install --id Ollama.Ollama -e --accept-package-agreements --accept-source-agreements --silent
$env:PATH += ";$env:LOCALAPPDATA\Programs\Ollama"
Start-Process powershell -ArgumentList '-NoExit','-Command','ollama pull gemma4:e4b'
# B. 命令列工具（gws 需要 Node.js）
winget install --id OpenJS.NodeJS.LTS -e --accept-package-agreements --accept-source-agreements --silent
$env:PATH += ";$env:ProgramFiles\nodejs;$env:APPDATA\npm"
npm install -g --allow-scripts=@googleworkspace/cli @googleworkspace/cli
# C. 測一下（新開一個 PowerShell 視窗再跑，PATH 才會更新）
ollama --version      # 0.40.1
node -v               # v24.x
gws --version         # gws 0.22.5
ollama list           # 等 pull 完會看到 gemma4:e4b
# D. 把「會自己搜」的系統提示烤進模型（Modelfile 放在同一個資料夾）
ollama create gemma4-search -f Modelfile
