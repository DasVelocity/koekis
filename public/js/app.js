import { db, storage } from "./firebase.js";
import {
  ref, set, push, onValue, serverTimestamp, get
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import { ref as sRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js";

const user = JSON.parse(localStorage.getItem("currentUser"));
if (!user) location.href = "/login.html";

let currentChat = null;

// user reference
const userRef = ref(db, `users/${user.username}`);

// Sync avatars from DB
onValue(userRef, snap => {
  const data = snap.val() || {};
  const pfp = data.pfp || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`;
  document.getElementById("pfp-preview").src = pfp;
  document.querySelectorAll(".avatar").forEach(img => img.src = pfp);
  document.querySelector(".chat-header img").src = pfp;
  localStorage.setItem("avatar", pfp);
});

// Upload PFP
document.getElementById("pfp-input").onchange = async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const storageRef = sRef(storage, `pfps/${user.username}_${Date.now()}`);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  await set(ref(db, `users/${user.username}/pfp`), url);
  document.getElementById("pfp-preview").src = url;
  document.querySelectorAll(".avatar").forEach(img => img.src = url);
  localStorage.setItem("avatar", url);
};

// Tabs and expand settings
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    const tab = btn.dataset.tab;
    document.querySelectorAll("#friends,#groups,#settings").forEach(p => p.classList.add("hidden"));
    document.getElementById(tab).classList.remove("hidden");

    const sidebar = document.querySelector(".sidebar");
    if (tab === "settings") sidebar.classList.add("big-settings");
    else sidebar.classList.remove("big-settings");
  };
});

// Load users into friends list
onValue(ref(db, "users"), snap => {
  const list = document.getElementById("friends");
  list.innerHTML = "";
  snap.forEach(child => {
    if (child.key !== user.username) {
      const data = child.val() || {};
      const pfpUrl = data.pfp || `https://api.dicebear.com/7.x/avataaars/svg?seed=${child.key}`;
      const div = document.createElement("div");
      div.className = "friend online";
      div.innerHTML = `
        <img src="${pfpUrl}" alt="" class="avatar-small">
        <div class="friend-meta"><strong>${child.key}</strong></div>
        <button class="add-friend" data-username="${child.key}">Add</button>
      `;
      div.querySelector(".add-friend").onclick = e => {
        e.stopPropagation();
        addFriend(child.key);
      };
      div.onclick = () => openDM(child.key);
      list.appendChild(div);
    }
  });
});

// Open DM
function openDM(username) {
  currentChat = username;
  document.getElementById("chat-name").textContent = username;
  document.querySelector(".input-area").style.display = "flex";
  loadMessages();
}

// Load DM messages
function loadMessages() {
  if (!currentChat) return;
  const channelId = [user.username, currentChat].sort().join("_");
  const msgRef = ref(db, `dms/${channelId}`);
  onValue(msgRef, snap => {
    const div = document.getElementById("messages");
    div.innerHTML = "";
    snap.forEach(child => {
      const m = child.val();
      const msgDiv = document.createElement("div");
      msgDiv.className = `message ${m.user === user.username ? "sent" : ""}`;
      const avatar = m.pfp || `https://api.dicebear.com/7.x/avataaars/svg?seed=${m.user}`;
      msgDiv.innerHTML = `
        <img class="avatar" src="${avatar}">
        <div>
          <div class="message-bubble">${m.text || ""}</div>
          ${m.media ? `<img src="${m.media}" class="media">` : ""}
        </div>`;
      div.appendChild(msgDiv);
    });
    div.scrollTop = div.scrollHeight;
  });
}

// Send message
const messageInput = document.getElementById("message-input");
const messageForm = document.getElementById("message-form");

messageForm?.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  await sendMessage();
});

messageInput.onkeydown = async e => {
  if (e.key === "Enter") {
    e.preventDefault();
    await sendMessage();
  }
};

async function sendMessage() {
  if (!currentChat) return alert("Select a chat first");
  const text = messageInput.value.trim();
  if (!text) return;
  const channelId = [user.username, currentChat].sort().join("_");
  const msgRef = push(ref(db, `dms/${channelId}`));
  const snap = await get(userRef);
  const myPfp = snap.val()?.pfp || localStorage.getItem("avatar") || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`;
  await set(msgRef, {
    user: user.username,
    text,
    pfp: myPfp,
    timestamp: serverTimestamp()
  });
  messageInput.value = "";
}

// Add friend function
async function addFriend(friendUsername) {
  const friendSnap = await get(ref(db, `users/${friendUsername}`));
  if (!friendSnap.exists()) return alert("User not found");
  await set(ref(db, `users/${user.username}/friends/${friendUsername}`), true);
  alert(`${friendUsername} added to your friends list.`);
}

// Add friend input in Settings
document.getElementById("add-friend-btn")?.addEventListener("click", async e => {
  e.preventDefault();
  const name = document.getElementById("add-friend-input").value.trim();
  if (!name) return alert("Enter a username");
  await addFriend(name);
  document.getElementById("add-friend-input").value = "";
});

// Show app
document.getElementById("app").classList.remove("hidden");
