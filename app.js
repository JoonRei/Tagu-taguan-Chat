// app.js - vanilla JS + Firebase Realtime Database
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, push, set, onChildAdded, get, remove, onValue, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

/* -------------------------
   YOUR FIREBASE CONFIG
--------------------------*/
const firebaseConfig = {
  apiKey: "AIzaSyDS21eqU6yinc1Nr1DOZeUXMDOc6Q9IDqc",
  authDomain: "tagu-taguan-chat.firebaseapp.com",
  databaseURL: "https://tagu-taguan-chat-default-rtdb.firebaseio.com",
  projectId: "tagu-taguan-chat",
  storageBucket: "tagu-taguan-chat.firebasestorage.app",
  messagingSenderId: "983113282878",
  appId: "1:983113282878:web:feddbbd4aa21e6a2d6686f",
  measurementId: "G-XRFDRN07ZV"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

/* ---------- DOM ---------- */
const screenLogin = document.getElementById("screenLogin");
const screenWaiting = document.getElementById("screenWaiting");
const screenChat = document.getElementById("screenChat");

const inpName = document.getElementById("inpName");
const btnJoin = document.getElementById("btnJoin");
const btnCancel = document.getElementById("btnCancel");
const searchStatus = document.getElementById("searchStatus");
const icebreakerEl = document.getElementById("icebreaker");
const meAvatar = document.getElementById("meAvatar");

const lblPartner = document.getElementById("lblPartner");
const lblReveal = document.getElementById("lblReveal");
const chatMessages = document.getElementById("chatMessages");
const inpMsg = document.getElementById("inpMsg");
const btnSend = document.getElementById("btnSend");
const btnEnd = document.getElementById("btnEnd");
const btnRematch = document.getElementById("btnRematch");

/* ---------- State ---------- */
let nickname = "";
let roomId = null;
let partnerName = "";
let partnerWatcher = null;
let messageWatcher = null;
let searchingTimer = null;
let icebreakerTimer = null;
let revealTimer = null;
let revealCountdown = null;

/* ---------- Icebreakers ---------- */
const icebreakers = [
  "Ano’ng paborito mong merienda? 🍞",
  "Team adobo o sinigang? 🍲",
  "Kape o tsaa? ☕",
  "Beach o bundok? 🏖️/⛰️",
  "Favorite karaoke song? 🎤"
];

/* ---------- Helpers ---------- */
function showScreen(screen) {
  [screenLogin, screenWaiting, screenChat].forEach(s => s.classList.add("hidden"));
  screen.classList.remove("hidden");
}

function updateAvatar(name) {
  const initials = (name || "ME").split(" ").map(s => s[0]).slice(0,2).join("").toUpperCase();
  meAvatar.textContent = initials;
}

function scrollToBottom() { chatMessages.scrollTop = chatMessages.scrollHeight; }

function addSystem(text){
  const el = document.createElement("div");
  el.className = "text-center text-xs text-slate-500 my-1";
  el.innerText = text;
  chatMessages.appendChild(el);
  scrollToBottom();
}

/* ---------- Messages & Reactions ---------- */
function createMessageElement(msgId, text, senderIsMe, reaction = null){
  const wrapper = document.createElement("div");
  wrapper.className = senderIsMe ? "flex justify-end mb-2" : "flex justify-start mb-2";

  const container = document.createElement("div");
  container.className = "relative max-w-[75%]";

  const bubble = document.createElement("div");
  bubble.className = "msg-bubble " + (senderIsMe ? "me" : "them");
  bubble.innerText = text;
  bubble.style.userSelect = "none";
  bubble.style.wordBreak = "break-word";
  bubble.style.whiteSpace = "pre-wrap";
  bubble.style.display = "inline-block";
  bubble.style.maxWidth = "100%";

  const badge = document.createElement("div");
  badge.className = "bg-white rounded-full shadow px-2 py-0.5 text-sm absolute left-1/2 -translate-x-1/2 -bottom-5";
  badge.textContent = reaction || "";
  badge.style.display = reaction ? "block" : "none";

  container.appendChild(bubble);
  container.appendChild(badge);
  wrapper.appendChild(container);
  chatMessages.appendChild(wrapper);
  scrollToBottom();

  // Long press for reactions
  let pressTimer;
  const startPress = (e) => {
    e.preventDefault();
    pressTimer = setTimeout(() => showReactionPopup(bubble, msgId, badge), 500);
  };
  const endPress = () => clearTimeout(pressTimer);

  bubble.addEventListener("mousedown", startPress);
  bubble.addEventListener("mouseup", endPress);
  bubble.addEventListener("mouseleave", endPress);
  bubble.addEventListener("touchstart", startPress);
  bubble.addEventListener("touchend", endPress);
}

/* Reaction popup overlay */
function showReactionPopup(bubble, msgId, badgeEl){
  const existing = document.getElementById("reaction-popup");
  if(existing) existing.remove();

  const rect = bubble.getBoundingClientRect();
  const popup = document.createElement("div");
  popup.id = "reaction-popup";
  popup.className = "flex gap-2 bg-white rounded-full shadow p-2 z-[9999] fixed";

  // Default position below bubble
  let left = rect.left + rect.width/2;
  let top = rect.bottom + window.scrollY + 8;

  // Clamp to viewport width so it doesn't go off-screen
  const popupWidth = 200; 
  if(left - popupWidth/2 < 8) left = popupWidth/2 + 8;
  if(left + popupWidth/2 > window.innerWidth - 8) left = window.innerWidth - popupWidth/2 - 8;

  popup.style.left = left + "px";
  popup.style.top = top + "px";
  popup.style.transform = "translateX(-50%)";

  const reactions = ["👍","❤️","😂","😮","😢","👏"];
  reactions.forEach(r => {
    const btn = document.createElement("button");
    btn.className = "text-xl hover:scale-125 transition-transform";
    btn.textContent = r;
    btn.onclick = async () => {
      await update(ref(db, `rooms/${roomId}/messages/${msgId}`), { reaction: r });
      badgeEl.textContent = r;
      badgeEl.style.display = "block";
      popup.remove();
    };
    popup.appendChild(btn);
  });

  document.body.appendChild(popup);

  setTimeout(()=>{
    document.addEventListener("click", function handler(e){
      if(!popup.contains(e.target)){
        popup.remove();
        document.removeEventListener("click", handler);
      }
    });
  },0);
}

/* ---------- Matchmaking & Chat ---------- */
btnJoin.addEventListener("click", async ()=>{
  nickname = (inpName.value || "").trim() || `Player${Math.floor(Math.random()*900)+100}`;
  updateAvatar(nickname);
  showScreen(screenWaiting);
  startIcebreakers();

  const lobbyRef = ref(db,"lobby");
  const snap = await get(lobbyRef);
  let matched = false;

  if(snap.exists()){
    snap.forEach(child=>{
      if(!matched && child.val().waiting){
        matched=true;
        roomId=child.key;
        partnerName=child.val().nickname;
        remove(ref(db,`lobby/${roomId}`));
        startChat(roomId, partnerName);
      }
    });
  }

  if(!matched){
    const myLobbyRef = push(lobbyRef);
    roomId=myLobbyRef.key;
    await set(myLobbyRef,{nickname,waiting:true});

    partnerWatcher = onValue(ref(db,`rooms/${roomId}/_partner`),(s)=>{
      const val = s.val();
      if(val){
        partnerName=val;
        startChat(roomId, partnerName);
      }
    });

    let dots=0;
    searchingTimer=setInterval(()=>{
      dots=(dots+1)%4;
      searchStatus.textContent="Searching"+ ".".repeat(dots);
    },500);

    btnCancel.onclick=async ()=>{
      await remove(ref(db,`lobby/${roomId}`));
      cleanupWaiting();
      showScreen(screenLogin);
    };
  }
});

function cleanupWaiting(){
  if(partnerWatcher){ partnerWatcher(); partnerWatcher=null; }
  if(searchingTimer){ clearInterval(searchingTimer); searchingTimer=null; }
  stopIcebreakers();
}

function startChat(id, partner){
  cleanupWaiting();
  showScreen(screenChat);
  roomId=id;
  partnerName=partner;

  lblPartner.textContent="??? (nagtatago…)";
  lblPartner.classList.add("pulsate");
  lblReveal.textContent="Reveals in 5:00";
  chatMessages.innerHTML="";

  set(ref(db,`rooms/${roomId}/_partner`),nickname);

  const fiveMin=5*60*1000;
  startRevealCountdown(fiveMin);
  if(revealTimer) clearTimeout(revealTimer);
  revealTimer=setTimeout(()=>{
    lblPartner.textContent=partnerName;
    lblPartner.classList.remove("pulsate");
    addSystem("🎉 Nagpakilala na siya!");
  },fiveMin);

  if(messageWatcher){ messageWatcher(); messageWatcher=null; }
  const msgsRef=ref(db,`rooms/${roomId}/messages`);
  messageWatcher=onChildAdded(msgsRef,(snap)=>{
    const m = snap.val();
    if(!m) return;
    const msgId = snap.key;

    if(m.type==="system") addSystem(m.text);
    else createMessageElement(msgId, m.text, m.sender===nickname, m.reaction);
  });

  push(ref(db, `rooms/${roomId}/messages`), { type: "system", text: "🔔 bagong tambay session! Mag-hi ka na.", ts: Date.now() });

  btnSend.onclick = sendMessage;
  inpMsg.onkeydown = (e)=>{ if(e.key==="Enter") sendMessage(); };

  btnEnd.onclick = endChat;
  btnRematch.onclick = async ()=>{
    await endChat();
    inpName.value=nickname;
    btnJoin.click();
  };
}

/* ---------- Send / End ---------- */
function sendMessage(){
  const t = (inpMsg.value||"").trim();
  if(!t||!roomId) return;
  push(ref(db,`rooms/${roomId}/messages`),{ type:"text", sender:nickname, text:t, ts: Date.now()});
  inpMsg.value="";
}

async function endChat(){
  if(messageWatcher){ messageWatcher(); messageWatcher=null; }
  if(partnerWatcher){ partnerWatcher(); partnerWatcher=null; }
  if(searchingTimer){ clearInterval(searchingTimer); searchingTimer=null; }
  if(icebreakerTimer){ clearInterval(icebreakerTimer); icebreakerTimer=null; }
  if(revealTimer){ clearTimeout(revealTimer); revealTimer=null; }
  if(revealCountdown){ clearInterval(revealCountdown); revealCountdown=null; }

  showScreen(screenLogin);
}

/* ---------- Icebreakers ---------- */
function startIcebreakers(){
  let i = Math.floor(Math.random()*icebreakers.length);
  icebreakerEl.textContent=icebreakers[i];
  icebreakerTimer = setInterval(()=>{
    i=(i+1)%icebreakers.length;
    icebreakerEl.textContent=icebreakers[i];
  },8500);
}

function stopIcebreakers(){ if(icebreakerTimer){ clearInterval(icebreakerTimer); icebreakerTimer=null; } }

/* ---------- Reveal countdown ---------- */
function startRevealCountdown(ms){
  const end=Date.now()+ms;
  if(revealCountdown) clearInterval(revealCountdown);
  revealCountdown=setInterval(()=>{
    const left = Math.max(0,Math.ceil((end-Date.now())/1000));
    const mm = Math.floor(left/60);
    const ss = left%60;
    lblReveal.textContent=`Reveals in ${mm}:${String(ss).padStart(2,"0")}`;
    if(left<=0){ clearInterval(revealCountdown); lblReveal.textContent="Revealed"; }
  },1000);
}

/* ---------- Init ---------- */
showScreen(screenLogin);
updateAvatar("ME");
