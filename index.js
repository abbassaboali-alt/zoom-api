const express = require("express");
const cors = require("cors");
const { google } = require("googleapis");

const app = express();

app.use(cors({ origin: "*" }));
app.use(express.json());

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

const TRAINER_TOKENS = {};
// مؤقت فقط. إذا Render أعاد التشغيل، تحتاج تربط Google مرة ثانية

app.get("/", (req, res) => {
  res.send("Prudle Google Meet API is running ✅");
});

/* ربط حساب Google */
app.get("/google/connect", (req, res) => {
  const trainer = (req.query.trainer || "").toLowerCase().trim();

  if (!trainer) {
    return res.status(400).send("Missing trainer");
  }

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/calendar.events"],
    state: trainer
  });

  res.redirect(url);
});

/* رجوع Google بعد الموافقة */
app.get("/google/callback", async (req, res) => {
  try {
    const code = req.query.code;
    const trainer = (req.query.state || "").toLowerCase().trim();

    if (!code || !trainer) {
      return res.status(400).send("Missing code or trainer");
    }

    const { tokens } = await oauth2Client.getToken(code);

    TRAINER_TOKENS[trainer] = tokens;

    res.send(`
      <h2 style="font-family:Arial;text-align:center;margin-top:50px">
        ✅ تم ربط حساب Google بنجاح<br>
        يمكنك الرجوع إلى Prudle الآن
      </h2>
    `);

  } catch (err) {
    console.error(err);
    res.status(500).send("Google connection failed");
  }
});

/* التحقق هل المدرب ربط حساب Google */
app.get("/google/status", (req, res) => {
  const trainer = (req.query.trainer || "").toLowerCase().trim();

  if (!trainer) {
    return res.status(400).json({
      connected: false,
      error: "Missing trainer"
    });
  }

  const tokens = TRAINER_TOKENS[trainer];

  if (!tokens) {
    return res.json({
      connected: false
    });
  }

  return res.json({
    connected: true
  });
});

/* إنشاء Google Meet */
app.post("/create-meet", async (req, res) => {
  try {
    const { trainer, topic, start_time, duration } = req.body;

    if (!trainer || !topic || !start_time) {
      return res.status(400).json({ error: "Missing data" });
    }

    const trainerKey = trainer.toLowerCase().trim();

    const tokens = TRAINER_TOKENS[trainerKey];

    if (!tokens) {
      return res.status(400).json({
        error: "Google account not connected"
      });
    }

    oauth2Client.setCredentials(tokens);

    const calendar = google.calendar({
      version: "v3",
      auth: oauth2Client
    });

    const start = new Date(start_time);
    const end = new Date(start.getTime() + Number(duration || 60) * 60000);

    const event = await calendar.events.insert({
      calendarId: "primary",
      conferenceDataVersion: 1,
      requestBody: {
        summary: topic,
        start: {
          dateTime: start.toISOString()
        },
        end: {
          dateTime: end.toISOString()
        },
        conferenceData: {
          createRequest: {
            requestId: Date.now().toString(),
            conferenceSolutionKey: {
              type: "hangoutsMeet"
            }
          }
        }
      }
    });

    res.json({
      meetLink: event.data.hangoutLink,
      eventId: event.data.id
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Create meet failed",
      details: err.message
    });
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Server running");
});
