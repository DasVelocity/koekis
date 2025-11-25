// helper to upload images/videos
import { storage } from "./firebase.js";
import { ref as sRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js";

export async function uploadFile(file, pathPrefix = "uploads") {
  const refStr = `${pathPrefix}/${Date.now()}_${file.name}`;
  const s = sRef(storage, refStr);
  await uploadBytes(s, file);
  return await getDownloadURL(s);
}
