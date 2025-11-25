import { db } from "./firebase.js";
import { ref, onValue, push, set, update, remove, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import { uploadFile } from "./upload.js";

lucide.createIcons();

const user = JSON.parse(localStorage.getItem("currentUser"));
if (!user) location.href = "/login.html";

document.getElementById("current-user").textContent = user.username;

let currentChat = null;
const friendList = document.getElementById("friend-list");
const pendingList = document.getElementById("pending-list");
const messagesDiv = document.getElementById("messages");
const messageInput = document.getElementById("message-input");
const fileInput = document.getElementById("file-input");
const chatNameEl = document.getElementById("chat-name");
const myAvatar = document.getElementById("my-avatar");

// Load my avatar
onValue(ref(db, `users/${user.username}/avatar`), snap => {
  const url = snap.val() || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`;
  myAvatar.src = url;
}, { onlyOnce: true });

// Show popup
function showPopup(title, msg, buttons = []) {
  const overlay = document.createElement("div");
  overlay.className = "popup-overlay";
  overlay.innerHTML = `<div class="popup"><h3>${title}</h3><p>${msg}</p><div>
    ${buttons.map(b => `<button class="${b.class}">${b.text}</button>`).join("")}
  </div></div>`;
  document.body.appendChild(overlay);
  overlay.onclick = e => {
    if (e.target.tagName === "BUTTON") {
      overlay.remove();
      b.callback?.();
    }
  };
  return overlay;
}

// Friend system
function sendFriendRequest(target) {
  target = target.trim().toLowerCase();
  if (target === user.username) return alert("Can't add yourself");
  const reqRef = ref(db, `friendRequests/${target}/${user.username}`);
  set(reqRef, { from: user.username, at: serverTimestamp() });
  showPopup("Request Sent", `Friend request sent to @${target}`, [{ text: "OK", class: "accept" }]);
}

function acceptRequest(from) {
  update(ref(db, `users/${user.username}/friends`), { [from]: true });
  update(ref(db, `users/${from}/friends`), { [user.username]: true });
  remove(ref(db, `friendRequests/${user.username}/${from}`));
  showPopup("Friend Added", `@${from} is now your friend!`, [{ text: "Yay!", class: "accept" }]);
}

function declineRequest(from) {
  remove(ref(db, `friendRequests/${user.username}/${from}`));
  showPopup("Declined", `Declined @${from}`, [{ text: "OK", class: "decline" }]);
}

// Load friends
onValue(ref(db, `users/${user.username}/friends`), snap => {
  friendList.innerHTML = "";
  const friends = snap.val() || {};
  Object.keys(friends).sort().forEach(f => {
    const div = document.createElement("div");
    div.className = "friend";
    div.innerHTML = `<img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${f}" alt="">
                     <div><strong>@${f}</strong><br><span style="color:#43b581">Online</span></div>`;
    div.onclick = () => openDM(f);
    friendList.appendChild(div);
  });
});

// Load pending requests
onValue(ref(db, `friendRequests/${user.username}`), snap => {
  pendingList.innerHTML = "";
  snap.forEach(child => {
    const from = child.key;
    const div = document.createElement("div");
    div.className = "pending-item";
    div.innerHTML = `<img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${from}" alt="">
                     <div><strong>@${from}</strong> wants to be friends</div>
                     <div class="pending-actions">
                       <button class="accept">Accept</button>
                       <button class="decline">Decline</button>
                     </div>`;
    div.querySelector(".accept").onclick = () => acceptRequest(from);
    div.querySelector(".decline").onclick = () => declineRequest(from);
    pendingList.appendChild(div);
  });
});

// Open DM
function openDM(username) {
  currentChat = [user.username, username].sort().join("_");
  chatNameEl.textContent = "@" + username;
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
          ${msg.media ? `<img src="${msg.media}" class="media" onerror="this.style.display='none'">` : ""}
        </div>`;
      messagesDiv.appendChild(div);
    });
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  });
}

// Send message
async function sendMessage() {
  if (!currentChat) return alert("Select a friend first");
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
    avatar: myAvatar.src,
    media,
    timestamp: serverTimestamp()
  });
  messageInput.value = "";
}

messageInput.addEventListener("keydown", e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendMessage()));
fileInput.addEventListener("change", sendMessage);

// Settings
document.getElementById("settings-btn").onclick = e => {
  e.stopPropagation();
  document.querySelector(".main-chat").innerHTML = `
    <div class="settings-page">
      <div class="settings-card">
        <h2>User Settings</h2>
        <div class="setting-row">
          <label>Change Avatar</label>
          <input type="file" id="avatar-upload" accept="image/*">
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
      if (url) {
        await update(ref(db, `users/${user.username}`), { avatar: url });
        myAvatar.src = url;
      }
    }
  };
};

// Add friend on double click input area
document.querySelector(".input-area").ondblclick = () => {
  const name = prompt("Enter username to add:");
  if (name) sendFriendRequest(name.trim().toLowerCase());
};

document.getElementById("app").classList.remove("hidden");
