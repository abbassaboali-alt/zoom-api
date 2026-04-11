const express = require("express");
const axios = require("axios");
const admin = require("firebase-admin");
const cloudinary = require("cloudinary").v2;

const app = express();
app.use(express.json());

/* ================= Firebase ================= */
const serviceAccount = require("./serviceAccount.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

/* ================= Zoom ================= */
const ACCOUNT_ID = "fNDPaV5xTWKeSeS4rojHuA";
const CLIENT_ID = "vZchcwmtSVWBzxbXcthxxQ";
const CLIENT_SECRET = "JBDKJ5wda3mX0VyhUTVedbfxqT8bdrX6";

/* ================= Cloudinary ================= */
cloudinary.config({
  cloud_name: "dgs6mo4hl",
  api_key: "845894915521265",
  api_secret: "lnrr8AjEQ5VCJmYcqIl2q9aGR4I"
});

/* ================= Get Token ================= */
async function getAccessToken() {
  const url = `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${ACCOUNT_ID}`;

  const res = await axios.post(url, null, {
    headers: {
      Authorization:
        "Basic " +
        Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64")
    }
  });

  return res.data.access_token;
}

/* ================= Create Meeting ================= */
app.post("/create-meeting", async (req, res) => {
  try {
    const token = await getAccessToken();

    const zoomRes = await axios.post(
      "https://api.zoom.us/v2/users/me/meetings",
      {
        topic: req.body.topic,
        type: 2,
        start_time: req.body.start_time,
        duration: req.body.duration || 60,
        timezone: "Asia/Riyadh",
        settings: {
          auto_recording: "cloud"
        }
      },
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    res.json({
      join_url: zoomRes.data.join_url,
      start_url: zoomRes.data.start_url,
      meeting_id: zoomRes.data.id
    });

  } catch (e) {
    console.error(e.response?.data || e.message);
    res.status(500).json({ error: "Zoom create failed" });
  }
});

/* ================= Sync Recordings ================= */
app.post("/sync-recordings", async (req, res) => {
  try {
    const token = await getAccessToken();

    const recordings = await axios.get(
      "https://api.zoom.us/v2/users/me/recordings",
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    for (const meeting of recordings.data.meetings) {

      for (const file of meeting.recording_files || []) {

        if (!file.download_url) continue;

        const stream = await axios({
          url: file.download_url,
          method: "GET",
          responseType: "stream",
          headers: { Authorization: `Bearer ${token}` }
        });

        const upload = await new Promise((resolve, reject) => {
          const up = cloudinary.uploader.upload_stream(
            { resource_type: "video" },
            (err, result) => {
              if (err) reject(err);
              else resolve(result);
            }
          );
          stream.data.pipe(up);
        });

        await db.collection("videos").add({
          courseId: meeting.topic,
          title: "Zoom Recording",
          url: upload.secure_url,
          createdAt: new Date()
        });

      }
    }

    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Sync failed" });
  }
});

/* ================= Delete Meeting ================= */
app.delete("/delete-meeting/:id", async (req, res) => {
  try {
    const token = await getAccessToken();

    await axios.delete(
      `https://api.zoom.us/v2/meetings/${req.params.id}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    res.json({ success: true });

  } catch (e) {
    res.status(500).json({ error: "Delete failed" });
  }
});

/* ================= Start ================= */
app.listen(3000, () => {
  console.log("Server running on port 3000");
});
