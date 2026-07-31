const chat = document.getElementById("chat");
const input = document.getElementById("msg");
const sendButton = document.getElementById("sendButton");
const fileInput = document.getElementById("fileInput");
const uploadStatus = document.getElementById("uploadStatus");
const settingsMenu = document.getElementById("settingsMenu");

function escapeHTML(text) {
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatPlainText(text) {
    return escapeHTML(text)
        .split(/\n{2,}/)
        .map((paragraph) => paragraph.trim().replace(/\n/g, "<br>"))
        .filter(Boolean)
        .map((paragraph) => `<p>${paragraph}</p>`)
        .join("");
}

function formatMessage(text) {
    const raw = String(text || "").trim();
    if (!raw) {
        return "<p>No content returned.</p>";
    }

    const parts = raw.split(/```/);
    return parts.map((part, index) => {
        if (index % 2 === 1) {
            const code = part.replace(/^[a-zA-Z0-9_-]+\n/, "").trim();
            return `
                <div class="code-block">
                    <button class="copy-code" type="button" title="Copy code">Copy</button>
                    <pre><code>${escapeHTML(code)}</code></pre>
                </div>
            `;
        }

        return formatPlainText(part);
    }).join("");
}

async function copyText(text, button) {
    try {
        await navigator.clipboard.writeText(text);
    } catch (error) {
        const helper = document.createElement("textarea");
        helper.value = text;
        helper.style.position = "fixed";
        helper.style.opacity = "0";
        document.body.appendChild(helper);
        helper.select();
        document.execCommand("copy");
        helper.remove();
    }

    if (button) {
        const oldText = button.textContent;
        button.textContent = "Copied";
        window.setTimeout(() => {
            button.textContent = oldText;
        }, 1200);
    }
}

function wireCopyButtons(message, rawContent) {
    const fullCopy = message.querySelector(".copy-message");
    if (fullCopy) {
        fullCopy.addEventListener("click", () => copyText(rawContent, fullCopy));
    }

    message.querySelectorAll(".copy-code").forEach((button) => {
        button.addEventListener("click", () => {
            const code = button.parentElement.querySelector("code");
            copyText(code ? code.textContent : "", button);
        });
    });
}

function addMessage(role, content) {
    const rawContent = String(content || "");
    const message = document.createElement("div");
    message.className = `message ${role}`;

    if (role === "bot") {
        message.innerHTML = `
            <div class="message-toolbar">
                <button class="copy-message" type="button" title="Copy full response">Copy</button>
            </div>
            <div class="message-content">${formatMessage(rawContent)}</div>
        `;
        wireCopyButtons(message, rawContent);
    } else {
        message.innerHTML = `<div class="message-content">${formatPlainText(rawContent)}</div>`;
    }

    chat.appendChild(message);
    chat.scrollTop = chat.scrollHeight;
    return message;
}

function setBusy(isBusy) {
    sendButton.disabled = isBusy;
    input.disabled = isBusy;
    sendButton.textContent = isBusy ? "Sending..." : "Send";
}

function toggleSettings() {
    settingsMenu.hidden = !settingsMenu.hidden;
}

document.addEventListener("click", (event) => {
    if (!event.target.closest(".settings")) {
        settingsMenu.hidden = true;
    }
});

async function uploadFile() {
    const file = fileInput.files[0];
    if (!file) {
        uploadStatus.textContent = "No file selected";
        return;
    }

    uploadStatus.textContent = `Uploading ${file.name}...`;

    const formData = new FormData();
    formData.append("file", file);

    try {
        const response = await fetch("/upload", {
            method: "POST",
            body: formData,
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            uploadStatus.textContent = data.error || "Upload failed";
            return;
        }

        uploadStatus.textContent = `Attached: ${data.filename}`;
        addMessage("user", `Attached file/photo: ${data.filename}`);

        if (data.content) {
            const prefix = input.value.trim() ? `${input.value.trim()}\n\n` : "";
            input.value = `${prefix}Fix this program from ${data.filename}:\n\n${data.content}`;
            resizeComposer();
            input.focus();
        }
    } catch (error) {
        uploadStatus.textContent = "Upload failed";
    } finally {
        fileInput.value = "";
    }
}

async function sendMessage() {
    const message = input.value.trim();
    if (!message) return;

    addMessage("user", message);
    input.value = "";
    input.style.height = "";
    setBusy(true);

    const typing = addMessage("bot", "Thinking...");
    typing.classList.add("typing");

    try {
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({message}),
        });

        const data = await response.json().catch(() => ({}));
        typing.remove();

        if (!response.ok) {
            addMessage("bot", data.error || "Something went wrong. Please try again.");
            return;
        }

        addMessage("bot", data.response || "I did not receive a response.");
    } catch (error) {
        typing.remove();
        addMessage("bot", "Could not reach the server. Make sure Flask is running.");
    } finally {
        setBusy(false);
        input.focus();
    }
}

function handleKey(event) {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

function resizeComposer() {
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 240)}px`;
}

async function newChat() {
    try {
        const response = await fetch("/new_chat", {method: "POST"});
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            addMessage("bot", data.error || "Could not start a new chat.");
            return;
        }

        chat.innerHTML = "";
        uploadStatus.textContent = "No file selected";
        input.focus();
    } catch (error) {
        addMessage("bot", "Could not reach the server.");
    }
}

async function loadMessages() {
    try {
        const response = await fetch("/get_messages");
        if (!response.ok) return;

        const messages = await response.json();
        chat.innerHTML = "";

        messages.forEach((msg) => addMessage(msg.role === "user" ? "user" : "bot", msg.content));
    } catch (error) {
        addMessage("bot", "Could not load previous messages.");
    }
}

document.addEventListener("DOMContentLoaded", () => {
    loadMessages();
    input.addEventListener("input", resizeComposer);
    input.focus();
});
