import { db } from "./firebase.js";
import { ref, set, get, child, update } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";

// Secure PBKDF2 hashing
async function hashPassword(password, salt = crypto.randomUUID()) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const saltBuffer = encoder.encode(salt);
  const derivedBits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: saltBuffer, iterations: 600000, hash: "SHA-256" },
    keyMaterial,
    256
  );
  const hash = Array.from(new Uint8Array(derivedBits)).map(b => b.toString(16).padStart(2, '0')).join('');
  return { hash, salt };
}

const currentUser = JSON.parse(localStorage.getItem("currentUser") || "null");

if (currentUser && (location.pathname.includes("login.html") || location.pathname.includes("register.html"))) {
  location.href = "/";
}
if (!currentUser && location.pathname === "/") {
  location.href = "/login.html";
}

// Register
document.getElementById("register-form")?.addEventListener("submit", async e => {
  e.preventDefault();
  const username = e.target[0].value.trim().toLowerCase();
  const password = e.target[1].value;

  const snap = await get(child(ref(db), `users/${username}`));
  if (snap.exists()) return alert("Username already taken");

  const { hash, salt } = await hashPassword(password);
  await set(ref(db, `users/${username}`), {
    passwordHash: hash,
    passwordSalt: salt,
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
    status: "online",
    createdAt: Date.now()
  });

  localStorage.setItem("currentUser", JSON.stringify({ username }));
  location.href = "/";
});

// Login
document.getElementById("login-form")?.addEventListener("submit", async e => {
  e.preventDefault();
  const username = e.target[0].value.trim().toLowerCase();
  const password = e.target[1].value;

  const snap = await get(child(ref(db), `users/${username}`));
  if (!snap.exists()) return alert("Wrong username or password");

  const user = snap.val();
  const { hash } = await hashPassword(password, user.passwordSalt);
  if (hash !== user.passwordHash) return alert("Wrong username or password");

  localStorage.setItem("currentUser", JSON.stringify({ username }));
  location.href = "/";
});
