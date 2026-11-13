# LINE bot 簡單版：一支 Python 程式就是整個 bot，跑在你自己的電腦上
#
# 傳什麼進來，它做什麼：
#   問問題（「2026 年諾貝爾物理獎得主是誰？」）→ 交給你電腦上的 Ollama 本地模型，需要就自己上網搜，回覆附來源
#   講行程（「明天下午三點開會」）            → 整理出日期時間，排進 Google 日曆
#   傳照片（活動海報、便條紙）               → 照片存進雲端硬碟；模型看照片說上面有什麼；有日期時間就排進日曆
#   問題、行程、照片都先寫一列進 Google 試算表，才回覆（只講已經做完的事；打招呼和看不懂的格式不記）
# 雲端硬碟、試算表、日曆都用第 2 段登入好的 gws；模型一律打本機 Ollama 的 API（http://127.0.0.1:11434）。
#
# 為什麼還要「通道」：LINE 的伺服器要把訊息送進來，得找得到你的電腦；
# 教室和家裡的電腦都躲在網路後面，所以用 Cloudflare 的免費臨時通道給它一個 https 網址。
# 程式開起來會自己把 LINE 的 Webhook 換成這個網址，按 Ctrl+C 結束時再換回原本的（例如你 W5 的 Apps Script）。
#
# 需要：Python 3（只用內建功能，不用 pip install）、Ollama 開著且有 gemma4:e4b、
#       gws 已登入（要有 drive、sheets、calendar 權限）、cloudflared、LINE 的長效通行碼（W5 申請過）
# 用法（PowerShell，在這個檔所在的資料夾）：
#   python line_bot_local.py
# 開起來會問你 LINE 長效通行碼、Channel secret（畫面不顯示）和試算表 ID，貼上按 Enter 就好。

import base64, getpass, hashlib, hmac, json, os, queue, re, shutil, subprocess, sys, tempfile, threading, time, urllib.error, urllib.request
from datetime import datetime, timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

MODEL = os.environ.get("MODEL", "gemma4:e4b")
PORT = int(os.environ.get("PORT", "8000"))
CALENDAR_ID = os.environ.get("CALENDAR_ID", "primary")          # 排進哪個日曆；primary＝你的主日曆
PHOTO_FOLDER = os.environ.get("PHOTO_FOLDER", "LINE待辦照片")   # 照片存進雲端硬碟的哪個資料夾（沒有就建）
OLLAMA = "http://127.0.0.1:11434"
GREETING = re.compile(r"^(hi|hello|你好|嗨|哈囉|測試|test)$", re.I)
HELP = ("你好！我是跑在同學電腦上的本地模型 🤖\n"
        "• 問我問題：需要的話我會上網查，附來源\n• 講行程（「明天下午三點開會」）：我排進 Google 日曆\n"
        "• 傳照片：我存進雲端硬碟、告訴你上面有什麼，有日期時間也幫你排日曆\n問題、行程、照片都會記進試算表。")
TOOLS = [
    {"type": "function", "function": {"name": "web_search", "description": "搜尋網路，回傳前幾筆標題、網址與內文。",
     "parameters": {"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"]}}},
    {"type": "function", "function": {"name": "web_fetch", "description": "讀一個網頁的主要文字。",
     "parameters": {"type": "object", "properties": {"url": {"type": "string"}}, "required": ["url"]}}},
]
EVENT_SHAPE = {"type": "object", "required": ["isEvent", "title", "date", "time"], "properties": {
    "isEvent": {"type": "boolean"}, "title": {"type": "string"},
    "date": {"type": "string", "description": "YYYY-MM-DD，沒提到就填空字串"},
    "time": {"type": "string", "description": "HH:MM（24 小時制）；有結束時間就寫 HH:MM-HH:MM；沒提到就填空字串"}}}

LINE_TOKEN = LINE_SECRET = SHEET_ID = ""  # main() 開起來時問你，再填進這裡
GWS = None
_folder_id = None
_turn = threading.Lock()  # 一次只處理一則：顯示卡一次只答一題，照片資料夾也不會被同時建兩個
_procs = []               # 開出去的 cloudflared，結束時一定要關
TUNNEL_WAIT = 60         # 等 cloudflared 給網址最多幾秒


def log(s):
    print(f"[{datetime.now():%H:%M:%S}] {s}", flush=True)


def today():
    return datetime.now().strftime("%Y-%m-%d（%A）")  # 附上星期幾，模型才算得準「下週五」


# ===== 1. 設定：開起來時問一次，不寫進檔案 =====
def ask_settings():
    token = os.environ.get("LINE_CHANNEL_ACCESS_TOKEN") or getpass.getpass("貼上 LINE 長效通行碼（Channel access token，畫面不顯示）：").strip()
    secret = os.environ.get("LINE_CHANNEL_SECRET") or getpass.getpass("貼上 Channel secret（LINE Developers → Basic settings；必填；畫面不顯示）：").strip()
    sheet = os.environ.get("SHEET_ID") or input("試算表 ID（網址 /d/ 和 /edit 中間那段；不寫試算表就直接 Enter）：").strip()
    return token, secret, sheet


# ===== 2. 叫 LINE、叫 Ollama、叫 gws 的小工具 =====
def http_json(method, url, body=None, headers=None, timeout=60):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={"Content-Type": "application/json", **(headers or {})})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read()
            return r.status, (json.loads(raw) if raw.strip() else {})
    except urllib.error.HTTPError as e:
        return e.code, {"error": e.read().decode("utf-8", "replace")[:200]}


def line(method, path, body=None):
    return http_json(method, "https://api.line.me" + path, body, {"Authorization": "Bearer " + LINE_TOKEN})


def reply(token, text):
    code, res = line("POST", "/v2/bot/message/reply", {"replyToken": token, "messages": [{"type": "text", "text": text[:5000]}]})
    if code != 200:
        log(f"⚠️ LINE 回覆失敗 {code}：{res}")


def download_image(message_id):
    req = urllib.request.Request(f"https://api-data.line.me/v2/bot/message/{message_id}/content",
                                 headers={"Authorization": "Bearer " + LINE_TOKEN})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


def ollama(path, body, timeout=60):
    code, res = http_json("POST", OLLAMA + path, body, timeout=timeout)
    if code != 200:
        raise RuntimeError(f"Ollama {path} 回應 {code}：{res}")
    return res


def chat(messages, timeout=60, **extra):
    body = {"model": MODEL, "messages": messages, "stream": False, "think": False, "keep_alive": "1h", "options": {"num_ctx": 16384}}
    return ollama("/api/chat", {**body, **extra}, timeout).get("message", {})


def gws(*args, upload=None, cwd=None):
    """跑一條 gws 指令，回傳它印出的 JSON。（gws 只肯上傳「目前資料夾」裡的檔，所以上傳時用 cwd 指到檔案所在的資料夾）"""
    cmd = [GWS, *args] + (["--upload", upload] if upload else [])
    r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", timeout=60, cwd=cwd)
    if r.returncode != 0:
        raise RuntimeError((r.stderr or r.stdout).strip()[-300:])
    return json.loads(r.stdout or "{}")


def find_gws():
    # npm 裝的 gws 背後有一個真正的 gws.exe；直接叫它，JSON 的引號才不會被 Windows 的 .cmd 轉接弄壞
    roots = [os.path.join(os.environ.get("APPDATA", ""), "npm", "node_modules")]
    try:  # npm 裝到別的地方時，問 npm 它的全域資料夾在哪
        roots.append(subprocess.run("npm root -g", shell=True, capture_output=True, text=True, timeout=30).stdout.strip())
    except Exception:
        pass
    for root in roots:
        exe = os.path.join(root, "@googleworkspace", "cli", "bin", "gws.exe")
        if root and os.path.exists(exe):
            return exe
    return None


# ===== 3. 模型：回答問題（自己決定要不要搜）、看照片、找出行程 =====
def ask_text(question):
    """模型自己決定要不要搜；回傳（答案, 來源網址清單）。"""
    msgs = [{"role": "system", "content": f"你是 LINE 上的助理，今天是 {today()}，可能比你的訓練資料新。"
             "遇到最近的事、版本號、價格或任何你不確定的事實，先呼叫 web_search；不夠明確再用 web_fetch 讀官方頁面。"
             "回答用台灣的繁體中文、純文字（不要用星號或井字號），150 字以內，先講結論；不用自己寫網址，程式會附上來源。"},
            {"role": "user", "content": question}]
    sources = []
    for _ in range(4):  # 最多來回四次工具呼叫
        m = chat(msgs, tools=TOOLS)
        msgs.append(m)
        if not m.get("tool_calls"):
            return m.get("content", "").replace("**", "").strip(), sources
        for c in m["tool_calls"]:
            name, args = c["function"]["name"], c["function"].get("arguments") or {}
            try:
                if name == "web_search":
                    log(f"  🔍 模型決定搜：{args.get('query')}")
                    rows = ollama("/api/experimental/web_search", {"query": args.get("query", ""), "max_results": 3}).get("results", [])
                    sources += [r["url"] for r in rows]
                    out = json.dumps([{"title": r["title"], "url": r["url"], "content": r["content"][:1500]} for r in rows], ensure_ascii=False)
                else:
                    log(f"  📄 模型決定讀網頁：{args.get('url')}")
                    page = ollama("/api/experimental/web_fetch", {"url": args.get("url", "")})
                    sources.insert(0, args.get("url", ""))
                    out = page.get("content", "")[:3000]
            except Exception as e:
                out = f"ERROR: {e}"
            msgs.append({"role": "tool", "tool_name": name, "content": out})
    return "查了幾次還整理不出答案，換個問法再試一次。", sources


def ask_image(jpg):
    m = chat([{"role": "user", "images": [base64.b64encode(jpg).decode()],
               "content": "這是使用者用 LINE 傳來的照片。用台灣的繁體中文、三句以內說明照片裡有什麼；"
                          "看得到日期、時間、地點、活動或繳費資訊就列出來，看不清楚的不要猜。"}])
    return re.sub(r"^\s*[*-]\s+", "• ", m.get("content", "").replace("**", ""), flags=re.M).strip()  # 星號清單在 LINE 上很亂，換成 •


def find_event(text):
    """請模型照固定格式回答「這是不是有日期和時間的行程」；欄位驗算過才算數，不照單全收。"""
    m = chat([{"role": "user", "content": f"今天是 {today()}，台北時間。下面這段文字如果是一個有日期和時間的行程、活動或提醒"
               "（不是在問問題），把「明天」「下週五」換算成實際日期，整理成 JSON；不是就 isEvent 填 false。\n\n" + text}],
             format=EVENT_SHAPE)
    try:
        ev = json.loads(m.get("content", "{}"))
        times = re.findall(r"\d{1,2}:\d{2}", ev["time"])  # 「15:10-17:00」這種區間：第一個是開始、第二個是結束
        ev["start"] = datetime.strptime(f"{ev['date']} {times[0]}", "%Y-%m-%d %H:%M")  # 2/30、25:99 這種不存在的會在這裡被擋掉
        ev["end"] = datetime.strptime(f"{ev['date']} {times[1]}", "%Y-%m-%d %H:%M") if len(times) > 1 else ev["start"] + timedelta(minutes=30)
        ev["time"] = f"{ev['start']:%H:%M}" + (f"–{ev['end']:%H:%M}" if len(times) > 1 else "")
    except (ValueError, KeyError, TypeError, IndexError):
        return None
    # 原文寫了「幾月幾日」或「10/20」，模型整理出來的日期要對得上：模型會偷偷把「2 月 30 日」改成 2 月 28 日
    said = re.search(r"(\d{4})\s*[-/年]\s*(\d{1,2})\s*[-/月]\s*(\d{1,2})|(\d{1,2})\s*月\s*(\d{1,2})\s*[日號]|(?<!\d)(\d{1,2})/(\d{1,2})(?!\d)", text)
    nums = [int(x) for x in said.groups() if x] if said else []
    if nums and nums != [ev["start"].year, ev["start"].month, ev["start"].day][-len(nums):]:
        log(f"  ⚠️ 模型整理的日期 {ev['date']} 跟原文「{said.group(0)}」對不上，不排日曆")
        return None
    return ev if ev.get("isEvent") is True and str(ev.get("title", "")).strip() and ev["end"] > ev["start"] else None


# ===== 4. Google：照片存雲端硬碟、排日曆、寫試算表（都用 gws） =====
def save_photo(jpg):
    """照片存進 PHOTO_FOLDER 資料夾（沒有就建），回傳檔案連結。"""
    global _folder_id
    if not _folder_id:
        q = f"name='{PHOTO_FOLDER}' and mimeType='application/vnd.google-apps.folder' and trashed=false"
        found = gws("drive", "files", "list", "--params", json.dumps({"q": q, "fields": "files(id)"}, ensure_ascii=False)).get("files", [])
        _folder_id = found[0]["id"] if found else gws("drive", "files", "create", "--json", json.dumps(
            {"name": PHOTO_FOLDER, "mimeType": "application/vnd.google-apps.folder"}, ensure_ascii=False))["id"]
    with tempfile.TemporaryDirectory() as tmp:  # 照片先存成暫存檔，上傳完整個暫存資料夾自動刪掉
        with open(os.path.join(tmp, "photo.jpg"), "wb") as fh:
            fh.write(jpg)
        f = gws("drive", "files", "create", "--params", json.dumps({"fields": "id,webViewLink"}),
                "--json", json.dumps({"name": f"line-{datetime.now():%Y%m%d-%H%M%S}.jpg", "parents": [_folder_id]}),
                upload="photo.jpg", cwd=tmp)
    log("  📷 照片存進雲端硬碟了")
    return f.get("webViewLink", "")


def add_calendar(ev):
    gws("calendar", "events", "insert", "--params", json.dumps({"calendarId": CALENDAR_ID}),
        "--json", json.dumps({"summary": ev["title"], "description": "由 LINE bot 簡單版建立",
                              "start": {"dateTime": f"{ev['start']:%Y-%m-%dT%H:%M:00}", "timeZone": "Asia/Taipei"},
                              "end": {"dateTime": f"{ev['end']:%Y-%m-%dT%H:%M:00}", "timeZone": "Asia/Taipei"}}, ensure_ascii=False))
    log(f"  🗓️ 排進日曆了：{ev['date']} {ev['time']}")


def write_sheet(row):
    """寫一列進試算表：時間、類型、傳了什麼、bot 回了什麼、照片連結、日曆。"""
    gws("sheets", "spreadsheets", "values", "append",
        "--params", json.dumps({"spreadsheetId": SHEET_ID, "range": "A1", "valueInputOption": "USER_ENTERED"}),
        "--json", json.dumps({"values": [row]}, ensure_ascii=False))
    log("  📝 寫進試算表了")


def try_do(what, fn, *args):
    """Google 那邊哪一件失敗，都不讓整則訊息掛掉；回傳（結果, 錯誤訊息；成功時是空字串）。"""
    try:
        return fn(*args), ""
    except Exception as e:
        log(f"⚠️ {what}失敗：{e}")
        return None, str(e)[:120] or "不明原因"


# ===== 5. 處理一則訊息：先把事情做完（存照片、排日曆、寫試算表）→ 才回覆，只講已經做完的事 =====
def handle(event):
    with _turn:
        _handle(event)


def _handle(event):
    if event.get("type") != "message" or not event.get("replyToken"):
        return
    msg, token = event["message"], event["replyToken"]
    user = event.get("source", {})
    if user.get("type") == "user":  # 「對方正在輸入…」動畫，最多 60 秒
        line("POST", "/v2/bot/chat/loading/start", {"chatId": user["userId"], "loadingSeconds": 60})
    t0, notes, link, cal = time.time(), [], "", ""
    try:
        if msg["type"] == "text":
            text = msg["text"].strip()
            if GREETING.match(text):
                return reply(token, HELP)
            log(f"📩 收到文字（{len(text)} 字）")  # 不印內容：螢幕可能正在投影
            kind, said, ev = "文字", text, find_event(text)
            if ev:  # 講行程：排日曆就好，不必上網查
                answer = f"📌 {ev['title']}\n📅 {ev['date']}　⏰ {ev['time']}"
            else:   # 問問題：交給模型，需要就自己搜
                answer, sources = ask_text(text)
                answer += ("\n\n來源：\n" + "\n".join("• " + u for u in list(dict.fromkeys(sources))[:3]) if sources
                           else "\n\nℹ️ 這題沒有上網查，只憑模型記憶，請自己核對。")
        elif msg["type"] == "image":
            log("📩 收到照片")
            jpg = download_image(msg["id"])
            kind, said = "照片", "（照片）"
            link, err = try_do("存照片", save_photo, jpg)
            notes.append(f"📷 照片已存進雲端硬碟「{PHOTO_FOLDER}」" if not err else "⚠️ 照片沒存進雲端硬碟：" + err)
            answer = ask_image(jpg)
            ev = find_event(answer)
        else:
            return reply(token, "目前我看得懂文字和照片，其他類型還不行喔。")
        if ev:
            _, err = try_do("排日曆", add_calendar, ev)
            cal = "已建立" if not err else "失敗：" + err
            notes.append(f"🗓️ 已排進 Google 日曆（{ev['date']} {ev['time']}）" if not err else "⚠️ 日曆沒排成：" + err)
        if SHEET_ID:
            _, err = try_do("寫試算表", write_sheet, [f"{datetime.now():%Y-%m-%d %H:%M:%S}", kind, said, answer[:500], link or "", cal])
            notes.append("📝 已記進試算表" if not err else "⚠️ 這則沒寫進試算表：" + err)
        reply(token, f"{answer}\n\n" + "\n".join(notes + [f"（本地模型 {time.time() - t0:.0f} 秒）"]))
        log(f"✅ 回覆了（{time.time() - t0:.0f} 秒）")
    except Exception as e:
        log(f"❌ {e}")
        reply(token, "⚠️ 出錯了：" + str(e)[:300])


class Webhook(BaseHTTPRequestHandler):
    def do_POST(self):
        body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
        if LINE_SECRET:  # 對簽章：確定真的是 LINE 送來的，不是知道網址的路人
            sig = base64.b64encode(hmac.new(LINE_SECRET.encode(), body, hashlib.sha256).digest()).decode()
            if not hmac.compare_digest(sig, self.headers.get("x-line-signature", "")):
                log("⛔ 簽章不對，不是 LINE 送來的，丟掉")
                self.send_response(401)
                self.end_headers()
                return
        self.send_response(200)  # 先跟 LINE 說收到了（LINE 要 2 秒內回應），再慢慢處理
        self.end_headers()
        for ev in json.loads(body or b"{}").get("events", []):
            threading.Thread(target=handle, args=(ev,), daemon=True).start()

    def do_GET(self):
        self.send_response(200)
        self.end_headers()
        self.wfile.write("LINE bot 簡單版運作中".encode())

    def log_message(self, *args):  # 不要印每一個連線
        pass


# ===== 6. 開通道、把 LINE 的 Webhook 換過來；結束時換回去 =====
def open_tunnel():
    """開 Cloudflare 臨時通道，最多等 60 秒拿網址；拿不到就把它關掉，回傳 None。"""
    if not shutil.which("cloudflared"):
        log("⚠️ 找不到 cloudflared，外面連不到這裡。另開 PowerShell 貼：winget install --id Cloudflare.cloudflared -e")
        log("   裝完關掉這個視窗、新開一個再跑一次。")
        return None
    cf = subprocess.Popen(["cloudflared", "tunnel", "--no-autoupdate", "--url", f"http://127.0.0.1:{PORT}"],
                          stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding="utf-8", errors="replace")
    _procs.append(cf)
    found = queue.Queue()

    def watch():  # 另一條執行緒一行一行讀它的輸出（之後的也照讀照丟，免得塞住）；主程式只等 60 秒
        for row in cf.stdout:
            m = re.search(r"https://[a-z0-9-]+\.trycloudflare\.com", row)
            if m:
                found.put(m.group(0))
        found.put(None)

    threading.Thread(target=watch, daemon=True).start()
    try:
        url = found.get(timeout=TUNNEL_WAIT)
    except queue.Empty:
        url = None
    if not url:
        log(f"⚠️ {TUNNEL_WAIT} 秒內通道沒拿到網址：看網路（學校網路可能擋），或再跑一次")
    return url


def restore(old):
    """把 LINE 的 Webhook 換回原本的，再讀一次確認真的換回去了（換的那條路說成功不算數）。"""
    if not old:
        log("ℹ️ 原本沒有 Webhook 網址，現在指著一個已經關掉的通道；要用 Apps Script 版就回 LINE Developers 貼回 /exec 網址")
        return
    line("PUT", "/v2/bot/channel/webhook/endpoint", {"endpoint": old})
    code, now = line("GET", "/v2/bot/channel/webhook/endpoint")
    if code == 200 and now.get("endpoint") == old:
        log("↩️ LINE 的 Webhook 換回原本的了（重新讀過一次，確認是原本那個）")
    else:
        log(f"⚠️ 沒能確認換回去：到 LINE Developers →「Messaging API」→ Webhook URL 手動貼回：{old}")


def main():
    global LINE_TOKEN, LINE_SECRET, SHEET_ID, GWS
    LINE_TOKEN, LINE_SECRET, SHEET_ID = ask_settings()
    GWS = find_gws()
    code, info = line("GET", "/v2/bot/info")
    if code != 200:
        sys.exit(f"LINE 通行碼不對（{code}）：回 LINE Developers 重新複製長效通行碼")
    log(f"✅ LINE bot「{info.get('displayName')}」")
    if not LINE_SECRET:
        sys.exit("沒有 Channel secret 就不開通道：沒有它，知道通道網址的人都能假冒 LINE 送訊息進來。"
                 "回 LINE Developers →「Basic settings」複製，再跑一次。")
    if not GWS:
        log("⚠️ 找不到 gws.exe：照片、日曆、試算表都會失敗（先裝 gws：指南 1-3）")
    code, cur = line("GET", "/v2/bot/channel/webhook/endpoint")
    if code == 200:
        old = cur.get("endpoint")
    elif code == 404:  # LINE 說這個 channel 原本就沒設 Webhook
        old = None
    else:  # 讀不到原本的網址就不換，免得換了回不去
        sys.exit(f"讀不到 LINE 現在的 Webhook 網址（{code}）：先不換。等一下再跑一次。{cur}")
    log(f"   原本的 Webhook：{old or '（沒有設定）'}——先抄下來，萬一沒換回去要手動貼回")
    log(f"載入模型 {MODEL}（第一次要等一下）…")
    chat([], timeout=300)
    log("✅ 模型已在顯示卡上")

    server = ThreadingHTTPServer(("127.0.0.1", PORT), Webhook)  # 只聽本機：外面只能從通道進來
    threading.Thread(target=server.serve_forever, daemon=True).start()
    switched = False
    try:  # 從開通道起就在 try 裡：只要 Webhook 換過，不管怎麼結束都會換回去
        url = open_tunnel()
        if url:
            code, res = line("PUT", "/v2/bot/channel/webhook/endpoint", {"endpoint": url + "/callback"})
            if code != 200:
                log(f"⚠️ 換 Webhook 失敗 {code}：{res}。可以手動貼到 LINE Developers：{url}/callback")
            else:
                switched = True
                log(f"✅ LINE 的 Webhook 換到這台電腦了：{url}/callback（按 Ctrl+C 會換回去）")
                log("   LINE 說換網址最多要 1 分鐘才生效；等一下再用手機傳訊息")
                time.sleep(5)
                code, test = line("POST", "/v2/bot/channel/webhook/test", {})
                log(f"   LINE 測試連線：{'✅ 通了' if test.get('success') else '還沒通（' + str(test.get('reason')) + '），等一分鐘再傳'}")
        log("開好了。手機傳訊息給 bot 試試看；這個視窗不要關，按 Ctrl+C 結束。" if switched
            else "⚠️ 這次沒接上 LINE（看上面的訊息）。按 Ctrl+C 結束。")
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        pass
    finally:
        if switched:
            restore(old)
        for cf in _procs:
            cf.terminate()
        server.shutdown()


if __name__ == "__main__":
    main()
