// ===== komekome動画: コメント同期・運営対応 =====
let player;
let videoId = "";  
const socket = io("https://your-render-url");

let allComments = [];
let lastTime = 0;
let token = localStorage.getItem("token");
let blocked = JSON.parse(localStorage.getItem("block") || "[]");

// ===== レーン制御 =====
const lanes = [];
const laneHeight = 30;
function getFreeLane() {
  for (let i = 0; i < lanes.length; i++) {
    if (Date.now() > lanes[i]) return i;
  }
  lanes.push(0);
  return lanes.length - 1;
}

// ===== コメント表示 =====
function renderComment(c) {
  if (c.deleted) return;
  if (blocked.includes(c.user_name)) return;

  const el = document.createElement("div");
  el.className = "comment";

  // 運営バッジ
  if (c.is_admin) {
    el.innerHTML = `<span class="admin-badge">運営</span> ${c.text}`;
  } else {
    el.textContent = c.text;
  }

  el.style.color = c.color || "white";

  // サイズ
  if (c.size === "small") el.style.fontSize = "14px";
  if (c.size === "medium") el.style.fontSize = "20px";
  if (c.size === "large") el.style.fontSize = "30px";

  if (c.position === "flow") {
    const lane = getFreeLane();
    el.style.top = lane * laneHeight + "px";
    const duration = Math.min(8, Math.max(4, c.text.length / 5));
    el.style.animation = `flow ${duration}s linear`;
    lanes[lane] = Date.now() + duration * 800;
    setTimeout(() => el.remove(), duration * 1000);
  } else {
    const lane = getFreeLane();
    const offset = lane * laneHeight;
    if (c.position === "top") el.style.top = offset + "px";
    if (c.position === "middle") el.style.top = 200 + offset + "px";
    if (c.position === "bottom") el.style.bottom = offset + "px";
    lanes[lane] = Date.now() + 3000;
    setTimeout(() => el.remove(), 3000);
  }

  document.getElementById("comments").appendChild(el);
}

// ===== 同期 =====
function syncLoop() {
  if (!player || !player.getCurrentTime) return;
  const t = player.getCurrentTime();

  allComments.forEach(c => {
    if (!c.shown && Math.abs(c.time - t) < 0.3) {
      renderComment(c);
      c.shown = true;
    }
  });

  if (Math.abs(t - lastTime) > 2) handleSeek();
  lastTime = t;
}
setInterval(syncLoop, 100);

// ===== コメント削除反映 =====
socket.on("delete_comment", id => {
  allComments = allComments.map(c =>
    c.id === id ? { ...c, deleted: true } : c
  );
});

// ===== 動画URLから再生 =====
function onYouTubeIframeAPIReady() {
  player = new YT.Player("player");
}

function loadVideo() {
  const url = document.getElementById("videoUrl").value;
  const match = url.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/);
  if (!match) {
    alert("URLが正しくありません");
    return;
  }
  videoId = match[1];
  player.loadVideoById(videoId, 0, "default");
  handleSeek();
}

// ===== コメント取得（シークやロード時） =====
async function handleSeek() {
  if (!videoId) return;
  allComments = [];
  document.getElementById("comments").innerHTML = "";
  try {
    const res = await fetch(`https://your-render-url/comments?videoId=${videoId}`);
    const data = await res.json();
    allComments = data.map(c => ({ ...c, shown: false }));
  } catch (err) {
    console.error(err);
  }
}

// ===== 再生速度変更 =====
function changeSpeed() {
  if (!player) return;
  const rate = parseFloat(document.getElementById("speed").value);
  player.setPlaybackRate(rate);
}

// ===== ブロック =====
function blockUser(name) {
  if (!blocked.includes(name)) {
    blocked.push(name);
    localStorage.setItem("block", JSON.stringify(blocked));
  }
}
