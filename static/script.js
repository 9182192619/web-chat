// ---------------- SOCKET ----------------
const socket = io();

// ---------------- ELEMENTS ----------------
const chatBox = document.getElementById("chat-box");
const messageInput = document.getElementById("message-input");
const sendBtn = document.getElementById("send-btn");

const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("login-btn");
const registerBtn = document.getElementById("register-btn");
const loginStatus = document.getElementById("status");

const onlineUsersUL = document.getElementById("online-users");
const welcomeText = document.getElementById("welcome-text");
const chatContainer = document.querySelector(".chat");

// ---------------- STATE ----------------
let currentUser = null;
let typingTimer = null;

// ---------------- AUTH ----------------
loginBtn.onclick = async () => {
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    if (!username || !password) {
        loginStatus.innerText = "Enter username & password";
        return;
    }

    const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    if (!data.success) {
        loginStatus.innerText = data.message;
        return;
    }

    afterLogin(username);
};

registerBtn.onclick = async () => {
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    if (!username || !password) {
        loginStatus.innerText = "Enter username & password";
        return;
    }

    const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    loginStatus.innerText = data.message;
};

// ---------------- AFTER LOGIN ----------------
function afterLogin(username) {
    currentUser = username;

    loginStatus.innerText = `Logged in as ${username}`;
    welcomeText.innerText = `Chat Room — ${username}`;
    chatContainer.style.display = "flex";

    socket.emit("join", { username });
    socket.emit("request_user_list");
}

// ---------------- SEND MESSAGE ----------------
sendBtn.onclick = sendMessage;
messageInput.addEventListener("keypress", e => {
    if (e.key === "Enter") sendMessage();
});

function sendMessage() {
    const text = messageInput.value.trim();
    if (!text) return;

    socket.emit("message", { text });
    messageInput.value = "";
}

// ---------------- RECEIVE MESSAGE ----------------
socket.on("message", data => {
    const msgDiv = document.createElement("div");
    msgDiv.classList.add("message");

    if (data.username === currentUser || data.self) {
        msgDiv.classList.add("self");
    } else {
        msgDiv.classList.add("other");
    }

    if (data.private) {
        msgDiv.classList.add("private");
    }

    msgDiv.innerHTML = `
        <div class="user">${data.username}</div>
        <div class="text">${data.text}</div>
        <div class="time">${data.time}</div>
    `;

    chatBox.appendChild(msgDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
});

// ---------------- ONLINE USERS ----------------
socket.on("user_list", users => {
    onlineUsersUL.innerHTML = "";

    users.forEach(user => {
        const li = document.createElement("li");
        li.innerText = user;

        if (user !== currentUser) {
            li.onclick = () => {
                messageInput.value = `/w ${user} `;
                messageInput.focus();
            };
        }

        onlineUsersUL.appendChild(li);
    });
});

// ---------------- TYPING INDICATOR ----------------
messageInput.addEventListener("input", () => {
    socket.emit("typing", { typing: true });

    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
        socket.emit("typing", { typing: false });
    }, 700);
});

socket.on("typing", data => {
    if (!data.typing) {
        welcomeText.innerText = `Chat Room — ${currentUser}`;
        return;
    }

    welcomeText.innerText = `${data.username} is typing…`;
});
