const socket = io();

const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("login-btn");
const registerBtn = document.getElementById("register-btn");
const statusDiv = document.getElementById("status");

const chatBox = document.getElementById("chat-box");
const messageInput = document.getElementById("message-input");
const sendBtn = document.getElementById("send-btn");
const onlineUsers = document.getElementById("online-users");
const typingDiv = document.getElementById("typing");

let currentUser = "";
let privateTarget = "";

/* ---------- LOGIN / REGISTER ---------- */
function auth(url) {
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            currentUser = username;

            statusDiv.innerText = "Logged in as " + username;
            document.getElementById("chat-title").innerText =
                "Chat Room – " + username;
            document.getElementById("welcome-text").innerText =
                "You are online";

            socket.emit("join", { username });
        } else {
            statusDiv.innerText = data.message;
        }
    });
}

loginBtn.onclick = () => auth("/api/login");
registerBtn.onclick = () => auth("/api/register");

/* ---------- SEND MESSAGE ---------- */
function sendMessage() {
    if (!messageInput.value) return;

    if (privateTarget) {
        socket.emit("message", {
            text: `/w ${privateTarget} ${messageInput.value}`
        });
        privateTarget = "";
        messageInput.placeholder = "Type a message";
    } else {
        socket.emit("message", { text: messageInput.value });
    }

    messageInput.value = "";
}

sendBtn.onclick = sendMessage;

messageInput.addEventListener("keypress", e => {
    if (e.key === "Enter") sendMessage();
    socket.emit("typing");
});

/* ---------- RECEIVE MESSAGE ---------- */
socket.on("message", data => {
    const div = document.createElement("div");
    div.className = "message " +
        (data.username === currentUser ? "self" : "other");

    if (data.private) div.classList.add("private");

    div.innerHTML = `
        <div class="user">${data.username}</div>
        <div>${data.text}</div>
        <div class="time">${data.time}</div>
    `;

    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
});

/* ---------- ONLINE USERS CLICK → PRIVATE ---------- */
socket.on("user_list", users => {
    onlineUsers.innerHTML = "";
    users.forEach(user => {
        if (user === currentUser) return;

        const li = document.createElement("li");
        li.innerText = user;

        li.onclick = () => {
            privateTarget = user;
            messageInput.placeholder = "Private message to " + user;
        };

        onlineUsers.appendChild(li);
    });
});

/* ---------- TYPING ---------- */
socket.on("typing", data => {
    typingDiv.innerText = data.username + " is typing...";
    setTimeout(() => typingDiv.innerText = "", 1000);
});
