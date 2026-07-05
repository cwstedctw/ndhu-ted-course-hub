# -*- coding: utf-8 -*-
"""
course-intro 雙語版頁型建構函式（英文為主、中文小字在下）。

從 v1 generate_aa_en.py 抽出。與 pagebuilders.py 共用同一套 slide 骨架
（render_slide／icon／HEAD/TAIL／seal／arcs——都 import 自 pagebuilders），
只在「文字層」多一組雙語版式函式（bititle／zh／雙語 partcard 等）。

版式骨架不動：v1 已證明 generate_aa_en.py 是「複製 generate.py 結構＋內容雙語化、
非改版式」，所以這裡是文字排法的差異，deck.css 的 .bi-title/.zh-sub/.zh/.ctitle.en
等雙語 class 早就備好（照抄自 v1，不改）。
"""
from pagebuilders import esc, icon  # noqa: F401  共用 icon 與 esc（＝html.escape，quote=True）

# 說明：v1 generate_aa_en.py 的 esc＝html.escape（quote=True），會把 & ' " < > 全轉義。
# 經 builder helper（bititle/weekcell/statblock/partcard/toolcard/tband/ruleitem）的
# 文字參數都走這條，故本 skill 也用同一個 esc 對齊。
# 例外：少數 v1「直接寫進 f-string、沒過 esc」的英文字面 HTML（page6 noteEn、
# page8 step label、page9 band text、page19 actionEn 的裸 & 和 '），在 generate_deck.py
# 對應處以 raw 輸出（不套 esc）逐位元組對齊，見那幾頁的註解。


def kicker(t):
    return f'<div class="kicker">{esc(t)}</div>'


def bititle(en, zh, big=False):
    """雙語標題：英文（Outfit）大 + 中文 serif 小字 + 金色短底線。"""
    c = "bi-title big" if big else "bi-title"
    return f'<div class="{c}">{esc(en)}<span class="zh">{esc(zh)}</span></div><hr class="rule">'


def zh(s):
    """行內中文小字（.zh-sub），接在英文文字後。"""
    return f'<span class="zh-sub">{esc(s)}</span>'


def pending(t):
    return f'<span class="pending-text">{esc(t)}</span>'


def infocard(ic, lab, val):
    """val 允許帶 HTML（呼叫端已組好英文＋zh() 小字），沿用 v1。"""
    return (f'<div class="card infocard"><div style="display:flex;gap:16px;align-items:flex-start">'
            f'<div style="flex:none;margin-top:2px">{icon(ic)}</div>'
            f'<div><div class="label">{esc(lab)}</div><div class="value">{val}</div></div></div></div>')


linecard = infocard


def partcard(num, head_en, head_zh, body_en, body_zh):
    return (f'<div class="card part"><div class="pnum">PART {esc(num)}</div>'
            f'<div class="phead">{esc(head_en)}<span class="zh-sub" style="font-size:15px">{esc(head_zh)}</span></div>'
            f'<div class="pbody">{esc(body_en)}<span class="zh-sub">{esc(body_zh)}</span></div></div>')


def weekcell(num, lab_en, lab_zh, kind):
    dotc = "dot ms" if kind == "ms" else "dot"
    return (f'<div class="wk"><div class="{dotc}"></div>'
            f'<div class="wnum">W{esc(num)}</div>'
            f'<div class="wlab">{esc(lab_en)}'
            f'<span style="display:block;font-size:12px;color:var(--mist);margin-top:2px">{esc(lab_zh)}</span></div></div>')


def progress_ring(pct, color1="#0E7C7B", color2="#D9A441"):
    offset = 176 - (176 * pct) / 100
    return f'''
    <div style="position:relative; width:90px; height:90px; margin-bottom:12px; display:inline-block;">
      <svg width="90" height="90" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r="28" stroke="rgba(14, 124, 123, 0.08)" stroke-width="6" fill="none"/>
        <circle cx="40" cy="40" r="28" stroke="url(#grad-{pct})" stroke-width="6" fill="none"
                stroke-dasharray="176" stroke-dashoffset="{offset}"
                stroke-linecap="round" transform="rotate(-90 40 40)"/>
        <defs><linearGradient id="grad-{pct}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="{color1}"/><stop offset="100%" stop-color="{color2}"/>
        </linearGradient></defs>
      </svg>
      <div style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
                  font-family:var(--lat); font-size:22px; font-weight:800; color:var(--ink);">
        {pct}<span style="font-size:12px; font-weight:700; color:var(--gold); margin-left:1px;">%</span>
      </div>
    </div>
    '''


def statblock(pct, label_en, label_zh, sub_en="", c1="var(--teal)", c2="var(--gold)"):
    ring = progress_ring(pct, c1, c2)
    sub_html = (f'<div class="ssub">{esc(sub_en)}</div>' if sub_en
                else '<div class="ssub" style="visibility:hidden">—</div>')
    return (f'<div class="card stat" style="align-items:center; text-align:center;">'
            f'{ring}'
            f'<div class="slabel" style="font-size:18px; font-weight:800; margin-top:8px;">{esc(label_en)}'
            f'<span class="zh-sub" style="font-size:14px;margin-top:1px">{esc(label_zh)}</span></div>'
            f'{sub_html}</div>')


def toolcard(ic, name, sub_en, sub_zh):
    return (f'<div class="card tool"><div class="ic">{icon(ic)}</div>'
            f'<div class="tname">{esc(name)}</div>'
            f'<div class="tsub">{esc(sub_en)}<span class="zh-sub" style="font-size:13px">{esc(sub_zh)}</span></div></div>')


def tband(ic, gname_en, gname_zh, items):
    """items = [(name, sub), ...]"""
    its = "".join(f'<div class="it"><b>{esc(n)}</b><span>{esc(s)}</span></div>' for n, s in items)
    return (f'<div class="tband" style="padding:14px 0"><div class="g"><div class="ic">{icon(ic)}</div>'
            f'<div class="gn">{esc(gname_en)}'
            f'<span style="display:block;font-size:13px;color:var(--mist);font-weight:500">{esc(gname_zh)}</span></div></div>'
            f'<div class="items">{its}</div></div>')


def ruleitem(num, head_en, head_zh, body_en, body_zh):
    # padding 15px→10px（2026-07-03）：v1 三條雙語守則總高超出 720px 畫布，
    # 第 3 條中文行被裁出畫面（review agent 逐頁目檢抓到的 v1 既有蟲）——
    # 三條共省 30px，讓最後一行中文回到畫布內。
    return (f'<div class="rule-item" style="padding:10px 0"><div class="num">{esc(num)}</div><div>'
            f'<div class="rt">{esc(head_en)}'
            f'<span style="display:block;font-size:18px;color:var(--on-dark-dim);font-weight:700;margin-top:2px">{esc(head_zh)}</span></div>'
            f'<div class="rb">{esc(body_en)}'
            f'<span style="display:block;font-size:14px;margin-top:2px">{esc(body_zh)}</span></div></div></div>')
