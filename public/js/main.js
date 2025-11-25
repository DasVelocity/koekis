import { db } from "./firebase.js";
import { ref, onValue, push, set, update, remove, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import { uploadFile } from "./upload.js";

lucide.createIcons();

const user = JSON.parse(localStorage.getItem("currentUser"));
if (!user) location.href = "/login.html";

document.getElementById("current-user").textContent = "@" + user.username;

let currentChat = null;
let currentChatType = "dm";
let unread = {};

const friendList = document.getElementById("friend-list");
const groupList = document.getElementById("group-list");
const pendingList = document.getElementById("pending-list");
const messagesDiv = document.getElementById("messages");
const messageInput = document.getElementById("message-input");
const fileInput = document.getElementById("file-input");
const chatNameEl = document.getElementById("chat-name");
const myAvatar = document.getElementById("my-avatar");
const mainChat = document.querySelector(".main-chat");

onValue(ref(db, `users/${user.username}`), s => {
  const data = s.val();
  myAvatar.src = data?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`;
});

function notify(title, body) {
  if (document.hidden && Notification.permission === "granted") {
    new Notification(title, { body, icon: myAvatar.src });
  }
}
if (Notification.permission === "default") Notification.requestPermission();

function showPopup(t, m, b = []) {
  const o = document.createElement("div");
  o.className = "popup-overlay";
  o.innerHTML = `<div class="popup"><h3>${t}</h3><p>${m}</p><div>${b.map(x=>`<button class="${x.c}">${x.t}</button>`).join("")}</div></div>`;
  document.body.appendChild(o);
  o.onclick = e => e.target.tagName==="BUTTON" && (o.remove(), x?.a?.());
}

function openDM(u) {
  currentChat = [user.username, u].sort().join("_");
  currentChatType = "dm";
  chatNameEl.textContent = "@" + u;
  loadMessages();
  unread[currentChat] = 0;
}

function openGroup(id, name) {
  currentChat = id;
  currentChatType = "group";
  chatNameEl.textContent = "#" + name;
  loadMessages();
  unread[id] = 0;
}

function loadMessages() {
  messagesDiv.innerHTML = "";
  const path = currentChatType === "group" ? `groups/${currentChat}/messages` : `dms/${currentChat}`;
  onValue(ref(db, path), s => {
    messagesDiv.innerHTML = "";
    s.forEach(c => {
      const m = c.val();
      const div = document.createElement("div");
      div.className = `message ${m.user === user.username ? "sent" : ""}`;
      div.innerHTML = `
        <img class="avatar" src="${m.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed='+m.user}">
        <div>
          <div class="message-author">${m.user}</div>
          <div class="message-content">${m.text || ""}</div>
          ${m.media ? `<img src="${m.media}" class="media" onerror="this.remove()">` : ""}
        </div>`;
      messagesDiv.appendChild(div);
    });
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  });
}

async function sendMessage() {
  if (!currentChat) return;
  if (!messageInput.value.trim() && !fileInput.files[0]) return;

  let media = null;
  if (fileInput.files[0]) {
    media = await uploadFile(fileInput.files[0]);
    fileInput.value = "";
  }

  const path = currentChatType === "group" ? `groups/${currentChat}/messages` : `dms/${currentChat}`;
  const msgRef = push(ref(db, path));
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

onValue(ref(db, `users/${user.username}/friends`), s => {
  friendList.innerHTML = "";
  const f = s.val() || {};
  Object.keys(f).sort().forEach(u => {
    const d = document.createElement("div");
    d.className = "friend";
    d.innerHTML = `<img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${u}"><div><strong>@${u}</strong><span class="online">Online</span></div>`;
    d.onclick = () => openDM(u);
    friendList.appendChild(d);
  });
});

onValue(ref(db, `groups`), s => {
  groupList.innerHTML = "";
  s.forEach(c => {
    const g = c.val();
    if (g.members?.[user.username]) {
      const d = document.createElement("div");
      d.className = "friend";
      d.innerHTML = `<div><strong># ${g.name}</strong></div>`;
      d.onclick = () => openGroup(c.key, g.name);
      groupList.appendChild(d);
    }
  });
});

onValue(ref(db, `friendRequests/${user.username}`), s => {
  pendingList.innerHTML = "";
  s.forEach(c => {
    const from = c.key;
    const d = document.createElement("div");
    d.className = "pending-item";
    d.innerHTML = `<img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${from}"><div><strong>@${from}</strong></div>
      <div class="pending-actions"><button class="accept">Accept</button><button class="decline">Decline</button></div>`;
    d.querySelector(".accept").onclick = () => {
      update(ref(db, `users/${user.username}/friends`), { [from]: true });
      update(ref(db, `users/${from}/friends`), { [user.username]: true });
      remove(ref(db, `friendRequests/${user.username}/${from}`));
    };
    d.querySelector(".decline").onclick = () => remove(ref(db, `friendRequests/${user.username}/${from}`));
    pendingList.appendChild(d);
  });
});

document.getElementById("add-friend-btn").onclick = () => {
  const name = prompt("Username to add:");
  if (name) {
    set(ref(db, `friendRequests/${name.trim().toLowerCase()}/${user.username}`), { from: user.username });
    showPopup("Sent", `Request sent to @${name}`);
  }
};

function openSettings() {
  mainChat.innerHTML = `
    <div class="settings-page">
      <button id="close-settings" class="icon-btn" style="position:absolute;top:16px;right:16px;"><i data-lucide="x"></i></button>
      <div class="settings-card">
        <h2>My Account</h2>
        <div class="setting-row"><label>Change Avatar</label><input type="file" id="avatar-upload" accept="image/*"></div>
        <div class="setting-row"><label>Status</label><select id="status-select"><option>Online</option><option>Away</option><option>Do Not Disturb</option></select></div>
        <h2>Groups</h2>
        <button id="create-group">Create New Group</button>
        <button class="logout-btn" id="logout">Logout</button>
      </div>
    </div>`;
  lucide.createIcons();
  document.getElementById("close-settings").onclick = () => location.reload();
  document.getElementById("logout").onclick = () => { localStorage.clear(); location.href = "/login.html"; };
  document.getElementById("avatar-upload").onchange = async e => {
    const url = await uploadFile(e.target.files[0]);
    if (url) {
      update(ref(db, `users/${user.username}`), { avatar: url });
      myAvatar.src = url;
    }
  };
  document.getElementById("create-group").onclick = async () => {
    const name = prompt("Group name:");
    if (!name) return;
    const friends = await new Promise(res => {
      onValue(ref(db, `users/${user.username}/friends`), s => res(Object.keys(s.val() || {})), { onlyOnce: true });
    });
    let html = `<div style="max-height:400px;overflow-y:auto;">`;
    friends.forEach(f => {
      html += `<label style="display:block;padding:8px;cursor:pointer"><input type="checkbox" value="${f}"> @${f}</label>`;
    });
    html += `</div><button id="confirm-group" style="margin-top:16px;padding:12px;background:#5865f2;color:white;border:none;border-radius:8px">Create</button>`;
    showPopup(`Create Group: ${name}`, html, []);
    document.getElementById("confirm-group")?.addEventListener("click", () => {
      const selected = Array.from(document.querySelectorAll('input[type="checkbox"]:checked')).map(c => c.value);
      if (selected.length === 0) return alert("Select at least one friend");
      const g = push(ref(db, "groups"));
      const members = { [user.username]: true };
      selected.forEach(u => members[u] = true);
      set(g, { name, creator: user.username, members });
      document.querySelector(".popup-overlay")?.remove();
    });
  };
};

document.getElementById("settings-btn").onclick = openSettings;

document.getElementById("app").classList.remove("hidden");
