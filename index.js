const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

// بيانات Zoom (حط بياناتك هنا)
const ACCOUNT_ID = "fNDPaV5xTWKeSeS4rojHuA";
const CLIENT_ID = "vZchcwmtSVWBzxbXcthxxQ";
const CLIENT_SECRET = "JBDKJ5wda3mX0VyhUTVedbfxqT8bdrX6";

// جلب التوكن
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

// إنشاء اجتماع
app.post("/create-meeting", async (req, res) => {
  try {
    const token = await getAccessToken();

    const response = await axios.post(
      "https://api.zoom.us/v2/users/me/meetings",
      {
        topic: "Prudle Class",
        type: 2,
        start_time: new Date().toISOString(),
        duration: 60,
        timezone: "Asia/Riyadh",
        settings: {
          join_before_host: true,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    res.json({
      join_url: response.data.join_url,
      start_url: response.data.start_url,
    });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.listen(3000, () => console.log("Server running"));
