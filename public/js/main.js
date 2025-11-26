import { db } from "./firebase.js";
import { ref, onValue, push, set, update, remove, serverTimestamp, get } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import { uploadFile } from "./upload.js";

lucide.createIcons();

const user = JSON.parse(localStorage.getItem("currentUser"));
if (!user) location.href = "/login.html";

// State
let currentChat = null;
let currentChatType = null;
let friendCache = [];

// DOM Elements
const els = {
  app: document.getElementById("app"),
  messages: document.getElementById("messages"),
  msgInput: document.getElementById("message-input"),
  fileInput: document.getElementById("file-input"),
  chatName: document.getElementById("chat-name"),
  myAvatar: document.getElementById("my-avatar"),
  settingAvatar: document.getElementById("settings-avatar-preview"),
  friendList: document.getElementById("friend-list"),
  groupList: document.getElementById("group-list"),
  inputArea: document.getElementById("input-area"),
  overlays: {
    settings: document.getElementById("settings-overlay"),
    requests: document.getElementById("requests-overlay"),
    group: document.getElementById("group-overlay")
  }
};

// Initial Setup
els.app.classList.remove("hidden");
document.getElementById("current-user").textContent = "@" + user.username;

// 1. User Profile Listener
onValue(ref(db, `users/${user.username}`), s => {
  const data = s.val() || {};
  const pfp = data.avatar || "/default.png";
  els.myAvatar.src = pfp;
  els.settingAvatar.src = pfp;
});

// 2. Load Friends
onValue(ref(db, `users/${user.username}/friends`), s => {
  els.friendList.innerHTML = "";
  friendCache = [];
  const data = s.val() || {};
  
  Object.keys(data).forEach(f => {
    friendCache.push(f);
    // Fetch friend details for realtime PFP updates
    onValue(ref(db, `users/${f}`), friendSnap => {
      const fData = friendSnap.val() || {};
      const existingEl = document.getElementById(`friend-nav-${f}`);
      const pfp = fData.avatar || "/default.png";
      const html = `<img src="${pfp}"><span>${f}</span>`;
      
      if (existingEl) {
        existingEl.innerHTML = html;
      } else {
        const div = document.createElement("div");
        div.className = "nav-item";
        div.id = `friend-nav-${f}`;
        div.innerHTML = html;
        div.onclick = () => openChat(f, "dm");
        els.friendList.appendChild(div);
      }
    });
  });
});

// 3. Load Groups
onValue(ref(db, "groups"), s => {
  els.groupList.innerHTML = "";
  s.forEach(gSnap => {
    const g = gSnap.val();
    if (g.members && g.members[user.username]) {
      const div = document.createElement("div");
      div.className = "nav-item";
      div.innerHTML = `<i data-lucide="hash" style="width:20px;color:#a1a1aa"></i><span>${g.name}</span>`;
      div.onclick = () => openChat(gSnap.key, "group", g.name);
      els.groupList.appendChild(div);
      lucide.createIcons();
    }
  });
});

// 4. Friend Requests
onValue(ref(db, `friendRequests/${user.username}`), s => {
  const count = s.size;
  const badge = document.getElementById("pending-badge");
  if (count > 0) badge.classList.remove("hidden");
  else badge.classList.add("hidden");
  
  const list = document.getElementById("pending-list");
  list.innerHTML = "";
  
  if (count === 0) list.innerHTML = "<div style='padding:20px;text-align:center;color:#666'>No pending requests</div>";

  s.forEach(req => {
    const from = req.key;
    const div = document.createElement("div");
    div.className = "list-item";
    div.innerHTML = `
      <div class="item-user">
        <span style="font-weight:600">@${from}</span>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn-primary accept">Accept</button>
        <button class="btn-secondary decline">Reject</button>
      </div>
    `;
    div.querySelector(".accept").onclick = async () => {
      await update(ref(db, `users/${user.username}/friends`), { [from]: true });
      await update(ref(db, `users/${from}/friends`), { [user.username]: true });
      await remove(ref(db, `friendRequests/${user.username}/${from}`));
    };
    div.querySelector(".decline").onclick = async () => {
      await remove(ref(db, `friendRequests/${user.username}/${from}`));
    };
    list.appendChild(div);
  });
});

// 5. Chat Logic
function openChat(id, type, name = null) {
  currentChat = type === "dm" ? [user.username, id].sort().join("_") : id;
  currentChatType = type;
  
  els.chatName.textContent = type === "dm" ? "@" + id : "# " + name;
  els.inputArea.classList.remove("hidden");
  
  // Highlight active
  document.querySelectorAll(".nav-item").forEach(i => i.classList.remove("active"));
  if (type === "dm") document.getElementById(`friend-nav-${id}`)?.classList.add("active");
  
  els.messages.innerHTML = "";
  
  const path = type === "group" ? `groups/${id}/messages` : `dms/${currentChat}`;
  onValue(ref(db, path), s => {
    els.messages.innerHTML = "";
    s.forEach(msgSnap => {
      const m = msgSnap.val();
      renderMessage(m);
    });
    scrollToBottom();
  });
}

function renderMessage(m) {
  const div = document.createElement("div");
  const isMe = m.user === user.username;
  div.className = `message ${isMe ? "sent" : ""}`;
  
  const pfp = m.avatar || "/default.png";
  
  div.innerHTML = `
    <img src="${pfp}" class="message-avatar">
    <div class="message-content-wrapper">
      <div class="message-meta">${m.user}</div>
      ${m.text ? `<div class="message-bubble">${m.text}</div>` : ""}
      ${m.media ? `<img src="${m.media}" class="media-attachment">` : ""}
    </div>
  `;
  els.messages.appendChild(div);
}

function scrollToBottom() {
  els.messages.scrollTop = els.messages.scrollHeight;
}

// 6. Sending Messages
async function sendMessage() {
  if (!currentChat) return;
  const txt = els.msgInput.value.trim();
  const file = els.fileInput.files[0];
  
  if (!txt && !file) return;
  
  let mediaUrl = null;
  if (file) {
    mediaUrl = await uploadFile(file);
    els.fileInput.value = "";
  }
  
  const path = currentChatType === "group" ? `groups/${currentChat}/messages` : `dms/${currentChat}`;
  const myPfp = els.myAvatar.src; // Use current src as snapshot
  
  await push(ref(db, path), {
    user: user.username,
    text: txt,
    media: mediaUrl,
    avatar: myPfp,
    timestamp: serverTimestamp()
  });
  
  els.msgInput.value = "";
  scrollToBottom();
}

els.msgInput.onkeydown = (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
};
document.getElementById("send-btn").onclick = sendMessage;

// 7. Modals & Overlays Logic
function toggleModal(id, show) {
  const el = els.overlays[id];
  if (show) el.classList.remove("hidden");
  else el.classList.add("hidden");
}

// Settings
document.getElementById("settings-trigger").onclick = () => toggleModal("settings", true);
document.getElementById("close-settings").onclick = () => toggleModal("settings", false);

document.getElementById("avatar-upload").onchange = async (e) => {
  const file = e.target.files[0];
  if (file) {
    const url = await uploadFile(file);
    if (url) {
      await update(ref(db, `users/${user.username}`), { avatar: url });
      alert("Avatar updated!");
    }
  }
};

document.getElementById("logout-btn").onclick = () => {
  localStorage.clear();
  location.href = "/login.html";
};

// Friend Requests Button
document.getElementById("pending-btn").onclick = () => toggleModal("requests", true);
document.getElementById("close-requests").onclick = () => toggleModal("requests", false);

// Add Friend Action
document.getElementById("add-friend-btn").onclick = async () => {
  const name = prompt("Enter username to add:");
  if (!name) return;
  const target = name.trim().toLowerCase();
  
  if (target === user.username) return alert("Cannot add yourself");
  
  const snap = await get(ref(db, `users/${target}`));
  if (!snap.exists()) return alert("User not found");
  
  await set(ref(db, `friendRequests/${target}/${user.username}`), { from: user.username });
  alert("Request sent!");
};

// Create Group
const createGroupBtn = document.createElement("div");
createGroupBtn.className = "nav-label";
createGroupBtn.style.marginTop = "20px";
createGroupBtn.style.cursor = "pointer";
createGroupBtn.innerHTML = `<span>GROUPS</span> <i data-lucide="plus" style="width:16px"></i>`;
createGroupBtn.onclick = () => {
  // Populate friend list for selection
  const container = document.getElementById("group-friends-list");
  container.innerHTML = "";
  friendCache.forEach(f => {
    const row = document.createElement("label");
    row.className = "checkbox-row";
    row.innerHTML = `<input type="checkbox" value="${f}"> <span>@${f}</span>`;
    container.appendChild(row);
  });
  toggleModal("group", true);
};
els.groupList.parentElement.insertBefore(createGroupBtn, els.groupList.parentElement.firstChild);

document.getElementById("close-group").onclick = () => toggleModal("group", false);

document.getElementById("confirm-create-group").onclick = async () => {
  const name = document.getElementById("group-name-input").value.trim();
  const checkboxes = document.querySelectorAll("#group-friends-list input:checked");
  
  if (!name) return alert("Group name required");
  if (checkboxes.length === 0) return alert("Select at least 1 friend");
  
  const members = { [user.username]: true };
  checkboxes.forEach(c => members[c.value] = true);
  
  const gRef = push(ref(db, "groups"));
  await set(gRef, {
    name,
    creator: user.username,
    members
  });
  
  toggleModal("group", false);
  document.getElementById("group-name-input").value = "";
};
