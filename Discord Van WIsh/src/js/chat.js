import { ref, push, onValue, set, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import { db } from "./firebase.js";

const user = JSON.parse(localStorage.getItem("currentUser"));
if (!user) location.href = "/login.html";

document.getElementById("current-user").textContent = user.username;

const roomsRef = ref(db, "rooms");
let currentRoom = null;

const createRoom = name => {
  const roomRef = push(roomsRef);
  set(roomRef, { name, createdAt: serverTimestamp(), creator: user.username });
};

const loadRooms = () => {
  onValue(roomsRef, snap => {
    const list = document.getElementById("room-list");
    list.innerHTML = "";
    snap.forEach(child => {
      const room = child.val();
      const div = document.createElement("div");
      div.className = "room-item";
      div.textContent = room.name;
      div.onclick = () => joinRoom(child.key, room.name);
      list.appendChild(div);
    });
  });
};

const joinRoom = (key, name) => {
  currentRoom = key;
  document.getElementById("room-name").textContent = name;
  document.querySelector(".message-form").classList.remove("hidden");
  document.querySelectorAll(".room-item").forEach(r => r.classList.remove("active"));
  event.target.classList.add("active");
  loadMessages();
};

const loadMessages = () => {
  const messagesDiv = document.getElementById("messages");
  messagesDiv.innerHTML = "";
  const messagesRef = ref(db, `messages/${currentRoom}`);
  onValue(messagesRef, snap => {
    messagesDiv.innerHTML = "";
    snap.forEach(child => {
      const msg = child.val();
      const div = document.createElement("div");
      div.className = "message";
      if (msg.user === user.username) div.classList.add("sent");
      const author = document.createElement("div");
      author.className = "message-author";
      author.textContent = msg.user;
      const bubble = document.createElement("div");
      bubble.className = "message-bubble";
      bubble.textContent = msg.text;
      div.append(author, bubble);
      messagesDiv.appendChild(div);
    });
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  });
};

document.getElementById("message-form").addEventListener("submit", e => {
  e.preventDefault();
  const input = document.getElementById("message-input");
  if (!input.value.trim() || !currentRoom) return;
  const msgRef = push(ref(db, `messages/${currentRoom}`));
  set(msgRef, {
    user: user.username,
    text: input.value,
    timestamp: serverTimestamp()
  });
  input.value = "";
});

document.getElementById("new-room").addEventListener("click", () => {
  const name = prompt("Room name:");
  if (name) createRoom(name);
});

loadRooms();
document.getElementById("app").classList.remove("hidden");