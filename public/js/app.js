import { db, storage } from "./firebase.js";
import { ref, set, push, onValue, serverTimestamp, update } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import { uploadFile } from "./upload.js";

const user = JSON.parse(localStorage.getItem("currentUser"));
if (!user) location.href = "/login.html";

let currentChat = null;
let currentType = null;

// Load PFP
const savedPfp = localStorage.getItem("pfp") || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`;
document.getElementById("pfp-preview").src = savedPfp;
document.querySelectorAll(".avatar").forEach(img => img.src = savedPfp);

// Change PFP
document.getElementById("pfp-input").onchange = async e => {
  const file = e.target.files[0];
  if (file) {
    const url = await uploadFile(file);
    localStorage.setItem("pfp", url);
    document.getElementById("pfp-preview").src = url;
    document.querySelectorAll(".avatar").forEach(img => img.src = url);
  }
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

// Load Friends (everyone is friend for now)
onValue(ref(db, "users"), snap => {
  const list = document.getElementById("friends");
  list.innerHTML = "";
  snap.forEach(child => {
    const u = child.val();
    if (child.key !== user.username) {
      const div = document.createElement("div");
      div.className = "friend";
      div.innerHTML = `<img src="${u.pfp || `https://api.dicebear.com/7.x/avataaars/svg?seed=${child.key}`}" alt="">
                       <div><strong>${child.key}</strong><br><span class="online">Online</span></div>`;
      div.onclick = () => openDM(child.key, "dm");
      list.appendChild(div);
    }
  });
});

// Open DM or Group
function openDM(id, type) {
  currentChat = id;
  currentType = type;
  document.getElementById("chat-name").textContent = id;
  loadMessages();
  document.querySelector(".input-area").style.display = "flex";
}

// Load Messages
function loadMessages() {
  const msgRef = ref(db, `messages/${currentType}_${currentChat}`);
  onValue(msgRef, snap => {
    const div = document.getElementById("messages");
    div.innerHTML = "";
    snap.forEach(child => {
      const m = child.val();
      const msgDiv = document.createElement("div");
      msgDiv.className = `message ${m.user === user.username ? "sent" : ""}`;
      msgDiv.innerHTML = `<img class="avatar" src="${m.pfp || `https://api.dicebear.com/7.x/avataaars/svg?seed=${m.user}`}">
                          <div>
                            <div class="message-bubble">${m.text || ""}</div>
                            ${m.media ? `<img src="${m.media}" class="media">` : ""}
                          </div>`;
      div.appendChild(msgDiv);
    });
    div.scrollTop = div.scrollHeight;
  });
}

// Send Message
document.getElementById("message-input").onkeydown = async e => {
  if (e.key === "Enter" && currentChat) {
    const input = e.target;
    if (!input.value.trim()) return;
    const media = null; // you can add file attach later
    const msgRef = push(ref(db, `messages/${currentType}_${currentChat}`));
    await set(msgRef, {
      user: user.username,
      text: input.value,
      pfp: localStorage.getItem("pfp"),
      media,
      timestamp: serverTimestamp()
    });
    input.value = "";
  }
};

// Init
document.getElementById("app").classList.remove("hidden");