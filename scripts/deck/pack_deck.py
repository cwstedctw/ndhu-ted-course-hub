# -*- coding: utf-8 -*-
"""
course-intro 打包器 — 把 19 頁 slides＋deck.css＋assets 打成單檔自足 deck.html。

移植自 v1 build/build_html_deck.py（OneDrive，唯讀）：
- 資產 base64 內嵌（data URI），輸出約 10MB 級、雙擊即播、離線可看
  （字型走 Google Fonts @import，離線時退回系統字型，行為同 v1）
- 捲動式外殼：固定 1280×720 等比縮放填滿容器（resize 自適應）
- 第 9 頁（17 週地圖）捲到才逐週浮現（IntersectionObserver reveal，同 v1）

用法：
    python pack_deck.py --slides-dir <slides資料夾> --css <deck.css> \
        --assets <assets資料夾> --out <deck.html> \
        [--course-json <course.json> --section AA]

--course-json＋--section 給的話，頁首 lead 區塊（課名／英文名／學期／單位）從
course.json 讀出組成（資料驅動，對齊本 skill 精神）；不給就只出 19 頁、無 lead。
"""
import argparse
import base64
import glob
import os
import re
import sys

# 頁數不再固定（2026-07-03 跳頁支援）——以 slides 夾實際 NN.html 為準

MIME = {
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".webp": "image/webp", ".gif": "image/gif", ".svg": "image/svg+xml",
}

# ---- 外殼樣式與腳本：照抄 v1 build_html_deck.py（版式資產，非課程內容）----
SHELL_CSS = """
html,body{margin:0;background:#0a1414;color-scheme:dark}
body{font-family:'Outfit','Noto Sans TC',sans-serif}
.wrap{max-width:1180px;margin:0 auto;padding:26px 16px 90px}
.lead{text-align:center;color:#E6F2F2;padding:14px 0 2px}
.lead h1{font-family:'Noto Serif TC',serif;font-size:28px;margin:0;font-weight:900}
.lead .en{font-family:'Outfit',sans-serif;color:#D9A441;font-size:18px;font-weight:700;margin-top:4px}
.lead p{color:#9FBDBC;font-size:13px;margin:8px 0 0}
.page{margin:22px 0}
.frame{position:relative;width:100%;padding-top:56.25%;overflow:hidden;border-radius:16px;
  box-shadow:0 12px 44px rgba(0,0,0,.5)}
.frame .stage{position:absolute;top:0;left:0;width:1280px;height:720px;transform-origin:top left}
.reveal-roadmap .wk{opacity:0;transform:translateY(14px);transition:opacity .5s ease, transform .5s ease}
.reveal-roadmap.in .wk{opacity:1;transform:none}
"""

SHELL_JS = """
function fit(){document.querySelectorAll('.stage').forEach(function(st){
  st.style.transform='scale('+(st.parentElement.clientWidth/1280)+')';});}
window.addEventListener('resize',fit);window.addEventListener('load',fit);fit();
var io=new IntersectionObserver(function(es){es.forEach(function(e){
  if(e.isIntersecting){e.target.querySelectorAll('.wk').forEach(function(w,i){
    w.style.transitionDelay=(i*0.08)+'s';});e.target.classList.add('in');io.unobserve(e.target);}});},
  {threshold:0.35});
document.querySelectorAll('.reveal-roadmap').forEach(function(p){io.observe(p);});
"""


def build_lead(course_json_path, section_id, lang="zh"):
    """從 course.json 組頁首 lead（資料驅動；v1 是 AA/AB 兩段硬編）。lang＝bilingual 時出中英並列 lead。"""
    import json
    with open(course_json_path, encoding="utf-8") as f:
        course = json.load(f)
    import html as _html
    name = _html.escape(str(course.get("name", "")))
    name_en = _html.escape(str(course.get("nameEn", "")))
    semester = _html.escape(str(course.get("semester", "")))
    org = _html.escape(str(course.get("org", "")))
    sec = _html.escape(str(section_id))

    if lang == "bilingual":
        # 對齊 v1 export_deck 部署的雙語版 lead（英文課名行＋中英並列頁尾行）
        title = f"{name} {sec} · Introduction to AI — 課程介紹"
        lead = (f'<div class="lead"><h1>{name} {sec}</h1>'
                f'<div class="en">{name_en}</div>'
                f'<p>{semester} 課程介紹 · Course Introduction　|　'
                f'國立東華大學 通識教育中心 National Dong Hwa University</p></div>')
        return title, lead

    title = f"{name} {sec} — 課程介紹"
    lead = (f'<div class="lead"><h1>{name} {sec}</h1>'
            f'<div class="en">{name_en}</div>'
            f'<p>{semester} 課程介紹　|　{org}</p></div>')
    return title, lead


def main():
    ap = argparse.ArgumentParser(description="course-intro 打包器（單檔自足 deck.html）")
    ap.add_argument("--slides-dir", required=True, help="19 頁 slides 資料夾（01.html…19.html）")
    ap.add_argument("--css", required=True, help="deck.css 路徑")
    ap.add_argument("--assets", required=True, help="assets 資料夾（頁面內 ../assets/ 引用的圖）")
    ap.add_argument("--out", required=True, help="輸出 deck.html 路徑")
    ap.add_argument("--course-json", default=None, help="選配：course.json（組頁首 lead 用）")
    ap.add_argument("--section", default=None, help="選配：班別 id（與 --course-json 一起用）")
    ap.add_argument("--lang", default="zh", choices=["zh", "bilingual"],
                    help="頁首 lead 語言：zh＝中文（預設）；bilingual＝中英並列（對齊部署雙語版）")
    args = ap.parse_args()

    deck_css = open(args.css, encoding="utf-8").read()

    _uri_cache = {}

    def data_uri(fn):
        if fn not in _uri_cache:
            path = os.path.join(args.assets, fn)
            ext = os.path.splitext(fn)[1].lower()
            mime = MIME.get(ext, "image/png")
            with open(path, "rb") as f:
                _uri_cache[fn] = f"data:{mime};base64," + base64.b64encode(f.read()).decode()
        return _uri_cache[fn]

    # 2026-07-03 跳頁支援：頁數依課程內容而定（可跳工具三頁），改 glob 全部 NN.html
    # 並驗流水號連續，不再假設固定 19 頁。
    paths = sorted(glob.glob(os.path.join(args.slides_dir, "[0-9][0-9].html")))
    if not paths:
        print(f"錯誤：{args.slides_dir} 找不到 NN.html", file=sys.stderr)
        sys.exit(1)
    nums = [int(os.path.basename(p)[:2]) for p in paths]
    if nums != list(range(1, len(paths) + 1)):
        print(f"錯誤：頁碼流水號不連續（{nums}）", file=sys.stderr)
        sys.exit(1)

    slides = []
    for p in paths:
        h = open(p, encoding="utf-8").read()
        m = re.search(r"<body>(.*)</body>", h, re.S)
        if not m:
            print(f"錯誤：{p} 找不到 <body>…</body>", file=sys.stderr)
            sys.exit(1)
        body = m.group(1)
        body = re.sub(r"\.\./assets/([\w\-.]+)", lambda mm: data_uri(mm.group(1)), body)
        slides.append(body)

    pages = []
    for s in slides:
        # 17 週地圖 reveal 頁改用內容標記判定（中文/雙語第 9 頁皆含此 kicker、他頁無）——
        # 跳頁後頁面位置會漂移，不能再用「第 9 格」位置規則（v1 版式規則不變、判定方式改）。
        cls = "page reveal-roadmap" if "17-WEEK ROADMAP" in s else "page"
        pages.append(f'<section class="{cls}"><div class="frame"><div class="stage">{s}</div></div></section>')
    pages_html = "\n".join(pages)

    if args.course_json and args.section:
        title, lead = build_lead(args.course_json, args.section, lang=args.lang)
    else:
        title, lead = "課程介紹", ""

    html_doc = (
        '<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width, initial-scale=1">'
        f'<title>{title}</title>'
        f'<style>{deck_css}</style><style>{SHELL_CSS}</style></head><body>'
        '<div class="wrap">'
        f'{lead}'
        f'{pages_html}'
        '</div>'
        f'<script>{SHELL_JS}</script></body></html>'
    )

    os.makedirs(os.path.dirname(os.path.abspath(args.out)) or ".", exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        f.write(html_doc)
    print(f"HTML deck -> {args.out} ({os.path.getsize(args.out) // 1024} KB)")


if __name__ == "__main__":
    main()
