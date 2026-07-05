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
        --course-json "D:/Ted_data/wailan_agent/workspace/teaching/tools/ndhu-ted-course-hub/content/courses/11501-ai-intro/course.json" \
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
DARK_PAGES = {1, 6, 7, 8, 17, 18, 19}  # render-check 用的深底節奏規格，供 parity/驗收引用


class Deck:
    def __init__(self, course, section, out_dir, overlay=None):
        self.course = course
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
                        return f'{esc(head + sep)}<br>{esc(tail)}'
        return esc(s)

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
            '<img class="hero hero-intro" src="../assets/intro-hero-ai.png" alt="">'
            '<div class="scrim"></div>'
            '<div class="inner">'
            f'<div class="kicker">{esc(kicker)}</div>'
            f'<div class="ctitle">{self._name_html(name)}</div>'
            f'<div class="csub">{esc(name_en)}</div>'
            f'<div class="cover-promise">{esc(promise)}</div>'
            f'<div class="cover-chips">{chips_html}</div>'
            f'<div class="cmeta">{self._semester_display(semester)}　·　{esc(org)}<br>'
            f'授課教師：<b>{esc(instructor_name)}</b></div>'
            '<img src="../assets/seal-white.png" alt="NDHU" '
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
        # 內容對照表「TA 名字」列，標記待補、非模板固定文案。
        ta_html = pb.pending("開學前待補")
        cells = (
            pb.infocard("cap", "班別／課號",
                        f'{esc(sec.get("id", ""))} 班　<small style="font-family:var(--lat)">'
                        f'{esc(sec.get("code", ""))}・系統編號 {esc(sec.get("systemId", ""))}</small><br>'
                        f'<small>{esc(course_type)}・{esc(credits)} 學分・{esc(weeks_system)}</small>')
            + pb.infocard("clock", "上課時間", f'{esc(sec.get("time", ""))}{time_note_html}')
            + pb.infocard("pin", "教　　室", esc(sec.get("room", "")))
            + pb.infocard("user", "授課教師", f'{esc(instr.get("name", ""))}　<small>TA：</small>{ta_html}')
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
        parts = [f'{p.get("use", "")} {p.get("name", "")}' for p in plats]
        line = "・".join(parts)
        return f'<small>{esc(line)}</small><br><small>' + pb.pending("Slido #・Teams 代碼開學前補") + '</small>'

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
        map_note = pb.pending("【教室平面圖・開學前補】")
        inner = (
            pb.kicker("WHERE WE MEET") + pb.title("上課地點")
            + '<div class="card-blueprint" style="margin-top:24px;">'
            + '<div style="text-align:center;color:var(--on-dark);z-index:2">'
            + pb.icon("pin", "var(--gold)", 40)
            + room_line
            + '<div class="muted" style="margin-top:6px;color:var(--on-dark-dim)">'
            + map_note + '</div></div></div>'
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
            + pb.icon("pin", "var(--gold)", 40)
            + f'<div style="font-size:22px;font-weight:700;margin-top:12px">{esc(instr.get("office", ""))}</div>'
            + '<div class="muted" style="margin-top:6px;color:var(--on-dark-dim)">'
            + pb.pending("【研究室平面圖・開學前補】") + '</div></div></div>'
        )
        self.write(5, inner)

    def _slido_event_code(self):
        code = self.section.get("slidoEvent")
        return code if code else pb.pending("開學前待補")

    def page06_slido1(self):
        inner = (
            '<div class="big-center" style="height:100%;display:flex;flex-direction:column;justify-content:center;max-width:760px">'
            '<div class="kicker">JOIN AT SLIDO.COM</div>'
            '<div class="big-title" style="margin-top:14px">拿出手機，<br>先認識一下你</div>'
            f'<div class="big-sub">掃 QR Code 加入　slido.com　·　#{self._slido_event_code()}</div>'
            '<div class="muted" style="color:var(--on-dark-dim);margin-top:22px;font-size:16px">'
            '等等問你：你心中的 AI 像什麼、你來自哪個系、用過哪些 AI 工具</div>'
            '</div>'
            '<div class="qr-phone"><div class="qr-screen"><div class="qr-placeholder">'
            + pb.icon("qr", "var(--gold)", 48)
            + '<div style="margin-top:10px;font-size:12px;color:var(--on-dark-dim)">QR 待補</div>'
            + '</div></div></div>'
        )
        self.write(6, inner, dark=True)

    def page07_phases(self):
        phases = self.intro.get("phases", [])
        cards = "".join(pb.partcard(p.get("id", ""), p.get("title", ""), p.get("body", "")) for p in phases)
        phases_note = self.intro.get("phasesNote", "")
        note_html = self._phases_note_html(phases_note)
        inner = (
            pb.kicker("WHAT YOU'LL LEARN") + pb.title("這門課在學什麼：三部曲", big=True)
            + f'<div class="subtitle" style="color:var(--on-dark-dim)">{note_html}</div>'
            + f'<div class="grid grid-3" style="margin-top:34px;margin-bottom:0">{cards}</div>'
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
            '<img class="concept-hero" src="../assets/workflow-hero-ai.png" alt="">'
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
        row1 = "".join(pb.weekcell(w.get("w", ""), w.get("label", ""), "ms" if w.get("milestone") else "")
                        for w in row1_weeks)
        row2 = "".join(pb.weekcell(w.get("w", ""), w.get("label", ""), "ms" if w.get("milestone") else "")
                        for w in row2_weeks)

        # 三段色帶：依 weeklyPlan 的 part 欄位算 row1/row2 內 Part1/2/3 各佔幾格（flex 比例），
        # 沿用 v1 版式常數（band1=Part1(3):Part2(4)、band2=P2續(1):Part3(5)）——
        # v1 這兩行 flex 數字是「排版微調」而非課程內容，故仍留常數；若未來週數改變，
        # 這裡改用「依 part 實際格數算 flex」而非沿用 v1 寫死比例，兩者在 17 週不變時等價。
        band1 = self._week_band(row1_weeks, phase_titles, phase_weeks, variant="row1")
        band2 = self._week_band(row2_weeks, phase_titles, phase_weeks, variant="row2")

        inner = (
            pb.kicker("17-WEEK ROADMAP") + pb.title("17 週課程地圖")
            + '<div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:44px">'
            + '<div><div style="position:relative"><div class="tlbar" style="top:7px;left:0;right:0"></div>'
            + f'<div class="timeline" style="margin-top:0">{row1}</div></div>{band1}</div>'
            + '<div><div style="position:relative"><div class="tlbar" style="top:7px;left:0;right:0"></div>'
            + f'<div class="timeline" style="margin-top:0">{row2}</div></div>{band2}</div>'
            + '</div>'
            + '<div class="muted">●＝每週主題　<span style="color:var(--gold)">●</span>＝期中／期末里程碑　·　色帶＝三部曲分段</div>'
        )
        self.write(9, inner)

    @staticmethod
    def _week_band(weeks, phase_titles, phase_weeks, variant):
        """依實際 part 分布算色帶格數與文案；17 週、三部曲切法不變時，
        算出的 flex 比例與 v1 硬編值一致（row1: p1=3,p2=4；row2: p2=1,p3=5）。
        色帶名稱與週距一律取自 intro.phases[]（title／weeks）——SKILL.md 內容對照表
        「三段色帶」本就標 JSON 算出，不得硬編單一課程的部名文案。"""
        # 統計本列每個 part 出現幾筆（週數項目，不是實際週數）
        from collections import OrderedDict
        counts = OrderedDict()
        for w in weeks:
            p = w.get("part")
            counts[p] = counts.get(p, 0) + 1

        cls_map = {1: "p1", 2: "p2", 3: "p3"}
        parts_ids = list(counts.keys())

        def label_for(part_id, is_continuation):
            if is_continuation:
                return f"P{part_id} 續"
            name = phase_titles.get(part_id, "")
            w_range = phase_weeks.get(part_id, "")
            return f"PART {part_id} · {name}（{w_range}）" if w_range else f"PART {part_id} · {name}"

        segs = []
        for idx, p in enumerate(parts_ids):
            is_first_seg_of_row = (idx == 0)
            is_continuation = (variant == "row2" and is_first_seg_of_row and len(parts_ids) > 1)
            cls = cls_map.get(p, "p2")
            segs.append(f'<div class="{cls}" style="flex:{counts[p]}">{esc(label_for(p, is_continuation))}</div>')
        return f'<div class="pband">{"".join(segs)}</div>'

    def page10_grading(self):
        grading = self.intro.get("grading", [])
        colors = [
            ("var(--teal)", "var(--teal-700)"),
            ("var(--teal)", "var(--gold)"),
            ("var(--gold)", "var(--gold)"),
            ("var(--gold)", "#E05236"),
        ]
        cells = ""
        for i, g in enumerate(grading):
            c1, c2 = colors[i] if i < len(colors) else ("var(--teal)", "var(--gold)")
            cells += pb.statblock(g.get("pct", 0), g.get("label", ""), g.get("sub") or "", c1, c2)
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
            + pb.linecard("msg", "Microsoft Teams", "直接發訊息給我")
            + pb.linecard("mail", "Email", f'<span style="font-family:var(--lat);font-size:20px">{esc(instr.get("email", ""))}</span>')
            + '</div>'
            + '<div class="muted" style="margin-top:28px">上 Slido，問問題不用舉手。</div>'
        )
        self.write(11, inner)

    def page12_teams(self):
        # 純模板固定文案（Office 365／桌面版建議／團隊代碼待補）——course.json 目前
        # 未收錄這段（見 SKILL.md「模板固定」欄），故整頁沿用 v1 固定清單。
        inner = (
            pb.kicker("JOIN ON TEAMS") + pb.title("加入 Teams 課程")
            + '<div class="vcenter"><ul class="list list--lg" style="margin-top:0">'
            '<li><span class="b"></span><div>用學校 Office 365 帳號（先啟用國立東華大學 Office 365）</div></li>'
            '<li><span class="b"></span><div>建議安裝 Teams 桌面版</div></li>'
            '<li><span class="b"></span><div>團隊代碼：' + pb.pending("【開學前待補】") + '</div></li>'
            '</ul></div>'
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
        group_icon = {"理解 AI": "bot", "查資料": "search", "做內容": "slides", "任務型與自動化": "term"}
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
        self.write(14, inner)

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
        note_html = (
            '<div class="muted" style="margin-top:24px">第一週先挑<b style="color:var(--ink)">一個順手的</b>'
            '就好，不用全裝；之後再慢慢擴充。</div>'
        ) if daily else ''
        # 卡片＋推薦語一起包 .vcenter（2026-07-05 設計升級，同第 13 頁理由）
        inner = (
            pb.kicker("FOR DAILY USE") + pb.title("日常 AI 工具推薦")
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
        inner = (
            pb.kicker("HOW WE USE AI") + pb.title("這門課的 AI 使用守則", big=True)
            + '<div class="subtitle" style="color:var(--on-dark-dim)">可以用 AI 學習與創作，但你要——</div>'
            + f'<div style="margin-top:14px;max-width:880px">{items}</div>'
        )
        self.write(17, inner, dark=True)

    def page18_slido2(self):
        inner = (
            '<div class="big-center" style="height:100%;display:flex;flex-direction:column;justify-content:center;max-width:760px">'
            '<div class="kicker">BACK TO SLIDO</div>'
            '<div class="big-title" style="margin-top:14px">最後，<br>聊聊你的期待</div>'
            f'<div class="big-sub">再掃一次　slido.com　·　#{self._slido_event_code()}</div>'
            '<div class="muted" style="color:var(--on-dark-dim);margin-top:22px;font-size:16px">'
            '修課動機、<b style="color:var(--gold)">你最想用 AI 幫你完成什麼事</b>、一個詞形容你的期待</div>'
            '</div>'
            '<div class="qr-phone"><div class="qr-screen"><div class="qr-placeholder">'
            + pb.icon("qr", "var(--gold)", 48)
            + '<div style="margin-top:10px;font-size:12px;color:var(--on-dark-dim)">QR 待補</div>'
            + '</div></div></div>'
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
        self.page10_grading()
        self.page11_help()
        self.page12_teams()
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

    # ---- 19 頁（1:1 對齊 v1 generate_aa_en.py 版式）----

    def page01_cover(self):
        bb = self.bb
        c = self.en["cover"]
        name_en = self.en.get("nameEn", "")
        name_zh = self.course.get("name", "")
        chips_html = "".join(f"<span>{bb.esc(x)}</span>" for x in c.get("chips", []))
        inner = (
            '<img class="hero hero-intro" src="../assets/intro-hero-ai.png" alt="">'
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
            '<img src="../assets/seal-white.png" alt="NDHU" '
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
            + '<div class="grid grid-3" style="margin-top:24px">'
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
        inner = (
            bb.kicker(loc["kicker"]) + bb.bititle(loc["titleEn"], loc["titleZh"])
            + '<div class="card-blueprint" style="margin-top:22px;">'
            + '<div style="text-align:center;color:var(--on-dark);z-index:2">'
            + bb.icon("pin", "var(--gold)", 40)
            + f'<div style="font-size:21px;font-weight:700;margin-top:12px;font-family:var(--lat)">{s["roomBlueprintEn"]}</div>'
            + f'<div style="font-size:17px;color:var(--on-dark-dim);margin-top:4px">{bb.esc(s["roomBlueprintZh"])}</div>'
            + f'<div class="muted" style="margin-top:8px;color:var(--on-dark-dim)">{bb.esc(s["roomBlueprintNote"])}</div></div></div>'
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
        inner = (
            bb.kicker(o["kicker"]) + bb.bititle(o["titleEn"], o["titleZh"])
            + '<div class="card-blueprint" style="margin-top:22px;">'
            + '<div style="text-align:center;color:var(--on-dark);z-index:2">'
            + bb.icon("pin", "var(--gold)", 40)
            + f'<div style="font-size:21px;font-weight:700;margin-top:12px;font-family:var(--lat)">{o["blueprintEn"]}</div>'
            + f'<div style="font-size:17px;color:var(--on-dark-dim);margin-top:4px">{bb.esc(o["blueprintZh"])}</div>'
            + f'<div class="muted" style="margin-top:8px;color:var(--on-dark-dim)">{bb.esc(o["blueprintNote"])}</div></div></div>'
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
            f'<div class="big-sub">{bb.esc(s["subEn"])}{bb.pending(s["subPendingEn"])}</div>'
            '<div class="muted" style="color:var(--on-dark-dim);margin-top:22px;font-size:16px">'
            # noteEn raw：v1 這句「…you've tried.」直接寫進 f-string 未過 esc，' 保裸字元
            f'{s["noteEn"]}'
            f'<br><span style="font-size:14px">{bb.esc(s["noteZh"])}</span></div>'
            '</div>'
            '<div class="qr-phone"><div class="qr-screen"><div class="qr-placeholder">'
            + bb.icon("qr", "var(--gold)", 48)
            + f'<div style="margin-top:10px;font-size:12px;color:var(--on-dark-dim)">{bb.esc(s["qrPendingEn"])}</div>'
            + '</div></div></div>'
        )
        self.write(6, inner, dark=True)

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
            + f'<div class="grid grid-3" style="margin-top:28px;margin-bottom:0">{cards}</div>'
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
            '<img class="concept-hero" src="../assets/workflow-hero-ai.png" alt="">'
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
        cells = []
        for i, wk in enumerate(weekly):
            kind = "ms" if wk.get("milestone") else ""
            cells.append(bb.weekcell(wk.get("w", ""), labels_en[i], wk.get("label", ""), kind))
        half = 7
        row1 = "".join(cells[:half])
        row2 = "".join(cells[half:])

        def band(segs):
            # band text 在 v1 是行內字面 HTML（「TASK AI & AGENTS」的 & 是裸 & 不轉義），
            # 故此處 raw 輸出、不 bb.esc()，以逐位元組對齊 v1。overlay 的 band text 純由本
            # skill 維護（非使用者輸入、無 XSS 面），raw 安全。
            return '<div class="pband">' + "".join(
                f'<div class="{cls}" style="flex:{seg["flex"]}">{seg["text"]}</div>'
                for cls, seg in segs) + '</div>'

        band1 = band([("p1", w["band1En"][0]), ("p2", w["band1En"][1])])
        band2 = band([("p2", w["band2En"][0]), ("p3", w["band2En"][1])])
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

    def page12_teams(self):
        bb = self.bb
        t = self.en["teams"]
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
            + f'<div style="margin-top:12px;max-width:900px">{items}</div>'
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
            f'<div class="big-sub">{bb.esc(s["subEn"])}{bb.pending(s["subPendingEn"])}</div>'
            '<div class="muted" style="color:var(--on-dark-dim);margin-top:22px;font-size:16px">'
            f'{s["noteEnHtml"]}'
            f'<br><span style="font-size:14px">{bb.esc(s["noteZh"])}</span></div>'
            '</div>'
            '<div class="qr-phone"><div class="qr-screen"><div class="qr-placeholder">'
            + bb.icon("qr", "var(--gold)", 48)
            + f'<div style="margin-top:10px;font-size:12px;color:var(--on-dark-dim)">{bb.esc(s["qrPendingEn"])}</div>'
            + '</div></div></div>'
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
        self.page12_teams()
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
        deck = Deck(course, section, args.out, overlay=overlay)
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
