import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Attachment, Chat, Message } from "./types";

type ChatState = {
  chats: Chat[];
  messages: Message[];
  activeChatId: string;
  sidebarOpen: boolean;
  isStreaming: boolean;
  attachedFiles: Attachment[];
  setChats: (chats: Chat[]) => void;
  setMessages: (messages: Message[]) => void;
  setActiveChatId: (id: string) => void;
  setSidebarOpen: (open: boolean) => void;
  setIsStreaming: (streaming: boolean) => void;
  addMessage: (message: Message) => void;
  updateMessage: (id: string, patch: Partial<Message>) => void;
  addAttachments: (attachments: Attachment[]) => void;
  removeAttachment: (url: string) => void;
  clearAttachments: () => void;
};

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      chats: [],
      messages: [],
      activeChatId: "",
      sidebarOpen: false,
      isStreaming: false,
      attachedFiles: [],
      setChats: (chats) => set({ chats }),
      setMessages: (messages) => set({ messages }),
      setActiveChatId: (activeChatId) => set({ activeChatId }),
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      setIsStreaming: (isStreaming) => set({ isStreaming }),
      addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
      updateMessage: (id, patch) =>
        set((state) => ({
          messages: state.messages.map((message) => (message.id === id ? { ...message, ...patch } : message)),
        })),
      addAttachments: (attachments) => set((state) => ({ attachedFiles: [...state.attachedFiles, ...attachments] })),
      removeAttachment: (url) =>
        set((state) => ({ attachedFiles: state.attachedFiles.filter((attachment) => attachment.url !== url) })),
      clearAttachments: () => set({ attachedFiles: [] }),
    }),
    {
      name: "local-ai-chat-state",
      partialize: (state) => ({ activeChatId: state.activeChatId, sidebarOpen: state.sidebarOpen }),
    },
  ),
);
