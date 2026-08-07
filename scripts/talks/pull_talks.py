#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scripts/talks/pull_talks.py
從演講課管理台正式 Sheet 的 Talks 分頁，一鍵更新 course hub 的
content/courses/11501-ai-future/talks.json。

用法：
    離線／測試（不連網、吃本機 CSV）：
        python scripts/talks/pull_talks.py --csv <talks_raw.csv> [--out <輸出路徑>]

    線上（預設，會呼叫 gws）：
        python scripts/talks/pull_talks.py [--out <輸出路徑>]

隱私鐵律（2026-07-25 Ted 拍板）：
    只有 Sheet 狀態欄為「已確認」「已完成」的場次會公開講者與講題等資訊；
    其他任何狀態（含「邀約中」）一律輸出全空白占位（tba），即使 Sheet 上
    那一列其實已經填了講者姓名等欄位——因為講者還沒答應，公開頁不能先曝光。
    spreadsheetId 屬個資，本腳本絕不印到 stdout、絕不寫進任何檔案。

本腳本只負責「產生新的 talks.json 內容並寫檔＋印 diff」，絕不呼叫
git、絕不自動 commit——請人工核對 diff 後自行 commit。

詳細規則見同目錄 README.md。
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import subprocess
import sys
from pathlib import Path

# ── 常數（2026-07-25 由管理台 Sheet 的 Settings 分頁快照拍板，Sheet 本身不管這兩欄）──
COURSE_DIR = "11501-ai-future"
HUB_TIME = "09:30"
HUB_VENUE = "理工二館 ZT講堂 C101"
# moeIndicators＝Hub 全站的六面向指標清單（Sheet 不管這個總表，只管每場的 moe 子集）
MOE_INDICATORS = ["b1_ethics", "b1_rights", "b2_risk", "b2_verify", "b3_impact", "b3_account"]

# 正式 Sheet 名稱（ID 屬個資、不寫死，現查）＋讀取範圍
SHEET_NAME = "115-1 AI法律通識教育演講課管理台（正式）"
TALKS_RANGE = "Talks!A1:Z300"  # 給足上限，別用剛好夠的數字（見 talkmgr_sheet_ops.md 的截斷雷）

# 狀態白名單：只有這兩種會公開；其他任何字串（含「邀約中」）都視為未公開
STATUS_MAP = {"已確認": "confirmed", "已完成": "done"}

REQUIRED_NO_SET = list(range(1, 13))


class PullTalksError(SystemExit):
    """一律用 SystemExit 讓人看得到訊息、非 0 結束，不留半成品檔案。"""


# ── Sheet 名稱 → spreadsheetId（個資：只在函式內部流轉、絕不印出／寫檔）───────

def _resolve_spreadsheet_id(sheet_name: str) -> str:
    query = f'name = "{sheet_name}" and mimeType = "application/vnd.google-apps.spreadsheet" and trashed = false'
    params = json.dumps({"q": query, "fields": "files(id,name)"}, ensure_ascii=False)
    proc = subprocess.run(
        ["gws", "drive", "files", "list", "--params", params, "--format", "json"],
        capture_output=True, text=True, encoding="utf-8", errors="replace",
    )
    if proc.returncode != 0:
        raise PullTalksError(
            f"gws drive files list 失敗（exit {proc.returncode}）：{proc.stderr.strip()[:300]}"
        )
    try:
        data = json.loads(proc.stdout)
    except json.JSONDecodeError as e:
        raise PullTalksError(f"gws drive files list 回應不是合法 JSON：{e}") from e
    files = data.get("files", [])
    if not files:
        raise PullTalksError(f"找不到試算表「{sheet_name}」——請確認名稱與存取權限")
    if len(files) > 1:
        raise PullTalksError(
            f"名稱「{sheet_name}」比對到 {len(files)} 個檔案，無法判斷唯一 spreadsheetId"
            "——請人工確認是不是撞到 demo／dev／backup 同名副本"
        )
    spreadsheet_id = files[0].get("id")
    if not spreadsheet_id:
        raise PullTalksError("gws drive files list 回應缺 id 欄位")
    return spreadsheet_id


def fetch_rows_from_gws() -> list[dict]:
    """線上模式：先查 spreadsheetId，再讀 Talks 分頁，回傳一列一個 dict。"""
    spreadsheet_id = _resolve_spreadsheet_id(SHEET_NAME)
    params = json.dumps({"spreadsheetId": spreadsheet_id, "range": TALKS_RANGE}, ensure_ascii=False)
    proc = subprocess.run(
        ["gws", "sheets", "spreadsheets", "values", "get", "--params", params, "--format", "csv"],
        capture_output=True, text=True, encoding="utf-8", errors="replace",
    )
    del spreadsheet_id  # 個資：讀完即釋出，後續不再需要、也不往下傳
    if proc.returncode != 0:
        raise PullTalksError(
            f"gws sheets spreadsheets values get 失敗（exit {proc.returncode}）：{proc.stderr.strip()[:300]}"
        )
    reader = csv.DictReader(io.StringIO(proc.stdout))
    return list(reader)


def read_rows_from_csv(path: Path) -> list[dict]:
    """離線／測試模式：直接讀本機 CSV（欄位含半形逗號要用 csv 模組解析，不能用 split(",")）。"""
    with open(path, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        return list(reader)


# ── 欄位轉換 ─────────────────────────────────────────────────────────────

def cell(row: dict, name: str) -> str:
    """欄名對位（不可用欄序）：用欄位名稱找值，缺欄當空字串。"""
    v = row.get(name)
    return v.strip() if isinstance(v, str) else ""


def blank_to_none(v: str):
    """Sheet 用「無」表示「沒有」；照字面印到公開頁會變成怪句子，統一轉 null。"""
    return None if v in ("", "無") else v


def build_talks(rows: list[dict]) -> tuple[list[dict], dict[str, str]]:
    """
    把 Sheet 列轉成 talks 陣列。
    回傳 (talks, raw_status_by_id)——raw_status_by_id 只給 diff 摘要印「狀態原文」用，
    絕不包含任何講者／講題等隱私欄位。
    """
    talks: list[dict] = []
    raw_status_by_id: dict[str, str] = {}

    for row in rows:
        tid = cell(row, "id")
        if not tid:
            continue  # A1:Z300 讀超過實際列數的空白列
        if cell(row, "isDeleted").strip().upper() == "TRUE":
            continue  # 軟刪除列（含重複／作廢草稿）整列跳過

        no_str = cell(row, "no")
        if not no_str:
            raise PullTalksError(f"id「{tid}」缺 no 欄位，無法排序／對位")
        try:
            no = int(no_str)
        except ValueError as e:
            raise PullTalksError(f"id「{tid}」的 no「{no_str}」不是整數") from e

        raw_status = cell(row, "status")
        raw_status_by_id[tid] = raw_status
        mapped_status = STATUS_MAP.get(raw_status)

        if mapped_status is not None:
            moe_raw = cell(row, "moeJson")
            try:
                moe = json.loads(moe_raw) if moe_raw else []
            except json.JSONDecodeError as e:
                raise PullTalksError(f"id「{tid}」的 moeJson 不是合法 JSON：{moe_raw!r}（{e}）") from e
            talk = {
                "id": tid,
                "no": no,
                "status": mapped_status,
                "date": blank_to_none(cell(row, "date")),
                "time": HUB_TIME,
                "venue": HUB_VENUE,
                "title": blank_to_none(cell(row, "title")),
                "speaker": {
                    "name": blank_to_none(cell(row, "speakerName")),
                    "title": blank_to_none(cell(row, "speakerTitle")),
                    "org": blank_to_none(cell(row, "speakerOrg")),
                    "photo": None,  # 資產欄，稍後從現行 talks.json 合併
                    "links": None,  # 資產欄（講者自己的部落格／社群），同上從現行檔合併
                },
                "abstract": blank_to_none(cell(row, "abstract")),
                "moe": moe,
                "poster": None,
                "worksheetUrl": None,
                "materials": [],
            }
        else:
            # 隱私鐵律：狀態不在白名單（含「邀約中」及任何其他字串）——
            # 不論 Sheet 上這列其他欄位是否已經填了講者姓名等資訊，全部歸零。
            talk = {
                "id": tid,
                "no": no,
                "status": "tba",
                "date": None,
                "time": None,
                "venue": None,
                "title": None,
                "speaker": {"name": None, "title": None, "org": None, "photo": None, "links": None},
                "abstract": None,
                "moe": [],
                "poster": None,
                "worksheetUrl": None,
                "materials": [],
            }
        talks.append(talk)

    nos = sorted(t["no"] for t in talks)
    if nos != REQUIRED_NO_SET:
        raise PullTalksError(
            f"no 欄位不是完整的 1–12（實得：{nos}）——檢查 Sheet 是否有遺漏、重複，"
            "或該刪的列忘了勾 isDeleted"
        )
    talks.sort(key=lambda t: t["no"])
    return talks, raw_status_by_id


# ── 合併 repo 既有資產欄（Sheet 不管這些欄，一律保留現行 talks.json 的值）────

def merge_assets(new_talks: list[dict], old_by_id: dict[str, dict]) -> None:
    for talk in new_talks:
        old = old_by_id.get(talk["id"])
        if not old:
            continue
        talk["poster"] = old.get("poster")
        talk["worksheetUrl"] = old.get("worksheetUrl")
        talk["materials"] = old.get("materials", [])
        old_speaker = old.get("speaker") or {}
        talk["speaker"]["photo"] = old_speaker.get("photo")
        # ⚠️ links 是講者主動要求放的連結，Sheet 沒有這一欄——一定要從現行 talks.json
        #    帶回來，否則每次重生都會把它洗掉（2026-08-07 加，t09 陳柏威的部落格/FB）。
        talk["speaker"]["links"] = old_speaker.get("links")


# ── 輸出排版（手寫縮排以吻合現行 talks.json——逐位元組相容） ─────────────────

def _j(v) -> str:
    return json.dumps(v, ensure_ascii=False)


def serialize_talks_json(talks: list[dict]) -> str:
    out = ["{", f'  "courseDir": {_j(COURSE_DIR)},']
    out.append(f'  "moeIndicators": {_j(MOE_INDICATORS)},')
    out.append('  "talks": [')
    for n, t in enumerate(talks):
        out.append("    {")
        body = []
        for k in ("id", "no", "status", "date", "time", "venue", "title"):
            body.append(f"      {_j(k)}: {_j(t[k])}")
        sp = t["speaker"]
        body.append(
            '      "speaker": { "name": %s, "title": %s, "org": %s, "photo": %s, "links": %s }'
            % (_j(sp["name"]), _j(sp["title"]), _j(sp["org"]), _j(sp["photo"]), _j(sp.get("links")))
        )
        for k in ("abstract", "moe", "poster", "worksheetUrl", "materials"):
            body.append(f"      {_j(k)}: {_j(t[k])}")
        out.append(",\n".join(body))
        out.append("    }" + ("," if n < len(talks) - 1 else ""))
    out.append("  ]")
    out.append("}")
    return "\n".join(out) + "\n"


# ── diff 摘要（tba 場次只印「狀態原文」，絕不印任何隱私欄位內容） ────────────

_DIFF_FIELDS = [
    ("status", lambda t: t["status"]),
    ("date", lambda t: t["date"]),
    ("title", lambda t: t["title"]),
    ("abstract", lambda t: t["abstract"]),
    ("moe", lambda t: t["moe"]),
    ("speaker.name", lambda t: t["speaker"]["name"]),
    ("speaker.title", lambda t: t["speaker"]["title"]),
    ("speaker.org", lambda t: t["speaker"]["org"]),
]


def build_diff_lines(
    old_by_id: dict[str, dict], new_talks: list[dict], raw_status_by_id: dict[str, str]
) -> tuple[list[str], list[str]]:
    lines: list[str] = []
    placeholder_lines: list[str] = []

    for t in new_talks:
        tid = t["id"]
        no = t["no"]
        if t["status"] == "tba":
            raw = raw_status_by_id.get(tid, "")
            placeholder_lines.append(
                f"  第 {no} 場（{tid}）：Sheet 狀態原文＝「{raw}」→ 占位（不公開），全欄輸出 null"
            )
            continue

        old = old_by_id.get(tid)
        if old is None:
            lines.append(f"第 {no} 場（{tid}）：新場次（先前 talks.json 沒有這筆）")
            continue

        changes = []
        for label, getter in _DIFF_FIELDS:
            try:
                old_v = getter(old)
            except (KeyError, TypeError):
                old_v = None
            new_v = getter(t)
            if old_v != new_v:
                changes.append(f"{label}：{old_v!r} → {new_v!r}")
        if changes:
            lines.append(f"第 {no} 場（{tid}）：" + "；".join(changes))
        else:
            lines.append(f"第 {no} 場（{tid}）：無變動")

    return lines, placeholder_lines


# ── main ─────────────────────────────────────────────────────────────────

def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="拉演講課管理台 Sheet 的 Talks 分頁 → talks.json（絕不自動 commit）"
    )
    parser.add_argument("--csv", help="離線／測試模式：本機 CSV 路徑（不呼叫 gws）")
    parser.add_argument(
        "--out", help="輸出 talks.json 路徑（預設 content/courses/11501-ai-future/talks.json）"
    )
    args = parser.parse_args(argv)

    repo_root = Path(__file__).resolve().parents[2]
    out_path = Path(args.out) if args.out else repo_root / "content" / "courses" / COURSE_DIR / "talks.json"

    if args.csv:
        rows = read_rows_from_csv(Path(args.csv))
    else:
        rows = fetch_rows_from_gws()

    new_talks, raw_status_by_id = build_talks(rows)

    old_data = None
    if out_path.exists():
        old_data = json.loads(out_path.read_text(encoding="utf-8"))
    old_by_id = {t["id"]: t for t in (old_data.get("talks", []) if old_data else [])}

    merge_assets(new_talks, old_by_id)

    text = serialize_talks_json(new_talks)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)

    lines, placeholder_lines = build_diff_lines(old_by_id, new_talks, raw_status_by_id)

    print(f"=== talks.json 更新 diff 摘要（輸出：{out_path}） ===")
    for line in lines:
        print(line)
    if placeholder_lines:
        print("\n以下場次未達公開門檻，已歸為占位（不公開）：")
        for line in placeholder_lines:
            print(line)
    print("\n請人工檢查 diff 後自行 commit——本腳本絕不自動 commit。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
