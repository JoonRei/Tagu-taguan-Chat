// === Firebase Config & Init ===
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getDatabase, ref, push, onChildAdded, onChildChanged, update
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "YOUR-API-KEY",
  authDomain: "YOUR-FIREBASE-APP.firebaseapp.com",
  databaseURL: "https://YOUR-FIREBASE-APP.firebaseio.com",
  projectId: "YOUR-PROJECT-ID",
  storageBucket: "YOUR-PROJECT-ID.appspot.com",
  messagingSenderId: "YOUR-SENDER-ID",
  appId: "YOUR-APP-ID"
};
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// === Elements ===
const screenLogin = document.getElementById("screenLogin");
const screenWaiting = document.getElementById("screenWaiting");
const screenChat = document.getElementById("screenChat");

const inpName = document.getElementById("inpName");
const btnJoin = document.getElementById("btnJoin");
const btnCancel = document.getElementById("btnCancel");
const btnEnd = document.getElementById("btnEnd");
const btnRematch = document.getElementById("btnRematch");

const chatMessages = document.getElementById("chatMessages");
const inpMsg = document.getElementById("inpMsg");
const btnSend = document.getElementById("btnSend");

const reactionPopup = document.getElementById("reactionPopup");

let myName = "";
let roomId = "testroom"; // adjust for matchmaking logic
let messagesRef = ref(db, `rooms/${roomId}/messages`);

let longPressTimer = null;
let currentTargetMsgId = null;

// === Login ===
btnJoin.addEventListener("click", () => {
  myName = inpName.value.trim();
  if (!myName) return;
  screenLogin.classList.add("hidden");
  screenChat.classList.remove("hidden");
});

btnSend.addEventListener("click", sendMessage);
inpMsg.addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendMessage();
});

function sendMessage() {
  const text = inpMsg.value.trim();
  if (!text) return;
  const msg = {
    sender: myName,
    text,
    timestamp: Date.now(),
    reaction: ""
  };
  push(messagesRef, msg);
  inpMsg.value = "";
}

// === Render Message ===
function renderMessage(msgId, data) {
  let existing = document.getElementById(`msg-${msgId}`);
  const isMe = data.sender === myName;

  if (!existing) {
    const bubble = document.createElement("div");
    bubble.id = `msg-${msgId}`;
    bubble.className = `msg-bubble relative ${isMe ? "me" : "them"}`;
    bubble.innerHTML = `
      <div>${data.text}</div>
      <div class="msg-meta">${isMe ? "You" : data.sender}</div>
      <div class="reaction-display text-lg mt-1"></div>
    `;

    // Long press & right-click event
    bubble.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      showReactionPopup(msgId, bubble, e.pageX, e.pageY);
    });

    bubble.addEventListener("touchstart", (e) => {
      longPressTimer = setTimeout(() => {
        const touch = e.touches[0];
        showReactionPopup(msgId, bubble, touch.pageX, touch.pageY);
      }, 500);
    });
    bubble.addEventListener("touchend", () => clearTimeout(longPressTimer));

    const wrapper = document.createElement("div");
    wrapper.className = `flex ${isMe ? "justify-end" : "justify-start"}`;
    wrapper.appendChild(bubble);
    chatMessages.appendChild(wrapper);
  }

  // Update reaction
  const bubbleEl = document.getElementById(`msg-${msgId}`);
  const reactionEl = bubbleEl.querySelector(".reaction-display");
  reactionEl.textContent = data.reaction || "";
}

// === Firebase Listeners ===
onChildAdded(messagesRef, (snap) => {
  renderMessage(snap.key, snap.val());
  chatMessages.scrollTop = chatMessages.scrollHeight;
});

onChildChanged(messagesRef, (snap) => {
  renderMessage(snap.key, snap.val());
});

// === Reaction Popup ===
function showReactionPopup(msgId, bubble, x, y) {
  currentTargetMsgId = msgId;
  reactionPopup.style.left = `${x}px`;
  reactionPopup.style.top = `${y - 50}px`;
  reactionPopup.classList.remove("hidden");
}

// Close popup on outside click
document.addEventListener("click", (e) => {
  if (!reactionPopup.contains(e.target)) {
    reactionPopup.classList.add("hidden");
  }
});

// Reaction select
document.querySelectorAll(".reactionBtn").forEach(btn => {
  btn.addEventListener("click", () => {
    const reaction = btn.dataset.reaction;
    if (!currentTargetMsgId) return;

    const updateData = {};
    updateData[`rooms/${roomId}/messages/${currentTargetMsgId}/reaction`] = reaction;
    update(ref(db), updateData);

    reactionPopup.classList.add("hidden");

    // If it's my own message, spawn floaty
    const msgEl = document.getElementById(`msg-${currentTargetMsgId}`);
    if (msgEl && msgEl.classList.contains("me")) {
      spawnFloaty(reaction, msgEl);
    }
  });
});

// === Floaty Animation ===
function spawnFloaty(reaction, targetEl) {
  const floaty = document.createElement("div");
  floaty.className = "floaty";
  floaty.textContent = reaction;
  const rect = targetEl.getBoundingClientRect();
  floaty.style.left = `${rect.left + rect.width / 2}px`;
  floaty.style.top = `${rect.top}px`;
  document.body.appendChild(floaty);

  setTimeout(() => {
    floaty.remove();
  }, 900);
}
