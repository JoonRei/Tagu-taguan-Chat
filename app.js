import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, push, onChildAdded, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

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

/* DOM */
const screenLogin=document.getElementById("screenLogin");
const screenChat=document.getElementById("screenChat");
const inpName=document.getElementById("inpName");
const btnJoin=document.getElementById("btnJoin");
const chatMessages=document.getElementById("chatMessages");
const inpMsg=document.getElementById("inpMsg");
const btnSend=document.getElementById("btnSend");
const lblPartner=document.getElementById("lblPartner");
const lblReveal=document.getElementById("lblReveal");

/* State */
let nickname="", roomId="demo-room", messageWatcher=null;

/* Helpers */
function showScreen(screen){
  [screenLogin, screenChat].forEach(s=>s.classList.add("hidden"));
  screen.classList.remove("hidden");
}
function scrollToBottom(){ chatMessages.scrollTop = chatMessages.scrollHeight; }

/* Add message */
function addMessage(msgId, text, senderIsMe, reaction=null){
  const wrapper=document.createElement("div");
  wrapper.className=`msg-wrapper ${senderIsMe?"me":"them"}`;

  const bubble=document.createElement("div");
  bubble.className="msg-bubble "+(senderIsMe?"me":"them");
  bubble.innerText=text;

  const badge=document.createElement("div");
  badge.className="reaction-badge";
  badge.textContent=reaction||"";
  if(!reaction) badge.style.display="none";

  wrapper.appendChild(bubble);
  wrapper.appendChild(badge);
  chatMessages.appendChild(wrapper);
  scrollToBottom();

  // Long press to react
  let pressTimer;
  const startPress=e=>{ e.preventDefault(); pressTimer=setTimeout(()=>showReactionPopup(bubble,msgId,badge),500);}
  const endPress=()=>clearTimeout(pressTimer);

  bubble.addEventListener("mousedown",startPress);
  bubble.addEventListener("mouseup",endPress);
  bubble.addEventListener("mouseleave",endPress);
  bubble.addEventListener("touchstart",startPress);
  bubble.addEventListener("touchend",endPress);
}

/* Reaction popup */
function showReactionPopup(bubble,msgId,badgeEl){
  const existing=document.getElementById("reaction-popup");
  if(existing) existing.remove();

  const rect=bubble.getBoundingClientRect();
  const popup=document.createElement("div");
  popup.id="reaction-popup";
  popup.className="flex gap-2 bg-white rounded-full shadow p-2 fixed z-50";

  let top=rect.bottom+window.scrollY+6;
  let left=rect.left+window.scrollX+rect.width/2;
  if(left+120>window.innerWidth) left=window.innerWidth-120;
  if(left<60) left=60;
  popup.style.top=top+"px";
  popup.style.left=left+"px";
  popup.style.transform="translateX(-50%)";

  ["👍","❤️","😂","😮","😢","👏"].forEach(r=>{
    const btn=document.createElement("button");
    btn.textContent=r;
    btn.className="text-xl hover:scale-125 transition-transform";
    btn.onclick=async()=>{
      await update(ref(db,`rooms/${roomId}/messages/${msgId}`),{reaction:r});
      badgeEl.textContent=r;
      badgeEl.style.display="block";
      popup.remove();
    };
    popup.appendChild(btn);
  });

  document.body.appendChild(popup);
  setTimeout(()=>document.addEventListener("click",function handler(e){
    if(!popup.contains(e.target)){
      popup.remove();
      document.removeEventListener("click",handler);
    }
  }),0);
}

/* Join chat */
btnJoin.addEventListener("click",()=>{
  nickname=(inpName.value||"").trim()||`Player${Math.floor(Math.random()*900)+100}`;
  showScreen(screenChat);
  chatMessages.innerHTML="";

  // Listen messages
  const msgsRef=ref(db,`rooms/${roomId}/messages`);
  messageWatcher=onChildAdded(msgsRef,snap=>{
    const m=snap.val(); if(!m) return;
    addMessage(snap.key,m.text,m.sender===nickname,m.reaction);
  });
});

/* Send message */
btnSend.onclick=sendMessage;
inpMsg.onkeydown=e=>{ if(e.key==="Enter") sendMessage(); }
function sendMessage(){
  const t=(inpMsg.value||"").trim(); if(!t||!roomId) return;
  push(ref(db,`rooms/${roomId}/messages`),{type:"text",text:t,sender:nickname,ts:Date.now()});
  inpMsg.value="";
}
