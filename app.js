import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, push, set, onChildAdded, get, remove, onValue, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

/* ---------- Firebase Config ---------- */
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
const inpName = document.getElementById("inpName");
const btnJoin = document.getElementById("btnJoin");

const chatMessages = document.getElementById("chatMessages");
const inpMsg = document.getElementById("inpMsg");
const btnSend = document.getElementById("btnSend");

const lblPartner = document.getElementById("lblPartner");
const lblReveal = document.getElementById("lblReveal");
const btnEnd = document.getElementById("btnEnd");
const btnRematch = document.getElementById("btnRematch");

/* ---------- State ---------- */
let nickname = "", roomId = null, partnerName = "";
let partnerWatcher = null, messageWatcher = null;
let revealTimer = null, revealCountdown = null;

/* ---------- Helpers ---------- */
function showScreenLogin() { screenLogin.style.display = "flex"; }
function hideScreenLogin() { screenLogin.style.display = "none"; }
function scrollToBottom() { chatMessages.scrollTop = chatMessages.scrollHeight; }

function addSystem(text){
  const el = document.createElement("div");
  el.className = "system-msg";
  el.innerText = text;
  chatMessages.appendChild(el);
  scrollToBottom();
}

function addMessage(msgId, text, senderIsMe, reaction=null){
  const wrapper = document.createElement("div");
  wrapper.className = `msg-wrapper ${senderIsMe ? "me" : "them"}`;

  const bubble = document.createElement("div");
  bubble.className = `msg-bubble ${senderIsMe ? "me" : "them"}`;
  bubble.innerText = text;

  const badge = document.createElement("div");
  badge.className = "reaction-badge";
  badge.textContent = reaction || "";
  badge.style.display = reaction ? "inline-block" : "none";

  wrapper.appendChild(bubble);
  wrapper.appendChild(badge);
  chatMessages.appendChild(wrapper);
  scrollToBottom();

  // Long press for reaction
  let pressTimer;
  const startPress = e => { e.preventDefault(); pressTimer = setTimeout(()=>showReactionPopup(bubble, msgId, badge),500); }
  const endPress = () => clearTimeout(pressTimer);

  bubble.addEventListener("mousedown", startPress);
  bubble.addEventListener("mouseup", endPress);
  bubble.addEventListener("mouseleave", endPress);
  bubble.addEventListener("touchstart", startPress);
  bubble.addEventListener("touchend", endPress);
}

function showReactionPopup(bubble, msgId, badgeEl){
  const existing = document.getElementById("reaction-popup");
  if(existing) existing.remove();

  const rect = bubble.getBoundingClientRect();
  const popup = document.createElement("div");
  popup.id = "reaction-popup";
  popup.className = "flex gap-2 bg-white rounded-full shadow p-2 fixed z-50";

  // position below the bubble and adjust for left/right edges
  let left = rect.left + rect.width/2;
  if(left < 50) left = 50;
  if(left > window.innerWidth-50) left = window.innerWidth-50;
  popup.style.top = rect.bottom + window.scrollY + 8 + "px";
  popup.style.left = left + "px";
  popup.style.transform = "translateX(-50%)";

  const reactions = ["👍","❤️","😂","😮","😢","👏"];
  reactions.forEach(r => {
    const btn = document.createElement("button");
    btn.className = "text-xl hover:scale-125 transition-transform";
    btn.textContent = r;
    btn.onclick = async ()=>{
      await update(ref(db, `rooms/${roomId}/messages/${msgId}`), { reaction: r });
      badgeEl.textContent = r;
      badgeEl.style.display = "inline-block";
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

/* ---------- Join / Chat ---------- */
btnJoin.onclick = async ()=>{
  nickname = (inpName.value||"").trim() || `Player${Math.floor(Math.random()*900)+100}`;
  hideScreenLogin();

  // Join lobby and match logic...
  // For simplicity, you can re-use your existing matchmaking logic here
  // After roomId and partnerName are set, start listening to messages:

  const msgsRef = ref(db, `rooms/${roomId}/messages`);
  messageWatcher = onChildAdded(msgsRef, snap=>{
    const m = snap.val();
    if(!m) return;
    const msgId = snap.key;
    if(m.type==="system") addSystem(m.text);
    else addMessage(msgId, m.text, m.sender===nickname, m.reaction);
  });
};

btnSend.onclick = ()=>{
  const text = inpMsg.value.trim();
  if(!text || !roomId) return;
  push(ref(db, `rooms/${roomId}/messages`), { type:"text", sender:nickname, text:text, ts:Date.now()});
  inpMsg.value="";
};

/* ---------- Reveal Countdown ---------- */
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
showScreenLogin();
