export type Attachment = {
  id?: string;
  type: "image" | "file";
  name: string;
  url: string;
  mime?: string;
};

export type Chat = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export type Message = {
  id: string;
  chat_id?: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  attachments?: Attachment[];
};
