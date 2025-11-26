import { db } from "./firebase.js";
import { ref, onValue, push, set, update, serverTimestamp, remove, get } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import { uploadFile } from "./upload.js";

document.addEventListener('DOMContentLoaded', () => {
    
    lucide.createIcons();

    const user = JSON.parse(localStorage.getItem("currentUser"));
    if (!user) location.href = "/login.html";

    let currentChat = null;
    let currentChatType = null;
    let unreadCounts = {};
    let friendsForGroupSelection = {};

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

    els.app.classList.remove("hidden");
    document.getElementById("current-user").textContent = "@" + user.username;

    function toggleModal(id, show) {
        const el = els.overlays[id];
        if(!el) return;
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

    onValue(ref(db, `users/${user.username}`), s => {
      const data = s.val() || {};
      const pfp = data.avatar || "/default.png";
      els.myAvatar.src = pfp;
      els.settingAvatar.src = pfp;
    });

    onValue(ref(db, `users/${user.username}/friends`), s => {
        els.friendList.innerHTML = "";
        friendsForGroupSelection = {};
        const friendKeys = s.val() ? Object.keys(s.val()) : [];
        
        friendKeys.forEach(f => {
            onValue(ref(db, `users/${f}`), friendSnap => {
                const fData = friendSnap.val() || { username: f };
                friendsForGroupSelection[f] = fData;

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

            const chatId = [user.username, f].sort().join("_");
            const dmRef = ref(db, `dms/${chatId}`);
            
            onValue(dmRef, (snap) => {
                if(!snap.exists()) return;
                const msgs = snap.val();
                const keys = Object.keys(msgs);
                const lastMsg = msgs[keys[keys.length - 1]];
                
                const isRecent = (Date.now() - (lastMsg.timestamp || 0)) < 1000; 
                const isNotMe = lastMsg.user !== user.username;
                const isChatOpen = currentChat === chatId;
                
                if (isRecent && isNotMe && !isChatOpen) {
                    triggerNotification(f);
                }
            });
        });
    });

    onValue(ref(db, "groups"), s => {
      els.groupList.innerHTML = "";
      s.forEach(gSnap => {
        const g = gSnap.val();
        const gId = gSnap.key;
        
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
          
          const pfp = g.photo || "/default.png";
          const badgeHtml = unreadCounts[gId] ? `<div class="unread-badge"></div>` : '';

          div.innerHTML = `<img src="${pfp}" onerror="this.src='/default.png'"><span>${g.name}</span>${badgeHtml}`;
          if (currentChatType === "group" && currentChat === gId) div.classList.add("active");
          
          onValue(ref(db, `groups/${gId}/messages`), (snap) => {
              if(!snap.exists()) return;
              const msgs = snap.val();
              const keys = Object.keys(msgs);
              const lastMsg = msgs[keys[keys.length - 1]];

              const isRecent = (Date.now() - (lastMsg.timestamp || 0)) < 1000;
              const isNotMe = lastMsg.user !== user.username;
              const isChatOpen = currentChat === gId;

              if(isRecent && isNotMe && !isChatOpen) {
                  triggerNotification(gId);
              }
          });
        }
      });
    });

    function triggerNotification(trackerId) {
        try { 
            els.pingSound.currentTime = 0; 
            els.pingSound.play().catch(e => {
                console.log("Audio playback blocked by browser policy.");
            }); 
        } catch(e){}
        
        unreadCounts[trackerId] = true;
        
        const isGroup = trackerId.startsWith("-"); 
        const navId = isGroup ? `group-nav-${trackerId}` : `friend-nav-${trackerId}`;
        const el = document.getElementById(navId);
        
        if (el && !el.querySelector(".unread-badge")) {
            el.insertAdjacentHTML('beforeend', `<div class="unread-badge"></div>`);
        }
    }

    function openChat(id, type, name = null) {
      currentChat = type === "dm" ? [user.username, id].sort().join("_") : id;
      currentChatType = type;
      
      const trackerId = type === "dm" ? id : id;

      unreadCounts[trackerId] = false;
      const navItem = document.getElementById(type === "dm" ? `friend-nav-${id}` : `group-nav-${id}`);
      const badge = navItem?.querySelector(".unread-badge");
      if(badge) badge.remove();

      els.chatName.textContent = type === "dm" ? "@" + id : "# " + name;
      els.inputArea.classList.remove("hidden");
      
      document.querySelectorAll(".nav-item").forEach(i => i.classList.remove("active"));
      if (navItem) navItem.classList.add("active");
      
      els.messages.innerHTML = "";
      
      const path = type === "group" ? `groups/${id}/messages` : `dms/${currentChat}`;
      
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

    async function sendMessage() {
      if (!currentChat) return;
      const txt = els.msgInput.value.trim();
      const file = els.fileInput.files[0];
      
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

    document.querySelectorAll(".close-modal").forEach(btn => {
      btn.onclick = (e) => {
        const overlayId = e.target.closest(".overlay").id;
        const modalType = overlayId.substring(0, overlayId.indexOf('-'));
        toggleModal(modalType, false);
      };
    });

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

    document.getElementById("create-group-trigger").onclick = () => {
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
        
        let photoUrl = null;
        if (groupFile) {
            photoUrl = await uploadFile(groupFile);
        }
        
        const members = selectedMembers.reduce((acc, user) => {
            acc[user] = true;
            return acc;
        }, {});
        members[user.username] = true;
        
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

});
