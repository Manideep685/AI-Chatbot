import type { Attachment, Chat, Message } from "./types";

export async function fetchChats(): Promise<Chat[]> {
  const response = await fetch("/api/chats");
  if (!response.ok) throw new Error("Failed to load chats");
  return response.json();
}

export async function createChat(): Promise<Chat> {
  const response = await fetch("/api/chats", { method: "POST" });
  if (!response.ok) throw new Error("Failed to create chat");
  return response.json();
}

export async function deleteChat(chatId: string): Promise<void> {
  const response = await fetch(`/api/chats/${chatId}`, { method: "DELETE" });
  if (!response.ok) throw new Error("Failed to delete chat");
}

export async function fetchMessages(chatId: string): Promise<Message[]> {
  const response = await fetch(`/api/chats/${chatId}/messages`);
  if (!response.ok) throw new Error("Failed to load messages");
  return response.json();
}

export async function uploadFiles(files: FileList): Promise<Attachment[]> {
  const formData = new FormData();
  Array.from(files).forEach((file) => formData.append("files", file));
  const response = await fetch("/api/upload", { method: "POST", body: formData });
  if (!response.ok) throw new Error("Upload failed");
  const data = await response.json();
  return data.files;
}

type StreamHandlers = {
  onMeta: (chatId: string) => void;
  onToken: (token: string) => void;
  onImage: (attachment: Attachment) => void;
  onDone: (message: Message) => void;
  onError: (message: string) => void;
};

export async function streamChat(
  chatId: string,
  message: string,
  attachments: Attachment[],
  signal: AbortSignal,
  handlers: StreamHandlers,
) {
  const response = await fetch(`/api/chats/${chatId || "new"}/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, attachments }),
    signal,
  });

  if (!response.ok || !response.body) {
    throw new Error("Stream failed");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() || "";

    for (const chunk of chunks) {
      const event = chunk.match(/^event: (.+)$/m)?.[1];
      const dataText = chunk.match(/^data: (.+)$/m)?.[1];
      if (!event || !dataText) continue;

      const data = JSON.parse(dataText);
      if (event === "meta") handlers.onMeta(data.chatId);
      if (event === "token") handlers.onToken(data.token);
      if (event === "image") handlers.onImage(data.attachment);
      if (event === "done") handlers.onDone(data.message);
      if (event === "error") handlers.onError(data.message);
    }
  }
}
