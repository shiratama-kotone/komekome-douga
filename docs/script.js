const socket = io("https://your-render-url");
let token = localStorage.getItem("token");
let player;
let videoId = "";
let allComments = [];

// ===== 登録・ログイン =====
async function register(){
  const name = document.getElementById("loginName").value;
  const pass = document.getElementById("loginPassword").value;
  const res = await fetch("https://your-render-url/register",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({name,password:pass})
  });
  const data = await res.json();
  document.getElementById("loginStatus").textContent = data.error || "登録成功！ログインしてね";
}

async function login(){
  const name = document.getElementById("loginName").value;
  const pass = document.getElementById("loginPassword").value;
  const res = await fetch("https://your-render-url/login",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({name,password:pass})
  });
  const data = await res.json();
  if(data.token){
    token = data.token;
    localStorage.setItem("token", token);
    document.getElementById("loginForm").style.display="none";
    document.getElementById("mainContent").style.display="block";
  }else{
    document.getElementById("loginStatus").textContent = data.error;
  }
}

// ===== 動画再生 =====
function loadVideo(){
  const url = document.getElementById("videoUrl").value;
  const match = url.match(/v=([a-zA-Z0-9_-]{11})/);
  if(!match) return alert("URLが不正");
  videoId = match[1];
  if(player) player.loadVideoById(videoId);
  else player = new YT.Player("player",{videoId});
  fetchComments();
}

// ===== コメント同期 =====
async function fetchComments(){
  const res = await fetch(`https://your-render-url/comments?videoId=${videoId}`,{
    headers:{Authorization:token}
  });
  allComments = (await res.json()).map(c=>({...c,shown:false}));
  renderCommentList();
}

// ===== コメント投稿 =====
async function postComment(){
  const text = document.getElementById("commentText").value;
  const size = document.getElementById("commentSize").value;
  const pos = document.getElementById("commentPos").value;
  const color = document.getElementById("commentColor").value;

  const res = await fetch("https://your-render-url/comment",{
    method:"POST",
    headers:{ "Content-Type":"application/json","Authorization":token },
    body:JSON.stringify({videoId,text,time:player.getCurrentTime(),size,pos,color})
  });
  const data = await res.json();
  allComments.push({...data,shown:false});
  renderCommentList();
}

// ===== コメントリスト描画 =====
function renderCommentList(){
  const list = document.getElementById("commentList");
  list.innerHTML="";
  allComments.forEach(c=>{
    if(c.deleted) return;
    const el = document.createElement("div");
    el.innerHTML = c.is_admin ? `<b style="color:red;">[運営] ${c.user_name}</b>: ${c.text}` :
                                  `[${c.user_name}]: ${c.text}`;
    list.appendChild(el);
  });
}

// ===== Socket同期 =====
socket.on("new_comment", c=>{
  allComments.push({...c,shown:false});
  renderCommentList();
});
socket.on("delete_comment", id=>{
  allComments = allComments.map(c=>c.id===id?{...c,deleted:true}:c);
  renderCommentList();
});

// ===== YouTube API =====
function onYouTubeIframeAPIReady(){if(videoId) player=new YT.Player("player",{videoId});}