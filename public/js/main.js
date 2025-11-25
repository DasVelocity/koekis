import { db } from "./firebase.js";
import { ref, set, push, onValue, serverTimestamp, query, orderByChild, remove, update } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import { uploadFile } from "./upload.js";

const user = JSON.parse(localStorage.getItem("currentUser"));
if (!user) location.href = "/login.html";

document.getElementById("current-user").textContent = user.username;

// Profile pic
const avatarUrl = localStorage.getItem("avatar") || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`;
document.querySelectorAll(".avatar").forEach(img => img.src = avatarUrl);

// File input
const fileInput = document.createElement("input");
fileInput.type = "file";
fileInput.accept = "image/*,video/*";
fileInput.style.display = "none";
document.body.appendChild(fileInput);

// Send message
document.getElementById("message-form").onsubmit = async e => {
  e.preventDefault();
  const input = document.getElementById("message-input");
  if (!input.value.trim() && !fileInput.files[0]) return;

  let mediaUrl = null;
  if (fileInput.files[0]) {
    mediaUrl = await uploadFile(fileInput.files[0]);
    fileInput.value = "";
  }

  const msgRef = push(ref(db, `messages/${currentChannel}`));
  set(msgRef, {
    user: user.username,
    text: input.value,
    media: mediaUrl,
    timestamp: serverTimestamp()
  });
  input.value = "";
};

// Load messages
let currentChannel = "general";
function loadMessages() {
  const messagesDiv = document.getElementById("messages");
  onValue(ref(db, `messages/${currentChannel}`), snap => {
    messagesDiv.innerHTML = "";
    snap.forEach(child => {
      const msg = child.val();
      const div = document.createElement("div");
      div.className = `message ${msg.user === user.username ? "sent" : ""}`;
      div.innerHTML = `
        <img class="avatar" src="https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.user}">
        <div>
          <div class="message-author">${msg.user}</div>
          <div class="message-content">${msg.text || ""}</div>
          ${msg.media ? (msg.media.includes("video") ? `<video src="${msg.media}" controls class="media"></video>` : `<img src="${msg.media}" class="media">`) : ""}
        </div>
      `;
      messagesDiv.appendChild(div);
    });
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  });
}

// Switch channel
document.querySelectorAll(".channel").forEach(ch => {
  ch.onclick = () => {
    document.querySelectorAll(".channel").forEach(c => c.classList.remove("active"));
    ch.classList.add("active");
    currentChannel = ch.dataset.id || "general";
    document.getElementById("room-name").textContent = ch.textContent;
    loadMessages();
  };
});

// Attach file
document.querySelector(".input-area").onclick = () => fileInput.click();
fileInput.onchange = () => {
  if (fileInput.files[0]) document.getElementById("message-form").requestSubmit();
};

// Init
loadMessages();
document.getElementById("app").classList.remove("hidden");