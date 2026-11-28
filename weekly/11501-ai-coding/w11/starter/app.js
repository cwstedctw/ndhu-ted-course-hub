// 我的學習紀錄：登入、新增、列出、刪除。
// 連線設定在 config.js；資料表與門禁規則在 schema.sql。
(function () {
  "use strict";

  var cfg = window.APP_CONFIG || {};
  var $ = function (id) { return document.getElementById(id); };
  var els = {
    configWarning: $("config-warning"),
    configMessage: $("config-message"),
    authView: $("auth-view"),
    authForm: $("auth-form"),
    email: $("email"),
    password: $("password"),
    signUp: $("sign-up"),
    appView: $("app-view"),
    userEmail: $("user-email"),
    logout: $("logout"),
    logForm: $("log-form"),
    logDate: $("log-date"),
    topic: $("topic"),
    minutes: $("minutes"),
    note: $("note"),
    save: $("save"),
    list: $("log-list"),
    count: $("log-count"),
    status: $("status")
  };

  var client = null;
  var currentUserId = null;

  function say(message, kind) {
    els.status.textContent = message || "";
    els.status.dataset.kind = kind || "info";
  }

  // 今天的日期（用這台電腦的時區），格式 2026-11-16
  function today() {
    var d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }

  // ---------- 設定檢查：貼錯的東西在這裡先攔下來 ----------
  function cleanUrl(url) {
    return String(url || "").trim().replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, "");
  }

  function isSecretKey(key) {
    if (key.indexOf("sb_secret_") === 0) return true;
    var parts = key.split(".");
    if (parts.length !== 3) return false;
    try {
      var payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
      return payload.role === "service_role";
    } catch (e) {
      return false;
    }
  }

  function configProblem() {
    var url = cleanUrl(cfg.SUPABASE_URL);
    var key = String(cfg.SUPABASE_KEY || "").trim();
    if (!url || url.indexOf("貼上") === 0) return "SUPABASE_URL 還是「貼上…」，還沒換成你的 Project URL。";
    if (url.indexOf("supabase.com/dashboard") !== -1) return "SUPABASE_URL 貼到的是後台網址。要的是 Project URL，長得像 https://一串字.supabase.co。";
    if (!/^https?:\/\/[^\s]+$/.test(url)) return "SUPABASE_URL 看起來不是網址，要以 https:// 開頭。";
    if (!key || key.indexOf("貼上") === 0) return "SUPABASE_KEY 還是「貼上…」，還沒換成你的 publishable key。";
    if (isSecretKey(key)) return "SECRET";
    return "";
  }

  function showConfigProblem(problem) {
    els.configWarning.hidden = false;
    if (problem === "SECRET") {
      els.configWarning.classList.add("danger");
      els.configMessage.textContent =
        "🚨 config.js 裡貼的是 secret（萬能）鑰匙，網頁已停止連線。請馬上：" +
        "①到 Supabase 換成 publishable key；" +
        "②在 Supabase 的 API Keys 頁把這把 secret key 作廢；" +
        "③如果已經推上 GitHub，一定要作廢，只刪檔不算數（GitHub 的歷史裡還找得到）。";
    } else {
      els.configMessage.textContent = problem;
    }
  }

  // ---------- 把錯誤訊息翻成看得懂的話 ----------
  function explain(err) {
    if (!err) return "";
    var code = err.code || "";
    var msg = String(err.message || err);
    var byCode = {
      invalid_credentials: "Email 或密碼不對。還沒註冊過的話，先按「第一次來：註冊」。",
      email_not_confirmed: "這個帳號還沒按確認信。練習時可以到 Supabase 把 Confirm email 關掉（學生頁有寫在哪）。",
      user_already_exists: "這個 Email 已經註冊過了，直接按「登入」。",
      weak_password: "密碼太短或太簡單，至少 6 個字元。",
      over_email_send_rate_limit: "Supabase 內建的寄信額度用完了。練習時把 Confirm email 關掉，就不必寄信。",
      signup_disabled: "這個網站目前關閉註冊。",
      email_address_invalid: "這個 Email 被拒絕了，請換一個真的、收得到信的 Email。"
    };
    if (byCode[code]) return byCode[code];
    if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) return "連不到 Supabase：檢查 config.js 的 Project URL 有沒有貼錯，或網路是否正常。";
    if (/Invalid API key|No API key|apikey/i.test(msg)) return "金鑰不對：config.js 的 SUPABASE_KEY 貼錯或沒貼完整（要用 publishable key）。";
    if (code === "PGRST205" || /Could not find the table|relation .* does not exist/i.test(msg)) return "找不到資料表 learning_logs：schema.sql 還沒在這個 Supabase 專案的 SQL Editor 跑過。";
    if (/permission denied for table/i.test(msg)) return "資料表還沒開放給登入的人用：schema.sql 最後的 grant 那一段沒跑到，整份再跑一次。";
    if (code === "42703" || code === "PGRST204" || /column .* does not exist|Could not find the .* column/i.test(msg)) return "資料表的欄位跟這份程式對不上：這個專案以前用別的版本建過 learning_logs。照學生頁卡關表「欄位對不上」那一列，先刪舊表再跑這份 schema.sql。";
    if (code === "42501" || /row-level security/i.test(msg)) return "被資料庫的門禁（RLS）擋下來了：確認 schema.sql 整份跑過、而且你已經登入。";
    return "出了點問題：" + msg;
  }

  // ---------- 登入、註冊、登出 ----------
  async function signIn(event) {
    event.preventDefault();
    say("登入中…");
    var result = await client.auth.signInWithPassword({
      email: els.email.value.trim(),
      password: els.password.value
    });
    if (result.error) return say(explain(result.error), "error");
    say("");
  }

  async function signUp() {
    if (!els.authForm.reportValidity()) return;
    els.signUp.disabled = true; // 等回應時先鎖住，連點不會重複註冊
    say("註冊中…");
    var result = await client.auth.signUp({
      email: els.email.value.trim(),
      password: els.password.value
    });
    els.signUp.disabled = false;
    if (result.error) return say(explain(result.error), "error");
    if (!result.data.session) {
      return say("帳號建好了，但這個 Supabase 專案要求先按確認信才能登入。練習時可以到 Supabase 把 Confirm email 關掉，再回來按「登入」。", "warn");
    }
    say("註冊成功，已經登入。", "ok");
  }

  async function signOut() {
    var result = await client.auth.signOut();
    if (result.error) return say("登出沒有成功（" + result.error.message + "）。共用電腦請把瀏覽器整個關掉再離開。", "error");
    say("已登出。", "ok");
  }

  // 登入狀態一改變就換畫面（重新整理頁面時也會跑一次）
  function render(session) {
    var user = session ? session.user : null;
    var userId = user ? user.id : null;
    els.authView.hidden = Boolean(user);
    els.appView.hidden = !user;
    if (userId === currentUserId) return; // 同一個人，只是換了通行證，不必重抓
    currentUserId = userId;
    if (user) {
      els.userEmail.textContent = user.email || "";
      loadLogs();
    } else {
      els.list.replaceChildren();
      els.count.textContent = "";
    }
  }

  // ---------- 資料：讀、寫、刪 ----------
  // doneMessage：讀完之後要留在畫面上的那句話（例如「存好了」），不給就照筆數決定
  async function loadLogs(doneMessage, doneKind) {
    var askedFor = currentUserId;
    if (!askedFor) return;
    say("讀取紀錄中…");
    // 這裡故意不寫「只抓我自己的」。擋住別人資料的是資料庫門禁（RLS）。
    // 用兩個帳號測試，彼此都看不到對方的紀錄，才證明門禁真的開了。
    var result = await client
      .from("learning_logs")
      .select("id, log_date, topic, minutes, note, created_at")
      .order("log_date", { ascending: false })
      .order("created_at", { ascending: false });
    // 等回應的時候已經登出或換了人：這份是上一個人的，丟掉不畫
    if (askedFor !== currentUserId) return;
    if (result.error) return say(explain(result.error), "error");
    var rows = result.data || [];
    draw(rows);
    if (doneMessage) say(doneMessage, doneKind);
    else say(rows.length ? "" : "還沒有紀錄，寫下第一筆吧。");
  }

  function draw(rows) {
    els.count.textContent = "（" + rows.length + " 筆）";
    var items = rows.map(function (row) {
      var li = document.createElement("li");

      var head = document.createElement("p");
      head.className = "log-head";
      var date = document.createElement("span");
      date.className = "date";
      date.textContent = row.log_date;
      var topic = document.createElement("strong");
      topic.textContent = row.topic; // textContent：使用者打的字一律當純文字，不會被當成程式執行
      head.append(date, " ", topic);
      if (row.minutes !== null && row.minutes !== undefined) {
        var mins = document.createElement("span");
        mins.className = "mins";
        mins.textContent = row.minutes + " 分鐘";
        head.append(" ", mins);
      }
      li.append(head);

      if (row.note) {
        var note = document.createElement("p");
        note.className = "note";
        note.textContent = row.note;
        li.append(note);
      }

      var del = document.createElement("button");
      del.type = "button";
      del.className = "link";
      del.textContent = "刪除";
      del.addEventListener("click", function () { removeLog(row.id); });
      li.append(del);
      return li;
    });
    els.list.replaceChildren.apply(els.list, items);
  }

  async function addLog(event) {
    event.preventDefault();
    var row = {
      log_date: els.logDate.value || today(),
      topic: els.topic.value.trim(),
      minutes: els.minutes.value === "" ? null : Number(els.minutes.value),
      note: els.note.value.trim() || null
    };
    if (!row.topic) return say("「今天學了什麼」要寫一點。", "error");
    els.save.disabled = true;
    say("存檔中…");
    // 不用自己給 user_id：資料庫會自動填上「現在登入的是誰」
    var result = await client.from("learning_logs").insert(row);
    els.save.disabled = false;
    if (result.error) return say(explain(result.error), "error");
    els.logForm.reset();
    els.logDate.value = today();
    loadLogs("存好了。", "ok");
  }

  async function removeLog(id) {
    if (!window.confirm("確定刪掉這一筆？刪了救不回來。")) return;
    var result = await client.from("learning_logs").delete().eq("id", id);
    if (result.error) return say(explain(result.error), "error");
    loadLogs("刪掉了。", "ok");
  }

  // ---------- 開始 ----------
  function start() {
    els.logDate.value = today();
    var problem = configProblem();
    if (problem) return showConfigProblem(problem);
    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      return say("supabase-js 沒有載入：檢查網路，或 index.html 裡 CDN 那一行是不是被改壞了。", "error");
    }
    client = window.supabase.createClient(cleanUrl(cfg.SUPABASE_URL), String(cfg.SUPABASE_KEY).trim());

    els.authForm.addEventListener("submit", signIn);
    els.signUp.addEventListener("click", signUp);
    els.logout.addEventListener("click", signOut);
    els.logForm.addEventListener("submit", addLog);

    // 官方提醒：這個回呼裡不要直接 await 其他 Supabase 動作，所以用 setTimeout 排到下一輪再做
    client.auth.onAuthStateChange(function (_event, session) {
      setTimeout(function () { render(session); }, 0);
    });
  }

  start();
})();
