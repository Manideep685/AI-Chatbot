import cors from "cors";
import express from "express";
import fs from "fs";
import multer from "multer";
import path from "path";
import sqlite3 from "sqlite3";
import { fileURLToPath } from "url";
import { v4 as uuid } from "uuid";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const dataDir = path.join(rootDir, "data");
const uploadDir = path.join(rootDir, "uploads");
const generatedDir = path.join(uploadDir, "generated");

fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(uploadDir, { recursive: true });
fs.mkdirSync(generatedDir, { recursive: true });

const app = express();
const port = process.env.PORT || 4000;
const ollamaUrl = process.env.OLLAMA_URL || "http://localhost:11434/api/generate";
const ollamaModel = process.env.OLLAMA_MODEL || "gemma:2b";

app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use("/uploads", express.static(uploadDir));

const db = new sqlite3.Database(path.join(dataDir, "chatbot.sqlite"));

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS chats (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      chat_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(chat_id) REFERENCES chats(id) ON DELETE CASCADE
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY,
      message_id TEXT,
      chat_id TEXT,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      mime TEXT,
      created_at TEXT NOT NULL
    )
  `);
});

function now() {
  return new Date().toISOString();
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => (error ? reject(error) : resolve(rows)));
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => (error ? reject(error) : resolve(row)));
  });
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(error) {
      if (error) reject(error);
      else resolve(this);
    });
  });
}

async function createChat(title = "New chat") {
  const id = uuid();
  const timestamp = now();
  await run("INSERT INTO chats (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)", [
    id,
    title,
    timestamp,
    timestamp,
  ]);
  return { id, title, created_at: timestamp, updated_at: timestamp };
}

async function ensureChat(chatId) {
  if (chatId) {
    const existing = await get("SELECT * FROM chats WHERE id = ?", [chatId]);
    if (existing) return existing;
  }
  return createChat();
}

function titleFromMessage(message) {
  const compact = message.replace(/\s+/g, " ").trim();
  return compact.length > 38 ? `${compact.slice(0, 38)}...` : compact || "New chat";
}

async function saveMessage(chatId, role, content) {
  const id = uuid();
  const timestamp = now();
  await run(
    "INSERT INTO messages (id, chat_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)",
    [id, chatId, role, content, timestamp],
  );
  await run("UPDATE chats SET updated_at = ? WHERE id = ?", [timestamp, chatId]);
  return { id, chat_id: chatId, role, content, created_at: timestamp };
}

async function attachFiles(chatId, messageId, attachments = []) {
  for (const attachment of attachments) {
    await run(
      "INSERT INTO attachments (id, message_id, chat_id, type, name, url, mime, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        uuid(),
        messageId,
        chatId,
        attachment.type || "file",
        attachment.name || "Attachment",
        attachment.url,
        attachment.mime || "",
        now(),
      ],
    );
  }
}

function isGreeting(text) {
  return /^(hi|hello|hey|hii|hai|good morning|good afternoon|good evening)[!. ]*$/i.test(text.trim());
}

function isThanks(text) {
  return /^(thanks|thank you|thankyou|thx|ty)[!. ]*$/i.test(text.trim());
}

function isImageRequest(text) {
  return /\b(generate|create|make|draw)\b.*\b(image|photo|picture|pic|art)\b/i.test(text)
    || /\b(image|photo|picture) of\b/i.test(text);
}

function quickReply(text) {
  if (isGreeting(text)) return "Hello! How can I help you today?";
  if (isThanks(text)) return "You're welcome! Happy to help.";
  return "";
}

function buildPrompt(message, recentMessages) {
  const history = recentMessages
    .slice(-12)
    .map((row) => `${row.role === "user" ? "User" : "Assistant"}: ${row.content}`)
    .join("\n\n");

  return `
You are a professional local AI assistant with ChatGPT-style behavior.
Reply naturally, accurately, and concisely.
Render code in fenced Markdown blocks with a language label.
When the user sends a large program, debug it carefully and return a complete corrected version.

${history ? `Conversation so far:\n${history}\n\n` : ""}
User: ${message}
Assistant:
`.trim();
}

async function generateLocalImage(prompt) {
  const id = uuid();
  const filename = `${id}.svg`;
  const filepath = path.join(generatedDir, filename);
  const safePrompt = prompt.replace(/[<>&]/g, "");
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#101828"/>
      <stop offset="0.45" stop-color="#176b87"/>
      <stop offset="1" stop-color="#7c3aed"/>
    </linearGradient>
    <filter id="soft"><feGaussianBlur stdDeviation="32"/></filter>
  </defs>
  <rect width="1024" height="1024" fill="url(#bg)"/>
  <circle cx="248" cy="290" r="140" fill="#22d3ee" opacity="0.35" filter="url(#soft)"/>
  <circle cx="760" cy="710" r="190" fill="#f59e0b" opacity="0.25" filter="url(#soft)"/>
  <rect x="112" y="640" width="800" height="190" rx="32" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.24)"/>
  <text x="512" y="724" text-anchor="middle" font-family="Segoe UI, Arial" font-size="38" font-weight="700" fill="#fff">Generated Image</text>
  <text x="512" y="780" text-anchor="middle" font-family="Segoe UI, Arial" font-size="24" fill="#dbeafe">${safePrompt.slice(0, 58)}</text>
</svg>`;
  fs.writeFileSync(filepath, svg, "utf8");
  return { name: "generated-image.svg", type: "image", mime: "image/svg+xml", url: `/uploads/generated/${filename}` };
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^\w.-]/g, "_")}`),
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

app.get("/api/chats", async (_req, res) => {
  const chats = await all("SELECT * FROM chats ORDER BY updated_at DESC");
  res.json(chats);
});

app.post("/api/chats", async (_req, res) => {
  res.json(await createChat());
});

app.delete("/api/chats/:chatId", async (req, res) => {
  await run("DELETE FROM chats WHERE id = ?", [req.params.chatId]);
  await run("DELETE FROM messages WHERE chat_id = ?", [req.params.chatId]);
  await run("DELETE FROM attachments WHERE chat_id = ?", [req.params.chatId]);
  res.json({ ok: true });
});

app.get("/api/chats/:chatId/messages", async (req, res) => {
  const messages = await all("SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at ASC", [req.params.chatId]);
  for (const message of messages) {
    message.attachments = await all("SELECT * FROM attachments WHERE message_id = ? ORDER BY created_at ASC", [message.id]);
  }
  res.json(messages);
});

app.post("/api/upload", upload.array("files", 8), async (req, res) => {
  const files = (req.files || []).map((file) => ({
    name: file.originalname,
    type: file.mimetype.startsWith("image/") ? "image" : "file",
    mime: file.mimetype,
    url: `/uploads/${file.filename}`,
  }));
  res.json({ files });
});

app.post("/api/chats/:chatId/stream", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const send = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const text = String(req.body.message || "").trim();
    const incomingAttachments = req.body.attachments || [];
    const chat = await ensureChat(req.params.chatId === "new" ? "" : req.params.chatId);

    if (!text && incomingAttachments.length === 0) {
      send("error", { message: "Please enter a message or attach a file." });
      res.end();
      return;
    }

    const userMessage = await saveMessage(chat.id, "user", text || "Uploaded attachment");
    await attachFiles(chat.id, userMessage.id, incomingAttachments);

    const count = await get("SELECT COUNT(*) as count FROM messages WHERE chat_id = ?", [chat.id]);
    if (count.count <= 1 && text) {
      await run("UPDATE chats SET title = ?, updated_at = ? WHERE id = ?", [titleFromMessage(text), now(), chat.id]);
    }

    send("meta", { chatId: chat.id });

    const canned = quickReply(text);
    if (canned) {
      const assistant = await saveMessage(chat.id, "assistant", canned);
      send("token", { token: canned });
      send("done", { message: assistant });
      res.end();
      return;
    }

    if (isImageRequest(text)) {
      send("token", { token: "Generating image..." });
      const image = await generateLocalImage(text);
      const content = `Generated image for: ${text}`;
      const assistant = await saveMessage(chat.id, "assistant", content);
      await attachFiles(chat.id, assistant.id, [image]);
      send("image", { attachment: image });
      send("done", { message: { ...assistant, attachments: [image] } });
      res.end();
      return;
    }

    const recentMessages = await all("SELECT role, content FROM messages WHERE chat_id = ? ORDER BY created_at ASC", [chat.id]);
    const ollamaResponse = await fetch(ollamaUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: ollamaModel,
        prompt: buildPrompt(text, recentMessages),
        stream: true,
        options: { temperature: 0.25, top_p: 0.9, num_ctx: 8192, num_predict: 1800 },
      }),
    });

    if (!ollamaResponse.ok || !ollamaResponse.body) {
      throw new Error(`Ollama error: ${ollamaResponse.status}`);
    }

    const decoder = new TextDecoder();
    let buffer = "";
    let fullText = "";

    for await (const chunk of ollamaResponse.body) {
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;
        const json = JSON.parse(line);
        if (json.response) {
          fullText += json.response;
          send("token", { token: json.response });
        }
      }
    }

    const assistant = await saveMessage(chat.id, "assistant", fullText.trim() || "I did not receive a response.");
    send("done", { message: assistant });
    res.end();
  } catch (error) {
    send("error", { message: error.message || "Server error" });
    res.end();
  }
});

app.listen(port, () => {
  console.log(`Local AI chatbot server running on http://localhost:${port}`);
});
