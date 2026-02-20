import "../styles/assistant.css";
import { useNavigate, useLocation } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import { askAI, getChats, createChat, getConversations } from "../services/api";
import api from "../services/api";

const langMap = {
  English: "en-US",
  Hindi: "hi-IN",
  Tamil: "ta-IN",
  Telugu: "te-IN",
  Kannada: "kn-IN",
  Malayalam: "ml-IN",
};

export default function Assistant() {
  const { state } = useLocation();
  const name = state?.name || localStorage.getItem("userName") || "Teacher";
  const navigate = useNavigate();

  const [language, setLanguage] = useState(
    localStorage.getItem("language") || "English"
  );
  const [message, setMessage] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  // Sidebar sessions from DB: [{ id, title }]
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const chatEndRef = useRef(null);
  const recognitionRef = useRef(null);

  /* ── AUTH CHECK ── */
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    const profile = localStorage.getItem("profile");
    if (!token) navigate("/login");
    if (!profile) navigate("/profile-setup");
  }, [navigate]);

  /* ── LOAD ALL CHATS FROM DB ON MOUNT ── */
  useEffect(() => {
    loadChats();
  }, []);

  /* ── AUTO SCROLL ── */
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  /* ─────────────────────────────────────────
     DB HELPERS
  ───────────────────────────────────────── */

  const makeWelcomeMsg = () => ({
    type: "bot",
    sender: "Bot",
    text: `Hello ${name} 👋 I'm your teaching assistant. How can I help you today?`,
    time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  });

  const loadChats = async () => {
    try {
      setLoadingChats(true);
      const chats = await getChats(); // returns [{ id, title }]
      setSessions(chats);

      if (chats.length > 0) {
        // Resume last active session the user was on
        const lastId = parseInt(localStorage.getItem("activeChatId"));
        const target = chats.find((c) => c.id === lastId) || chats[0];
        await openSession(target.id, chats);
      } else {
        setChatHistory([makeWelcomeMsg()]);
      }
    } catch (err) {
      console.error("Failed to load chats:", err);
      setChatHistory([makeWelcomeMsg()]);
    } finally {
      setLoadingChats(false);
    }
  };

  const openSession = async (chatId) => {
    try {
      setLoadingMessages(true);
      setActiveSessionId(chatId);
      localStorage.setItem("activeChatId", chatId);

      const convos = await getConversations(chatId); // [{ question, response, time }]

      if (convos.length === 0) {
        setChatHistory([makeWelcomeMsg()]);
      } else {
        // Rebuild message pairs from DB
        const history = [];
        convos.forEach((c) => {
          history.push({
            type: "user",
            sender: name,
            text: c.question,
            time: new Date(c.time).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
          });
          history.push({
            type: "bot",
            sender: "Bot",
            text: c.response,
            time: new Date(c.time).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
          });
        });
        setChatHistory(history);
      }
    } catch (err) {
      console.error("Failed to load conversations:", err);
      setChatHistory([makeWelcomeMsg()]);
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleNewChat = async () => {
    try {
      const newChat = await createChat(); // { id }
      const newSession = { id: newChat.id, title: "New Chat" };
      setSessions((prev) => [newSession, ...prev]);
      setActiveSessionId(newChat.id);
      localStorage.setItem("activeChatId", newChat.id);
      setChatHistory([makeWelcomeMsg()]);
    } catch (err) {
      console.error("Failed to create chat:", err);
    }
  };

  const handleDeleteSession = async (e, chatId) => {
    e.stopPropagation();
    try {
      await api.delete(`/chats/${chatId}`);
      const remaining = sessions.filter((s) => s.id !== chatId);
      setSessions(remaining);

      if (chatId === activeSessionId) {
        if (remaining.length > 0) {
          await openSession(remaining[0].id);
        } else {
          setActiveSessionId(null);
          localStorage.removeItem("activeChatId");
          setChatHistory([makeWelcomeMsg()]);
        }
      }
    } catch (err) {
      console.error("Failed to delete chat:", err);
    }
  };

  /* ─────────────────────────────────────────
     SEND MESSAGE
  ───────────────────────────────────────── */

  const handleSend = async () => {
    const trimmed = message.trim();
    if (!trimmed) return;

    // Create a session if none is active
    let chatId = activeSessionId;
    if (!chatId) {
      try {
        const newChat = await createChat();
        chatId = newChat.id;
        const newSession = { id: chatId, title: trimmed.slice(0, 40) };
        setSessions((prev) => [newSession, ...prev]);
        setActiveSessionId(chatId);
        localStorage.setItem("activeChatId", chatId);
      } catch (err) {
        console.error("Failed to create chat:", err);
        return;
      }
    }

    const now = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    const userMsg = { type: "user", sender: name, text: trimmed, time: now };
    setChatHistory((prev) => [...prev, userMsg]);
    setMessage("");
    setIsTyping(true);

    try {
      const profile = JSON.parse(localStorage.getItem("profile") || "{}");
      const grade = profile?.grade || "General";
      const subject = profile?.subject || "Teaching";

      // Send chat_id so backend saves conversation in the right session
      const res = await askAI(grade, subject, trimmed, language, chatId);
      const botText = res.response || "No response generated.";

      // Sync if backend assigned a new chat_id
      if (res.chat_id && res.chat_id !== chatId) {
        chatId = res.chat_id;
        setActiveSessionId(chatId);
        localStorage.setItem("activeChatId", chatId);
      }

      const botMsg = {
        type: "bot",
        sender: "Bot",
        text: botText,
        time: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };

      setChatHistory((prev) => [...prev, botMsg]);

      // Set sidebar title from first user message
      setSessions((prev) =>
        prev.map((s) =>
          s.id === chatId && s.title === "New Chat"
            ? { ...s, title: trimmed.slice(0, 40) }
            : s
        )
      );
    } catch (err) {
      console.error("AI Error:", err);
      setChatHistory((prev) => [
        ...prev,
        {
          type: "bot",
          sender: "Bot",
          text: "AI service error. Please try again.",
          time: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  /* ── VOICE INPUT ── */
  const toggleRecording = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Speech recognition not supported in this browser");
      return;
    }

    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }

    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.lang = langMap[language] || "en-US";
    recognitionRef.current.onresult = (event) => {
      setMessage(event.results[0][0].transcript);
    };
    recognitionRef.current.onerror = () => setIsRecording(false);
    recognitionRef.current.start();
    setIsRecording(true);
  };

  /* ─────────────────────────────────────────
     RENDER
  ───────────────────────────────────────── */

  return (
    <div className="assistant-layout">

      {/* SIDEBAR */}
      <div className="chat-sidebar">
        <div className="sidebar-header">
          <h3>Chats</h3>
          <button className="new-chat-btn" onClick={handleNewChat}>
            + New Chat
          </button>
        </div>

        <div className="session-list">
          {loadingChats ? (
            <div className="session-loading">Loading chats...</div>
          ) : sessions.length === 0 ? (
            <div className="session-empty">No chats yet</div>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                className={`session-item ${session.id === activeSessionId ? "active" : ""}`}
                onClick={() => openSession(session.id)}
              >
                <span className="session-icon">💬</span>
                <span className="session-title">{session.title}</span>
                <button
                  className="delete-session-btn"
                  onClick={(e) => handleDeleteSession(e, session.id)}
                  title="Delete chat"
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* MAIN */}
      <div className="assistant-main">

        {/* TOP NAV */}
        <header className="top-nav">
          <div className="nav-left">
            <div className="logo">🎓</div>
            <div>
              <strong>TeachAssist</strong>
              <span>Empowering Teachers Everywhere</span>
            </div>
          </div>

          <div className="nav-right">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="lang-select"
            >
              {Object.keys(langMap).map((lang) => (
                <option key={lang}>{lang}</option>
              ))}
            </select>

            <button className="nav-btn active">💬 Assistant</button>
            <button className="nav-btn" onClick={() => navigate("/profile")}>
              👤 Profile
            </button>

            <div className="divider" />
            <div className="user-name">{name}</div>
          </div>
        </header>

        {/* SCROLLABLE CONTENT */}
        <div className="scrollable-content">

          <div className="assistant-header">
            <div>🤖</div>
            <div>
              <h2>Teaching Assistant</h2>
              <p>Ask me anything about teaching</p>
            </div>
          </div>

          {/* QUICK TOPICS — only on fresh/empty chat */}
          {chatHistory.length === 1 && (
            <div className="topics">
              {[
                "How can I manage a large classroom effectively?",
                "What are some effective teaching methods for mixed-ability classes?",
                "How do I keep students engaged when resources are limited?",
                "How should I handle disruptive student behavior?",
                "Can you help me create an engaging lesson plan?",
                "How can I manage my teaching time more effectively?",
              ].map((q, i) => (
                <div key={i} className="topic" onClick={() => setMessage(q)}>
                  <h4>{q.split("?")[0]}</h4>
                  <p>{q}</p>
                </div>
              ))}
            </div>
          )}

          {/* CHAT AREA */}
          <div className="chat-area">
            <div className="chat">
              {loadingMessages ? (
                <div className="bot-msg">Loading conversation...</div>
              ) : (
                chatHistory.map((msg, index) => (
                  <div key={index} className="chat-block">
                    <div className="message-wrapper">
                      <div className={msg.type === "bot" ? "bot-msg" : "user-msg"}>
                        {msg.text}
                      </div>
                    </div>
                    <small>
                      <strong>{msg.sender}</strong> · {msg.time}
                    </small>
                  </div>
                ))
              )}
              {isTyping && (
                <div className="bot-msg typing-indicator">Typing...</div>
              )}
              <div ref={chatEndRef} />
            </div>
          </div>

        </div>

        {/* INPUT */}
        <div className="chat-input">
          <input
            placeholder="Type your message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSend()}
          />

          <button
            className={`mic ${isRecording ? "recording" : ""}`}
            onClick={toggleRecording}
            title="Voice input"
          >
            🎤
          </button>

          <button className="send" onClick={handleSend} title="Send message">
            ➤
          </button>

          <button
            className="nav-btn"
            onClick={() => {
              localStorage.clear();
              navigate("/login");
            }}
          >
            🚪 Logout
          </button>
        </div>

      </div>
    </div>
  );
}