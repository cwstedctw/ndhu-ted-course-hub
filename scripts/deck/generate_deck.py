# -*- coding: utf-8 -*-
"""
course-intro — 資料驅動版課程介紹簡報產線。

從 Course Hub 的 course.json（單一內容源）讀課程資料，套 v1「洄瀾數位溪谷」
設計系統版式，出 19 頁 1280×720 HTML 投影片。取代 v1 手工硬編內容的
generate.py（詳 skills/course-intro/SKILL.md「內容對照表」）。

用法：
    python generate_deck.py --course-json <path/to/course.json> --section AA \
        [--overlay <path/to/overlay.json>] --out <輸出資料夾>

範例（用 Hub 的人工智慧概論 course.json 出 AA 班）：
    python generate_deck.py \
        --course-json "D:/Ted_data/ndhu-ted-course-hub/content/courses/11501-ai-intro/course.json" \
        --section AA --out ./out_aa

輸出：<out>/01.html … 19.html（沿用 v1 的相對路徑約定：../deck.css、../assets/…，
所以輸出資料夾要跟 skill 根目錄維持「out/ 在 deck.css 同層的子資料夾」關係，
或執行後自行把 deck.css、assets/ 複製到輸出根目錄旁——見 SKILL.md「怎麼跑」)。
"""
import argparse
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "templates"))

import pagebuilders as pb  # noqa: E402

TOTAL_PAGES = 19          # v1 模板頁規格總數（模板頁 id 1..19）
SKIPPABLE_PAGES = {13, 14, 15}  # 內容為空可跳的模板頁：平台／課堂工具／日常工具
                                # （2026-07-03 Ted 拍板：頁數依課程內容而定，如純演講課無工具區）

# 內部口徑欄位鎖：course.json 若含這些鍵，一律不得流進任何輸出頁面。
# （對齊 decisions.md 第六節：不公開的東西走 overlay，Hub CI 本身也擋 internalNotes）
FORBIDDEN_KEYS = {"internalNotes"}


def esc(s):
    return pb.esc(s)


# ---------------------------------------------------------------------------
# 載入與防呆
# ---------------------------------------------------------------------------

def load_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def assert_no_forbidden_content(obj, path=""):
    """遞迴檢查 course.json／overlay 裡沒有 internalNotes 類鍵——防止不小心把
    v1 的內部口徑檔（course-intro.json 含 internalNotes）誤當輸入餵進來。"""
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k in FORBIDDEN_KEYS:
                raise ValueError(
                    f"輸入檔含禁用鍵 '{k}'（路徑：{path}.{k}）——這是內部口徑欄位，"
                    "不得進入 course-intro 產線。請確認你餵的是 Hub 公開版 course.json，"
                    "不是 v1 內部定案檔 course-intro.json。"
                )
            assert_no_forbidden_content(v, f"{path}.{k}")
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            assert_no_forbidden_content(v, f"{path}[{i}]")


def find_section(course, section_id):
    for s in course.get("sections", []):
        if s.get("id") == section_id:
            return s
    available = [s.get("id") for s in course.get("sections", [])]
    raise ValueError(f"course.json 找不到 section '{section_id}'（可用：{available}）")


def deep_merge(base, overlay):
    """overlay 淺層覆蓋 base 的同名鍵；dict 遞迴合併，其餘（含 list）直接取代。
    只用於補講者備忘等 overlay 專屬欄位，不改變 course.json 的公開內容語意。"""
    if not overlay:
        return base
    if isinstance(base, dict) and isinstance(overlay, dict):
        out = dict(base)
        for k, v in overlay.items():
            out[k] = deep_merge(base.get(k), v) if k in base else v
        return out
    return overlay if overlay is not None else base


# ---------------------------------------------------------------------------
# 版式常數（頁型固定文案／規則——不屬課程內容，故不進 course.json）
# 見 SKILL.md 內容對照表「模板固定」欄。
# ---------------------------------------------------------------------------

COVER_KICKER = "GENERAL EDUCATION · COURSE INTRO"
DARK_PAGES = {1, 6, 7, 8, 17, 18, 19, 20, 21}  # render-check 用的深底節奏規格，供 parity/驗收引用；20/21＝演講課限定「講者陣容」插頁（2026-08-03）


class Deck:
    def __init__(self, course, section, out_dir, overlay=None, talks=None):
        self.course = course
        self.talks = talks or []  # 演講課（kind=lecture-series）限定：talks.json 的 12 場，與網站同源
        self.section = section
        self.intro = course.get("intro", {})
        self.instructor = course.get("instructor", {})
        self.overlay = overlay or {}
        self.out_dir = out_dir
        os.makedirs(out_dir, exist_ok=True)
        self.written = []
        self._page_no = 0   # 實際輸出流水號（跳頁後自動遞補）
        self.manifest = []  # 每頁 {file, template, dark, cover}——structure_check 依此驗收

    # -- overlay 取值：overlay 內同名頂層鍵（非 internalNotes）可補充 speaker notes
    #    等「不影響公開 deck 內容」的欄位；目前 19 頁版式未消費任何 overlay 欄位，
    #    保留掛勾點供未來（例如頁面 HTML comment 夾帶投影備忘）擴充。
    def ov(self, key, default=None):
        return self.overlay.get(key, default)

    def write(self, n, inner, dark=False, cover=False, no_footer=False):
        """n＝v1 19 頁規格的「模板頁 id」；檔名用實際流水號——內容缺頁（如純演講課
        無工具區）跳過不寫時，後續檔名自動遞補，模板對照關係記進 manifest
        （`_manifest.json`）供 structure_check 驗收（2026-07-03 跳頁支援）。"""
        org_text = f'{esc(self.course.get("org", ""))}'.replace("　", "　")
        # v1 固定用「國立東華大學　通識教育中心」兩段中間全形空白；course.json 的 org
        # 欄位本身就是「國立東華大學 通識教育中心」（半形空白），故 footer 另組半形轉全形
        # 以維持 v1 視覺 parity（見 SKILL.md 內容對照表「org footer 全形空白」一行）。
        org_footer_text = self.course.get("org", "").replace(" ", "　")
        html_doc = pb.render_slide(inner, org_footer_text, dark=dark, cover=cover, no_footer=no_footer)
        self._page_no += 1
        path = os.path.join(self.out_dir, f"{self._page_no:02d}.html")
        with open(path, "w", encoding="utf-8") as f:
            f.write(html_doc)
        self.written.append(path)
        self.manifest.append({"file": os.path.basename(path), "template": n,
                              "dark": bool(dark), "cover": bool(cover)})
        return path

    # ------------------------------------------------------------------
    # 19 頁
    # ------------------------------------------------------------------

    @staticmethod
    def _name_html(name):
        """長課名折行控制：課名含「–」／「：」且整串夠長（≥12 字）時，在第一個
        分隔符後補 <br>，讓折行落在語意邊界而不是詞中間（例：創客入門–｜智慧生活
        裝置實作）。短課名（如「人工智慧概論」）原樣輸出，維持 ai-intro parity。"""
        s = str(name)
        if len(s) >= 12:
            for sep in ("–", "："):
                if sep in s:
                    head, tail = s.split(sep, 1)
                    if head and tail:
                        # 第二行縮排：Ted 2026-08-31 眼檢封面「文字把背景圖整片壓住」，
                        # 他點名的解法是「只移第二行」——不縮字級、不左移整塊
                        # （左移會把第二行推進圖的亮部，實測更難讀）。
                        return (f'{esc(head + sep)}<br>'
                                f'<span class="ln2">{esc(tail)}</span>')
        return esc(s)

    def _hero(self, which):
        """封面／終點頁的背景圖路徑。

        2026-08-31：立霧替 ai-coding 重畫的兩張圖當初是**直接覆蓋共用資產**
        `assets/intro-hero-ai.webp`——那個檔名是六門課共用的，等於一改全改，
        另外五門課的封面在沒人看的情況下也被換掉了。改成走 `intro.heroImages`
        指定課程專屬圖（放 `assets/heroes/`），沒指定就回落共用預設。
        """
        default = {"intro": "intro-hero-ai.webp", "workflow": "workflow-hero-ai.webp"}[which]
        custom = (self.intro.get("heroImages") or {}).get(which)
        if custom:
            return f'../assets/heroes/{esc(custom)}'
        return f'../assets/{default}'

    @staticmethod
    def _semester_display(semester):
        """course.json 的 semester 存代碼格式（如「115-1」）；封面顯示由模板格式化成
        「115 學年度 第 1 學期」（Ted 裁決 2026-07-03：JSON 存代碼、模板負責顯示格式，
        不得硬編學年）。解析不到「-」就原樣輸出＋「學年度」，不臆造學期碼。"""
        s = str(semester)
        if "-" in s:
            year, term = s.split("-", 1)
            return f'{esc(year)} 學年度 第 {esc(term)} 學期'
        return f'{esc(s)} 學年度'

    def page01_cover(self):
        name = self.course.get("name", "")
        name_en = self.course.get("nameEn", "")
        promise = self.intro.get("promise", "")
        chips = self.intro.get("chips", [])
        semester = self.course.get("semester", "")
        org = self.course.get("org", "")
        instructor_name = self.instructor.get("name", "")
        chips_html = "".join(f"<span>{esc(c)}</span>" for c in chips)
        # 封面 kicker：v1 固定「GENERAL EDUCATION · COURSE INTRO」——通識開課單位沿用；
        # 非通識單位（如資工系 AIoT）不得掛 GENERAL EDUCATION，退為通用 COURSE INTRO。
        kicker = COVER_KICKER if "通識" in org else "COURSE INTRO"
        inner = (
            f'<img class="hero hero-intro" src="{self._hero("intro")}" alt="">'
            '<div class="scrim"></div>'
            '<div class="inner">'
            f'<div class="kicker">{esc(kicker)}</div>'
            f'<div class="ctitle">{self._name_html(name)}</div>'
            f'<div class="csub">{esc(name_en)}</div>'
            f'<div class="cover-promise">{esc(promise)}</div>'
            f'<div class="cover-chips">{chips_html}</div>'
            f'<div class="cmeta">{self._semester_display(semester)}　·　{esc(org)}<br>'
            f'授課教師：<b>{esc(instructor_name)}</b></div>'
            '<img src="../assets/seal-white.webp" alt="NDHU" '
            'style="position:absolute;right:96px;top:88px;width:60px;height:60px;opacity:.95">'
            '</div>'
        )
        self.write(1, inner, cover=True)

    def page02_info(self):
        sec = self.section
        instr = self.instructor
        credits = self.course.get("credits", "")
        course_type = self.course.get("courseType", "")
        weeks_system = self.course.get("weeksSystem", "")
        time_note = sec.get("timeNote", {})
        time_note_html = (
            f'　<small>{pb.pending(time_note.get("note", ""))}</small>'
            if time_note.get("status") == "pending" and time_note.get("note")
            else ""
        )
        # TA：course.json 目前無 TA 欄位（v1 亦為【開學前待補】佔位）——見 SKILL.md
        # 預設沿用舊版 TA 待補；個別課程可用 overlay 的 taLine 覆寫。
        # taLine="" 代表這門介紹 deck 不顯示未確認的 TA 佔位。
        ta_line = self.ov("taLine", None)
        # 2026-09-02 AB 中文版渲染：「TA：開學前待補」折成「開學前待／補」孤字 → 整組 nowrap
        if ta_line is None:
            instructor_value = (f'{esc(instr.get("name", ""))}　<span style="white-space:nowrap">'
                                f'<small>TA：</small>{pb.pending("開學前待補")}</span>')
        elif ta_line:
            instructor_value = (f'{esc(instr.get("name", ""))}　<span style="white-space:nowrap">'
                                f'<small>TA：</small>{esc(ta_line)}</span>')
        else:
            instructor_value = esc(instr.get("name", ""))
        is_single = len(self.course.get("sections") or []) == 1
        course_id_label = "課　　號" if is_single else "班別／課號"
        section_prefix = "" if is_single else f'{esc(sec.get("id", ""))} 班　'
        course_id_value = (
            section_prefix + f'<small style="font-family:var(--lat)">{esc(sec.get("code", ""))}・'
            f'<span style="white-space:nowrap">系統編號 {esc(sec.get("systemId", ""))}</span></small><br>'
            f'<small>{esc(course_type)}・{esc(credits)} 學分・{esc(weeks_system)}</small>'
        )
        cells = (
            pb.infocard("cap", course_id_label, course_id_value)
            + pb.infocard("clock", "上課時間", f'{esc(sec.get("time", ""))}{time_note_html}')
            + pb.infocard("pin", "教　　室", esc(sec.get("room", "")))
            + pb.infocard("user", "授課教師", instructor_value)
            + pb.infocard("msg", "聯　　絡",
                          f'<small style="font-family:var(--lat);font-size:15px">'
                          f'{esc(instr.get("contact", ""))}・{esc(instr.get("email", ""))}</small>')
            + pb.infocard("slides", "課堂平台", self._platform_line_short())
        )
        inner = (
            pb.kicker("COURSE INFO") + pb.title("課程資訊")
            + f'<div class="grid grid-3" style="margin-top:26px">{cells}</div>'
        )
        self.write(2, inner)

    def _platform_line_short(self):
        """B2 六卡「課堂平台」欄：v1 硬編『點名 Zuvio・作業 Teams・共筆 HackMD』，
        現改由 intro.platforms 動態組（use→name 併成短句），行為對齊 v1 三項固定序。"""
        plats = self.intro.get("platforms", [])
        # 2026-09-02：每組「用途 名稱」包 nowrap——AB 渲染把「e學苑」拆成「e／學苑」（秀姑巒／立霧）
        parts = [f'<span style="white-space:nowrap">{esc(p.get("use", ""))} {esc(p.get("name", ""))}</span>'
                 for p in plats]
        line_html = "・".join(parts)
        # Slido 活動已建就直接印編號、佔位只留還沒有的（2026-08-31 立霧終查抓到：
        # #7610459 在 p06/p18 都印了，這裡卻仍掛「開學前補」佔位，自相矛盾）。
        code = self.section.get("slidoEvent")
        # e學苑代碼 2026-09-02 Ted 拍板不印：「no need，the student join class system will provide」
        # ——學生選上課之後 e學苑 的「我的課程」自然會出現，代碼對學生沒有用處。
        # 原本這裡掛「e學苑課程代碼開學前補」佔位，是一個永遠不會被填、也不該被填的待辦。
        # overlay 仍可用 elearnShort 明確指定要印什麼（沒設就整段不印，不再產生佔位）。
        elearn_short = self.ov("elearnShort", None)
        elearn_tail = esc(elearn_short) if isinstance(elearn_short, str) and elearn_short else None
        if code:
            head = f'Slido #{esc(code)}'
        else:
            # 未建 event：與 p06/p18 同字樣「#現場公布」（2026-09-01 三端查核抓到只印「Slido #」空殼）
            head = pb.pending("Slido #現場公布")
        tail = f'<small>{head}・{elearn_tail}</small>' if elearn_tail else f'<small>{head}</small>'
        return f'<small>{line_html}</small><br>' + tail

    def page03_location(self):
        sec = self.section
        room = sec.get("room", "")
        # E403（AI 教室）保留金色別名標籤；平面圖說明一律誠實待補樣式——
        # v1 的「圖已備」字樣是留給後製的內部備註、頁面上並無實圖，
        # 2026-07-03 review agents 四位共識改掉（對 v1 有意差異，勿修回）。
        if "E403" in room:
            room_line = (f'<div style="font-size:22px;font-weight:700;margin-top:12px">{esc(room)}　'
                         f'<span style="color:var(--gold)">AI 教室</span></div>')
        else:
            room_line = f'<div style="font-size:22px;font-weight:700;margin-top:12px">{esc(room)}</div>'
        # 2026-08-31：平面圖 6/10 就備好在 OneDrive 課程介紹素材夾，只是產線沒有嵌圖的路。
        # course.json 的 intro.floorPlans 指路徑；找不到檔就退回原本的待補佔位。
        plan_img = pb.img_b64(self._floor_plan("classroom"), alt=f"{room} 平面圖位置",
                              style="max-width:100%;max-height:330px;border-radius:8px")
        if plan_img:
            body = (plan_img
                    + f'<div style="font-size:20px;font-weight:700;margin-top:14px;color:var(--on-dark)">'
                    + esc(room) + ('　<span style="color:var(--gold)">AI 教室</span>' if "E403" in room else '')
                    + '</div>')
        else:
            body = (pb.icon("pin", "var(--gold)", 40) + room_line
                    + '<div class="muted" style="margin-top:6px;color:var(--on-dark-dim)">'
                    + pb.pending("【教室平面圖・開學前補】") + '</div>')
        inner = (
            pb.kicker("WHERE WE MEET") + pb.title("上課地點")
            + '<div class="card-blueprint" style="margin-top:24px;">'
            + '<div style="text-align:center;color:var(--on-dark);z-index:2">'
            + body + '</div></div>'
        )
        self.write(3, inner)

    def page04_about(self):
        instr = self.instructor
        inner = (
            pb.kicker("YOUR INSTRUCTOR") + pb.title(f'關於我　{instr.get("name", "")}')
            + f'<div class="subtitle">{esc(instr.get("title", ""))}・{esc(self.course.get("org", ""))}</div>'
            + '<div style="margin-top:10px;font-size:19px;font-weight:500;color:var(--ink)">'
            + self._instructor_promise_html(instr.get("promise", ""))
            + '</div>'
            + '<div class="grid grid-2" style="margin-top:26px">'
            + pb.linecard("mail", "Email", f'<span style="font-family:var(--lat);font-size:20px">{esc(instr.get("email", ""))}</span>')
            + pb.linecard("phone", "電　話", f'<span style="font-family:var(--lat);font-size:20px">{esc(instr.get("phone", ""))}</span>')
            + pb.linecard("user", "研究室", esc(instr.get("office", "")))
            + pb.linecard("msg", "聯絡", esc(instr.get("contact", "")))
            + '</div>'
        )
        self.write(4, inner)

    @staticmethod
    def _instructor_promise_html(promise):
        """v1 把 promise 中「真實任務」四字加粗上色，course.json 只存純文字。
        用簡單字串比對還原強調——找不到就整句原樣輸出（不猜、不改文意）。
        promise 未定稿時 course.json 存 {status:'pending', note:…} 物件——
        以待補樣式顯示，不把物件字面印上投影片（也不代擬教師第一人稱）。
        名人語錄格式（2026-07-03 Ted 拍板：pending 課改放切題金句）：字串為
        「引句」——出處 時拆成兩行——引句主行＋出處小字行（quote／from 兩行式）。"""
        if not isinstance(promise, str):
            return pb.pending("【開學前待補】")
        sep = "」——"
        if promise.startswith("「") and sep in promise:
            quote, author = promise.rsplit(sep, 1)
            return (esc(quote + "」")
                    + '<div class="muted" style="margin-top:8px;font-size:15px;font-weight:400">'
                    + f'—— {esc(author)}</div>')
        marker = "真實任務"
        if marker in promise:
            before, after = promise.split(marker, 1)
            return f'{esc(before)}<b style="color:var(--teal)">{esc(marker)}</b>{esc(after)}'
        return esc(promise)

    def page05_office(self):
        instr = self.instructor
        inner = (
            pb.kicker("OFFICE") + pb.title("研究室位置")
            + '<div class="card-blueprint" style="margin-top:24px;">'
            + '<div style="text-align:center;color:var(--on-dark);z-index:2">'
            # 有正式平面圖時不疊圖釘；它會浮在圖外、看起來像標了另一個位置。
            # 只有沒有平面圖的佔位分支才用圖釘提示「位置待補」。
            + (lambda im, off: (
                im + f'<div style="font-size:20px;font-weight:700;margin-top:14px;color:var(--on-dark)">{esc(off)}</div>'
              ) if im else (
                pb.icon("pin", "var(--gold)", 40)
                + f'<div style="font-size:22px;font-weight:700;margin-top:12px">{esc(off)}</div>'
                + '<div class="muted" style="margin-top:6px;color:var(--on-dark-dim)">'
                + pb.pending("【研究室平面圖・開學前補】") + '</div>'
              ))(pb.img_b64(self._floor_plan("office"), alt="研究室平面圖位置",
                            style="max-width:100%;max-height:330px;border-radius:8px"),
                 instr.get("office", ""))
            + '</div></div>'
        )
        self.write(5, inner)

    def _slido_qr_html(self):
        """Slido 加入頁的手機框：有 event code 就畫真 QR、沒有才回佔位。

        2026-08-31 加：產線本來就有 qr_svg（第 19 頁課程網站在用），
        但 Slido 兩頁寫死「QR 上課現場提供」的佔位——event 建好後那句就過期了。
        掃 slido.com/<code> 直接進該場次。
        """
        code = self.section.get("slidoEvent")
        # ⚠️ QR 目標一定要用 slidoEventUrl（uuid 版連結）——
        # `app.sli.do/event/<數字碼>` 會回「Event not found for given hash」
        # （2026-08-31 實掃踩到：那條路吃 uuid hash、不吃數字碼；數字碼只能在
        # slido.com 首頁手動輸入）。沒有 uuid 就不畫 QR、回佔位，寧缺勿壞。
        url = self.section.get("slidoEventUrl")
        inner_qr = None
        if code and url:
            inner_qr = pb.qr_svg(url, size=150, dark="#07403F", label="Slido 互動問答 QR code")
        if inner_qr:
            body = ('<div style="background:#fff;padding:8px;border-radius:8px;display:inline-block">'
                    + inner_qr + '</div>'
                    + f'<div style="margin-top:10px;font-size:13px;font-weight:700;color:var(--on-dark)">#{esc(str(code))}</div>')
        else:
            body = (pb.icon("qr", "var(--gold)", 48)
                    + '<div style="margin-top:10px;font-size:12px;color:var(--on-dark-dim)">'
                    + pb.pending("QR 上課現場提供") + '</div>')
        return ('<div class="qr-phone"><div class="qr-screen"><div class="qr-placeholder">'
                + body + '</div></div></div>')

    def _floor_plan(self, which):
        """intro.floorPlans.{classroom,office} → 圖檔路徑；沒設定回 None。

        絕對路徑維持舊行為；相對路徑從 deck 產線根目錄解析，讓同一份
        course.json 在 wailan 正本與 Hub CI 鏡像都能使用 assets/ 素材。
        """
        fp = (self.intro.get("floorPlans") or {})
        value = fp.get(which)
        if not value or not isinstance(value, str):
            return None
        if os.path.isabs(value):
            return value
        return os.path.join(HERE, value.replace("/", os.sep))

    def _slido_event_code(self):
        code = self.section.get("slidoEvent")
        return code if code else pb.pending("現場公布")

    def page06_slido1(self):
        # 提示語要對得上「這門課」實際要問的第一波題（Ted 2026-09-01：slido 題組與
        # 投影片都要按課各自對課）——overlay 的 slidoNotes.wave1 可覆寫；沒給就用
        # 原句（ai-intro 措辭），既有課程輸出逐字元不變。值視為本 skill 維護的
        # 字面 HTML（同 page09 band text 慣例），可帶金色強調 <b>。
        note1 = (self.ov("slidoNotes") or {}).get(
            "wave1", "等等問你：你心中的 AI 像什麼、你來自哪個系、用過哪些 AI 工具")
        inner = (
            '<div class="big-center" style="height:100%;display:flex;flex-direction:column;justify-content:center;max-width:760px">'
            '<div class="kicker">JOIN AT SLIDO.COM</div>'
            '<div class="big-title" style="margin-top:14px">拿出手機，<br>先認識一下你</div>'
            f'<div class="big-sub">掃 QR Code 加入　slido.com　·　#{self._slido_event_code()}</div>'
            '<div class="muted" style="color:var(--on-dark-dim);margin-top:22px;font-size:16px">'
            f'{note1}</div>'
            '</div>'
            + self._slido_qr_html()
        )
        self.write(6, inner, dark=True)

    def page07_phases(self):
        phases = self.intro.get("phases", [])
        phases_note = self.intro.get("phasesNote", "")
        note_html = self._phases_note_html(phases_note)
        # 部曲數依 phases 實際長度（2026-08-31 ai-coding v2 改四段）：三段課程輸出
        # 與原硬編「三部曲／grid-3」逐字元相同，parity 不受影響；≥4 段走 grid-4 免折行。
        # 2026-09-01 補：grid-4 窄欄（254px）讓 pbody 折到 10 行、頁尾疊卡（ai-coding p7
        # 溢 46px）——≥4 段時卡片掛 .part--sm 緊湊版＋grid 上距 34→22；三段路徑兩值皆不變。
        compact = len(phases) >= 4
        cards = "".join(pb.partcard(p.get("id", ""), p.get("title", ""), p.get("body", ""),
                                    compact=compact) for p in phases)
        n_word = {2: "二", 3: "三", 4: "四", 5: "五"}.get(len(phases), str(len(phases)))
        grid_cls = "grid-4" if compact else "grid-3"
        grid_mt = 22 if compact else 34
        inner = (
            pb.kicker("WHAT YOU'LL LEARN") + pb.title(f"這門課在學什麼：{n_word}部曲", big=True)
            + f'<div class="subtitle" style="color:var(--on-dark-dim)">{note_html}</div>'
            + f'<div class="grid {grid_cls}" style="margin-top:{grid_mt}px;margin-bottom:0">{cards}</div>'
        )
        self.write(7, inner, dark=True)

    @staticmethod
    def _phases_note_html(note):
        """v1：『核心是 AI 素養（AI literacy）——<em-g>不從寫程式開始</em-g>，非資訊背景也跟得上』
        course.json phasesNote 是純文字整句、v1 額外用『——』切開並把中段加金色強調 class。
        用『——』分隔還原（找不到分隔符就整句照登，不臆測斷句）。"""
        sep = "——"
        if sep in note:
            head, rest = note.split(sep, 1)
            # 中段「不從寫程式開始」在 v1 是唯一 em-g 片段，其後接的逗號子句沿用純文字
            marker = "不從寫程式開始"
            if marker in rest:
                mid, tail = rest.split(marker, 1)
                return f'{esc(head)}{sep}{esc(mid)}<span class="em-g">{esc(marker)}</span>{esc(tail)}'
            return f'{esc(head)}{sep}{esc(rest)}'
        return esc(note)

    def page08_destination(self):
        dest = self.intro.get("destination", {})
        steps = dest.get("steps", [])
        steps_html = ""
        for i, step in enumerate(steps, start=1):
            steps_html += f'<div><b>{i:02d}</b><span>{esc(step.get("label", ""))}</span></div>'
            if i < len(steps):
                steps_html += '<div class="step-arrow">→</div>'
        inner = (
            f'<img class="concept-hero" src="{self._hero("workflow")}" alt="">'
            '<div class="concept-scrim"></div>'
            '<div class="concept-copy concept-copy--right">'
            '<div class="kicker">COURSE DESTINATION</div>'
            f'<div class="big-title" style="margin-top:14px">{self._destination_title_html(dest.get("title", ""))}</div>'
            f'<div class="big-sub">{esc(dest.get("sub", ""))}</div>'
            f'<div class="concept-steps">{steps_html}</div>'
            '</div>'
        )
        self.write(8, inner, dark=True, no_footer=True)

    @staticmethod
    def _destination_title_html(title_text):
        """v1：『這門課的終點：<br>做出你的 AI 工作流』——course.json 存純文字整句，
        用『：』還原換行位置（找不到冒號就整句照登）。"""
        sep = "："
        if sep in title_text:
            head, tail = title_text.split(sep, 1)
            return f'{esc(head)}{sep}<br>{esc(tail)}'
        return esc(title_text)

    def page09_weeks(self):
        weekly = self.intro.get("weeklyPlan", [])
        phases = self.intro.get("phases", [])
        phase_titles = {p.get("id"): p.get("title", "") for p in phases}
        phase_weeks = {p.get("id"): p.get("weeks", "") for p in phases}
        half = 7
        row1_weeks = weekly[:half]
        row2_weeks = weekly[half:]
        # 2026-09-02：p09 每欄只有約 130px，長標籤會擠成 4–5 行還把詞腰斬
        # （W1「（活／動」、W9「作品／展」，兩班渲染眼檢都抓到）。
        # course.json 可給 labelShort 當 deck 專用短版；網頁的週次表照用長版 label。
        def _lab(w):
            return w.get("labelShort") or w.get("label", "")
        row1 = "".join(pb.weekcell(w.get("w", ""), _lab(w), "ms" if w.get("milestone") else "")
                        for w in row1_weeks)
        row2 = "".join(pb.weekcell(w.get("w", ""), _lab(w), "ms" if w.get("milestone") else "")
                        for w in row2_weeks)

        # 三段色帶：依 weeklyPlan 的 part 欄位算 row1/row2 內 Part1/2/3 各佔幾格（flex 比例），
        # 沿用 v1 版式常數（band1=Part1(3):Part2(4)、band2=P2續(1):Part3(5)）——
        # v1 這兩行 flex 數字是「排版微調」而非課程內容，故仍留常數；若未來週數改變，
        # 這裡改用「依 part 實際格數算 flex」而非沿用 v1 寫死比例，兩者在 17 週不變時等價。
        band1 = self._week_band(row1_weeks, phase_titles, phase_weeks, prev_last_part=None)
        band2 = self._week_band(row2_weeks, phase_titles, phase_weeks,
                                prev_last_part=row1_weeks[-1].get("part") if row1_weeks else None)

        inner = (
            pb.kicker("17-WEEK ROADMAP") + pb.title("17 週課程地圖")
            + '<div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:44px">'
            + '<div><div style="position:relative"><div class="tlbar" style="top:7px;left:0;right:0"></div>'
            + f'<div class="timeline" style="margin-top:0">{row1}</div></div>{band1}</div>'
            + '<div><div style="position:relative"><div class="tlbar" style="top:7px;left:0;right:0"></div>'
            + f'<div class="timeline" style="margin-top:0">{row2}</div></div>{band2}</div>'
            + '</div>'
            + f'<div class="muted">●＝每週主題　<span style="color:var(--gold)">●</span>＝期中／期末里程碑　·　色帶＝{self._phase_count_word()}部曲分段'
            + ("　·　17 週新制＋W18 成果發表週" if len(weekly) == 18 else "")
            + '</div>'
        )
        self.write(9, inner)

    def _phase_count_word(self):
        """部曲數中文字（三段課程輸出不變，維持 parity；ai-coding v2 起有四段課程）。"""
        n = len(self.intro.get("phases", []))
        return {2: "二", 3: "三", 4: "四", 5: "五"}.get(n, str(n))

    @staticmethod
    def _week_band(weeks, phase_titles, phase_weeks, prev_last_part=None):
        """依實際 part 分布算色帶格數與文案；17 週、三部曲切法不變時，
        算出的 flex 比例與 v1 硬編值一致（row1: p1=3,p2=4；row2: p2=1,p3=5）。
        色帶名稱與週距一律取自 intro.phases[]（title／weeks）——SKILL.md 內容對照表
        「三段色帶」本就標 JSON 算出，不得硬編單一課程的部名文案。
        「續」判斷（2026-09-01 立霧複驗指正）：第一段是否延續＝跟上一列最後一個 part
        比對，不是「只要是第二列第一段」——某 part 剛好從第二列開頭起算時不得誤標。
        既有課程（延續皆為真延續）輸出逐字元不變。"""
        # 統計本列每個 part 出現幾筆（週數項目，不是實際週數）
        from collections import OrderedDict
        counts = OrderedDict()
        for w in weeks:
            p = w.get("part")
            counts[p] = counts.get(p, 0) + 1

        cls_map = {1: "p1", 2: "p2", 3: "p3", 4: "p4"}
        parts_ids = list(counts.keys())

        def label_for(part_id, is_continuation):
            if is_continuation:
                return f"PART {part_id}（續）"
            name = phase_titles.get(part_id, "")
            w_range = phase_weeks.get(part_id, "")
            return f"PART {part_id} · {name}（{w_range}）" if w_range else f"PART {part_id} · {name}"

        segs = []
        for idx, p in enumerate(parts_ids):
            # len>1 條件已去除（立霧 r2）：整列都是延續段時也該標「續」，
            # 「是否延續」只跟上一列末 part 有關（現行各課輸出不受影響、已回歸驗證）
            is_continuation = (idx == 0 and prev_last_part is not None
                               and p == prev_last_part)
            cls = cls_map.get(p, "p2")
            segs.append(f'<div class="{cls}" style="flex:{counts[p]}">{esc(label_for(p, is_continuation))}</div>')
        return f'<div class="pband">{"".join(segs)}</div>'

    # ------------------------------------------------------------------
    # 模板頁 20/21：演講課限定「12 場講者陣容」（2026-08-03，Ted「演講課 need different」）
    # 資料源＝talks.json（與網站海報牆同一份、由 pull_talks 從管理台 Sheet 出）；
    # 講題未定照網站措辭「講題公布中」、不放推測內容（官方連結原則同源）。
    # ------------------------------------------------------------------

    def pages_talks_lineup(self):
        talks = sorted(self.talks, key=lambda t: t.get("no") or 0)
        half = (len(talks) + 1) // 2
        for tpl, chunk, tag in ((20, talks[:half], "上"), (21, talks[half:], "下")):
            if not chunk:
                continue
            rows = "".join(self._talk_row(t) for t in chunk)
            inner = (
                pb.kicker("SPEAKER LINEUP")
                + pb.title(f"12 場講者陣容（{tag}）", big=True)
                + f'<div style="margin-top:24px;display:flex;flex-direction:column;gap:12px">{rows}</div>'
            )
            self.write(tpl, inner, dark=True)

    @staticmethod
    def _talk_row(t):
        sp = t.get("speaker") or {}
        d = t.get("date") or ""
        md = f"{int(d[5:7])}/{int(d[8:10])}" if len(d) == 10 else "日期公布中"
        who = sp.get("name") or "講者邀請中"
        # 陣容頁單位用短版：去掉全形括號補充（兼任主任職等），完整版留給海報牆／講者頁；
        # 再加 nowrap 保單行——長單位折兩行會把整頁推 17px 撞頁尾（2026-09-01 複驗 #2）。
        # ⚠️ ellipsis 是保險網：真被截斷代表單位又變長了，該回 talks.json 資料層縮短，別靠切字。
        seg = "・".join(x for x in (sp.get("title"), sp.get("org")) if x)
        seg = re.sub(r"（[^）]*）", "", seg).strip("・ ")
        topic = t.get("title") or "講題公布中"
        return (
            '<div style="display:flex;align-items:center;gap:18px;padding:9px 16px;'
            'background:rgba(255,255,255,0.06);border-radius:12px">'
            f'<div style="min-width:92px"><div style="font-size:12.5px;color:var(--on-dark-dim)">第 {t.get("no", "?")} 場</div>'
            f'<div style="font-size:19px;font-weight:800">{esc(md)}</div></div>'
            f'<div style="flex:1.1;min-width:0"><div style="font-size:18px;font-weight:800">{esc(who)}</div>'
            f'<div style="font-size:12.5px;color:var(--on-dark-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{esc(seg)}</div></div>'
            f'<div style="flex:1.3;font-size:15px">{esc(topic)}</div>'
            '</div>'
        )

    def page10_grading(self):
        grading = self.intro.get("grading", [])
        colors = [
            ("var(--teal)", "var(--teal-700)"),
            ("var(--teal)", "var(--gold)"),
            ("var(--gold)", "var(--gold)"),
            ("var(--gold)", "#E05236"),
        ]
        cells = ""
        sec_id = self.section.get("id")
        for i, g in enumerate(grading):
            c1, c2 = colors[i] if i < len(colors) else ("var(--teal)", "var(--gold)")
            # 2026-09-02：一課兩班的說明可分班（subBySection），沒給就退回共用 sub——
            # AB deck 曾把「AA 遇停課併週」印給 AB 學生看（美崙溪／木瓜溪複驗抓到）。
            sub = (g.get("subBySection") or {}).get(sec_id) or g.get("sub") or ""
            cells += pb.statblock(g.get("pct", 0), g.get("label", ""), sub, c1, c2)
        note = self.intro.get("gradingNote", "")
        note_html = self._grading_note_html(note)
        inner = (
            pb.kicker("GRADING") + pb.title("成績怎麼算")
            + f'<div class="grid grid-4">{cells}</div>'
            + f'<div class="muted" style="margin-top:30px">{note_html}</div>'
        )
        self.write(10, inner)

    @staticmethod
    def _grading_note_html(note):
        """v1 把結尾一句『期末不是考工具名稱，是展示你怎麼用 AI 解決任務。』加粗上色。
        用句號切最後一句還原（找不到就整句照登）。"""
        marker = "期末不是考工具名稱，是展示你怎麼用 AI 解決任務。"
        if marker in note:
            head = note.replace(marker, "")
            return f'{esc(head)}<b style="color:var(--ink)">{esc(marker)}</b>'
        return esc(note)

    def page11_help(self):
        instr = self.instructor
        inner = (
            pb.kicker("GETTING HELP") + pb.title("卡關了，怎麼找我")
            + '<div class="grid grid-2" style="margin-top:30px">'
            + pb.linecard("msg", "e學苑", "課程訊息直接發給我")
            + pb.linecard("mail", "Email", f'<span style="font-family:var(--lat);font-size:20px">{esc(instr.get("email", ""))}</span>')
            + '</div>'
            + '<div class="muted" style="margin-top:28px">上 Slido，問問題不用舉手。</div>'
        )
        self.write(11, inner)

    def page12_elearn(self):
        # 純模板固定文案（e學苑登入／用途／課程代碼待補）——course.json 目前
        # 未收錄這段（見 SKILL.md「模板固定」欄）。2026-08-31 由「加入 Teams 課程」
        # 改版：115-1 六課皆已定案走 e學苑（Hub commit 4a33840），模板層跟著換。
        items = self.ov("elearnItems", None)
        if not isinstance(items, list) or not items:
            # 2026-09-02 Ted 拍板 deck 不印 e學苑課程代碼（「學生加入課程系統就看得到」），
            # 原第三點「課程代碼：【開學前待補】」拿掉——它跟 p02 那個一樣是永遠不會被填的佔位。
            items = [
                '用學校帳號登入 <span style="font-family:var(--lat)">elearn4.ndhu.edu.tw</span>',
                "教材與交作業都在這",
            ]
        else:
            items = [esc(item) for item in items]
        list_html = "".join(
            f'<li><span class="b"></span><div>{item}</div></li>' for item in items
        )
        inner = (
            pb.kicker("JOIN ON E-LEARNING") + pb.title("加入 e學苑課程")
            + '<div class="vcenter"><ul class="list list--lg" style="margin-top:0">'
            + list_html + '</ul></div>'
        )
        self.write(12, inner)

    def page13_platforms(self):
        plats = self.intro.get("platforms", [])
        if not plats:
            return  # 無平台資料——跳頁不出空頁（頁數依內容而定，2026-07-03）
        use_to_name = {"課堂點名": "user", "交作業": "pen", "課堂共筆": "book"}
        cells = "".join(
            pb.toolcard(use_to_name.get(p.get("use", ""), "tool"), p.get("use", ""), p.get("name", ""))
            for p in plats
        )
        # 卡片列包 .vcenter 垂直置中（2026-07-05 設計升級）：v1 的 inline margin-top
        # 蓋掉 .grid 自帶的 margin auto 置中，單排卡片頁下半近半版留白、
        # 與 12/14/16 頁（皆置中）節奏不一致；margin:0 交還置中權給 .vcenter。
        inner = (
            pb.kicker("OUR PLATFORMS") + pb.title("這門課的網路工具")
            + f'<div class="vcenter"><div class="grid grid-3" style="margin:0">{cells}</div></div>'
        )
        self.write(13, inner)

    def page14_tools(self):
        tool_groups = self.intro.get("toolGroups", [])
        if not tool_groups:
            return  # 純演講課等無課堂工具區——跳頁（平台已在第 13 頁呈現，2026-07-03）
        group_icon = {"理解 AI": "bot", "查資料": "search", "做內容": "slides", "任務型與自動化": "term",
                      # 2026-09-02 ai-intro 115-1 四組（秀姑巒眼檢：沒對到全變扳手）
                      "做出作品": "slides", "查證與資料": "search", "版本與安全": "term", "Agent 監督": "bot"}
        compact = len(tool_groups) >= 5  # 五組以上走窄邊距，防總高溢出畫布
        bands = ""
        for g in tool_groups:
            # 雙層設計（Ted 2026-06-12 核定）：投影片優先取 subShort（短版），網頁用長版 sub
            items = [(it.get("name", ""), it.get("subShort") or it.get("sub", "")) for it in g.get("items", [])]
            bands += pb.tband(group_icon.get(g.get("group", ""), "tool"), g.get("group", ""), items,
                              compact=compact)

        plats = self.intro.get("platforms", [])
        # 工具帶 ≥5 組時版高吃緊：底部平台複習帶（同資訊第 13 頁已有）省略，
        # 否則 pstrip 會被擠出 720px 畫布、裁半截疊在頁尾上
        # （2026-07-03 it-apply 五組實測溢出，review agent 抓到）。
        if len(tool_groups) >= 5:
            pstrip_html = ""
        else:
            pstrip_items = "".join(
                f'<div class="p"><span class="use">{esc(p.get("use", ""))}</span>'
                f'<span class="pn">{esc(p.get("name", ""))}</span></div>'
                for p in plats
            )
            pstrip_html = f'<div class="pstrip">{pstrip_items}</div>'
        tools_note = self.intro.get("toolGroupsNote", "")
        note_html = self._tools_note_html(tools_note)

        inner = (
            pb.kicker("TOOLS WE'LL TRY") + pb.title("課堂會親手用到的工具")
            + '<div style="flex:1;display:flex;flex-direction:column;justify-content:center">'
            + bands
            + pstrip_html + '</div>'
            + f'<div class="muted">{note_html}</div>'
        )
        # ≥5 組窄版連 note 都貼到頁底，會跟 footer-org 疊字（2026-09-01 it-apply 六組
        # 渲染眼檢抓到）→ 窄版免頁尾。2026-09-02 ai-intro AB 四組、說明折兩行照樣撞
        # footer（秀姑巒／立霧眼檢），所以這頁一律免頁尾——雙語版本來就是 no_footer=True。
        self.write(14, inner, no_footer=True)

    @staticmethod
    def _tools_note_html(note):
        """v1：『<b>工具會換、能力不換</b>——AI 工具汰換快，實際以開學當週的等效工具為準。』
        toolGroupsNote 純文字用『——』切開還原強調（找不到分隔符整句照登）。"""
        sep = "——"
        if sep in note:
            head, tail = note.split(sep, 1)
            return f'<b style="color:var(--ink)">{esc(head)}</b>{sep}{esc(tail)}'
        return esc(note)

    def page15_daily(self):
        daily = self.intro.get("dailyTools", [])
        if not daily:
            return  # 無日常工具推薦——跳頁（2026-07-03）
        name_icon = {"聊天機器人": "bot", "AI 搜尋": "search", "AI 筆記本": "book", "AI 實驗場": "tool"}
        cells = "".join(
            pb.toolcard(name_icon.get(d.get("name", ""), "tool"), d.get("name", ""), d.get("sub", ""))
            for d in daily
        )
        # dailyTools 為空（如純演講課）時，固定推薦語沒有卡片可指——一併省略，
        # 讓頁面保持乾淨，而不是掛著沒有對象的說明句。
        # 說明句可由 intro.dailyToolsNote 按課覆寫（2026-09-01 創客課 W11 後才裝）；
        # 沒給就用共用預設。預設句的〔一個順手的〕保留字面 HTML 重點標，
        # 課程自訂的那句則走 esc()（資料層不寫 HTML）。
        daily_note = self.intro.get("dailyToolsNote")
        note_html = (
            (f'<div class="muted" style="margin-top:24px">{esc(daily_note)}</div>' if daily_note else
             '<div class="muted" style="margin-top:24px">第一週先挑<b style="color:var(--ink)">一個順手的</b>'
             '就好，不用全裝；之後再慢慢擴充。</div>')
        ) if daily else ''
        # 卡片＋推薦語一起包 .vcenter（2026-07-05 設計升級，同第 13 頁理由）
        inner = (
            pb.kicker("FOR DAILY USE")
            + pb.title(self.intro.get("dailyToolsTitle", "日常 AI 工具推薦"))
            + '<div class="vcenter">'
            + f'<div class="grid grid-4" style="margin:0">{cells}</div>'
            + note_html
            + '</div>'
        )
        self.write(15, inner)

    def page16_bring(self):
        items = self.intro.get("whatToBring", [])
        # 第一項『筆電或平板（<b>建議筆電</b>）』在 v1 對「建議筆電」加粗；
        # 其餘項目純文字直出。room 來自本班 section，非模板固定。
        li_html = ""
        for i, text in enumerate(items):
            if i == 0 and "建議筆電" in text:
                before, after = text.split("建議筆電", 1)
                body = f'{esc(before)}<b>建議筆電</b>{esc(after)}'
            else:
                body = esc(text)
            li_html += f'<li><span class="b"></span><div>{body}</div></li>'
        inner = (
            pb.kicker("WHAT TO BRING") + pb.title("上課要帶什麼")
            + f'<div class="vcenter"><ul class="list list--lg" style="margin-top:0">{li_html}</ul></div>'
        )
        self.write(16, inner)

    def page17_rules(self):
        rules = self.intro.get("aiRules", [])
        items = "".join(
            pb.ruleitem(f"{i:02d}", r.get("title", ""), r.get("body", ""))
            for i, r in enumerate(rules, start=1)
        )
        # 三分類帶（2026-08-31 秀姑巒複驗抓到：deck 只印三守則，但學生真正要遵守的
        # 🟢🟡🔴 三分類機制（course-plan §四之二、校方頁同步）整組缺席）。
        # intro.aiCategoriesBrief 有值才渲染，沒有就維持三守則版原樣（ai-intro parity）。
        cats = self.intro.get("aiCategoriesBrief", [])
        if cats:
            # 左欄三守則、右欄三分類卡並排——第一版把三分類卡直落在守則下方，
            # 渲染眼檢直接掉出 720px 頁底、壓到頁尾（2026-08-31）。
            rows = "".join(
                f'<div style="font-size:16px;font-weight:700;color:var(--on-dark);'
                f'line-height:1.55;padding:7px 0">{esc(c)}</div>' for c in cats)
            cats_html = (
                '<div style="width:400px;flex:none;align-self:center;padding:20px 24px;'
                'border:1px solid rgba(217,164,65,.35);border-radius:14px;'
                'background:rgba(6,37,36,.45)">'
                '<div class="kicker" style="font-size:13px">三分類，怎麼用才合規</div>'
                f'<div style="margin-top:6px">{rows}</div></div>')
            body = (
                '<div style="display:flex;gap:44px;margin-top:14px;align-items:stretch">'
                f'<div style="flex:1;min-width:0">{items}</div>{cats_html}</div>')
        else:
            body = f'<div style="margin-top:14px;max-width:880px">{items}</div>'
        inner = (
            pb.kicker("HOW WE USE AI") + pb.title("這門課的 AI 使用守則", big=True)
            + '<div class="subtitle" style="color:var(--on-dark-dim)">可以用 AI 學習與創作，但你要——</div>'
            + body
        )
        self.write(17, inner, dark=True)

    def page18_slido2(self):
        # 同 page06：第二波提示語可由 overlay slidoNotes.wave2 按課覆寫（字面 HTML）。
        note2 = (self.ov("slidoNotes") or {}).get(
            "wave2", '修課動機、<b style="color:var(--gold)">你最想用 AI 幫你完成什麼事</b>、一個詞形容你的期待')
        inner = (
            '<div class="big-center" style="height:100%;display:flex;flex-direction:column;justify-content:center;max-width:760px">'
            '<div class="kicker">BACK TO SLIDO</div>'
            '<div class="big-title" style="margin-top:14px">最後，<br>聊聊你的期待</div>'
            f'<div class="big-sub">再掃一次　slido.com　·　#{self._slido_event_code()}</div>'
            '<div class="muted" style="color:var(--on-dark-dim);margin-top:22px;font-size:16px">'
            f'{note2}</div>'
            '</div>'
            + self._slido_qr_html()
        )
        self.write(18, inner, dark=True)

    def page19_finale(self):
        finale = self.intro.get("finale", {})
        # 課程網站連結（2026-07-03 Ted 拍板：deck 結尾連到 Course Hub 各班頁）：
        # sections[].hubUrl 優先——每班指到自己的 Hub 課程頁、標籤改「課程網站」；
        # 顯示時去 scheme 好讀（資料仍存完整 URL）。無 hubUrl 才退回 finale.materialsUrl。
        hub_url = self.section.get("hubUrl")
        if hub_url:
            materials_label = "課程網站"
            shown = re.sub(r"^https?://", "", str(hub_url))
            materials_html = f'<span style="font-family:var(--lat)">{esc(shown)}</span>'
        else:
            materials_label = "課程教材網址"
            materials = finale.get("materialsUrl", {})
            materials_html = (
                pb.pending("【開學前待補】")
                if materials.get("status") == "pending"
                else esc(materials.get("url", ""))
            )
        col_body = (
            '<div class="kicker">SEE YOU NEXT WEEK</div>'
            f'<div class="big-title" style="margin-top:14px">{self._finale_title_html()}</div>'
            f'<div class="big-sub">下週預告：{esc(finale.get("nextWeek", ""))}</div>'
            '<div style="margin-top:26px;font-size:21px;font-weight:800;color:var(--gold)">'
            # 前綴「小任務：」（Ted 裁決 2026-07-03）：v1 原為「下週的小任務：」，但
            # course.json 的 finale.action 自帶「下週」開頭（供 Hub 網頁等載體單獨引用），
            # 前綴去掉「下週的」避免組合後重複。
            f'小任務：{esc(finale.get("action", ""))}</div>'
            '<div class="muted" style="color:var(--on-dark-dim);margin-top:18px;font-size:17px">'
            f'{materials_label}：{materials_html}</div>'
        )
        # hubUrl 掃碼卡（2026-07-05 設計升級）：教室裡學生拍投影幕、文字網址抄不了，
        # 白底 QR 卡讓 deck→Hub 這座橋真的走得通。qrcode 套件沒裝或無 hubUrl →
        # 退回原單欄純文字版（輸出與升級前 identical）。
        qr_html = pb.qr_svg(hub_url) if hub_url else None
        if qr_html:
            inner = (
                '<div style="height:100%;display:flex;align-items:center;gap:56px">'
                '<div style="flex:1;min-width:0;display:flex;flex-direction:column;'
                f'justify-content:center;max-width:820px">{col_body}</div>'
                '<div style="flex:0 0 auto;background:#fff;border-radius:18px;'
                'padding:16px 16px 10px;text-align:center;'
                f'box-shadow:0 10px 30px rgba(0,0,0,.30)">{qr_html}'
                '<div style="margin-top:6px;font-size:13px;font-weight:700;color:#07403F">'
                '掃碼進課程網站</div></div>'
                '</div>'
            )
        else:
            inner = (
                '<div style="height:100%;display:flex;flex-direction:column;justify-content:center;max-width:820px">'
                + col_body + '</div>'
            )
        self.write(19, inner, dark=True)

    def _finale_title_html(self):
        """v1：『歡迎來到<br>人工智慧概論』——course.json 沒有這句固定歡迎詞的獨立欄位，
        用課程 name 組字串還原（『歡迎來到』為模板固定文案，name 動態帶入；
        長課名折行規則同封面 _name_html）。"""
        return f'歡迎來到<br>{self._name_html(self.course.get("name", ""))}'

    def build_all(self):
        self.page01_cover()
        self.page02_info()
        self.page03_location()
        self.page04_about()
        self.page05_office()
        self.page06_slido1()
        self.page07_phases()
        self.page08_destination()
        self.page09_weeks()
        if self.course.get("kind") == "lecture-series" and self.talks:
            self.pages_talks_lineup()
        self.page10_grading()
        self.page11_help()
        self.page12_elearn()
        self.page13_platforms()
        self.page14_tools()
        self.page15_daily()
        self.page16_bring()
        self.page17_rules()
        self.page18_slido2()
        self.page19_finale()
        # 清掉上次輸出殘留的多餘頁——重跑到同一夾、且本次頁數變少（跳頁）時，
        # 殘留的舊 18/19.html 會讓 pack／structure_check 誤收
        for f in os.listdir(self.out_dir):
            if re.match(r"^\d{2}\.html$", f) and int(f[:2]) > self._page_no:
                os.remove(os.path.join(self.out_dir, f))
        with open(os.path.join(self.out_dir, "_manifest.json"), "w", encoding="utf-8") as f:
            json.dump({"templateTotal": TOTAL_PAGES, "pages": self.manifest},
                      f, ensure_ascii=False, indent=1)
        return self.written


class BilingualDeck:
    """英文為主、中文小字在下的雙語版（目前只 AA）。

    結構鏡射 v1 generate_aa_en.py（唯讀）：共用 pagebuilders 的 slide 骨架，
    文字層用 bilingual_builders。英文/中文字串全部由 overlay 的 `en` 區塊供給
    （overlay 不進 Hub course.json，見 decisions.md 第六節）；週數/成績百分比/
    班別 id 等結構資料仍來自 course.json（與中文版同源，保證兩版數字一致）。
    """

    def __init__(self, course, section, out_dir, overlay):
        import bilingual_builders as bb
        self.bb = bb
        self.course = course
        self.section = section
        self.intro = course.get("intro", {})
        if not overlay or "en" not in overlay:
            raise ValueError("--lang bilingual 需要含 `en` 區塊的 overlay（見 "
                             "skills/course-intro/overlays/11501-ai-intro-bilingual.json）")
        self.en = overlay["en"]
        self.out_dir = out_dir
        os.makedirs(out_dir, exist_ok=True)
        self.written = []

    def write(self, n, inner, dark=False, cover=False, no_footer=False):
        org_footer_text = self.en.get("orgFooter", "")
        # 雙語版校徽 alt 用英文（對齊 v1 generate_aa_en.py 的 seal alt）
        html_doc = pb.render_slide(inner, org_footer_text, dark=dark, cover=cover,
                                   no_footer=no_footer, seal_alt="National Dong Hwa University")
        path = os.path.join(self.out_dir, f"{n:02d}.html")
        with open(path, "w", encoding="utf-8") as f:
            f.write(html_doc)
        self.written.append(path)
        return path

    # ---- 與 zh Deck 共用的三個資料驅動掛勾（2026-09-01 補齊）----
    # 8/31 只在中文版加了 _hero／floorPlans／Slido 真 QR，BilingualDeck 漏掉，
    # 雙語產線因 AttributeError 整條壞掉（ai-intro AA 是 EMI、雙語版是課堂正式版）。
    # 直接借用 Deck 的同名函式（都只讀 self.intro／self.section，兩類介面相同）。
    _hero = Deck._hero
    _floor_plan = Deck._floor_plan
    _slido_qr_html = Deck._slido_qr_html
    _slido_event_code = Deck._slido_event_code

    # ---- 19 頁（1:1 對齊 v1 generate_aa_en.py 版式）----

    def page01_cover(self):
        bb = self.bb
        c = self.en["cover"]
        name_en = self.en.get("nameEn", "")
        name_zh = self.course.get("name", "")
        chips_html = "".join(f"<span>{bb.esc(x)}</span>" for x in c.get("chips", []))
        inner = (
            f'<img class="hero hero-intro" src="{self._hero("intro")}" alt="">'
            '<div class="scrim"></div>'
            '<div class="inner">'
            f'<div class="kicker">{bb.esc(c["kicker"])}</div>'
            f'<div class="ctitle en">{bb.esc(name_en)}'
            f'<span class="zh">{bb.esc(name_zh)}</span></div>'
            f'<div class="cover-promise">{bb.esc(c["promise"])}</div>'
            f'<div class="cover-chips">{chips_html}</div>'
            f'<div class="muted" style="color:#F8E8B8;margin-top:10px;font-size:15px">{bb.esc(c["chipsZh"])}</div>'
            f'<div class="cmeta">{c["metaEn"]}'
            f'<br><span style="font-size:16px;color:var(--on-dark-dim)">{bb.esc(c["metaZh"])}</span></div>'
            '<img src="../assets/seal-white.webp" alt="NDHU" '
            'style="position:absolute;right:96px;top:88px;width:60px;height:60px;opacity:.95">'
            '</div>'
        )
        self.write(1, inner, cover=True)

    def page02_info(self):
        bb = self.bb
        s = self.en["section"]
        info = self.en["info"]
        inner = (
            bb.kicker(info["kicker"]) + bb.bititle(info["titleEn"], info["titleZh"])
            # 24→18（2026-09-01）：雙語標題較高＋六張卡英文行數多，p2 溢 3px
            + '<div class="grid grid-3" style="margin-top:18px">'
            + bb.infocard("cap", info["sectionLabel"], s["codeLineEn"] + bb.zh(s["codeLineZh"]))
            + bb.infocard("clock", info["timeLabel"],
                          f'{bb.esc(s["timeEn"])} <small>{bb.pending(s["timePendingEn"])}</small>' + bb.zh(s["timeZh"]))
            + bb.infocard("pin", info["roomLabel"], bb.esc(s["roomEn"]) + bb.zh(s["roomZh"]))
            + bb.infocard("user", info["instructorLabel"],
                          f'Prof. Wen-Sheng Chen <small>· TA {bb.pending(info["instructorTaPendingEn"])}</small>'
                          + bb.zh(info["instructorValueZh"]))
            + bb.infocard("msg", info["contactLabel"],
                          f'<small style="font-family:var(--lat);font-size:15px">{bb.esc(info["contactValueEn"])}</small>'
                          + bb.zh(info["contactValueZh"]))
            + bb.infocard("slides", info["platformsLabel"],
                          f'<small>{bb.esc(info["platformsValueEn"])}</small>' + bb.zh(info["platformsValueZh"]))
            + '</div>'
        )
        self.write(2, inner)

    def page03_location(self):
        bb = self.bb
        loc = self.en["location"]
        s = self.en["section"]
        # intro.floorPlans 有圖就嵌真平面圖（同 zh page03，2026-09-01 補齊）；沒圖維持原待補佔位
        plan_img = pb.img_b64(self._floor_plan("classroom"), alt="Classroom floor plan",
                              style="max-width:100%;max-height:330px;border-radius:8px")
        if plan_img:
            body = (plan_img
                    + f'<div style="font-size:20px;font-weight:700;margin-top:14px;color:var(--on-dark);font-family:var(--lat)">{s["roomBlueprintEn"]}</div>'
                    + f'<div style="font-size:15px;color:var(--on-dark-dim);margin-top:4px">{bb.esc(s["roomBlueprintZh"])}</div>')
        else:
            body = (bb.icon("pin", "var(--gold)", 40)
                    + f'<div style="font-size:21px;font-weight:700;margin-top:12px;font-family:var(--lat)">{s["roomBlueprintEn"]}</div>'
                    + f'<div style="font-size:17px;color:var(--on-dark-dim);margin-top:4px">{bb.esc(s["roomBlueprintZh"])}</div>'
                    + f'<div class="muted" style="margin-top:8px;color:var(--on-dark-dim)">{bb.esc(s["roomBlueprintNote"])}</div>')
        inner = (
            bb.kicker(loc["kicker"]) + bb.bititle(loc["titleEn"], loc["titleZh"])
            + '<div class="card-blueprint" style="margin-top:22px;">'
            + '<div style="text-align:center;color:var(--on-dark);z-index:2">'
            + body + '</div></div>'
        )
        self.write(3, inner)

    def page04_about(self):
        bb = self.bb
        a = self.en["about"]
        instr = self.en["instructor"]
        inner = (
            bb.kicker(a["kicker"]) + bb.bititle(a["titleEn"], a["titleZh"])
            + f'<div class="subtitle">{bb.esc(instr["title"])}' + bb.zh(a["subtitleZh"]) + '</div>'
            + '<div style="margin-top:10px;font-size:19px;font-weight:500;color:var(--ink)">'
            + instr["promise"] + bb.zh(a["promiseZh"]) + '</div>'
            + '<div class="grid grid-2" style="margin-top:22px">'
            + bb.linecard("mail", a["emailLabel"], '<span style="font-family:var(--lat);font-size:20px">wschen@gms.ndhu.edu.tw</span>')
            + bb.linecard("phone", a["phoneLabel"], '<span style="font-family:var(--lat);font-size:20px">03-890-6610</span>')
            + bb.linecard("user", a["officeLabel"], bb.esc(instr["office"]) + bb.zh(a["officeValueZh"]))
            + bb.linecard("msg", a["contactLabel"], bb.esc(a["contactValueEn"]) + bb.zh(a["contactValueZh"]))
            + '</div>'
        )
        self.write(4, inner)

    def page05_office(self):
        bb = self.bb
        o = self.en["office"]
        # 同 page03：floorPlans.office 有圖就嵌真平面圖（2026-09-01 補齊）
        plan_img = pb.img_b64(self._floor_plan("office"), alt="Office floor plan",
                              style="max-width:100%;max-height:330px;border-radius:8px")
        if plan_img:
            body = (plan_img
                    + f'<div style="font-size:20px;font-weight:700;margin-top:14px;color:var(--on-dark);font-family:var(--lat)">{o["blueprintEn"]}</div>'
                    + f'<div style="font-size:15px;color:var(--on-dark-dim);margin-top:4px">{bb.esc(o["blueprintZh"])}</div>')
        else:
            body = (bb.icon("pin", "var(--gold)", 40)
                    + f'<div style="font-size:21px;font-weight:700;margin-top:12px;font-family:var(--lat)">{o["blueprintEn"]}</div>'
                    + f'<div style="font-size:17px;color:var(--on-dark-dim);margin-top:4px">{bb.esc(o["blueprintZh"])}</div>'
                    + f'<div class="muted" style="margin-top:8px;color:var(--on-dark-dim)">{bb.esc(o["blueprintNote"])}</div>')
        inner = (
            bb.kicker(o["kicker"]) + bb.bititle(o["titleEn"], o["titleZh"])
            + '<div class="card-blueprint" style="margin-top:22px;">'
            + '<div style="text-align:center;color:var(--on-dark);z-index:2">'
            + body + '</div></div>'
        )
        self.write(5, inner)

    def page06_slido1(self):
        bb = self.bb
        s = self.en["slido1"]
        inner = (
            '<div class="big-center" style="height:100%;display:flex;flex-direction:column;justify-content:center;max-width:780px">'
            f'<div class="kicker">{bb.esc(s["kicker"])}</div>'
            f'<div class="big-title" style="margin-top:14px">{s["titleEnHtml"]}'
            f'<span class="zh">{bb.esc(s["titleZh"])}</span></div>'
            f'<div class="big-sub">{self._slido_sub_html(s)}</div>'
            '<div class="muted" style="color:var(--on-dark-dim);margin-top:22px;font-size:16px">'
            # noteEn raw：v1 這句「…you've tried.」直接寫進 f-string 未過 esc，' 保裸字元
            f'{s["noteEn"]}'
            f'<br><span style="font-size:14px">{bb.esc(s["noteZh"])}</span></div>'
            '</div>'
            + self._slido_qr_or_placeholder(s)
        )
        self.write(6, inner, dark=True)

    def _slido_sub_html(self, s):
        """加入列：有 event 數字碼就印真碼（同 zh 版 2026-08-31 邏輯），沒有維持佔位字。"""
        bb = self.bb
        code = self.section.get("slidoEvent")
        if code:
            return f'{bb.esc(s["subEn"])}{bb.esc(str(code))}'
        return f'{bb.esc(s["subEn"])}{bb.pending(s["subPendingEn"])}'

    def _slido_qr_or_placeholder(self, s):
        """手機框：有 slidoEvent＋slidoEventUrl（uuid 版）畫真 QR，否則原英文佔位。"""
        bb = self.bb
        code = self.section.get("slidoEvent")
        url = self.section.get("slidoEventUrl")
        if code and url:
            return self._slido_qr_html()  # 借 zh Deck：真 QR＋#碼（語言中性）
        return ('<div class="qr-phone"><div class="qr-screen"><div class="qr-placeholder">'
                + bb.icon("qr", "var(--gold)", 48)
                + f'<div style="margin-top:10px;font-size:12px;color:var(--on-dark-dim)">{bb.esc(s["qrPendingEn"])}</div>'
                + '</div></div></div>')

    def page07_phases(self):
        bb = self.bb
        p = self.en["phases"]
        phases = self.intro.get("phases", [])
        cards = ""
        for i, ph in enumerate(phases):
            item = p["items"][i]
            cards += bb.partcard(ph.get("id", i + 1), item["headEn"], item["headZh"], item["bodyEn"], item["bodyZh"])
        inner = (
            bb.kicker(p["kicker"]) + bb.bititle(p["titleEn"], p["titleZh"], big=True)
            + f'<div class="subtitle" style="color:var(--on-dark-dim)">{p["noteEnHtml"]}' + bb.zh(p["noteZh"]) + '</div>'
            # 28→16（2026-09-01）：雙語標題＋雙語副標各多一行中文，p7 溢 9px
            + f'<div class="grid grid-3" style="margin-top:16px;margin-bottom:0">{cards}</div>'
        )
        self.write(7, inner, dark=True)

    def page08_destination(self):
        bb = self.bb
        d = self.en["destination"]
        steps = d.get("steps", [])
        steps_html = ""
        for i, step in enumerate(steps, start=1):
            # labelEn raw：v1「Verify & break down」的 & 直接寫進 f-string 未過 esc，保裸 &
            steps_html += (f'<div><b>{i:02d}</b><span>{step["labelEn"]}'
                           f'<small style="display:block;font-size:13px;font-weight:500;color:#F8E8B8;opacity:.8">'
                           f'{bb.esc(step["labelZh"])}</small></span></div>')
            if i < len(steps):
                steps_html += '<div class="step-arrow">→</div>'
        inner = (
            f'<img class="concept-hero" src="{self._hero("workflow")}" alt="">'
            '<div class="concept-scrim"></div>'
            '<div class="concept-copy concept-copy--right">'
            f'<div class="kicker">{bb.esc(d["kicker"])}</div>'
            f'<div class="big-title" style="margin-top:14px">{d["titleEnHtml"]}'
            f'<span class="zh">{bb.esc(d["titleZh"])}</span></div>'
            f'<div class="big-sub">{bb.esc(d["subEn"])}'
            f'<br><span style="font-size:16px">{bb.esc(d["subZh"])}</span></div>'
            f'<div class="concept-steps">{steps_html}</div>'
            '</div>'
        )
        self.write(8, inner, dark=True, no_footer=True)

    def page09_weeks(self):
        bb = self.bb
        w = self.en["weeks"]
        weekly = self.intro.get("weeklyPlan", [])
        labels_en = w["labelsEn"]
        if len(labels_en) != len(weekly):
            # fail-closed：英文標籤數跟 course.json 週數對不上＝overlay 過期，
            # 寧可當場擋下也不出「英文標到隔壁週」的 deck（美崙溪 2026-08-26 原則）
            raise ValueError(f"overlay weeks.labelsEn 有 {len(labels_en)} 條，"
                             f"course.json weeklyPlan 有 {len(weekly)} 週——overlay 過期，先補齊")
        # 短版同 zh：英文可由 overlay weeks.labelsEnShort（以週次為鍵）覆寫、中文用 labelShort，
        # 沒給就退回長版——p09 欄寬約 130px，長標籤會腰斬詞（2026-09-02 眼檢）。
        labels_en_short = w.get("labelsEnShort", {}) or {}
        cells = []
        for i, wk in enumerate(weekly):
            kind = "ms" if wk.get("milestone") else ""
            en = labels_en_short.get(str(wk.get("w"))) or labels_en[i]
            zh = wk.get("labelShort") or wk.get("label", "")
            cells.append(bb.weekcell(wk.get("w", ""), en, zh, kind))
        half = 7
        row1 = "".join(cells[:half])
        row2 = "".join(cells[half:])

        # 色帶改依 weeklyPlan 的 part 分布動態算（2026-09-01，鏡射 zh _week_band）：
        # v1 寫死兩段式 band1En/band2En，v4 的 part 分布（9/5/3）在第二列會出現三段，
        # 寫死版本裝不下。band 文案＝overlay weeks.partsEn[part id]（name＋weeks），
        # 字面 HTML（& 不轉義）同 v1 慣例；跨列延續段印「PART {id} (cont.)」。
        # fail-closed：partsEn 缺該 part＝overlay 過期，當場擋（立霧複驗 2026-09-01 指正，
        # 與 labelsEn 條數檢查同一原則——不靜默退化成「PART n」空週距）。
        parts_en = w.get("partsEn", {})
        for wk in weekly:
            if str(wk.get("part")) not in parts_en:
                raise ValueError(f"overlay weeks.partsEn 缺 part {wk.get('part')} 的英文名——"
                                 "overlay 過期，先補齊")

        def band(weeks_row, prev_last_part):
            from collections import OrderedDict
            counts = OrderedDict()
            for wk in weeks_row:
                p = wk.get("part")
                counts[p] = counts.get(p, 0) + 1
            cls_map = {1: "p1", 2: "p2", 3: "p3", 4: "p4"}
            segs = []
            for idx, p in enumerate(counts):
                # 「續」＝這一段真的是上一列最後一個 part 的延續（立霧複驗指正：
                # 只看 row2 第一段會把「剛好從第二列開頭起算的新 part」也誤標成續）
                is_cont = (idx == 0 and prev_last_part is not None
                           and p == prev_last_part)  # len>1 條件已去除（立霧 r2，同 zh）
                info = parts_en[str(p)]
                if is_cont:
                    text = f'PART {p} (cont.)'
                else:
                    name = info.get("name", f"PART {p}")
                    wr = info.get("weeks", "")
                    text = f'PART {p} · {name} ({wr})' if wr else f'PART {p} · {name}'
                segs.append(f'<div class="{cls_map.get(p, "p2")}" style="flex:{counts[p]}">{text}</div>')
            return f'<div class="pband">{"".join(segs)}</div>'

        row1_weeks = weekly[:half]
        band1 = band(row1_weeks, None)
        band2 = band(weekly[half:], row1_weeks[-1].get("part") if row1_weeks else None)
        inner = (
            bb.kicker(w["kicker"]) + bb.bititle(w["titleEn"], w["titleZh"])
            + '<div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:40px">'
            + '<div><div style="position:relative"><div class="tlbar" style="top:7px;left:0;right:0"></div>'
            + f'<div class="timeline" style="margin-top:0">{row1}</div></div>{band1}</div>'
            + '<div><div style="position:relative"><div class="tlbar" style="top:7px;left:0;right:0"></div>'
            + f'<div class="timeline" style="margin-top:0">{row2}</div></div>{band2}</div>'
            + '</div>'
            + f'<div class="muted">{w["legendEn"]}</div>'
        )
        self.write(9, inner)

    def page10_grading(self):
        bb = self.bb
        g = self.en["grading"]
        grading = self.intro.get("grading", [])
        colors = [
            ("var(--teal)", "var(--teal-700)"),
            ("var(--teal)", "var(--gold)"),
            ("var(--gold)", "var(--gold)"),
            ("var(--gold)", "#E05236"),
        ]
        cells = ""
        for i, gr in enumerate(grading):
            item = g["items"][i]
            c1, c2 = colors[i] if i < len(colors) else ("var(--teal)", "var(--gold)")
            cells += bb.statblock(gr.get("pct", 0), item["labelEn"], item["labelZh"], item.get("subEn", ""), c1, c2)
        inner = (
            bb.kicker(g["kicker"]) + bb.bititle(g["titleEn"], g["titleZh"])
            + f'<div class="grid grid-4">{cells}</div>'
            + f'<div class="muted" style="margin-top:26px">{g["noteEnHtml"]}'
            + f'<br><span style="font-size:13px">{bb.esc(g["noteZh"])}</span></div>'
        )
        self.write(10, inner)

    def page11_help(self):
        bb = self.bb
        h = self.en["help"]
        inner = (
            bb.kicker(h["kicker"]) + bb.bititle(h["titleEn"], h["titleZh"])
            + '<div class="grid grid-2" style="margin-top:28px">'
            + bb.linecard("msg", h["teamsLabel"], bb.esc(h["teamsValueEn"]) + bb.zh(h["teamsValueZh"]))
            + bb.linecard("mail", h["emailLabel"], '<span style="font-family:var(--lat);font-size:20px">wschen@gms.ndhu.edu.tw</span>')
            + '</div>'
            + f'<div class="muted" style="margin-top:26px">{bb.esc(h["noteEn"])}</div>'
        )
        self.write(11, inner)

    def page12_elearn(self):
        # 2026-09-01 由「加入 Teams 課程」改版（同 zh page12_elearn；115-1 六課定案走
        # e學苑，Hub commit 4a33840）——overlay 鍵名同步 teams→elearn，結構不變。
        bb = self.bb
        t = self.en["elearn"]
        lis = ""
        for it in t["items"]:
            if "pendingEn" in it:
                body = f'{bb.esc(it["enPrefix"])}{bb.pending(it["pendingEn"])}' + bb.zh(it["zh"])
            else:
                body = bb.esc(it["en"]) + bb.zh(it["zh"])
            lis += f'<li><span class="b"></span><div>{body}</div></li>'
        inner = (
            bb.kicker(t["kicker"]) + bb.bititle(t["titleEn"], t["titleZh"])
            + f'<div class="vcenter"><ul class="list list--lg" style="margin-top:0">{lis}</ul></div>'
        )
        self.write(12, inner)

    def page13_platforms(self):
        bb = self.bb
        p = self.en["platforms"]
        icons = ["user", "pen", "book"]
        cells = "".join(
            bb.toolcard(icons[i] if i < len(icons) else "tool", it["nameEn"], it["value"], it["zh"])
            for i, it in enumerate(p["items"])
        )
        # 卡片列包 .vcenter 垂直置中（2026-07-05 設計升級，同中文版第 13 頁；
        # 對 v1 slides_aa_en 為有意差異，見 PARITY.md 附錄）
        inner = (
            bb.kicker(p["kicker"]) + bb.bititle(p["titleEn"], p["titleZh"])
            + f'<div class="vcenter"><div class="grid grid-3" style="margin:0">{cells}</div></div>'
        )
        self.write(13, inner)

    def page14_tools(self):
        bb = self.bb
        t = self.en["tools"]
        icons = ["bot", "search", "slides", "term"]
        bands = ""
        for i, g in enumerate(t["groups"]):
            items = [(it["name"], it["sub"]) for it in g["items"]]
            bands += bb.tband(icons[i] if i < len(icons) else "tool", g["groupEn"], g["groupZh"], items)
        pstrip = "".join(
            f'<div class="p"><span class="use">{bb.esc(p["use"])}</span><span class="pn">{bb.esc(p["name"])}</span></div>'
            for p in t["pstripEn"]
        )
        inner = (
            bb.kicker(t["kicker"]) + bb.bititle(t["titleEn"], t["titleZh"])
            + '<div style="flex:1;display:flex;flex-direction:column;justify-content:center">'
            + bands
            + f'<div class="pstrip">{pstrip}</div></div>'
            + f'<div class="muted">{t["noteEnHtml"]}</div>'
        )
        self.write(14, inner, no_footer=True)

    def page15_daily(self):
        bb = self.bb
        d = self.en["daily"]
        icons = ["bot", "search", "book", "tool"]
        cells = "".join(
            bb.toolcard(icons[i] if i < len(icons) else "tool", it["nameEn"], it["sub"], it["zh"])
            for i, it in enumerate(d["items"])
        )
        # 卡片＋推薦語包 .vcenter（2026-07-05 設計升級，同中文版第 15 頁）
        inner = (
            bb.kicker(d["kicker"]) + bb.bititle(d["titleEn"], d["titleZh"])
            + '<div class="vcenter">'
            + f'<div class="grid grid-4" style="margin:0">{cells}</div>'
            + f'<div class="muted" style="margin-top:22px">{d["noteEnHtml"]}</div>'
            + '</div>'
        )
        self.write(15, inner)

    def page16_bring(self):
        bb = self.bb
        b = self.en["bring"]
        lis = "".join(
            f'<li><span class="b"></span><div>{it["enHtml"]}' + bb.zh(it["zh"]) + '</div></li>'
            for it in b["items"]
        )
        inner = (
            bb.kicker(b["kicker"]) + bb.bititle(b["titleEn"], b["titleZh"])
            + f'<div class="vcenter"><ul class="list list--lg" style="margin-top:0">{lis}</ul></div>'
        )
        self.write(16, inner)

    def page17_rules(self):
        bb = self.bb
        r = self.en["rules"]
        items = "".join(
            bb.ruleitem(f"{i:02d}", it["headEn"], it["headZh"], it["bodyEn"], it["bodyZh"])
            for i, it in enumerate(r["items"], start=1)
        )
        inner = (
            bb.kicker(r["kicker"]) + bb.bititle(r["titleEn"], r["titleZh"], big=True)
            + f'<div class="subtitle" style="color:var(--on-dark-dim)">{bb.esc(r["subEn"])}' + bb.zh(r["subZh"]) + '</div>'
            # 12→6（2026-09-01）：en p17 三條雙語守則本體 440px、整頁溢 78px 的擠版帳一角，
            # 主刀在 bilingual_builders.ruleitem 的邊距與字級
            + f'<div style="margin-top:6px;max-width:900px">{items}</div>'
        )
        self.write(17, inner, dark=True, no_footer=True)

    def page18_slido2(self):
        bb = self.bb
        s = self.en["slido2"]
        inner = (
            '<div class="big-center" style="height:100%;display:flex;flex-direction:column;justify-content:center;max-width:780px">'
            f'<div class="kicker">{bb.esc(s["kicker"])}</div>'
            f'<div class="big-title" style="margin-top:14px">{s["titleEnHtml"]}'
            f'<span class="zh">{bb.esc(s["titleZh"])}</span></div>'
            f'<div class="big-sub">{self._slido_sub_html(s)}</div>'
            '<div class="muted" style="color:var(--on-dark-dim);margin-top:22px;font-size:16px">'
            f'{s["noteEnHtml"]}'
            f'<br><span style="font-size:14px">{bb.esc(s["noteZh"])}</span></div>'
            '</div>'
            + self._slido_qr_or_placeholder(s)
        )
        self.write(18, inner, dark=True)

    def page19_finale(self):
        bb = self.bb
        f = self.en["finale"]
        col_body = (
            f'<div class="kicker">{bb.esc(f["kicker"])}</div>'
            f'<div class="big-title" style="margin-top:14px">{f["titleEnHtml"]}'
            f'<span class="zh">{bb.esc(f["titleZh"])}</span></div>'
            f'<div class="big-sub">{bb.esc(f["nextWeekEn"])}'
            f'<br><span style="font-size:16px">{bb.esc(f["nextWeekZh"])}</span></div>'
            '<div style="margin-top:24px;font-size:21px;font-weight:800;color:var(--gold)">'
            # actionEn raw：v1「…you'd like to solve…」直接寫進 f-string 未過 esc，' 保裸字元
            f'{f["actionEn"]}'
            f'<span style="display:block;font-size:16px;font-weight:700;margin-top:2px">{bb.esc(f["actionZh"])}</span></div>'
            '<div class="muted" style="color:var(--on-dark-dim);margin-top:16px;font-size:17px">'
            f'{bb.esc(f["materialsEn"])}{bb.pending(f["materialsPendingEn"])}　{bb.esc(f["materialsZh"])}</div>'
        )
        # hubUrl 掃碼卡（2026-07-05 設計升級，同中文版第 19 頁）：overlay 文字層不動、
        # QR 直接吃 section.hubUrl；無 hubUrl 或沒裝 qrcode → 原單欄版（與 v1 一致）
        hub_url = self.section.get("hubUrl")
        qr_html = pb.qr_svg(hub_url) if hub_url else None
        if qr_html:
            inner = (
                '<div style="height:100%;display:flex;align-items:center;gap:56px">'
                '<div style="flex:1;min-width:0;display:flex;flex-direction:column;'
                f'justify-content:center;max-width:860px">{col_body}</div>'
                '<div style="flex:0 0 auto;background:#fff;border-radius:18px;'
                'padding:16px 16px 10px;text-align:center;'
                f'box-shadow:0 10px 30px rgba(0,0,0,.30)">{qr_html}'
                '<div style="margin-top:6px;font-size:12.5px;font-weight:700;color:#07403F">'
                'Scan for the course site<br>掃碼進課程網站</div></div>'
                '</div>'
            )
        else:
            inner = (
                '<div style="height:100%;display:flex;flex-direction:column;justify-content:center;max-width:860px">'
                + col_body + '</div>'
            )
        self.write(19, inner, dark=True)

    def build_all(self):
        self.page01_cover()
        self.page02_info()
        self.page03_location()
        self.page04_about()
        self.page05_office()
        self.page06_slido1()
        self.page07_phases()
        self.page08_destination()
        self.page09_weeks()
        self.page10_grading()
        self.page11_help()
        self.page12_elearn()
        self.page13_platforms()
        self.page14_tools()
        self.page15_daily()
        self.page16_bring()
        self.page17_rules()
        self.page18_slido2()
        self.page19_finale()
        return self.written


def main():
    ap = argparse.ArgumentParser(description="course-intro 資料驅動版簡報產線")
    ap.add_argument("--course-json", required=True, help="Course Hub 的 course.json 路徑")
    ap.add_argument("--section", required=True, help="班別 id（對齊 sections[].id，如 AA / AB）")
    ap.add_argument("--overlay", default=None, help="選配：補講者備忘等不公開欄位的 overlay JSON；"
                                                    "--lang bilingual 時必填（含 en 區塊）")
    ap.add_argument("--lang", default="zh", choices=["zh", "bilingual"],
                    help="zh＝純中文（預設，行為不變）；bilingual＝英文為主＋中文小字（目前只 AA）")
    ap.add_argument("--out", required=True, help="輸出資料夾（會產 01.html ... 19.html）")
    args = ap.parse_args()

    course = load_json(args.course_json)
    assert_no_forbidden_content(course, "course.json")

    overlay = None
    if args.overlay:
        overlay = load_json(args.overlay)
        assert_no_forbidden_content(overlay, "overlay")

    section = find_section(course, args.section)

    if args.lang == "bilingual":
        deck = BilingualDeck(course, section, args.out, overlay=overlay)
    else:
        talks = None
        if course.get("kind") == "lecture-series":
            tpath = os.path.join(os.path.dirname(os.path.abspath(args.course_json)), "talks.json")
            if os.path.exists(tpath):
                tdata = load_json(tpath)
                talks = tdata if isinstance(tdata, list) else tdata.get("talks") or []
        deck = Deck(course, section, args.out, overlay=overlay, talks=talks)
    written = deck.build_all()

    if args.lang == "bilingual":
        # 雙語版（目前只 ai-intro AA）不走跳頁——固定 19 頁
        if len(written) != TOTAL_PAGES:
            print(f"警告：只產出 {len(written)} 頁，預期 {TOTAL_PAGES} 頁", file=sys.stderr)
            sys.exit(1)
    else:
        emitted = {p["template"] for p in deck.manifest}
        skipped = sorted(set(range(1, TOTAL_PAGES + 1)) - emitted)
        illegal = [t for t in skipped if t not in SKIPPABLE_PAGES]
        if illegal:
            print(f"錯誤：缺了不可跳的模板頁 {illegal}（可跳頁僅 {sorted(SKIPPABLE_PAGES)}）",
                  file=sys.stderr)
            sys.exit(1)
        if skipped:
            print(f"跳頁：模板頁 {skipped} 內容為空未輸出（本課 deck 共 {len(written)} 頁）")

    print(f"已生成 {len(written)} 個 HTML 到 {args.out}（lang={args.lang}）")
    for p in written:
        print(" -", os.path.basename(p))


if __name__ == "__main__":
    main()
