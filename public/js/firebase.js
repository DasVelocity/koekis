// Initialize Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyBxMncwm5s0A-sCOr5d8WXo7u1e2130ajQ",
  authDomain: "kaka-d1761.firebaseapp.com",
  databaseURL: "https://kaka-d1761-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "kaka-d1761",
  storageBucket: "kaka-d1761.firebasestorage.app",
  messagingSenderId: "627282238810",
  appId: "1:627282238810:web:8b746ae1b2404d419fe763"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const storage = getStorage(app);
