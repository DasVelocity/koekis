import { ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js";
import { storage } from "./firebase.js";

export async function uploadFile(file) {
  if (!file) return null;
  const ext = file.name.split('.').pop();
  const fileRef = storageRef(storage, `media/${Date.now()}_${Math.random().toString(36)}.${ext}`);
  await uploadBytes(fileRef, file);
  return await getDownloadURL(fileRef);
}
