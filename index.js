const express = require("express");
const axios = require("axios");
const cors = require("cors"); // 🔥 مهم

const app = express();

/* حل مشكلة CORS */
app.use(cors({ origin: "*" }));

app.use(express.json());

/* ===== بيانات Zoom ===== */
const ACCOUNT_ID = "fNDPaV5xTWKeSeS4rojHuA";
const CLIENT_ID = "vZchcwmtSVWBzxbXcthxxQ";
const CLIENT_SECRET = "JBDKJ5wda3mX0VyhUTVedbfxqT8bdrX6";

/* ===== جلب التوكن ===== */
async function getAccessToken() {
  const response = await axios.post(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${ACCOUNT_ID}`,
    {},
    {
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(CLIENT_ID + ":" + CLIENT_SECRET).toString("base64"),
      },
    }
  );

  return response.data.access_token;
}

/* ===== إنشاء اجتماع ===== */
app.post("/create-meeting", async (req, res) => {
  try {
    const token = await getAccessToken();

    const response = await axios.post(
      "https://api.zoom.us/v2/users/me/meetings",
      {
        topic: req.body.topic || "Prudle Class",
        type: 2,
        start_time: req.body.start_time || new Date().toISOString(),
        duration: req.body.duration || 60,
        timezone: "Asia/Riyadh",
        settings: {
          join_before_host: true,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`, // ✅ كان فيه خطأ هنا
        },
      }
    );

    res.json({
      join_url: response.data.join_url,
      start_url: response.data.start_url,
    });

  } catch (err) {

    console.error("Zoom Error:", err.response?.data || err.message);

    res.status(500).json(
      err.response?.data || { error: err.message }
    );
  }
});

/* اختبار السيرفر */
app.get("/", (req, res) => {
  res.send("Zoom API is running 🚀");
});

/* تشغيل السيرفر */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => console.log("Server running"));
