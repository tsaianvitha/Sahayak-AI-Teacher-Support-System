import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5001",
  headers: {
    "Content-Type": "application/json",
  },
});

// ✅ Attach JWT to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ---------------- AUTH ----------------
export const login = async (email, password) => {
  const res = await api.post("/login", { email, password });
  localStorage.setItem("access_token", res.data.access_token);
  return res.data;
};

export const signup = async (name, email, password) => {
  return await api.post("/signup", { name, email, password });
};

// ---------------- CHAT ----------------
export const createChat = async () => {
  const res = await api.post("/chats");
  return res.data;
};

export const getChats = async () => {
  const res = await api.get("/chats");
  return res.data;
};

export const getConversations = async (chatId) => {
  const res = await api.get(`/conversations/${chatId}`);
  return res.data;
};

// ---------------- FEEDBACK ----------------
export const submitFeedback = async (conversationId, payload) => {
  const res = await api.post(`/feedback/${conversationId}`, payload);
  return res.data;
};

// ---------------- ASK AI ----------------
// ✅ Parameter order matches Assistant.jsx: askAI(grade, subject, userMessage, language)
export const askAI = async (grade, subject, question, language, chat_id = null) => {
  const payload = { grade, subject, question, language };
  if (chat_id) payload.chat_id = chat_id;

  const res = await api.post("/ask", payload);
  return res.data;
};

export const deleteChat = async (chatId) => {
  return await api.delete(`/chats/${chatId}`);
};

export const updateChatTitle = async (chatId, title) => {
  return await api.post(`/chats/${chatId}/title`, { title });
};

export default api;