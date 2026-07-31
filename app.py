import os

from flask import Flask, jsonify, redirect, render_template, request, session, url_for
from werkzeug.utils import secure_filename

from chatbot.bot import get_bot_response
from chatbot.memory import save_message
from config import SECRET_KEY
from database.db import get_db
from database.models import create_tables


app = Flask(__name__)
app.secret_key = SECRET_KEY
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024

create_tables()

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
TEXT_EXTENSIONS = {".txt", ".py", ".js", ".html", ".css", ".json", ".md", ".csv", ".java", ".c", ".cpp", ".php"}


@app.route("/")
def home():
    return render_template("login.html")


@app.route("/login", methods=["POST"])
def login():
    email = (request.form.get("email") or "").strip().lower()
    if not email:
        return redirect(url_for("home"))

    session["user_email"] = email
    return redirect(url_for("chat_page"))


@app.route("/chat")
def chat_page():
    if "user_email" not in session:
        return redirect(url_for("home"))
    return render_template("chat.html")


@app.route("/api/chat", methods=["POST"])
def chat():
    if "user_email" not in session:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        data = request.get_json(silent=True) or {}
        message = (data.get("message") or "").strip()

        if not message:
            return jsonify({"error": "Please enter a message."}), 400

        email = session["user_email"]
        save_message(email, "user", message)

        response = get_bot_response(message)
        save_message(email, "bot", response)

        return jsonify({"response": response})

    except Exception:
        app.logger.exception("Chat Error")
        return jsonify({"error": "The server could not process your message."}), 500


@app.route("/new_chat", methods=["POST"])
def new_chat():
    if "user_email" not in session:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("DELETE FROM messages WHERE email=?", (session["user_email"],))
        conn.commit()
        conn.close()

        return jsonify({"status": "cleared"})

    except Exception:
        app.logger.exception("New Chat Error")
        return jsonify({"error": "Could not clear chat history."}), 500


@app.route("/get_messages")
def get_messages():
    if "user_email" not in session:
        return jsonify([])

    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute(
            "SELECT role, content FROM messages WHERE email=? ORDER BY id ASC",
            (session["user_email"],),
        )
        rows = cur.fetchall()
        conn.close()

        return jsonify([{"role": row["role"], "content": row["content"]} for row in rows])

    except Exception:
        app.logger.exception("Fetch Messages Error")
        return jsonify([])


@app.route("/upload", methods=["POST"])
def upload():
    if "user_email" not in session:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        if "file" not in request.files:
            return jsonify({"error": "No file uploaded"}), 400

        file = request.files["file"]
        if file.filename == "":
            return jsonify({"error": "Empty filename"}), 400

        filename = secure_filename(file.filename)
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        file.save(filepath)

        _, extension = os.path.splitext(filename.lower())
        content = ""
        if extension in TEXT_EXTENSIONS:
            with open(filepath, "r", encoding="utf-8", errors="replace") as uploaded_file:
                content = uploaded_file.read(120000)

        return jsonify({"status": "uploaded", "filename": filename, "content": content})

    except Exception:
        app.logger.exception("Upload Error")
        return jsonify({"error": "Upload failed."}), 500


@app.route("/logout")
def logout():
    session.pop("user_email", None)
    return redirect(url_for("home"))


if __name__ == "__main__":
    app.run(debug=True)
