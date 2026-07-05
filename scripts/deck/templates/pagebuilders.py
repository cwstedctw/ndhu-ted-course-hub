# -*- coding: utf-8 -*-
"""
course-intro 頁型建構函式 — 從 v1 generate.py 抽出、資料驅動化。

這裡放的是「頁型版式」（page layout）：卡片排法、icon、深淺底規則、
HTML 骨架。所有具體課程內容一律由呼叫端（generate_deck.py）從
course.json 讀出後傳進來，本檔不硬編任何課程資訊。

沿用 v1 的 CSS class 名稱與版式邏輯（deck.css 不動），
是 parity 驗證的基礎——版式不變，內容才能逐頁比對。
"""
import html
import sys


def esc(s):
    return html.escape(str(s))


_QR_WARNED = False


def qr_svg(data, size=176, dark="#07403F"):
    """URL → inline SVG QR（第 19 頁課程網站掃碼用，2026-07-05 Ted 授權設計升級）。

    可選依賴 `qrcode`（pip install qrcode，取矩陣不需 PIL）：沒裝回傳 None、
    stderr 提示一次，呼叫端退回純文字網址版——別台機器沒裝也能照常出 deck。
    暗色用 teal-deep（#07403F）配白底，對比夠掃；同輸入同輸出（矩陣決定性），
    不影響重跑比對。
    """
    global _QR_WARNED
    try:
        import qrcode
    except ImportError:
        if not _QR_WARNED:
            print("[course-intro] 未安裝 qrcode 套件——第 19 頁退回純文字網址"
                  "（pip install qrcode 可補掃碼）", file=sys.stderr)
            _QR_WARNED = True
        return None
    qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M,
                       box_size=1, border=4)
    qr.add_data(str(data))
    qr.make(fit=True)
    matrix = qr.get_matrix()  # 含 border 的布林矩陣
    n = len(matrix)
    # 每列連續黑模組併成一段 path（比逐格 rect 省 HTML 體積）
    segs = []
    for y, row in enumerate(matrix):
        cells = list(row) + [False]  # 哨兵收尾
        run = None
        for x, v in enumerate(cells):
            if v and run is None:
                run = x
            elif not v and run is not None:
                segs.append(f"M{run} {y}h{x - run}v1H{run}z")
                run = None
    return (
        f'<svg width="{size}" height="{size}" viewBox="0 0 {n} {n}" role="img" '
        f'aria-label="課程網站 QR code" shape-rendering="crispEdges" '
        f'xmlns="http://www.w3.org/2000/svg">'
        f'<rect width="{n}" height="{n}" fill="#FFFFFF"/>'
        f'<path d="{"".join(segs)}" fill="{dark}"/></svg>'
    )


# ---- icon 圖庫（版式固定資產，非課程內容，照抄 v1）----
ICONS = {
    "clock": '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    "pin": '<path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/>',
    "cap": '<path d="M2 9l10-4 10 4-10 4Z"/><path d="M6 11v4c0 1.5 3 2.5 6 2.5s6-1 6-2.5v-4"/>',
    "user": '<circle cx="12" cy="8" r="4"/><path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6"/>',
    "mail": '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    "phone": '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z"/>',
    "msg": '<path d="M4 5h16v11H8l-4 4Z"/>',
    "pen": '<path d="M14 4l6 6L9 21H3v-6Z"/>',
    "tool": '<path d="M14 7a4 4 0 0 0-5 5l-6 6 3 3 6-6a4 4 0 0 0 5-5l-3 3-3-3Z"/>',
    "search": '<circle cx="11" cy="11" r="7"/><path d="m21 21-4-4"/>',
    "slides": '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M9 21h6M12 17v4"/>',
    "music": '<circle cx="7" cy="17" r="3"/><circle cx="18" cy="15" r="3"/><path d="M10 17V6l11-2v11"/>',
    "bot": '<rect x="5" y="8" width="14" height="11" rx="3"/><path d="M12 8V4M9 13h.01M15 13h.01"/>',
    "term": '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m7 9 3 3-3 3M13 15h4"/>',
    "qr": '<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h3v3h-3zM19 19h1v1h-1z"/>',
    "laptop": '<rect x="4" y="5" width="16" height="11" rx="2"/><path d="M2 20h20"/>',
    "shield": '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6Z"/>',
    "book": '<path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2Z"/><path d="M18 3v16"/>',
}


def icon(name, color="var(--teal)", size=22, sw=1.75):
    p = ICONS.get(name, "")
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" '
            f'stroke="{color}" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round">{p}</svg>')


HEAD = ('<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8">'
        '<link rel="stylesheet" href="../deck.css"></head><body>')
TAIL = '</body></html>'


def seal(dark, alt="國立東華大學"):
    src = "../assets/seal-white.png" if dark else "../assets/seal-color.png"
    return f'<img class="seal" src="{src}" alt="{alt}">'


def org_footer(dark, org_text):
    return f'<div class="footer-org">{esc(org_text)}</div>'


def arcs():
    return ('<div class="arc" style="width:520px;height:520px;right:-150px;top:-160px"></div>'
            '<div class="arc" style="width:340px;height:340px;right:-60px;top:-40px;'
            'border-color:rgba(230,242,242,.10)"></div>')


def render_slide(inner, org_text, dark=False, cover=False, no_footer=False, seal_alt="國立東華大學"):
    """組一頁完整 HTML（骨架＝版式固定，inner＝呼叫端傳入的課程內容）。
    seal_alt＝校徽 alt 文字（中文版預設「國立東華大學」；雙語版傳英文 alt 對齊 v1）。"""
    cls = "slide cover" if cover else ("slide slide--dark" if dark else "slide slide--light")
    extras = "" if cover else (arcs() if dark else "")
    foot = "" if (cover or no_footer) else org_footer(dark, org_text)
    sealimg = "" if cover else seal(dark, alt=seal_alt)
    return f'{HEAD}<div class="{cls}">{extras}{inner}{foot}{sealimg}</div>{TAIL}'


def kicker(t):
    return f'<div class="kicker">{esc(t)}</div>'


def title(t, big=False):
    c = "title title--big" if big else "title"
    return f'<div class="{c}">{esc(t)}</div><hr class="rule">'


def pending(t):
    return f'<span class="pending-text">{esc(t)}</span>'


def infocard(ic, lab, val):
    """val 允許帶 HTML（呼叫端已組好 <small> 等），沿用 v1 行為。"""
    return (f'<div class="card infocard"><div style="display:flex;gap:16px;align-items:flex-start">'
            f'<div style="flex:none;margin-top:2px">{icon(ic)}</div>'
            f'<div><div class="label">{esc(lab)}</div><div class="value">{val}</div></div></div></div>')


linecard = infocard  # v1 中 linecard 與 infocard 同構，保留兩個名字方便對照 v1 呼叫點


def partcard(num, head, body):
    return (f'<div class="card part"><div class="pnum">PART {esc(num)}</div>'
            f'<div class="phead">{esc(head)}</div><div class="pbody">{esc(body)}</div></div>')


def weekcell(num, lab, kind):
    dotc = "dot ms" if kind == "ms" else "dot"
    return (f'<div class="wk"><div class="{dotc}"></div>'
            f'<div class="wnum">W{esc(num)}</div><div class="wlab">{esc(lab)}</div></div>')


def progress_ring(pct, color1="#0E7C7B", color2="#D9A441"):
    offset = 176 - (176 * pct) / 100
    return f'''
    <div style="position:relative; width:90px; height:90px; margin-bottom:12px; display:inline-block;">
      <svg width="90" height="90" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r="28" stroke="rgba(14, 124, 123, 0.08)" stroke-width="6" fill="none"/>
        <circle cx="40" cy="40" r="28" stroke="url(#grad-{pct})" stroke-width="6" fill="none"
                stroke-dasharray="176" stroke-dashoffset="{offset}"
                stroke-linecap="round" transform="rotate(-90 40 40)"/>
        <defs>
          <linearGradient id="grad-{pct}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="{color1}"/>
            <stop offset="100%" stop-color="{color2}"/>
          </linearGradient>
        </defs>
      </svg>
      <div style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
                  font-family:var(--lat); font-size:22px; font-weight:800; color:var(--ink);">
        {pct}<span style="font-size:12px; font-weight:700; color:var(--gold); margin-left:1px;">%</span>
      </div>
    </div>
    '''


def statblock(pct, label, sub="", c1="var(--teal)", c2="var(--gold)"):
    ring = progress_ring(pct, c1, c2)
    sub_html = (f'<div class="ssub">{esc(sub)}</div>' if sub
                else '<div class="ssub" style="visibility:hidden">—</div>')
    return (f'<div class="card stat" style="align-items:center; text-align:center;">'
            f'{ring}'
            f'<div class="slabel" style="font-size:18px; font-weight:800; margin-top:8px;">{esc(label)}</div>'
            f'{sub_html}'
            f'</div>')


def toolcard(ic, name, sub, cols=1, bg_style=""):
    span = f' style="grid-column: span {cols}; {bg_style}"' if (cols > 1 or bg_style) else ""
    return (f'<div class="card tool"{span}><div class="ic">{icon(ic)}</div>'
            f'<div class="tname">{esc(name)}</div><div class="tsub">{esc(sub)}</div></div>')


def tband(ic, gname, items, compact=False):
    """items = [(name, sub), ...]；compact＝工具帶 ≥5 組時的窄邊距版（19px→10px），
    防止總高超出 720px 畫布把尾註擠到頁尾上（2026-07-03 it-apply 五組實測）。"""
    its = "".join(f'<div class="it"><b>{esc(n)}</b><span>{esc(s)}</span></div>' for n, s in items)
    style = ' style="padding:10px 0"' if compact else ''
    return (f'<div class="tband"{style}><div class="g"><div class="ic">{icon(ic)}</div>'
            f'<div class="gn">{esc(gname)}</div></div><div class="items">{its}</div></div>')


def ruleitem(num, head, body):
    return (f'<div class="rule-item"><div class="num">{esc(num)}</div><div>'
            f'<div class="rt">{esc(head)}</div><div class="rb">{esc(body)}</div></div></div>')
