from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO, emit
import sqlite3, hashlib
from datetime import datetime

app = Flask(__name__)
app.config["SECRET_KEY"] = "chatappsecret"

# IMPORTANT: eventlet for Render / WebSockets
socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode="eventlet"
)

DB_NAME = "web_chat_users.db"
connected_users = {}   # sid -> username


# ---------- DATABASE ----------
def init_db():
    conn = sqlite3.connect(DB_NAME)
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password_hash TEXT
        )
    """)
    conn.commit()
    conn.close()


def hash_password(p):
    return hashlib.sha256(p.encode()).hexdigest()


def register_user(username, password):
    try:
        conn = sqlite3.connect(DB_NAME)
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO users VALUES (NULL, ?, ?)",
            (username, hash_password(password))
        )
        conn.commit()
        return True, "Registered successfully"
    except sqlite3.IntegrityError:
        return False, "Username already exists"
    finally:
        conn.close()


def check_login(username, password):
    conn = sqlite3.connect(DB_NAME)
    cur = conn.cursor()
    cur.execute("SELECT password_hash FROM users WHERE username=?", (username,))
    row = cur.fetchone()
    conn.close()
    return row and row[0] == hash_password(password)


def now():
    return datetime.now().strftime("%H:%M")


def online_users():
    return sorted(set(connected_users.values()))


# ---------- ROUTES ----------
@app.route("/")
def home():
    return render_template("index.html")


@app.route("/api/register", methods=["POST"])
def register():
    data = request.get_json()
    ok, msg = register_user(data["username"], data["password"])
    return jsonify({"success": ok, "message": msg})


@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json()
    if check_login(data["username"], data["password"]):
        return jsonify({"success": True})
    return jsonify({"success": False, "message": "Invalid credentials"})


# ---------- SOCKET EVENTS ----------
@socketio.on("join")
def join(data):
    username = data["username"]
    connected_users[request.sid] = username

    emit("message", {
        "username": "SERVER",
        "text": f"{username} joined the chat",
        "time": now()
    }, broadcast=True)

    emit("user_list", online_users(), broadcast=True)


@socketio.on("message")
def message(data):
    sender = connected_users.get(request.sid)
    if not sender:
        return

    text = data["text"]

    # PRIVATE MESSAGE
    if text.startswith("/w "):
        parts = text.split(" ", 2)
        if len(parts) < 3:
            emit("message", {
                "username": "SERVER",
                "text": "Usage: /w username message",
                "time": now()
            }, to=request.sid)
            return

        target, msg = parts[1], parts[2]
        for sid, user in connected_users.items():
            if user == target:
                emit("message", {
                    "username": sender,
                    "text": f"[PM] {msg}",
                    "time": now(),
                    "private": True
                }, to=sid)

                emit("message", {
                    "username": sender,
                    "text": f"[PM to {target}] {msg}",
                    "time": now(),
                    "private": True
                }, to=request.sid)
                return

        emit("message", {
            "username": "SERVER",
            "text": f"{target} is not online",
            "time": now()
        }, to=request.sid)
        return

    # PUBLIC MESSAGE
    emit("message", {
        "username": sender,
        "text": text,
        "time": now()
    }, broadcast=True)


@socketio.on("typing")
def typing():
    user = connected_users.get(request.sid)
    if user:
        emit("typing", {"username": user}, broadcast=True, include_self=False)


@socketio.on("disconnect")
def disconnect():
    user = connected_users.pop(request.sid, None)
    if user:
        emit("message", {
            "username": "SERVER",
            "text": f"{user} left the chat",
            "time": now()
        }, broadcast=True)
        emit("user_list", online_users(), broadcast=True)


# ---------- RUN ----------
if __name__ == "__main__":
    init_db()
    # IMPORTANT: Render uses port 10000
    socketio.run(app, host="0.0.0.0", port=10000)
