# 本地模型＋網路搜尋：模型自己決定要不要搜（工具呼叫）
# 需要：Ollama 在跑、已 pull gemma4:e4b；pip install ddgs
# 用法：python search_agent.py            （互動模式，輸入 q 離開）
#       python search_agent.py "你的問題"  （問一題就結束）
import json, sys, time, urllib.request, re, html
from ddgs import DDGS

MODEL = "gemma4:e4b"
OLLAMA = "http://127.0.0.1:11434/api/chat"
SYSTEM = ("你是研究助理。你有 web_search 與 fetch_page 兩個工具。遇到最近發生的事、日期在你知識之後的事、版本號、價格，"
          "或任何你不確定的事實，先呼叫 web_search；搜尋結果不夠明確時，用 fetch_page 讀官方頁面確認。"
          "回答用繁體中文，附上你實際用到的來源網址；查不到就老實說查不到。")
TOOLS = [
    {"type": "function", "function": {"name": "web_search", "description": "用 DuckDuckGo 搜尋網路，回傳前幾筆的標題、網址、摘要。",
     "parameters": {"type": "object", "properties": {"query": {"type": "string", "description": "搜尋關鍵字"}}, "required": ["query"]}}},
    {"type": "function", "function": {"name": "fetch_page", "description": "讀取一個網頁，回傳主要文字（前 3000 字）。",
     "parameters": {"type": "object", "properties": {"url": {"type": "string"}}, "required": ["url"]}}},
]

def web_search(query):
    rows = DDGS().text(query, max_results=5)
    return json.dumps([{"title": r.get("title"), "url": r.get("href"), "snippet": r.get("body")} for r in rows], ensure_ascii=False)

def fetch_page(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    raw = urllib.request.urlopen(req, timeout=20).read(400000).decode("utf-8", "replace")
    txt = re.sub(r"<script.*?</script>|<style.*?</style>", " ", raw, flags=re.S | re.I)
    txt = html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", txt)))
    return txt[:3000]

def ask_model(messages):
    body = json.dumps({"model": MODEL, "messages": messages, "tools": TOOLS, "stream": False,
                       "think": False, "options": {"num_ctx": 16384}}).encode()
    req = urllib.request.Request(OLLAMA, data=body, headers={"Content-Type": "application/json"})
    return json.loads(urllib.request.urlopen(req, timeout=900).read())["message"]

def answer(question, log=print):
    msgs = [{"role": "system", "content": SYSTEM}, {"role": "user", "content": question}]
    t0 = time.time()
    for _ in range(6):                      # 最多六輪工具呼叫
        m = ask_model(msgs); msgs.append(m)
        calls = m.get("tool_calls") or []
        if not calls:
            break
        for c in calls:
            fn = c["function"]["name"]; args = c["function"].get("arguments") or {}
            log(f"  🔍 模型決定呼叫 {fn}：{json.dumps(args, ensure_ascii=False)}")
            try:
                out = web_search(args.get("query", "")) if fn == "web_search" else fetch_page(args.get("url", ""))
            except Exception as e:
                out = f"ERROR: {e}"
            msgs.append({"role": "tool", "content": out, "tool_name": fn})
    log(f"  ⏱ {time.time() - t0:.0f} 秒")
    return msgs[-1].get("content", "")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        print(answer(" ".join(sys.argv[1:])))
    else:
        print(f"本地模型 {MODEL}，輸入問題（q 離開）")
        while True:
            q = input("\n你：").strip()
            if q.lower() in ("q", "quit", "exit"): break
            if q: print("\n模型：" + answer(q))
