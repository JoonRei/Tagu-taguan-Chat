// app.js - vanilla JS + Firebase Realtime Database
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, push, set, onChildAdded, get, remove, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

/* -------------------------
   FIREBASE CONFIG
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
const reactionBtns = Array.from(document.querySelectorAll(".reactionBtn"));

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
  const initials = (name || "ME").split(" ").map(s => s[0]).slice(0, 2).join("").toUpperCase();
  meAvatar.textContent = initials;
}
function scrollToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addBubble(text, senderIsMe = false) {
  const wrapper = document.createElement("div");
  wrapper.className = senderIsMe ? "flex justify-end" : "flex justify-start";
  const bubble = document.createElement("div");
  bubble.className = "msg-bubble " + (senderIsMe ? "me" : "them");
  bubble.innerText = text;

  // Long-press for quick reactions
  let pressTimer;
  bubble.addEventListener("mousedown", () => {
    pressTimer = setTimeout(() => showReactionMenu(bubble), 600);
  });
  bubble.addEventListener("mouseup", () => clearTimeout(pressTimer));
  bubble.addEventListener("mouseleave", () => clearTimeout(pressTimer));

  wrapper.appendChild(bubble);
  chatMessages.appendChild(wrapper);
  scrollToBottom();
}
function addSystem(text) {
  const el = document.createElement("div");
  el.className = "text-center text-xs text-slate-500";
  el.innerText = text;
  chatMessages.appendChild(el);
  scrollToBottom();
}

function spawnFloaty(emoji) {
  const el = document.createElement("div");
  el.className = "floaty";
  const left = Math.random() * (chatMessages.clientWidth - 60) + 20;
  el.style.left = left + "px";
  el.style.bottom = "18px";
  el.innerText = emoji;
  chatMessages.appendChild(el);
  setTimeout(() => el.remove(), 900);
}

function smallConfetti() {
  for (let i = 0; i < 14; i++) {
    const p = document.createElement("div");
    p.style.position = "absolute";
    p.style.width = (4 + Math.random() * 8) + "px";
    p.style.height = (6 + Math.random() * 8) + "px";
    p.style.background = ["#fff", "#ffd59f", "#ffb265", "#ffd8a8"][Math.floor(Math.random() * 4)];
    p.style.left = (30 + Math.random() * 40) + "%";
    p.style.bottom = "6px";
    p.style.opacity = "1";
    p.style.transform = `translateY(0) rotate(${Math.random() * 360}deg)`;
    p.style.transition = "transform 900ms cubic-bezier(.2,.9,.2,1), opacity 900ms";
    document.body.appendChild(p);
    setTimeout(() => {
      p.style.transform = `translateY(-140px) translateX(${(Math.random() * 160 - 80)}px) rotate(${Math.random() * 720}deg) scale(.9)`;
      p.style.opacity = 0;
    }, 10);
    setTimeout(() => p.remove(), 1100);
  }
}

let pressTimer;
let selectedMessageEl;

document.addEventListener('mousedown', (e) => {
  if (e.target.classList.contains('message-bubble')) {
    selectedMessageEl = e.target;
    pressTimer = setTimeout(() => {
      showReactionPicker(e.pageX, e.pageY);
    }, 500); // long press duration
  }
});

document.addEventListener('mouseup', () => clearTimeout(pressTimer));

function showReactionPicker(x, y) {
  const picker = document.getElementById('reactionPicker');
  picker.style.left = `${x}px`;
  picker.style.top = `${y - 40}px`;
  picker.classList.remove('hidden');
}

// Choose reaction
document.querySelectorAll('.reactionOption').forEach(opt => {
  opt.addEventListener('click', () => {
    const reaction = document.createElement('div');
    reaction.className = 'text-sm mt-1';
    reaction.textContent = opt.textContent;
    selectedMessageEl.appendChild(reaction);
    document.getElementById('reactionPicker').classList.add('hidden');
  });
});


/* ---------- Long Press Reaction Menu ---------- */
function showReactionMenu(bubble) {
  const menu = document.createElement("div");
  menu.className = "absolute bg-white border border-gray-200 rounded-lg shadow-md flex gap-2 p-2 z-50";
  menu.style.top = (bubble.getBoundingClientRect().top - 50 + window.scrollY) + "px";
  menu.style.left = (bubble.getBoundingClientRect().left) + "px";

  ["❤️", "😂", "😮", "👍", "🔥"].forEach(emoji => {
    const btn = document.createElement("button");
    btn.textContent = emoji;
    btn.className = "text-2xl hover:scale-125 transition";
    btn.onclick = () => {
      push(ref(db, `rooms/${roomId}/messages`), { type: "reaction", emoji, ts: Date.now() });
      spawnFloaty(emoji);
      menu.remove();
    };
    menu.appendChild(btn);
  });

  document.body.appendChild(menu);
  document.addEventListener("click", () => menu.remove(), { once: true });
}

/* ---------- Matchmaking ---------- */
btnJoin.addEventListener("click", async () => {
  nickname = (inpName.value || "").trim() || `Player${Math.floor(Math.random() * 900) + 100}`;
  updateAvatar(nickname);
  showScreen(screenWaiting);
  startIcebreakers();

  const lobbyRef = ref(db, "lobby");
  const snap = await get(lobbyRef);
  let matched = false;

  if (snap.exists()) {
    snap.forEach(child => {
      if (!matched && child.val().waiting) {
        matched = true;
        roomId = child.key;
        partnerName = child.val().nickname;
        remove(ref(db, `lobby/${roomId}`));
        startChat(roomId, partnerName);
      }
    });
  }

  if (!matched) {
    const myLobbyRef = push(lobbyRef);
    roomId = myLobbyRef.key;
    await set(myLobbyRef, { nickname, waiting: true });

    partnerWatcher = onValue(ref(db, `rooms/${roomId}/_partner`), (s) => {
      const val = s.val();
      if (val) {
        partnerName = val;
        startChat(roomId, partnerName);
      }
    });

    let dots = 0;
    searchingTimer = setInterval(() => {
      dots = (dots + 1) % 4;
      searchStatus.textContent = "Searching" + ".".repeat(dots);
    }, 500);

    btnCancel.onclick = async () => {
      await remove(ref(db, `lobby/${roomId}`));
      cleanupWaiting();
      showScreen(screenLogin);
    };
  }
});

function cleanupWaiting() {
  if (partnerWatcher) { partnerWatcher(); partnerWatcher = null; }
  if (searchingTimer) { clearInterval(searchingTimer); searchingTimer = null; }
  stopIcebreakers();
}

/* ---------- Start Chat ---------- */
function startChat(id, partner) {
  cleanupWaiting();
  showScreen(screenChat);
  roomId = id;
  partnerName = partner;

  lblPartner.textContent = "??? (nagtatago…)";
  lblPartner.classList.add("pulsate");
  lblReveal.textContent = "Reveals in 5:00";
  chatMessages.innerHTML = "";

  set(ref(db, `rooms/${roomId}/_partner`), nickname);

  const fiveMin = 5 * 60 * 1000;
  startRevealCountdown(fiveMin);
  if (revealTimer) clearTimeout(revealTimer);
  revealTimer = setTimeout(() => {
    lblPartner.textContent = partnerName;
    lblPartner.classList.remove("pulsate");
    addSystem("🎉 Nagpakilala na siya!");
    smallConfetti();
  }, fiveMin);

  if (messageWatcher) { messageWatcher(); messageWatcher = null; }
  const msgsRef = ref(db, `rooms/${roomId}/messages`);
  messageWatcher = onChildAdded(msgsRef, (snap) => {
    const m = snap.val();
    if (!m) return;
    if (m.type === "reaction") {
      spawnFloaty(m.emoji || "👍");
      return;
    }
    if (m.type === "system") {
      addSystem(m.text);
      return;
    }
    if (m.text) addBubble(m.text, m.sender === nickname);
  });

  push(ref(db, `rooms/${roomId}/messages`), { type: "system", text: "🔔 bagong tambay session! Mag-hi ka na.", ts: Date.now() });

  btnSend.onclick = sendMessage;
  inpMsg.onkeydown = (e) => { if (e.key === "Enter") sendMessage(); };

  btnEnd.onclick = endChat;
  btnRematch.onclick = async () => {
    await endChat();
    inpName.value = nickname;
    btnJoin.click();
  };

  reactionBtns.forEach(btn => {
    btn.onclick = () => {
      push(ref(db, `rooms/${roomId}/messages`), { type: "reaction", emoji: btn.textContent, ts: Date.now() });
      spawnFloaty(btn.textContent);
    };
  });
}

function startRevealCountdown(ms) {
  const end = Date.now() + ms;
  if (revealCountdown) clearInterval(revealCountdown);
  revealCountdown = setInterval(() => {
    const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
    const mm = Math.floor(left / 60);
    const ss = left % 60;
    lblReveal.textContent = `Reveals in ${mm}:${String(ss).padStart(2, "0")}`;
    if (left <= 0) { clearInterval(revealCountdown); lblReveal.textContent = "Revealed"; }
  }, 1000);
}

/* ---------- Send / End ---------- */
function sendMessage() {
  const t = (inpMsg.value || "").trim();
  if (!t || !roomId) return;
  push(ref(db, `rooms/${roomId}/messages`), { type: "text", sender: nickname, text: t, ts: Date.now() });
  inpMsg.value = "";
}

async function endChat() {
  if (messageWatcher) { messageWatcher(); messageWatcher = null; }
  if (partnerWatcher) { partnerWatcher(); partnerWatcher = null; }
  if (searchingTimer) { clearInterval(searchingTimer); searchingTimer = null; }
  if (icebreakerTimer) { clearInterval(icebreakerTimer); icebreakerTimer = null; }
  if (revealTimer) { clearTimeout(revealTimer); revealTimer = null; }
  if (revealCountdown) { clearInterval(revealCountdown); revealCountdown = null; }

  inpName.value = ""; // clear nickname when back to login
  showScreen(screenLogin);
}

/* ---------- Icebreakers ---------- */
function startIcebreakers() {
  let i = Math.floor(Math.random() * icebreakers.length);
  icebreakerEl.textContent = icebreakers[i];
  icebreakerTimer = setInterval(() => {
    i = (i + 1) % icebreakers.length;
    icebreakerEl.textContent = icebreakers[i];
  }, 8500);
}
function stopIcebreakers() { if (icebreakerTimer) { clearInterval(icebreakerTimer); icebreakerTimer = null; } }

/* ---------- Init ---------- */
showScreen(screenLogin);
updateAvatar("ME");

