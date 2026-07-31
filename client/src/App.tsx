import jsPDF from "jspdf";
import {
  Bot,
  Camera,
  Copy,
  Download,
  FileUp,
  Image,
  Menu,
  MessageSquarePlus,
  Plus,
  RefreshCw,
  Search,
  Square,
  Trash2,
  User,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { createChat, deleteChat, fetchChats, fetchMessages, streamChat, uploadFiles } from "./api";
import { useChatStore } from "./store";
import type { Attachment, Message } from "./types";

const emptyAssistant =
  "Hello! I am ready to help with questions, code, files, images, and program fixes.";

function stamp() {
  return new Date().toISOString();
}

function shortTime(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function copyText(text: string) {
  navigator.clipboard.writeText(text);
}

export default function App() {
  const {
    chats,
    messages,
    activeChatId,
    sidebarOpen,
    isStreaming,
    attachedFiles,
    setChats,
    setMessages,
    setActiveChatId,
    setSidebarOpen,
    setIsStreaming,
    addMessage,
    updateMessage,
    addAttachments,
    removeAttachment,
    clearAttachments,
  } = useChatStore();

  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [plusOpen, setPlusOpen] = useState(false);
  const [typingText, setTypingText] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const filteredChats = useMemo(
    () => chats.filter((chat) => chat.title.toLowerCase().includes(search.toLowerCase())),
    [chats, search],
  );

  useEffect(() => {
    refreshChats();
  }, []);

  useEffect(() => {
    if (activeChatId) {
      fetchMessages(activeChatId).then(setMessages).catch(() => setMessages([]));
    }
  }, [activeChatId, setMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingText]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "b") {
        event.preventDefault();
        setSidebarOpen(!sidebarOpen);
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "n") {
        event.preventDefault();
        handleNewChat();
      }
      if (event.key === "Escape") {
        setPlusOpen(false);
        setSidebarOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sidebarOpen]);

  async function refreshChats() {
    const loaded = await fetchChats();
    setChats(loaded);
    if (!activeChatId && loaded[0]) setActiveChatId(loaded[0].id);
  }

  async function handleNewChat() {
    const chat = await createChat();
    setChats([chat, ...chats]);
    setActiveChatId(chat.id);
    setMessages([]);
    setSidebarOpen(false);
  }

  async function handleDeleteChat(chatId: string) {
    await deleteChat(chatId);
    const remaining = chats.filter((chat) => chat.id !== chatId);
    setChats(remaining);
    if (activeChatId === chatId) {
      setActiveChatId(remaining[0]?.id || "");
      setMessages([]);
    }
  }

  async function handleUpload(files: FileList | null) {
    if (!files?.length) return;
    const uploaded = await uploadFiles(files);
    addAttachments(uploaded);
    setPlusOpen(false);
  }

  function stopGeneration() {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
    setTypingText("");
  }

  async function sendMessage(override?: string) {
    const text = (override ?? input).trim();
    if ((!text && attachedFiles.length === 0) || isStreaming) return;

    setInput("");
    setTypingText("");
    const localUser: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text || "Uploaded attachment",
      created_at: stamp(),
      attachments: attachedFiles,
    };
    addMessage(localUser);

    const assistantId = crypto.randomUUID();
    addMessage({ id: assistantId, role: "assistant", content: "", created_at: stamp(), attachments: [] });
    const attachmentsToSend = attachedFiles;
    clearAttachments();

    const controller = new AbortController();
    abortRef.current = controller;
    setIsStreaming(true);
    let collected = "";
    let currentChatId = activeChatId;

    try {
      await streamChat(currentChatId, text, attachmentsToSend, controller.signal, {
        onMeta: (chatId) => {
          currentChatId = chatId;
          if (!activeChatId) setActiveChatId(chatId);
        },
        onToken: (token) => {
          collected += token;
          setTypingText(collected);
          updateMessage(assistantId, { content: collected });
        },
        onImage: (attachment) => {
          updateMessage(assistantId, { attachments: [attachment] });
        },
        onDone: (message) => {
          updateMessage(assistantId, { ...message, content: collected || message.content });
        },
        onError: (message) => {
          updateMessage(assistantId, { content: message });
        },
      });
    } catch (error) {
      if (!controller.signal.aborted) {
        updateMessage(assistantId, { content: "Could not reach the local AI server." });
      }
    } finally {
      setIsStreaming(false);
      setTypingText("");
      abortRef.current = null;
      refreshChats();
      if (currentChatId && currentChatId !== activeChatId) setActiveChatId(currentChatId);
    }
  }

  function regenerateLast() {
    const lastUser = [...messages].reverse().find((message) => message.role === "user");
    if (lastUser) sendMessage(lastUser.content);
  }

  function exportPdf() {
    const pdf = new jsPDF();
    const title = chats.find((chat) => chat.id === activeChatId)?.title || "Chat export";
    let y = 16;
    pdf.setFontSize(16);
    pdf.text(title, 14, y);
    y += 12;
    pdf.setFontSize(10);
    messages.forEach((message) => {
      const label = message.role === "user" ? "You" : "AI";
      const lines = pdf.splitTextToSize(`${label}: ${message.content}`, 180);
      if (y + lines.length * 6 > 286) {
        pdf.addPage();
        y = 16;
      }
      pdf.text(lines, 14, y);
      y += lines.length * 6 + 6;
    });
    pdf.save(`${title.replace(/[^\w-]+/g, "_")}.pdf`);
  }

  return (
    <div className="min-h-screen bg-[#0f1117] text-zinc-100">
      <div className={`fixed inset-0 z-30 bg-black/50 transition-opacity ${sidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"}`} onClick={() => setSidebarOpen(false)} />

      <aside className={`fixed left-0 top-0 z-40 h-full w-80 border-r border-white/10 bg-[#111318]/95 p-4 shadow-glow backdrop-blur-xl transition-transform duration-300 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold">Local AI</h1>
          <button className="icon-btn" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar">
            <X size={18} />
          </button>
        </div>

        <button className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl bg-teal-500 px-4 py-3 font-semibold text-black transition hover:bg-teal-400" onClick={handleNewChat}>
          <MessageSquarePlus size={18} /> New Chat
        </button>

        <label className="mb-3 flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
          <Search size={16} className="text-zinc-400" />
          <input className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-500" placeholder="Search chats" value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>

        <div className="space-y-2 overflow-y-auto pb-8">
          {filteredChats.map((chat) => (
            <div key={chat.id} className={`group flex items-center gap-2 rounded-xl p-2 transition ${chat.id === activeChatId ? "bg-white/12" : "hover:bg-white/7"}`}>
              <button
                className="min-w-0 flex-1 truncate text-left text-sm"
                onClick={() => {
                  setActiveChatId(chat.id);
                  setSidebarOpen(false);
                }}
              >
                {chat.title}
              </button>
              <button className="rounded-lg p-2 text-zinc-500 opacity-0 transition hover:bg-red-500/20 hover:text-red-300 group-hover:opacity-100" onClick={() => handleDeleteChat(chat.id)} aria-label="Delete chat">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      </aside>

      <main className="flex h-screen flex-col">
        <header className="flex h-16 items-center justify-between border-b border-white/10 bg-[#111318]/75 px-4 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <button className="icon-btn" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Open menu">
              <Menu size={22} />
            </button>
            <div>
              <p className="text-sm font-semibold">ChatGPT-style Local Chatbot</p>
              <p className="text-xs text-zinc-500">Ollama, SQLite, uploads, streaming</p>
            </div>
          </div>
          <button className="hidden rounded-xl border border-white/10 px-3 py-2 text-sm text-zinc-300 transition hover:bg-white/10 sm:block" onClick={exportPdf}>
            Export PDF
          </button>
        </header>

        <section className="flex-1 overflow-y-auto px-4 py-6">
          <div className="mx-auto flex max-w-4xl flex-col gap-5">
            {messages.length === 0 && (
              <div className="mt-20 rounded-2xl border border-white/10 bg-white/[0.04] p-8 text-center shadow-glow">
                <Bot className="mx-auto mb-4 text-teal-300" size={38} />
                <h2 className="mb-2 text-2xl font-semibold">How can I help you today?</h2>
                <p className="text-zinc-400">{emptyAssistant}</p>
              </div>
            )}

            {messages.map((message) => (
              <article key={message.id} className={`group flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                {message.role === "assistant" && <Avatar ai />}
                <div className={`max-w-[84%] rounded-2xl border px-4 py-3 shadow-sm transition ${message.role === "user" ? "border-teal-400/20 bg-teal-500/15" : "border-white/10 bg-white/[0.055]"}`}>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="text-xs text-zinc-500">{shortTime(message.created_at)}</span>
                    {message.role === "assistant" && (
                      <div className="flex opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                        <button className="mini-btn" onClick={() => copyText(message.content)} title="Copy response">
                          <Copy size={14} />
                        </button>
                        <button className="mini-btn" onClick={regenerateLast} title="Regenerate">
                          <RefreshCw size={14} />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="prose prose-invert max-w-none prose-pre:rounded-xl prose-pre:border prose-pre:border-white/10 prose-pre:bg-[#090b10]">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                      {message.content || (message.role === "assistant" ? "Thinking..." : "")}
                    </ReactMarkdown>
                  </div>

                  {!!message.attachments?.length && <AttachmentGrid attachments={message.attachments} />}
                </div>
                {message.role === "user" && <Avatar />}
              </article>
            ))}
            {isStreaming && <div className="text-sm text-zinc-500">AI is typing...</div>}
            <div ref={bottomRef} />
          </div>
        </section>

        <footer className="border-t border-white/10 bg-[#111318]/80 p-3 backdrop-blur-xl">
          <div className="mx-auto max-w-4xl">
            {!!attachedFiles.length && (
              <div className="mb-3 flex flex-wrap gap-2">
                {attachedFiles.map((attachment) => (
                  <button key={attachment.url} className="flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-3 py-2 text-sm" onClick={() => removeAttachment(attachment.url)}>
                    {attachment.type === "image" ? <Image size={15} /> : <FileUp size={15} />}
                    <span className="max-w-40 truncate">{attachment.name}</span>
                    <X size={14} />
                  </button>
                ))}
              </div>
            )}

            <div className="relative flex items-end gap-2 rounded-2xl border border-white/10 bg-white/[0.06] p-2 shadow-glow">
              <button className="icon-btn" onClick={() => setPlusOpen(!plusOpen)} aria-label="Add attachment">
                <Plus size={22} />
              </button>

              {plusOpen && (
                <div className="absolute bottom-16 left-2 z-20 w-52 rounded-2xl border border-white/10 bg-[#181b22] p-2 shadow-glow">
                  <MenuItem icon={<Image size={17} />} label="Upload Image" onClick={() => imageInputRef.current?.click()} />
                  <MenuItem icon={<FileUp size={17} />} label="Upload File" onClick={() => fileInputRef.current?.click()} />
                  <MenuItem icon={<Camera size={17} />} label="Camera Capture" onClick={() => cameraInputRef.current?.click()} />
                </div>
              )}

              <textarea
                className="max-h-52 min-h-12 flex-1 resize-none bg-transparent px-2 py-3 text-sm leading-6 outline-none placeholder:text-zinc-500"
                placeholder="Message Local AI..."
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    sendMessage();
                  }
                }}
              />

              {isStreaming ? (
                <button className="send-btn bg-red-400 text-black hover:bg-red-300" onClick={stopGeneration} title="Stop generation">
                  <Square size={18} />
                </button>
              ) : (
                <button className="send-btn" onClick={() => sendMessage()} title="Send message">
                  Send
                </button>
              )}
            </div>

            <input ref={imageInputRef} className="hidden" type="file" accept="image/*" multiple onChange={(event) => handleUpload(event.target.files)} />
            <input ref={fileInputRef} className="hidden" type="file" multiple onChange={(event) => handleUpload(event.target.files)} />
            <input ref={cameraInputRef} className="hidden" type="file" accept="image/*" capture="environment" onChange={(event) => handleUpload(event.target.files)} />
            <p className="mt-2 text-center text-xs text-zinc-600">Enter sends, Shift+Enter adds a line, Ctrl+B toggles sidebar, Ctrl+N starts a new chat.</p>
          </div>
        </footer>
      </main>
    </div>
  );
}

function Avatar({ ai = false }: { ai?: boolean }) {
  return (
    <div className={`mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full ${ai ? "bg-teal-400 text-black" : "bg-zinc-700 text-white"}`}>
      {ai ? <Bot size={19} /> : <User size={18} />}
    </div>
  );
}

function AttachmentGrid({ attachments }: { attachments: Attachment[] }) {
  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2">
      {attachments.map((attachment) =>
        attachment.type === "image" ? (
          <div key={attachment.url} className="overflow-hidden rounded-xl border border-white/10 bg-black/20">
            <img className="max-h-80 w-full object-cover" src={attachment.url} alt={attachment.name} />
            <a className="flex items-center gap-2 px-3 py-2 text-sm text-teal-200 hover:text-teal-100" href={attachment.url} download>
              <Download size={15} /> Download image
            </a>
          </div>
        ) : (
          <a key={attachment.url} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-zinc-200 hover:bg-white/10" href={attachment.url} download>
            <FileUp size={16} /> {attachment.name}
          </a>
        ),
      )}
    </div>
  );
}

function MenuItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-zinc-200 transition hover:bg-white/10" onClick={onClick}>
      {icon}
      {label}
    </button>
  );
}
