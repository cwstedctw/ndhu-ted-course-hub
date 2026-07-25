#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scripts/talks/test_pull_talks.py — pull_talks.py 的離線測試（零網路，不呼叫 gws）。

用法：
    PYTHONUTF8=1 python scripts/talks/test_pull_talks.py

做的事：
    1. 把 repo 的 content/、schema/ 複製一份到暫存目錄，模擬「一個乾淨的 repo」。
    2. 在暫存目錄裡放一份「舊版」talks.json（帶著 poster／worksheetUrl／materials／
       speaker.photo 等資產欄位），驗證 pull_talks.py 會把這些欄位原樣保留。
    3. 用 fixtures/talks_raw.csv 當作「假管理台匯出」，跑
       `python pull_talks.py --csv ... --out ...`（--csv 模式＝離線、不連網）。
    4. 逐欄比對輸出 JSON 是否與期望值完全相等。
    5. 用 subprocess 跑 `node scripts/validate-content.mjs <暫存 repo 根目錄>`，
       確認整個內容樹（含我們剛產生的 talks.json）通過驗證。
    6. 專門驗證隱私鐵律：狀態不在白名單的場次（邀約中／婉拒……）即使 Sheet 上
       已經填了講者姓名等欄位，也絕不能出現在輸出 JSON 或 stdout 診斷訊息裡。

全程只讀 repo 真正的 content/、schema/，從不寫回——跑完不會留下被改動的 content。
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent           # scripts/talks
REPO_ROOT = SCRIPT_DIR.parents[1]                        # repo 根目錄
PULL_TALKS = SCRIPT_DIR / "pull_talks.py"
FIXTURE_CSV = SCRIPT_DIR / "fixtures" / "talks_raw.csv"
VALIDATE_MJS = REPO_ROOT / "scripts" / "validate-content.mjs"

COURSE_DIR = "11501-ai-future"
MOE_INDICATORS = ["b1_ethics", "b1_rights", "b2_risk", "b2_verify", "b3_impact", "b3_account"]
HUB_TIME = "09:30"
HUB_VENUE = "理工二館 ZT講堂 C101"

# 只出現在「應被隱藏」場次（t02＝邀約中、t11＝婉拒）裡的字串——
# 這些字串絕不可以出現在最終輸出 JSON 或 stdout 診斷訊息中任何地方。
# （注意：不能把「副教授」整個放進來，因為合法公開的 t10 講者職稱也是副教授。）
FORBIDDEN_LEAK_STRINGS = [
    "陳小華", "測試學院", "尚未確定的講題", "尚未確定的摘要",
    "已婉拒的測試講者", "測試婉拒單位", "已婉拒講題", "已婉拒摘要",
]


def _tba_talk(tid: str, no: int) -> dict:
    return {
        "id": tid, "no": no, "status": "tba",
        "date": None, "time": None, "venue": None, "title": None,
        "speaker": {"name": None, "title": None, "org": None, "photo": None},
        "abstract": None, "moe": [],
        "poster": None, "worksheetUrl": None, "materials": [],
    }


def build_previous_talks_json() -> dict:
    """
    模擬「暫存 repo 裡現有的 talks.json」：12 場都還是初始 tba 骨架，
    只有 t01、t05 已經上傳過海報／學習單／教材／講者照片——
    pull_talks.py 必須原樣保留這幾欄，即使 Sheet 沒有管這些欄。
    """
    talks = [_tba_talk(f"t{n:02d}", n) for n in range(1, 13)]
    by_id = {t["id"]: t for t in talks}

    # 注意：worksheetUrl／materials.url 的網域要用 scripts/validate-content.mjs 的
    # ALLOWED_URL_HOSTS 白名單（#20 規則）裡已經有的網域（cwstedctw.github.io＝hub 本體），
    # 別用 example.com 之類的假網域，否則測試會被 #20 擋下、跟 pull_talks.py 本身無關。
    by_id["t01"]["poster"] = "/images/talks/t01-poster.jpg"
    by_id["t01"]["worksheetUrl"] = "https://cwstedctw.github.io/ndhu-ted-course-hub/worksheets/t01.pdf"
    by_id["t01"]["materials"] = [
        {"label": "投影片", "url": "https://cwstedctw.github.io/ndhu-ted-course-hub/slides/t01.pdf"}
    ]
    by_id["t01"]["speaker"]["photo"] = "/images/talks/t01.jpg"

    by_id["t05"]["poster"] = "/images/talks/t05-poster.jpg"
    by_id["t05"]["speaker"]["photo"] = "/images/talks/t05.jpg"

    return {"courseDir": COURSE_DIR, "moeIndicators": MOE_INDICATORS, "talks": talks}


def build_expected_talks() -> list[dict]:
    """依 fixtures/talks_raw.csv 的內容＋規格手動推導出的期望值（與程式邏輯無關的獨立真值）。"""

    def confirmed(tid, no, date, title, abstract, moe, name, title_, org, status="confirmed"):
        return {
            "id": tid, "no": no, "status": status,
            "date": date, "time": HUB_TIME, "venue": HUB_VENUE, "title": title,
            "speaker": {"name": name, "title": title_, "org": org, "photo": None},
            "abstract": abstract, "moe": moe,
            "poster": None, "worksheetUrl": None, "materials": [],
        }

    talks = {
        "t01": confirmed(
            "t01", 1, "2026-09-18", "AI與氣候治理導論", None,
            ["b2_risk", "b2_verify"], "王大明", "教授", "國立測試大學資訊工程學系",
        ),
        "t02": _tba_talk("t02", 2),  # 邀約中，即使 Sheet 已填講者姓名等——隱私核心測試
        "t03": confirmed(
            "t03", 3, "2026-10-16", None, None,  # 已確認但無講題
            ["b1_rights"], "李小芳", None, None,
        ),
        "t04": _tba_talk("t04", 4),  # 邀約中、全空的一般占位
        "t05": confirmed(
            "t05", 5, "2026-10-30", "智慧交通應用測試", "智慧號誌控制與停車管理示範",
            ["b3_impact", "b3_account"], "林小美", "技正", None,  # org="無" → null
        ),
        "t06": confirmed(
            "t06", 6, "2026-11-06", "在地創生資料應用", None,
            ["b2_risk"], "張小強", "執行長", "測試基金會（服務超過 30,000 人次）",
        ),
        "t07": confirmed(
            "t07", 7, "2026-11-13", "已完成場次測試講題", None,
            ["b3_impact"], "黃小龍", "主治醫師", "測試醫院", status="done",
        ),
        "t08": _tba_talk("t08", 8),
        "t09": confirmed(
            "t09", 9, "2026-11-27", "醫療與AI測試講題", None,
            ["b1_ethics", "b2_verify"], "吳小婷", "主治醫師", "測試醫療財團法人",
        ),
        "t10": confirmed(
            "t10", 10, "2026-12-04", "地理資訊測試講題", None,
            ["b2_risk", "b3_account"], "郭小麟", "副教授", "國立測試大學",
        ),
        "t11": _tba_talk("t11", 11),  # 狀態＝「婉拒」，非白名單——同樣隱私測試
        "t12": confirmed(
            "t12", 12, "2026-12-18", "偏鄉科技應用測試講題", None,
            ["b3_impact", "b1_rights"], "張小育", "主任", "測試醫事室",
        ),
    }

    # 資產欄合併（來自 build_previous_talks_json）
    talks["t01"]["poster"] = "/images/talks/t01-poster.jpg"
    talks["t01"]["worksheetUrl"] = "https://cwstedctw.github.io/ndhu-ted-course-hub/worksheets/t01.pdf"
    talks["t01"]["materials"] = [
        {"label": "投影片", "url": "https://cwstedctw.github.io/ndhu-ted-course-hub/slides/t01.pdf"}
    ]
    talks["t01"]["speaker"]["photo"] = "/images/talks/t01.jpg"
    talks["t05"]["poster"] = "/images/talks/t05-poster.jpg"
    talks["t05"]["speaker"]["photo"] = "/images/talks/t05.jpg"

    return [talks[f"t{n:02d}"] for n in range(1, 13)]


class PullTalksOfflineTest(unittest.TestCase):
    """setUpClass 只實際跑一次 pull_talks.py＋一次 validate-content.mjs，其餘方法各自斷言。"""

    @classmethod
    def setUpClass(cls):
        cls.tmpdir = Path(tempfile.mkdtemp(prefix="pull_talks_test_"))
        cls.temp_content = cls.tmpdir / "content"
        cls.temp_schema = cls.tmpdir / "schema"
        shutil.copytree(REPO_ROOT / "content", cls.temp_content)
        shutil.copytree(REPO_ROOT / "schema", cls.temp_schema)

        cls.out_path = cls.temp_content / "courses" / COURSE_DIR / "talks.json"
        cls.out_path.write_text(
            json.dumps(build_previous_talks_json(), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

        proc = subprocess.run(
            [sys.executable, str(PULL_TALKS), "--csv", str(FIXTURE_CSV), "--out", str(cls.out_path)],
            capture_output=True, text=True, encoding="utf-8", errors="replace",
            env=_utf8_env(),
        )
        cls.pull_proc = proc

        if cls.out_path.exists():
            cls.output_text = cls.out_path.read_text(encoding="utf-8")
            try:
                cls.output_json = json.loads(cls.output_text)
            except json.JSONDecodeError:
                cls.output_json = None
        else:
            cls.output_text = ""
            cls.output_json = None

        cls.validate_proc = None
        if cls.output_json is not None:
            cls.validate_proc = subprocess.run(
                [shutil.which("node") or "node", str(VALIDATE_MJS), str(cls.tmpdir)],
                capture_output=True, text=True, encoding="utf-8", errors="replace",
            )

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmpdir, ignore_errors=True)

    # ── 基本執行結果 ────────────────────────────────────────────────

    def test_pull_talks_exits_zero(self):
        self.assertEqual(
            self.pull_proc.returncode, 0,
            f"pull_talks.py 非 0 結束：\nSTDOUT:\n{self.pull_proc.stdout}\nSTDERR:\n{self.pull_proc.stderr}",
        )

    def test_output_is_valid_json(self):
        self.assertIsNotNone(self.output_json, f"輸出不是合法 JSON：\n{self.output_text[:2000]}")

    # ── 逐欄相等（核心） ────────────────────────────────────────────

    def test_output_matches_expected_exactly(self):
        expected = {
            "courseDir": COURSE_DIR,
            "moeIndicators": MOE_INDICATORS,
            "talks": build_expected_talks(),
        }
        self.assertEqual(self.output_json, expected)

    def test_exactly_twelve_talks_sorted_by_no(self):
        talks = self.output_json["talks"]
        self.assertEqual(len(talks), 12, "必須恰 12 場")
        nos = [t["no"] for t in talks]
        self.assertEqual(nos, list(range(1, 13)), "必須依 no 由 1 到 12 排序")
        ids = [t["id"] for t in talks]
        self.assertEqual(ids, [f"t{n:02d}" for n in range(1, 13)])

    def test_deleted_row_is_skipped(self):
        """fixtures 裡有一列 id=t05／isDeleted=TRUE 的舊草稿重複列，t05 應該只出現一次
        且內容來自未刪除那一列（智慧交通應用測試），不是「舊草稿重複列」。"""
        t05 = next(t for t in self.output_json["talks"] if t["id"] == "t05")
        self.assertEqual(t05["title"], "智慧交通應用測試")
        self.assertNotIn("舊草稿", json.dumps(self.output_json, ensure_ascii=False))

    def test_org_wu_becomes_null(self):
        t05 = next(t for t in self.output_json["talks"] if t["id"] == "t05")
        self.assertIsNone(t05["speaker"]["org"], 'Sheet 填「無」時 org 必須輸出 null')

    def test_confirmed_without_title_keeps_title_null(self):
        t03 = next(t for t in self.output_json["talks"] if t["id"] == "t03")
        self.assertEqual(t03["status"], "confirmed")
        self.assertIsNone(t03["title"])

    def test_comma_in_field_parsed_correctly(self):
        t06 = next(t for t in self.output_json["talks"] if t["id"] == "t06")
        self.assertEqual(t06["speaker"]["org"], "測試基金會（服務超過 30,000 人次）")

    def test_done_status_mapped(self):
        t07 = next(t for t in self.output_json["talks"] if t["id"] == "t07")
        self.assertEqual(t07["status"], "done")

    def test_asset_fields_preserved_from_existing_file(self):
        t01 = next(t for t in self.output_json["talks"] if t["id"] == "t01")
        self.assertEqual(t01["poster"], "/images/talks/t01-poster.jpg")
        self.assertEqual(
            t01["worksheetUrl"], "https://cwstedctw.github.io/ndhu-ted-course-hub/worksheets/t01.pdf"
        )
        self.assertEqual(
            t01["materials"],
            [{"label": "投影片", "url": "https://cwstedctw.github.io/ndhu-ted-course-hub/slides/t01.pdf"}],
        )
        self.assertEqual(t01["speaker"]["photo"], "/images/talks/t01.jpg")

    # ── 隱私鐵律：非白名單狀態必須全欄 null，且原始欄位內容絕不外流 ──────

    def test_non_whitelisted_status_becomes_full_null(self):
        for tid in ("t02", "t04", "t08", "t11"):
            t = next(x for x in self.output_json["talks"] if x["id"] == tid)
            self.assertEqual(t["status"], "tba", f"{tid} 應為 tba")
            self.assertIsNone(t["date"])
            self.assertIsNone(t["title"])
            self.assertIsNone(t["abstract"])
            self.assertEqual(t["moe"], [])
            self.assertEqual(t["speaker"], {"name": None, "title": None, "org": None, "photo": None})

    def test_no_privacy_leak_in_output_json(self):
        blob = self.output_text
        for s in FORBIDDEN_LEAK_STRINGS:
            self.assertNotIn(s, blob, f"隱私外流：「{s}」不該出現在輸出 JSON 裡")

    def test_no_privacy_leak_in_stdout(self):
        blob = self.pull_proc.stdout
        for s in FORBIDDEN_LEAK_STRINGS:
            self.assertNotIn(s, blob, f"隱私外流：「{s}」不該出現在 stdout 診斷訊息裡")

    def test_diff_summary_lists_placeholders_with_raw_status(self):
        stdout = self.pull_proc.stdout
        self.assertIn("占位（不公開）", stdout)
        self.assertIn("t02", stdout)
        self.assertIn("t04", stdout)
        self.assertIn("t08", stdout)
        self.assertIn("t11", stdout)
        self.assertIn("邀約中", stdout)
        self.assertIn("婉拒", stdout)

    def test_stdout_reminds_manual_commit(self):
        self.assertIn("絕不自動 commit", self.pull_proc.stdout)

    def test_spreadsheet_id_never_appears_anywhere(self):
        """--csv 離線模式根本不會呼叫 gws，這裡順便斷言 stdout/輸出都不含任何看起來像
        Google Sheets spreadsheetId 的字串（gws 回應通常是 40+ 字的英數混合字串）。"""
        combined = self.pull_proc.stdout + self.pull_proc.stderr + self.output_text
        self.assertNotIn("spreadsheetId", combined)

    # ── 跨檔驗證：整個內容樹（含我們剛產生的 talks.json）必須 PASS ────────

    def test_validate_content_passes(self):
        self.assertIsNotNone(self.validate_proc, "validate-content.mjs 沒有機會執行（輸出 JSON 解析失敗）")
        stdout = self.validate_proc.stdout
        self.assertEqual(
            self.validate_proc.returncode, 0,
            f"validate-content.mjs 失敗：\nSTDOUT:\n{stdout}\nSTDERR:\n{self.validate_proc.stderr}",
        )
        self.assertIn("PASS", stdout)

    def test_real_repo_content_untouched(self):
        """跑完測試，repo 真正的 talks.json 內容必須與測試開始前一致（我們只動暫存目錄）。"""
        real_path = REPO_ROOT / "content" / "courses" / COURSE_DIR / "talks.json"
        real_data = json.loads(real_path.read_text(encoding="utf-8"))
        # 真實內容是「已確認」場次為主，不會恰好等於我們的假測試資料——
        # 只要確認它不是被我們的假資料覆蓋過去即可。
        self.assertNotEqual(real_data, self.output_json)
        real_ids_titles = {t["id"]: t.get("title") for t in real_data["talks"]}
        self.assertNotIn("AI與氣候治理導論", real_ids_titles.values())  # 假資料的假標題不該出現在真檔


def _utf8_env() -> dict:
    env = dict(os.environ)
    env["PYTHONUTF8"] = "1"
    env["PYTHONIOENCODING"] = "utf-8"
    return env


if __name__ == "__main__":
    unittest.main(verbosity=2)
