const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { Pool } = require("pg");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const SECRET = "your-secret-key";

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ===== ユーザー登録 =====
app.post("/register", async (req, res) => {
  const { name, password } = req.body;
  if (!name || !password) return res.status(400).json({ error: "必須項目なし" });

  const hash = await bcrypt.hash(password, 10);
  await pool.query("INSERT INTO users (name,password_hash) VALUES ($1,$2)", [name, hash]);
  res.json({ success: true });
});

// ===== ログイン =====
app.post("/login", async (req, res) => {
  const { name, password } = req.body;
  const result = await pool.query("SELECT * FROM users WHERE name=$1", [name]);
  const user = result.rows[0];
  if (!user) return res.status(400).json({ error: "ユーザーなし" });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(400).json({ error: "パスワード違う" });

  const token = jwt.sign({ name }, SECRET, { expiresIn: "7d" });
  res.json({ token });
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

// ===== コメント投稿 =====
app.post("/comment", auth, async (req, res) => {
  const { videoId, text, time, color, size, position } = req.body;
  const user = req.user.name;

  const adminCheck = await pool.query("SELECT 1 FROM admins WHERE user_name=$1", [user]);
  const isAdmin = adminCheck.rowCount > 0;
  const finalColor = color || (isAdmin ? "red" : "white");

  const result = await pool.query(
    `INSERT INTO comments (video_id,text,time,user_name,color,size,position,is_admin)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [videoId, text, time, user, finalColor, size, position, isAdmin]
  );

  const comment = result.rows[0];
  io.emit("new_comment", comment);
  res.json(comment);
});

// ===== コメント取得 =====
app.get("/comments", auth, async (req, res) => {
  const { videoId } = req.query;
  const result = await pool.query("SELECT * FROM comments WHERE video_id=$1 ORDER BY time ASC", [videoId]);
  res.json(result.rows);
});

// ===== コメント削除 =====
app.post("/delete_comment", auth, async (req, res) => {
  const { id } = req.body;
  const user = req.user.name;

  const commentCheck = await pool.query("SELECT * FROM comments WHERE id=$1", [id]);
  if (!commentCheck.rows[0]) return res.status(404).json({ error: "コメントなし" });

  const adminCheck = await pool.query("SELECT 1 FROM admins WHERE user_name=$1", [user]);
  const isAdmin = adminCheck.rowCount > 0;

  if (commentCheck.rows[0].user_name !== user && !isAdmin) return res.status(403).json({ error: "権限なし" });

  io.emit("delete_comment", id);
  res.json({ success: true });
});

// ===== ブロック機能 =====
app.post("/block_user", auth, async (req, res) => {
  const { blockName } = req.body;
  const user = req.user.name;
  // 簡易的にクライアント側で管理するためサーバーは受け取りのみ
  res.json({ success: true });
});

server.listen(3000, () => console.log("Server started on port 3000"));