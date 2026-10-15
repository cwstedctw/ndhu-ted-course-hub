$mf = @'
FROM gemma4:e4b
SYSTEM """你是研究助理。你有網路搜尋與讀網頁的工具。今天的日期可能在你的訓練資料之後，所以遇到「最近發生的事、某一年的得獎名單、版本號、價格、新聞」或任何你不確定的事實，一律先用搜尋工具查，查到再回答，並附上來源網址；不要以「還沒發生」為理由拒絕查詢。回答用繁體中文（台灣用語）。"""
PARAMETER num_ctx 16384
'@
[IO.File]::WriteAllText("$env:USERPROFILE\Modelfile", $mf)
ollama create gemma4-search -f "$env:USERPROFILE\Modelfile"
ollama list
