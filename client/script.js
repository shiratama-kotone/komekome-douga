const socket = io("https://your-render-url");

let player;
let videoId = "";
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
  el.innerHTML = c.text;
  el.style.color = c.color || "white";

  const duration = Math.min(8, Math.max(4, c.text.length / 5));

  if (c.position === "flow") {
    const lane = getFreeLane();
    el.style.top = (lane * laneHeight) + "px";
    el.style.animation = `flow ${duration}s linear`;

    lanes[lane] = Date.now() + duration * 800;
    setTimeout(() => el.remove(), duration * 1000);

  } else {
    const lane = getFreeLane();
    const offset = lane * laneHeight;

    if (c.position === "top") el.style.top = offset + "px";
    if (c.position === "middle") el.style.top = (200 + offset) + "px";
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

// ===== 削除反映 =====
socket.on("delete_comment", id => {
  allComments = allComments.map(c =>
    c.id === id ? { ...c, deleted: true } : c
  );
});

// ===== 動画 =====
function onYouTubeIframeAPIReady() {
  player = new YT.Player("player");
}

// ===== 倍速 =====
function changeSpeed() {
  if(!player) return;
  const rate = parseFloat(document.getElementById("speed").value);
  player.setPlaybackRate(rate);
}