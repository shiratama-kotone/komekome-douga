const BASE = "https://komekome-server.onrender.com";
const socket = io(BASE);

let token = localStorage.getItem("token");
let player, videoId, allComments = [], lastTime = 0;
let blocked = JSON.parse(localStorage.getItem("block") || "[]");
const lanes = [], laneHeight = 30;

// ===== ログイン/登録 =====
async function login() {
  const name = document.getElementById("name").value;
  const pw = document.getElementById("password").value;

  const res = await fetch(BASE + "/login", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ name, password: pw })
  });

  const data = await res.json();

  if (data.token) {
    token = data.token;
    localStorage.setItem("token", token);
    showMain();
  } else {
    document.getElementById("loginMsg").textContent = data.error;
  }
}

async function register() {
  const name = document.getElementById("name").value;
  const pw = document.getElementById("password").value;

  const res = await fetch(BASE + "/register", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ name, password: pw })
  });

  const data = await res.json();
  document.getElementById("loginMsg").textContent =
    data.success ? "登録完了" : data.error;
}

// ===== UI表示 =====
function showMain() {
  document.getElementById("loginWrap").style.display = "none";
  document.getElementById("mainWrap").style.display = "block";
}

// ===== 動画 =====
function onYouTubeIframeAPIReady() {
  player = new YT.Player("player");
}

function loadVideo() {
  const url = document.getElementById("videoUrl").value;
  const match = url.match(/v=([a-zA-Z0-9_-]+)/);
  if (!match) return alert("正しいURL入れて");

  videoId = match[1];
  player.loadVideoById(videoId);
  fetchComments();
}

// ===== コメント同期 =====
function getFreeLane() {
  for (let i = 0; i < lanes.length; i++) {
    if (Date.now() > lanes[i]) return i;
  }
  lanes.push(0);
  return lanes.length - 1;
}

function renderComment(c) {
  if (c.deleted || blocked.includes(c.user_name)) return;

  const el = document.createElement("div");
  el.className = "comment";

  let text = c.text;
  if (c.is_admin) text = `<span class="adminBadge">運営</span> ${text}`;

  el.innerHTML = text;
  el.style.color = c.color || "white";

  if (c.size === "small") el.style.fontSize = "14px";
  if (c.size === "medium") el.style.fontSize = "20px";
  if (c.size === "large") el.style.fontSize = "30px";

  const duration = c.position === "flow"
    ? Math.min(8, Math.max(4, c.text.length / 5))
    : 3;

  const lane = getFreeLane();

  if (c.position === "flow") {
    el.style.top = (lane * laneHeight) + "px";
    el.style.animation = `flow ${duration}s linear`;
    lanes[lane] = Date.now() + duration * 800;
    setTimeout(() => el.remove(), duration * 1000);
  } else {
    if (c.position === "top") el.style.top = (lane * laneHeight) + "px";
    if (c.position === "middle") el.style.top = (200 + lane * laneHeight) + "px";
    if (c.position === "bottom") el.style.bottom = (lane * laneHeight) + "px";
    lanes[lane] = Date.now() + 3000;
    setTimeout(() => el.remove(), 3000);
  }

  document.getElementById("comments").appendChild(el);

  // コメントリスト
  const li = document.createElement("li");
  li.textContent = `[${c.time.toFixed(1)}] ${c.user_name}: ${c.text}`;

  const delBtn = document.createElement("button");
  delBtn.textContent = "削除";
  delBtn.onclick = () => deleteComment(c.id);

  li.appendChild(delBtn);
  document.getElementById("commentList").appendChild(li);
}

async function fetchComments() {
  const res = await fetch(BASE + `/comments?videoId=${videoId}`, {
    headers: { Authorization: token }
  });

  const data = await res.json();
  allComments = data.map(c => ({ ...c, shown: false }));
}

// ===== 同期ループ =====
function syncLoop() {
  if (!player || !player.getCurrentTime) return;

  const t = player.getCurrentTime();

  allComments.forEach(c => {
    if (!c.shown && Math.abs(c.time - t) < 0.3) {
      renderComment(c);
      c.shown = true;
    }
  });

  if (Math.abs(t - lastTime) > 2) fetchComments();
  lastTime = t;
}

setInterval(syncLoop, 100);

// ===== コメント送信 =====
async function sendComment() {
  const text = document.getElementById("commentText").value;
  const color = document.getElementById("color").value;
  const size = document.getElementById("size").value;
  const position = document.getElementById("position").value;
  const time = player.getCurrentTime();

  const res = await fetch(BASE + "/comment", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": token
    },
    body: JSON.stringify({ videoId, text, time, color, size, position })
  });

  const c = await res.json();
  allComments.push({ ...c, shown: false });
  document.getElementById("commentText").value = "";
}

// ===== コメント削除 =====
async function deleteComment(id) {
  await fetch(BASE + "/delete_comment", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": token
    },
    body: JSON.stringify({ id })
  });

  allComments = allComments.map(c =>
    c.id === id ? { ...c, deleted: true } : c
  );
}

// ===== 再生速度 =====
function changeSpeed() {
  const rate = parseFloat(document.getElementById("speed").value);
  player.setPlaybackRate(rate);
}

// ===== Socket =====
socket.on("new_comment", c => {
  allComments.push({ ...c, shown: false });
});

socket.on("delete_comment", id => {
  allComments = allComments.map(c =>
    c.id === id ? { ...c, deleted: true } : c
  );
});