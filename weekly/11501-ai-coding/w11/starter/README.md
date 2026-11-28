# 我的學習紀錄（W11 起步檔）

登入之後記下「今天學了什麼」的小網站。每個人只看得到自己的紀錄。
純 HTML＋JavaScript，不用安裝、不用建置。

| 檔案 | 做什麼 |
|---|---|
| `index.html` | 畫面：登入表單、新增一筆、我的紀錄 |
| `style.css` | 外觀 |
| `app.js` | 登入、註冊、登出；存、讀、刪紀錄；把錯誤訊息翻成白話 |
| `config.js` | 連到你的 Supabase：Project URL＋publishable key（兩個都可以公開） |
| `schema.sql` | 在 Supabase 建資料表＋門禁（RLS），SQL Editor 跑一次就好 |

## 上線三步

1. **Supabase**：建專案 → SQL Editor 貼上 `schema.sql` 按 Run → 把 Project URL 與 publishable key 貼進 `config.js`。
2. **GitHub**：把這幾個檔放進一個 repo（檔案放在最外層，不要再包一層資料夾）。
3. **Cloudflare**：連上這個 repo，拿到網址；之後每次推上 GitHub，網站自動更新。

**驗收**：用兩個不同的 Email 各註冊、各寫一筆，**彼此都看不到對方的紀錄**才算過。

## 兩把鑰匙

- ✅ **publishable key**（`sb_publishable_` 開頭）：放 `config.js`，本來就會被看到。
- 🚨 **secret key**（`sb_secret_` 開頭）或舊式的 `service_role` key：**永遠不進這個資料夾、不進 GitHub**。
  貼錯了網頁會停止連線並提醒你；已經推上去的話，到 Supabase 把那把作廢。
