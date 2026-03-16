import "../styles/assistant.css";
import SaveButton from "../components/SaveButton";
import { useNavigate, useLocation } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import {
  askAI,
  getChats,
  createChat,
  getConversations,
  submitFeedback,
} from "../services/api";
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
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [feedbackState, setFeedbackState] = useState({});
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const chatEndRef = useRef(null);

  /* ── AUTH CHECK ── */

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    const profile = localStorage.getItem("profile");
    if (!token) navigate("/login");
    if (!profile) navigate("/profile-setup");
  }, [navigate]);

  /* ── LOAD CHATS ── */

  useEffect(() => {
    loadChats();
  }, []);

  /* ── AUTO SCROLL ── */

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  /* ── HELPERS ── */

  const makeWelcomeMsg = () => ({
    type: "bot",
    sender: "Bot",
    text: `Hello ${name} 👋 I'm your teaching assistant. How can I help you today?`,
    suggestions: [],
    time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  });

  const getProfile = () =>
    JSON.parse(localStorage.getItem("profile") || "{}");

  /* ── LOAD CHAT LIST ── */

  const loadChats = async () => {
    try {
      const chats = await getChats();
      setSessions(chats);
      if (chats.length > 0) {
        openSession(chats[0].id);
      } else {
        setChatHistory([makeWelcomeMsg()]);
      }
    } catch {
      setChatHistory([makeWelcomeMsg()]);
    }
  };

  /* ── OPEN SESSION ── */

  const openSession = async (chatId) => {
    try {
      setActiveSessionId(chatId);
      const convos = await getConversations(chatId);

      if (!convos.length) {
        setChatHistory([makeWelcomeMsg()]);
        return;
      }

      const history = [];
      convos.forEach((c) => {
        const time = new Date(c.time).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
        history.push({ type: "user", sender: name, text: c.question, time });
        history.push({
          type: "bot",
          sender: "Bot",
          text: c.response,
          suggestions: [],   // old messages have no saved suggestions
          time,
          conversationId: c.id,
        });
      });

      setChatHistory(history);
    } catch {
      setChatHistory([makeWelcomeMsg()]);
    }
  };

  /* ── NEW CHAT ── */

  const handleNewChat = async () => {
    const newChat = await createChat();
    setSessions((prev) => [{ id: newChat.id, title: "New Chat" }, ...prev]);
    setActiveSessionId(newChat.id);
    setChatHistory([makeWelcomeMsg()]);
  };

  /* ── DELETE CHAT ── */

  const handleDeleteSession = async (e, chatId) => {
    e.stopPropagation();
    await api.delete(`/chats/${chatId}`);
    const remaining = sessions.filter((s) => s.id !== chatId);
    setSessions(remaining);
    if (chatId === activeSessionId) {
      if (remaining.length > 0) {
        openSession(remaining[0].id);
      } else {
        setActiveSessionId(null);
        setChatHistory([makeWelcomeMsg()]);
      }
    }
  };

  /* ── CORE SEND LOGIC (accepts text directly) ── */

  const sendMessage = async (trimmed) => {
    if (!trimmed) return;

    let chatId = activeSessionId;

    if (!chatId) {
      const newChat = await createChat();
      chatId = newChat.id;
      setActiveSessionId(chatId);
      setSessions((prev) => [
        { id: chatId, title: trimmed.slice(0, 40) },
        ...prev,
      ]);
    }

    const now = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    setChatHistory((prev) => [
      ...prev,
      { type: "user", sender: name, text: trimmed, time: now },
    ]);

    setIsTyping(true);

    try {
      const profile = getProfile();

      const res = await askAI(
        profile?.grade      || "General",
        profile?.subjects   || "Teaching",
        trimmed,
        language,
        chatId,
        profile?.experience || "",
        profile?.challenges || "",
        profile?.location   || ""
      );

      setChatHistory((prev) => [
        ...prev,
        {
          type:           "bot",
          sender:         "Bot",
          text:           res.response,
          suggestions:    res.suggestions || [],
          time:           new Date().toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          }),
          conversationId: res.conversation_id,
        },
      ]);

      setSessions((prev) =>
        prev.map((s) =>
          s.id === chatId && s.title === "New Chat"
            ? { ...s, title: trimmed.slice(0, 40) }
            : s
        )
      );
    } catch {
      setChatHistory((prev) => [
        ...prev,
        { type: "bot", sender: "Bot", text: "AI error. Try again.", time: now, suggestions: [] },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  /* ── SEND FROM INPUT BAR ── */

  const handleSend = async () => {
    const trimmed = message.trim();
    if (!trimmed) return;
    setMessage("");
    await sendMessage(trimmed);
  };

  /* ── SEND FROM SUGGESTION CHIP ── */

  const handleSuggestionTap = async (suggestion) => {
    await sendMessage(suggestion);
  };

  /* ── FEEDBACK ── */

  const handleFeedbackSubmit = async (conversationId) => {
    const current = feedbackState[conversationId];
    if (!current?.rating) return;

    await submitFeedback(conversationId, {
      worked:        current.rating >= 3,
      rating:        current.rating,
      feedback_text: current.comment,
    });

    setFeedbackState((prev) => ({
      ...prev,
      [conversationId]: { ...current, submitted: true },
    }));
  };

  /* ── VOICE INPUT ── */

  const toggleRecording = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Speech recognition not supported");
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
      return;
    }

    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.lang = langMap[language];
    recognitionRef.current.onresult = (event) => {
      setMessage(event.results[0][0].transcript);
    };
    recognitionRef.current.start();
    setIsRecording(true);
  };

  /* ── RENDER ── */

  return (
    <div className={`assistant-layout ${sidebarOpen ? "" : "collapsed"}`}>

      <div className="chat-sidebar">
        <div className="sidebar-header">
          <h3>Chats</h3>
          <button className="new-chat-btn" onClick={handleNewChat}>
            + New Chat
          </button>
        </div>

        <div className="session-list">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`session-item ${session.id === activeSessionId ? "active" : ""}`}
              onClick={() => openSession(session.id)}
            >
              <span className="session-title">{session.title}</span>
              <button
                className="delete-session-btn"
                onClick={(e) => handleDeleteSession(e, session.id)}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="assistant-main">

        <header className="top-nav">
          <div className="nav-left">
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarOpen((prev) => !prev)}
          >
            ☰
          </button>
            <div className="logo">🎓</div>
            <div>
              <strong>TeachAssist AI Mentor</strong>
              <span>Adaptive Classroom Support</span>
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
            <button className="nav-btn" onClick={() => navigate("/quiz")}>
              📝 Quiz
            </button>
            <button className="nav-btn" onClick={() => navigate("/behaviour-coach")}>
              🧠 Coach
            </button>
            <button className="nav-btn" onClick={() => navigate("/library")}>
              📚 Library
            </button>

            <div className="user-name">{name}</div>
          </div>
        </header>

        {/* CHAT AREA */}
        <div className="scrollable-content">
          <div className="assistant-header">
            <div>✨</div>
            <div>
              <h2>Hi {name}, let's improve your classroom impact</h2>
              <p>Your feedback helps personalize future suggestions.</p>
            </div>
          </div>

          <div className="chat-area">
            <div className="chat">

              {chatHistory.map((msg, index) => (
                <div key={index} className="chat-block">

                  {/* MESSAGE BUBBLE */}
                  <div className="message-wrapper">
                    <div className={msg.type === "bot" ? "bot-msg" : "user-msg"}>
                    {msg.type === "bot"
                      ? msg.text.split('\n').map((line, i) => (
                          <span key={i}>
                            {line}
                            {i < msg.text.split('\n').length - 1 && <br />}
                          </span>
                        ))
                      : msg.text}
                  </div>
                  </div>
                  {msg.type === "bot" && msg.text && (
                      <div className="message-actions">
                        <SaveButton
                          content={msg.text}
                          defaultTitle={chatHistory[index - 1]?.text?.slice(0, 50) || "AI Response"}
                          source="assistant"
                        />
                      </div>
                    )}

                  <small>
                    <strong>{msg.sender}</strong> · {msg.time}
                  </small>

                  {/* SUGGESTION CHIPS — only on bot messages with suggestions */}
                  {msg.type === "bot" &&
                    msg.suggestions?.length > 0 && (
                      <div className="suggestion-chips">
                        {msg.suggestions.map((s, i) => (
                          <button
                            key={i}
                            className="suggestion-chip"
                            onClick={() => handleSuggestionTap(s)}
                            disabled={isTyping}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    )}

                  {/* FEEDBACK CARD — only on bot messages with a conversationId */}
                  {msg.type === "bot" && msg.conversationId && (
                    <div className="feedback-card">
                      {feedbackState[msg.conversationId]?.submitted ? (
                        <div className="feedback-success">
                          ✅ Thanks for your feedback!
                        </div>
                      ) : (
                        <>
                          <div className="feedback-question">
                            Rate this response:
                          </div>

                          <div className="rating-buttons">
                            {[1, 2, 3, 4, 5].map((n) => (
                              <button
                                key={n}
                                className={`rating-btn ${
                                  feedbackState[msg.conversationId]?.rating === n
                                    ? "active"
                                    : ""
                                }`}
                                onClick={() =>
                                  setFeedbackState((prev) => ({
                                    ...prev,
                                    [msg.conversationId]: {
                                      ...(prev[msg.conversationId] || {}),
                                      rating: n,
                                    },
                                  }))
                                }
                              >
                                {n}
                              </button>
                            ))}
                          </div>

                          <textarea
                            placeholder="Optional comment"
                            value={feedbackState[msg.conversationId]?.comment || ""}
                            onChange={(e) =>
                              setFeedbackState((prev) => ({
                                ...prev,
                                [msg.conversationId]: {
                                  ...(prev[msg.conversationId] || {}),
                                  comment: e.target.value,
                                },
                              }))
                            }
                          />

                          <button
                            className="submit-feedback-btn"
                            onClick={() => handleFeedbackSubmit(msg.conversationId)}
                          >
                            Submit
                          </button>
                        </>
                      )}
                    </div>
                  )}

                </div>
              ))}

              {isTyping && <div className="bot-msg typing-indicator">Typing…</div>}

              <div ref={chatEndRef} />
            </div>
          </div>
        </div>

        {/* INPUT BAR */}
        <div className="chat-input">
          <input
            placeholder="Describe your classroom situation..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
          />

          <button
            className={`mic ${isRecording ? "recording" : ""}`}
            onClick={toggleRecording}
          >
            🎤
          </button>

          <button className="send" onClick={handleSend} disabled={isTyping}>
            ➤
          </button>

          <button
            className="nav-btn"
            onClick={() => {
              localStorage.clear();
              navigate("/login");
            }}
          >
            🚪
          </button>
        </div>
      </div>
    </div>
  );
}