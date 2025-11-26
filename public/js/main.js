import { db } from "./firebase.js";
import { ref, onValue, push, set, update, serverTimestamp, remove, get } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import { uploadFile } from "./upload.js";

// --- WRAP ALL EXECUTION CODE IN DOMContentLoaded TO ENSURE ELEMENTS EXIST ---
document.addEventListener('DOMContentLoaded', () => {
    
    lucide.createIcons();

    const user = JSON.parse(localStorage.getItem("currentUser"));
    if (!user) location.href = "/login.html";

    // --- STATE ---
    let currentChat = null;
    let currentChatType = null; // "dm" or "group"
    let unreadCounts = {}; // { trackerId: true/false }
    let friendsForGroupSelection = {}; // Stores friend data for group modal

    // --- DOM ELEMENTS ---
    const els = {
      app: document.getElementById("app"),
      messages: document.getElementById("messages"),
      msgInput: document.getElementById("message-input"),
      fileInput: document.getElementById("file-input"),
      chatName: document.getElementById("chat-name"),
      myAvatar: document.getElementById("my-avatar"),
      settingAvatar: document.getElementById("settings-avatar-preview"),
      friendList: document.getElementById("friend-list"),
      groupList: document.getElementById("group-list"),
      inputArea: document.getElementById("input-area"),
      pingSound: document.getElementById("ping-audio"),
      overlays: {
        settings: document.getElementById("settings-overlay"),
        requests: document.getElementById("requests-overlay"),
        group: document.getElementById("group-overlay"),
        addFriend: document.getElementById("add-friend-overlay"),
      },
      groupFriendsList: document.getElementById("group-friends-list"),
      groupNameInput: document.getElementById("group-name-input"),
      groupFileInput: document.getElementById("group-file-input"),
      groupAvatarPreview: document.getElementById("group-avatar-preview"),
      addFriendInput: document.getElementById("add-friend-input"),
    };

    // --- INITIALIZATION & LISTENERS ---
    els.app.classList.remove("hidden");
    document.getElementById("current-user").textContent = "@" + user.username;

    // Helper: Toggles visibility of a modal
    function toggleModal(id, show) {
        const el = els.overlays[id];
        if(!el) return;
        // Reset inputs when closing
        if (!show) {
            if (id === 'addFriend') els.addFriendInput.value = '';
            if (id === 'group') {
                els.groupNameInput.value = '';
                els.groupFileInput.value = '';
                els.groupAvatarPreview.src = '/default.png';
            }
        }
        if (show) el.classList.remove("hidden");
        else el.classList.add("hidden");
    }

    // 1. User Profile Listener
    onValue(ref(db, `users/${user.username}`), s => {
      const data = s.val() || {};
      const pfp = data.avatar || "/default.png";
      els.myAvatar.src = pfp;
      els.settingAvatar.src = pfp;
    });

    // 2. Friend List, Unread Logic, and Group Selection Data
    onValue(ref(db, `users/${user.username}/friends`), s => {
        els.friendList.innerHTML = "";
        friendsForGroupSelection = {};
        const friendKeys = s.val() ? Object.keys(s.val()) : [];
        
        friendKeys.forEach(f => {
            // 2a. Watch friend details (Avatar and name for sidebar)
            onValue(ref(db, `users/${f}`), friendSnap => {
                const fData = friendSnap.val() || { username: f };
                friendsForGroupSelection[f] = fData;

                // Sidebar Item Rendering
                const divId = `friend-nav-${f}`;
                let div = document.getElementById(divId);
                if (!div) {
                    div = document.createElement("div");
                    div.className = "nav-item";
                    div.id = divId;
                    div.onclick = () => openChat(f, "dm");
                    els.friendList.appendChild(div);
                }

                const pfp = fData.avatar || "/default.png";
                const badgeHtml = unreadCounts[f] ? `<div class="unread-badge"></div>` : '';
                
                div.innerHTML = `<img src="${pfp}" onerror="this.src='/default.png'"><span>${f}</span>${badgeHtml}`;
                if (currentChatType === "dm" && currentChat.includes(f)) div.classList.add("active");
            });

            // 2b. Listen for new messages to trigger sound/badge
            const chatId = [user.username, f].sort().join("_");
            const dmRef = ref(db, `dms/${chatId}`);
            
            onValue(dmRef, (snap) => {
                if(!snap.exists()) return;
                const msgs = snap.val();
                const keys = Object.keys(msgs);
                const lastMsg = msgs[keys[keys.length - 1]];
                
                // Only consider messages received right now (within 1 second difference)
                const isRecent = (Date.now() - (lastMsg.timestamp || 0)) < 1000; 
                const isNotMe = lastMsg.user !== user.username;
                const isChatOpen = currentChat === chatId;
                
                if (isRecent && isNotMe && !isChatOpen) {
                    triggerNotification(f); // Use friend's username as trackerId
                }
            });
        });
    });

    // 3. Group List & Unread Logic
    onValue(ref(db, "groups"), s => {
      els.groupList.innerHTML = "";
      s.forEach(gSnap => {
        const g = gSnap.val();
        const gId = gSnap.key;
        
        // Only display groups the user is a member of
        if (g.members && g.members[user.username]) {
          
          const divId = `group-nav-${gId}`;
          let div = document.getElementById(divId);
          if (!div) {
            div = document.createElement("div");
            div.className = "nav-item";
            div.id = divId;
            div.onclick = () => openChat(gId, "group", g.name);
            els.groupList.appendChild(div);
          }
          
          const pfp = g.photo || "/default.png"; // Group avatar
          const badgeHtml = unreadCounts[gId] ? `<div class="unread-badge"></div>` : '';

          div.innerHTML = `<img src="${pfp}" onerror="this.src='/default.png'"><span>${g.name}</span>${badgeHtml}`;
          if (currentChatType === "group" && currentChat === gId) div.classList.add("active");
          
          // Group Message Listener
          onValue(ref(db, `groups/${gId}/messages`), (snap) => {
              if(!snap.exists()) return;
              const msgs = snap.val();
              const keys = Object.keys(msgs);
              const lastMsg = msgs[keys[keys.length - 1]];

              const isRecent = (Date.now() - (lastMsg.timestamp || 0)) < 1000;
              const isNotMe = lastMsg.user !== user.username;
              const isChatOpen = currentChat === gId;

              if(isRecent && isNotMe && !isChatOpen) {
                  triggerNotification(gId); // Use groupId as trackerId
              }
          });
        }
      });
    });

    // Helper: Trigger Sound and Red Dot
    function triggerNotification(trackerId) {
        try { 
            els.pingSound.currentTime = 0; 
            els.pingSound.play().catch(e => {
                console.log("Audio playback blocked by browser policy.");
            }); 
        } catch(e){}
        
        // Set unread flag
        unreadCounts[trackerId] = true;
        
        // Update visual badge
        const isGroup = trackerId.startsWith("-"); 
        const navId = isGroup ? `group-nav-${trackerId}` : `friend-nav-${trackerId}`;
        const el = document.getElementById(navId);
        
        if (el && !el.querySelector(".unread-badge")) {
            el.insertAdjacentHTML('beforeend', `<div class="unread-badge"></div>`);
        }
    }

    // 4. Chat Logic (Includes resetting unread badge)
    function openChat(id, type, name = null) {
      // Determine the actual Firebase path ID
      currentChat = type === "dm" ? [user.username, id].sort().join("_") : id;
      currentChatType = type;
      
      // Determine the ID used for tracking unread state (the ID shown in the sidebar)
      const trackerId = type === "dm" ? id : id;

      // Clear unread state and remove badge
      unreadCounts[trackerId] = false;
      const navItem = document.getElementById(type === "dm" ? `friend-nav-${id}` : `group-nav-${id}`);
      const badge = navItem?.querySelector(".unread-badge");
      if(badge) badge.remove();

      // Update UI
      els.chatName.textContent = type === "dm" ? "@" + id : "# " + name;
      els.inputArea.classList.remove("hidden");
      
      // UI Active State
      document.querySelectorAll(".nav-item").forEach(i => i.classList.remove("active"));
      if (navItem) navItem.classList.add("active");
      
      els.messages.innerHTML = "";
      
      const path = type === "group" ? `groups/${id}/messages` : `dms/${currentChat}`;
      
      // Listener for messages
      onValue(ref(db, path), s => {
        els.messages.innerHTML = "";
        s.forEach(msgSnap => {
          renderMessage(msgSnap.val());
        });
        scrollToBottom();
      });
    }

    function renderMessage(m) {
      const div = document.createElement("div");
      const isMe = m.user === user.username;
      div.className = `message ${isMe ? "sent" : ""}`;
      
      const pfp = m.avatar || "/default.png";
      
      div.innerHTML = `
        <img src="${pfp}" class="message-avatar" onerror="this.src='/default.png'">
        <div class="message-content-wrapper">
          <div class="message-meta">${m.user}</div>
          ${m.text ? `<div class="message-bubble">${m.text}</div>` : ""}
          ${m.media ? `<img src="${m.media}" class="media-attachment">` : ""}
        </div>
      `;
      els.messages.appendChild(div);
    }

    function scrollToBottom() {
      setTimeout(() => {
        els.messages.scrollTop = els.messages.scrollHeight;
      }, 100); 
    }

    // 5. Sending Messages (Includes Empty Message Validation)
    async function sendMessage() {
      if (!currentChat) return;
      const txt = els.msgInput.value.trim(); // Trim whitespace
      const file = els.fileInput.files[0];
      
      // Validation: Prevent sending if text is empty AND no file is attached
      if (!txt && !file) {
        els.msgInput.classList.add("input-error");
        setTimeout(() => els.msgInput.classList.remove("input-error"), 500);
        return;
      }
      
      let mediaUrl = null;
      if (file) {
        mediaUrl = await uploadFile(file);
        els.fileInput.value = "";
      }
      
      const path = currentChatType === "group" ? `groups/${currentChat}/messages` : `dms/${currentChat}`;
      
      await push(ref(db, path), {
        user: user.username,
        text: txt,
        media: mediaUrl,
        avatar: els.myAvatar.src,
        timestamp: serverTimestamp()
      });
      
      els.msgInput.value = "";
      scrollToBottom();
    }

    els.msgInput.onkeydown = (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    };
    document.getElementById("send-btn").onclick = sendMessage;


    // --- MODAL HANDLERS ---

    // Close buttons generic handler
    document.querySelectorAll(".close-modal").forEach(btn => {
      btn.onclick = (e) => {
        const overlayId = e.target.closest(".overlay").id;
        const modalType = overlayId.substring(0, overlayId.indexOf('-'));
        toggleModal(modalType, false);
      };
    });

    // Settings & Avatar Upload
    document.getElementById("settings-trigger").onclick = () => toggleModal("settings", true);
    document.getElementById("logout-btn").onclick = () => { localStorage.clear(); location.href = "/login.html"; };
    document.getElementById("avatar-upload").onchange = async (e) => {
      const file = e.target.files[0];
      if (file) {
        const url = await uploadFile(file);
        if (url) {
          await update(ref(db, `users/${user.username}`), { avatar: url });
          els.myAvatar.src = url;
          els.settingAvatar.src = url;
        }
      }
    };
    document.getElementById("pending-btn").onclick = () => toggleModal("requests", true);


    // 6. Custom Add Friend Modal Logic
    document.getElementById("add-friend-trigger").onclick = () => toggleModal("add-friend", true);

    document.getElementById("confirm-add-friend").onclick = async () => {
        const targetUsername = els.addFriendInput.value.trim();
        if (!targetUsername || targetUsername === user.username) {
            alert("Please enter a valid, different username.");
            return;
        }

        const userSnapshot = await get(ref(db, `users/${targetUsername}`));
        if (!userSnapshot.exists()) {
            alert(`User @${targetUsername} not found.`);
            return;
        }
        
        const friendRef = await get(ref(db, `users/${user.username}/friends/${targetUsername}`));
        if (friendRef.exists()) {
            alert(`You are already friends with @${targetUsername}.`);
            return;
        }

        await set(ref(db, `friendRequests/${targetUsername}/${user.username}`), { 
            timestamp: serverTimestamp() 
        });
        
        alert(`Friend request sent to @${targetUsername}!`);
        toggleModal("add-friend", false);
    };


    // 7. Custom Create Group Modal Logic
    document.getElementById("create-group-trigger").onclick = () => {
        // Populate the friend list dynamically every time the modal opens
        els.groupFriendsList.innerHTML = '';
        
        Object.keys(friendsForGroupSelection).forEach(f => {
            const friend = friendsForGroupSelection[f];
            const div = document.createElement("label");
            div.className = "checkbox-row";
            div.innerHTML = `
                <input type="checkbox" data-user="${f}">
                <img src="${friend.avatar || '/default.png'}">
                <span>@${f}</span>
            `;
            els.groupFriendsList.appendChild(div);
        });
        
        toggleModal("group", true);
    };

    // Preview group avatar image when selected
    els.groupFileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => els.groupAvatarPreview.src = e.target.result;
            reader.readAsDataURL(file);
        } else {
            els.groupAvatarPreview.src = '/default.png';
        }
    };


    document.getElementById("confirm-create-group").onclick = async () => {
        const groupName = els.groupNameInput.value.trim();
        const groupFile = els.groupFileInput.files[0];
        
        const selectedMembers = Array.from(els.groupFriendsList.querySelectorAll("input[type='checkbox']:checked"))
                                    .map(input => input.dataset.user);
                                    
        if (!groupName) {
            alert("Please enter a group name.");
            return;
        }
        if (selectedMembers.length === 0) {
            alert("Please select at least one friend to add to the group.");
            return;
        }
        
        // 1. Upload Group Avatar (Optional)
        let photoUrl = null;
        if (groupFile) {
            photoUrl = await uploadFile(groupFile);
        }
        
        // 2. Prepare member list (including self)
        const members = selectedMembers.reduce((acc, user) => {
            acc[user] = true;
            return acc;
        }, {});
        members[user.username] = true; // Add the creator
        
        // 3. Create Group in Firebase
        const newGroupRef = push(ref(db, "groups"));
        await set(newGroupRef, {
            name: groupName,
            photo: photoUrl,
            creator: user.username,
            members: members,
            createdAt: serverTimestamp()
        });
        
        alert(`Group "${groupName}" created successfully!`);
        toggleModal("group", false);
    };

}); // END OF DOMContentLoaded
