#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""發布前才產 deck（2026-07-05 Ted 拍板）——course.json 驅動、產物不進版控。

npm run build 的第二步（validate → decks → next build → scan）會呼叫本腳本：
掃 content/courses/*/course.json 的 sections[]，凡有 `deckUrl`（中文版）／
`deckUrlEn`（英文雙語版）就把 19 頁 deck 產出＋打包成自足單檔，放進
public/decks/<檔名取自 deckUrl>（.gitignore 擋住、僅存在於建置產物）。

產線＝wailan repo `skills/course-intro/` 的部署鏡像（見本夾 README.md）；
雙語版 overlay 依慣例吃 `overlays/<courseDir>-bilingual.json`，缺檔大聲失敗。
QR 掃碼卡需要 `qrcode` 套件（CI 由 deploy.yml 安裝；沒裝會退回純文字網址，
generate_deck 於 stderr 提示）。
"""
import json
import subprocess
import sys
import tempfile
from pathlib import Path

# Windows 主控台預設 cp950，中文進度訊息會變亂碼——強制 UTF-8（CI ubuntu 本就 UTF-8）
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HERE = Path(__file__).resolve().parent            # scripts/deck
ROOT = HERE.parent.parent                          # repo 根
COURSES = ROOT / "content" / "courses"
OUT = ROOT / "public" / "decks"


def run(cmd):
    r = subprocess.run([str(c) for c in cmd], cwd=str(ROOT))
    if r.returncode != 0:
        sys.exit(f"[decks] 產線失敗（exit {r.returncode}）：{' '.join(str(c) for c in cmd)}")


def main():
    jobs = []
    for cj in sorted(COURSES.glob("*/course.json")):
        data = json.loads(cj.read_text(encoding="utf-8"))
        for sec in data.get("sections") or []:
            if not isinstance(sec, dict):
                continue
            for key, lang in (("deckUrl", "zh"), ("deckUrlEn", "bilingual")):
                url = sec.get(key)
                if isinstance(url, str) and url.strip():
                    jobs.append((cj, sec.get("id"), lang, url.rsplit("/", 1)[-1]))
    if not jobs:
        print("[decks] course.json 沒有任何 deckUrl——本次建置不出簡報")
        return

    OUT.mkdir(parents=True, exist_ok=True)
    for cj, sec_id, lang, name in jobs:
        course_dir = cj.parent.name
        with tempfile.TemporaryDirectory() as td:
            slides = Path(td) / "slides"
            gen = [sys.executable, HERE / "generate_deck.py",
                   "--course-json", cj, "--section", sec_id, "--out", slides]
            pack = [sys.executable, HERE / "pack_deck.py",
                    "--slides-dir", slides, "--css", HERE / "deck.css",
                    "--assets", HERE / "assets", "--out", OUT / name,
                    "--course-json", cj, "--section", sec_id]
            if lang == "bilingual":
                overlay = HERE / "overlays" / f"{course_dir}-bilingual.json"
                if not overlay.exists():
                    sys.exit(f"[decks] {course_dir} 的 {sec_id} 班有 deckUrlEn，"
                             f"但缺雙語 overlay：{overlay}")
                gen += ["--lang", "bilingual", "--overlay", overlay]
                pack += ["--lang", "bilingual"]
            run(gen)
            run(pack)
            print(f"[decks] {name} 完成（{course_dir}／{sec_id}／{lang}）")
    print(f"[decks] 共 {len(jobs)} 份 → public/decks/")


if __name__ == "__main__":
    main()
