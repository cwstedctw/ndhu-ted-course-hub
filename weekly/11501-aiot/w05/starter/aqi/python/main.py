# W5 花蓮 AQI 跑馬燈：Linux 這半——跟環境部開放資料要花蓮測站的 AQI，整理成一行字，交給 MCU 捲動
import json
import pathlib
import ssl
import time
import urllib.parse
import urllib.request

from arduino.app_utils import *

SITE = "花蓮"  # 環境部測站名稱
LABEL = "HUALIEN"  # 點陣只認得英文字母和數字
CACHE_SECONDS = 600  # 10 分鐘內只問一次：測站每小時才更新，金鑰每天也有次數上限
RETRY_SECONDS = 60  # 沒拿到資料時，1 分鐘後再試
KEY_FILE = pathlib.Path(__file__).with_name("moenv_key.txt")  # 金鑰放檔案，不寫進程式

# 環境部網站的憑證少了一個新版 Python 預設要查的欄位；只放寬這一項，憑證和網址照樣驗證
SSL_CTX = ssl.create_default_context()
SSL_CTX.verify_flags &= ~ssl.VERIFY_X509_STRICT

last_text = "WAIT"
last_fetch = 0.0


def fetch_aqi() -> str:
    key = KEY_FILE.read_text().strip()
    query = urllib.parse.urlencode({"api_key": key, "format": "JSON", "filters": f"sitename,EQ,{SITE}"})
    url = "https://data.moenv.gov.tw/api/v2/aqx_p_432?" + query
    with urllib.request.urlopen(url, timeout=15, context=SSL_CTX) as r:
        body = r.read().decode("utf-8")
    try:
        records = json.loads(body)
    except ValueError:
        print("moenv says:", body[:60])  # 金鑰打錯、或今天的次數用完了
        return "KEY?"
    if not records:
        print("no such site:", SITE)
        return "NO SITE"
    rec = records[0]
    print("moenv:", rec["publishtime"], rec["sitename"], "AQI", rec["aqi"], rec["status"])
    return f"{LABEL} AQI {rec['aqi'] or '--'} PM2.5 {rec['pm2.5'] or '--'}"


def get_aqi_text() -> str:
    global last_text, last_fetch
    now = time.time()
    if now - last_fetch < CACHE_SECONDS:
        print("cache:", last_text)
        return last_text
    last_fetch = now
    try:
        last_text = fetch_aqi()
    except FileNotFoundError:
        last_text = "NO KEY"
        print("no key file:", KEY_FILE.name)
    except Exception as e:
        last_text = "NO DATA"
        print("fetch failed:", type(e).__name__)
    if not last_text.startswith(LABEL):  # 沒拿到資料：不等 10 分鐘，1 分鐘後再試
        last_fetch = now - CACHE_SECONDS + RETRY_SECONDS
    return last_text


Bridge.provide("get_aqi_text", get_aqi_text)

App.run()
