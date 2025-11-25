import { ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js";
import { storage } from "./firebase.js";

export async function uploadFile(file) {
  if (!file) return null;
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const fileRef = storageRef(storage, `media/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${ext}`);
  
  try {
    const snapshot = await uploadBytes(fileRef, file);
    const url = await getDownloadURL(snapshot.ref);
    return url;
  } catch (err) {
    console.error("Upload failed:", err);
    alert("Failed to upload file. Check console.");
    return null;
  }
}
