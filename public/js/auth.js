import { db } from "./firebase.js";
import { ref, set, get, child } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";

async function hashPassword(password, salt = crypto.randomUUID()) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const derivedBits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: encoder.encode(salt), iterations: 600000, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return {
    hash: Array.from(new Uint8Array(derivedBits)).map(b => b.toString(16).padStart(2, '0')).join(''),
    salt
  };
}

const currentUser = JSON.parse(localStorage.getItem("currentUser") || "null");

if (currentUser && (location.pathname.includes("login") || location.pathname.includes("register"))) {
  location.href = "/";
}
if (!currentUser && !location.pathname.includes("login") && !location.pathname.includes("register")) {
  location.href = "/login.html";
}

document.getElementById("register-form")?.addEventListener("submit", async e => {
  e.preventDefault();
  const username = e.target[0].value.trim().toLowerCase();
  const password = e.target[1].value;

  if (username.length < 3) return alert("Username too short");

  try {
    const userRef = ref(db, `users/${username}`);
    const snapshot = await get(userRef);

    if (snapshot.exists()) {
      alert("Username already taken. Please choose another.");
      return;
    }

    const { hash, salt } = await hashPassword(password);
    
    await set(userRef, {
      passwordHash: hash,
      passwordSalt: salt,
      avatar: "", // Empty string implies default
      status: "online",
      createdAt: Date.now()
    });

    localStorage.setItem("currentUser", JSON.stringify({ username }));
    location.href = "/";
  } catch (err) {
    console.error(err);
    alert("Error registering. Try again.");
  }
});

document.getElementById("login-form")?.addEventListener("submit", async e => {
  e.preventDefault();
  const username = e.target[0].value.trim().toLowerCase();
  const password = e.target[1].value;

  try {
    const snapshot = await get(ref(db, `users/${username}`));
    
    if (!snapshot.exists()) {
      alert("Invalid credentials");
      return;
    }

    const userData = snapshot.val();
    const { hash } = await hashPassword(password, userData.passwordSalt);
    
    if (hash !== userData.passwordHash) {
      alert("Invalid credentials");
      return;
    }

    localStorage.setItem("currentUser", JSON.stringify({ username }));
    location.href = "/";
  } catch (err) {
    console.error(err);
    alert("Login error.");
  }
});
