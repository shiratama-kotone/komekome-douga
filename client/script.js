// ===== コメコメ動画 script.js =====
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

  // 運営バッジ
  if(c.is_admin){
    el.innerHTML = `<span style="color:red;font-weight:bold;border:1px solid black;padding:0 2px;">運営</span> ${el.innerHTML}`;
    el.style.color = "red";
  } else el.style.color = c.color || "white";

  const duration = c.position==="flow" ? Math.min(8, Math.max(4, c.text.length / 5)) : 3;

  const lane = getFreeLane();
  if (c.position === "flow") {
    el.style.top = (lane * laneHeight) + "px";
    el.style.animation = `flow ${duration}s linear`;
    lanes[lane] = Date.now() + duration*800;
    setTimeout(()=>el.remove(), duration*1000);
  } else {
    const offset = lane*laneHeight;
    if (c.position==="top") el.style.top = offset+"px";
    if (c.position==="middle") el.style.top = (200+offset)+"px";
    if (c.position==="bottom") el.style.bottom = offset+"px";
    lanes[lane] = Date.now() + duration*1000;
    setTimeout(()=>el.remove(), duration*1000);
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

  if (Math.abs(t-lastTime) > 2) handleSeek();
  lastTime = t;
}
setInterval(syncLoop,100);

// ===== 削除反映 =====
socket.on("delete_comment", id=>{
  allComments = allComments.map(c => c.id===id ? {...c,deleted:true}:c);
});

// ===== 動画 =====
function onYouTubeIframeAPIReady(){ player = new YT.Player("player"); }
function changeSpeed(){ 
  if(!player) return;
  const rate=parseFloat(document.getElementById("speed").value);
  player.setPlaybackRate(rate);
}

// ===== コメント取得 =====
async function fetchComments(vId){
  videoId = vId;
  const res = await fetch(`https://your-render-url/comments?videoId=${vId}`);
  const data = await res.json();
  allComments = data.map(c=>({...c,shown:false}));
  document.getElementById("comments").innerHTML="";
}

// ===== 動画検索 =====
async function searchYoutube(query){
  const res = await fetch(`https://youtube-search-api.vercel.app/api/search?query=${encodeURIComponent(query)}`);
  const data = await res.json();
  const list = document.getElementById("searchResults");
  list.innerHTML="";
  data.items.forEach(v=>{
    const li = document.createElement("li");
    li.textContent = v.title;
    li.onclick = ()=>{ fetchComments(v.videoId); loadPlayer(v.videoId); }
    list.appendChild(li);
  });
}

// ===== プレイヤーロード =====
function loadPlayer(vId){
  if(player) player.loadVideoById(vId);
  else player = new YT.Player("player",{videoId:vId});
}