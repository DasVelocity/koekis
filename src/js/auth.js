import { ref, set, get, child } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import { db } from "./firebase.js";

const currentUser = JSON.parse(localStorage.getItem("currentUser") || "null");

if (currentUser && (location.pathname.includes("login.html") || location.pathname.includes("register.html"))) {
  location.href = "/";
}
if (!currentUser && location.pathname === "/") {
  location.href = "/login.html";
}

document.getElementById("register-form")?.addEventListener("submit", async e => {
  e.preventDefault();
  const username = e.target[0].value.trim();
  const password = e.target[1].value;
  const snap = await get(child(ref(db), `users/${username}`));
  if (snap.exists()) return alert("Username taken");
  await set(ref(db, `users/${username}`), { password });
  localStorage.setItem("currentUser", JSON.stringify({ username }));
  location.href = "/";
});

document.getElementById("login-form")?.addEventListener("submit", async e => {
  e.preventDefault();
  const username = e.target[0].value.trim();
  const password = e.target[1].value;
  const snap = await get(child(ref(db), `users/${username}`));
  if (!snap.exists() || snap.val().password !== password) return alert("Wrong credentials");
  localStorage.setItem("currentUser", JSON.stringify({ username }));
  location.href = "/";
});

document.getElementById("logout")?.addEventListener("click", () => {
  localStorage.removeItem("currentUser");
  location.href = "/login.html";
});