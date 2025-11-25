import { db, storage } from "./firebase.js";
import { ref, onValue, push, set, update, remove, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import { uploadFile } from "./upload.js";

const user = JSON.parse(localStorage.getItem("currentUser"));
if (!user) location.href = "/login.html";

let currentChat = null;
let currentChatName = "Friends";

// Elements
const friendList = document.getElementById("friend-list");
const pendingList = document.getElementById("pending-list");
const messagesDiv = document.getElementById("messages");
const messageInput = document.getElementById("message-input");
const fileInput = document.getElementById("file-input");
const chatNameEl = document.getElementById("chat-name");
const myAvatar = document.getElementById("my-avatar");

// Load my profile
onValue(ref(db, `users/${user.username}`), snap => {
  const data = snap.val();
  if (data?.avatar) {
    myAvatar.src = data.avatar;
    localStorage.setItem("myAvatar", data.avatar);
  }
}, { onlyOnce: true });

// Show popup
function showPopup(title, html, buttons) {
  const overlay = document.createElement("div");
  overlay.className = "popup-overlay";
  overlay.innerHTML = `
    <div class="popup">
      <h3>${title}</h3>
      <p>${html}</p>
      <div>${buttons.map(b => `<button class="${b.class}">${b.text}</button>`).join("")}</div>
    </div>`;
  document.body.appendChild(overlay);
  return overlay;
}

// Friend Requests
function sendFriendRequest(target) {
  const reqRef = push(ref(db, `friendRequests/${target}`));
  set(reqRef, { from: user.username, status: "pending", at: serverTimestamp() });
  showPopup("Request Sent", `Friend request sent to @${target}`, [{ text: "OK", class: "accept" }]).onclick = e => e.target.textContent === "OK" && overlay.remove();
}

function acceptRequest(from) {
  update(ref(db, `users/${user.username}/friends`), { [from]: true });
  update(ref(db, `users/${from}/friends`), { [user.username]: true });
  remove(ref(db, `friendRequests/${user.username}/${from}`));
  showPopup("Friend Added", `@${from} is now your friend!`, [{ text: "Awesome!", class: "accept" }]).querySelector("button").onclick = () => location.reload();
}

function declineRequest(from) {
  remove(ref(db, `friendRequests/${user.username}/${from}`));
  showPopup("Request Declined", `Declined @${from}`, [{ text: "OK", class: "decline" }]).onclick = () => overlay.remove();
}

// Load friends & requests
onValue(ref(db, `users/${user.username}/friends`), snap => {
  friendList.innerHTML = "";
  const friends = snap.val() || {};
  Object.keys(friends).forEach(f => {
    const div = document.createElement("div");
    div.className = "friend";
    div.innerHTML = `<img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${f}" alt="">
                     <div><strong>@${f}</strong><br><span style="color:#43b581">Online</span></div>`;
    div.onclick = () => openDM(f);
    friendList.appendChild(div);
  });
});

onValue(ref(db, `friendRequests/${user.username}`), snap => {
  pendingList.innerHTML = "";
  snap.forEach(child => {
    const req = child.val();
    const div = document.createElement("div");
    div.className = "pending-item";
    div.innerHTML = `<img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${req.from}" alt="">
                     <div><strong>@${req.from}</strong> wants to be friends</div>
                     <div class="pending-actions">
                       <button class="accept">Accept</button>
                       <button class="decline">Decline</button>
                     </div>`;
    div.querySelector(".accept").onclick = () => acceptRequest(req.from);
    div.querySelector(".decline").onclick = () => declineRequest(req.from);
    pendingList.appendChild(div);
  });
});

// Open DM
function openDM(username) {
  currentChat = [user.username, username].sort().join("_");
  currentChatName = "@" + username;
  chatNameEl.textContent = currentChatName;
  loadMessages();
}

// Load messages
function loadMessages() {
  messagesDiv.innerHTML = "";
  if (!currentChat) return;
  onValue(ref(db, `dms/${currentChat}`), snap => {
    messagesDiv.innerHTML = "";
    snap.forEach(child => {
      const msg = child.val();
      const div = document.createElement("div");
      div.className = `message ${msg.user === user.username ? "sent" : ""}`;
      div.innerHTML = `
        <img class="avatar" src="${msg.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + msg.user}">
        <div>
          <div class="message-author">${msg.user}</div>
          <div class="message-content">${msg.text || ""}</div>
          ${msg.media ? (msg.media.includes("video") ? `<video src="${msg.media}" controls class="media"></video>` : `<img src="${msg.media}" class="media">`) : ""}
        </div>`;
      messagesDiv.appendChild(div);
    });
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  });
}

// Send message
async function sendMessage() {
  if (!messageInput.value.trim() && !fileInput.files[0]) return;
  let media = null;
  if (fileInput.files[0]) {
    media = await uploadFile(fileInput.files[0]);
    fileInput.value = "";
  }
  const msgRef = push(ref(db, `dms/${currentChat}`));
  await set(msgRef, {
    user: user.username,
    text: messageInput.value,
    avatar: localStorage.getItem("myAvatar") || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`,
    media,
    timestamp: serverTimestamp()
  });
  messageInput.value = "";
}

messageInput.addEventListener("keydown", e => e.key === "Enter" && sendMessage());
document.querySelector(".attach-btn")?.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", sendMessage);

// Settings Tab
document.querySelector(".user-panel").onclick = () => {
  document.querySelector(".main-chat").innerHTML = `
    <div class="settings-page">
      <div class="settings-card">
        <h2>My Account</h2>
        <div class="setting-row">
          <label>Change Avatar</label>
          <input type="file" id="avatar-upload" accept="image/*">
        </div>
        <div class="setting-row">
          <label>Username</label>
          <input type="text" value="${user.username}" disabled>
        </div>
        <div class="setting-row">
          <label>Status</label>
          <select><option>Online</option><option>Away</option><option>Do Not Disturb</option><option>Invisible</option></select>
        </div>
        <button class="logout-btn" id="logout">Logout</button>
      </div>
    </div>`;
  document.getElementById("logout").onclick = () => {
    localStorage.clear();
    location.href = "/login.html";
  };
  document.getElementById("avatar-upload").onchange = async e => {
    const file = e.target.files[0];
    if (file) {
      const url = await uploadFile(file);
      await update(ref(db, `users/${user.username}`), { avatar: url });
      localStorage.setItem("myAvatar", url);
      myAvatar.src = url;
    }
  };
};

// Add friend (click anywhere in input area to add friend)
document.querySelector(".input-area").ondblclick = () => {
  const name = prompt("Enter username to add:");
  if (name) sendFriendRequest(name.trim().toLowerCase());
};

// Init
document.getElementById("app").classList.remove("hidden");
