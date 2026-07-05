# scripts/deck/ — 課程介紹簡報產線（部署鏡像）

> **開發正本＝wailan repo `skills/course-intro/`**（含 SKILL.md 全說明與 PARITY.md 驗證史）。
> 這裡是給 CI「發布前才產 deck」用的鏡像（2026-07-05 Ted 拍板：packed 10MB 檔不進版控，
> 建置時現產進 `public/decks/`）。

## 誰在什麼時候跑

`npm run build` = validate → **decks（本腳本）** → next build → scan。
CI（`.github/workflows/deploy.yml`）與本機 build 都會走到；需要 Python 3 與
`qrcode` 套件（CI 已配；本機沒裝 qrcode 只是少掃碼卡、不會失敗）。

## 資料驅動

`content/courses/*/course.json` 的 `sections[].deckUrl`（中文）／`deckUrlEn`（雙語）
＝開關兼檔名：值如 `/decks/11501-ai-intro-aa.html`，檔名取最後一段。
雙語版 overlay 慣例路徑：`overlays/<courseDir>-bilingual.json`（缺檔建置直接失敗）。
課程頁 hero 讀同一欄位長出「課程介紹簡報 ↗」連結——一個欄位、兩件事一次對齊。

## 改產線怎麼同步

產線行為要改（版式、QR、頁型）→ **先改 wailan repo `skills/course-intro/`**（那邊有
parity 驗證流程），再把下列檔案原樣覆蓋過來：

```
generate_deck.py  pack_deck.py  deck.css  templates/  assets/  overlays/
```

別直接改這份鏡像——兩邊漂移的話，以 wailan repo 為準。
