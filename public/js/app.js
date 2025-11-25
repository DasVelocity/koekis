import { db, storage } from "./firebase.js";
import { ref, set, push, onValue, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import { ref as sRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js";

const user = JSON.parse(localStorage.getItem("currentUser"));
if (!user) location.href = "/login.html";

let currentChat = null;
let currentType = null;

// Load PFP from Firebase or local
const userRef = ref(db, `users/${user.username}`);
onValue(userRef, (snap) => {
  const data = snap.val();
  const pfp = data?.pfp || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`;
  document.getElementById("pfp-preview").src = pfp;
  document.querySelectorAll(".avatar").forEach(img => img.src = pfp);
  document.querySelector(".chat-header img").src = pfp;
});

// Change PFP
document.getElementById("pfp-input").onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const storageRef = sRef(storage, `pfps/${user.username}_${Date.now()}`);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  await set(ref(db, `users/${user.username}/pfp`), url);
  document.getElementById("pfp-preview").src = url;
};

// Tabs
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    document.querySelectorAll("#friends,#groups,#settings").forEach(p => p.classList.add("hidden"));
    document.getElementById(btn.dataset.tab).classList.remove("hidden");
  };
});

// Load Friends
onValue(ref(db, "users"), snap => {
  const list = document.getElementById("friends");
  list.innerHTML = "";
  snap.forEach(child => {
    if (child.key !== user.username) {
      const div = document.createElement("div");
      div.className = "friend online";
      div.innerHTML = `
        <img src="${child.val().pfp || `https://api.dicebear.com/7.x/avataaars/svg?seed=${child.key}`}" alt="">
        <div><strong>${child.key}</strong></div>
      `;
      div.onclick = () => openDM(child.key);
      list.appendChild(div);
    }
  });
});

function openDM(username) {
  currentChat = username;
  document.getElementById("chat-name").textContent = username;
  document.querySelector(".input-area").style.display = "flex";
  loadMessages();
}

function loadMessages() {
  const msgRef = ref(db, `dms/${[user.username, currentChat].sort().join("_")}`);
  onValue(msgRef, snap => {
    const div = document.getElementById("messages");
    div.innerHTML = "";
    snap.forEach(child => {
      const m = child.val();
      const msgDiv = document.createElement("div");
      msgDiv.className = `message ${m.user === user.username ? "sent" : ""}`;
      msgDiv.innerHTML = `
        <img class="avatar" src="${m.pfp || `https://api.dicebear.com/7.x/avataaars/svg?seed=${m.user}`}">
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
document.getElementById("message-input").onkeydown = async e => {
  if (e.key === "Enter" && currentChat && e.target.value.trim()) {
    const msgRef = push(ref(db, `dms/${[user.username, currentChat].sort().join("_")}`));
    await set(msgRef, {
      user: user.username,
      text: e.target.value,
      pfp: (await get(userRef)).val()?.pfp,
      timestamp: serverTimestamp()
    });
    e.target.value = "";
  }
};

document.getElementById("app").classList.remove("hidden");
