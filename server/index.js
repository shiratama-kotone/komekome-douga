const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { Pool } = require("pg");
const jwt = require("jsonwebtoken");
const axios = require("axios");

const SECRET = "your-secret-key";

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// ===== 認証 =====
function auth(req, res, next) {
  const token = req.headers.authorization;
  if (!token) return res.sendStatus(401);
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.sendStatus(403);
  }
}

// ===== ログイン =====
app.post("/login", (req, res) => {
  const { name } = req.body;
  const token = jwt.sign({ name }, SECRET, { expiresIn: "7d" });
  res.json({ token });
});

// ===== YouTube検索 =====
app.get("/search", async (req, res) => {
  const { q } = req.query;

  const yt = await axios.get("https://www.googleapis.com/youtube/v3/search", {
    params: {
      part: "snippet",
      q,
      type: "video",
      maxResults: 10,
      key: process.env.YT_API_KEY
    }
  });

  res.json(
    yt.data.items.map(v => ({
      videoId: v.id.videoId,
      title: v.snippet.title,
      thumbnail: v.snippet.thumbnails.medium.url
    }))
  );
});

// ===== コメント投稿 =====
app.post("/comment", auth, async (req, res) => {
  const { videoId, text, time, color, size, position } = req.body;
  const user = req.user.name;

  const adminCheck = await pool.query(
    "SELECT 1 FROM admins WHERE user_name=$1",
    [user]
  );
  const isAdmin = adminCheck.rowCount > 0;

  const finalColor = color || (isAdmin ? "red" : "white");

  const result = await pool.query(
    `INSERT INTO comments (video_id, text, time, user_name, color, size, position, is_admin)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [videoId, text, time, user, finalColor, size, position, isAdmin]
  );

  const comment = result.rows[0];
  io.emit("new_comment", comment);

  res.json(comment);
});

// ===== 削除（論理） =====
app.post("/delete", auth, async (req, res) => {
  const { id } = req.body;
  const user = req.user.name;

  const comment = await pool.query("SELECT * FROM comments WHERE id=$1", [id]);
  if (!comment.rowCount) return res.sendStatus(404);

  const c = comment.rows[0];

  const adminCheck = await pool.query(
    "SELECT 1 FROM admins WHERE user_name=$1",
    [user]
  );
  const isAdmin = adminCheck.rowCount > 0;

  if (c.user_name !== user && !isAdmin) return res.sendStatus(403);

  await pool.query("UPDATE comments SET deleted=true WHERE id=$1", [id]);

  io.emit("delete_comment", id);
  res.sendStatus(200);
});

// ===== コメント取得 =====
app.get("/comments", async (req, res) => {
  const { videoId } = req.query;

  const result = await pool.query(
    `SELECT * FROM comments WHERE video_id=$1 ORDER BY time ASC`,
    [videoId]
  );

  res.json(result.rows);
});

server.listen(3000, () => console.log("コメコメ動画 server running"));