// ===== komekome-server: コメント =====
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { Pool } = require("pg");
const jwt = require("jsonwebtoken");

const SECRET = "your-secret-key";

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ===== ログイン =====
app.post("/login", async (req, res) => {
  const { name } = req.body;
  const token = jwt.sign({ name }, SECRET, { expiresIn: "7d" });
  res.json({ token });
});

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

// ===== コメント取得 =====
app.get("/comments", async (req, res) => {
  const { videoId } = req.query;
  const result = await pool.query(
    `SELECT * FROM comments WHERE video_id=$1 ORDER BY time ASC`,
    [videoId]
  );
  res.json(result.rows);
});

server.listen(3000, () => console.log("Server started on port 3000"));