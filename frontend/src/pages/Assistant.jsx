import "../styles/assistant.css";
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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [message, setMessage] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [feedbackState, setFeedbackState] = useState({});

  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [loadingChats, setLoadingChats] = useState(true);

  const chatEndRef = useRef(null);

  /* AUTH CHECK */
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    const profile = localStorage.getItem("profile");
    if (!token) navigate("/login");
    if (!profile) navigate("/profile-setup");
  }, [navigate]);

  useEffect(() => {
    loadChats();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  const makeWelcomeMsg = () => ({
    type: "bot",
    sender: "AI Mentor",
    text: `Hello ${name} 👋 I'm your AI teaching mentor. How can I assist you today?`,
    time: new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
  });

  const loadChats = async () => {
    try {
      const chats = await getChats();
      setSessions(chats);

      if (chats.length > 0) {
        await openSession(chats[0].id);
      } else {
        setChatHistory([makeWelcomeMsg()]);
      }
    } catch {
      setChatHistory([makeWelcomeMsg()]);
    } finally {
      setLoadingChats(false);
    }
  };

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
        const formattedTime = new Date(c.time).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });

        history.push({
          type: "user",
          sender: name,
          text: c.question,
          time: formattedTime,
        });

        history.push({
          type: "bot",
          sender: "AI Mentor",
          text: c.response,
          time: formattedTime,
          conversationId: c.id,
        });
      });

      setChatHistory(history);
    } catch {
      setChatHistory([makeWelcomeMsg()]);
    }
  };

  const handleNewChat = async () => {
    const newChat = await createChat();
    setSessions((prev) => [
      { id: newChat.id, title: "New Chat" },
      ...prev,
    ]);
    setActiveSessionId(newChat.id);
    setChatHistory([makeWelcomeMsg()]);
  };

  const handleDeleteSession = async (e, chatId) => {
    e.stopPropagation();
    try {
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
    } catch (err) {
      console.error(err);
    }
  };

  const handleSend = async () => {
    const trimmed = message.trim();
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

    setMessage("");
    setIsTyping(true);

    try {
      const profile = JSON.parse(localStorage.getItem("profile") || "{}");
      const res = await askAI(
        profile?.grade || "General",
        profile?.subject || "Teaching",
        trimmed,
        language,
        chatId
      );

      setChatHistory((prev) => [
        ...prev,
        {
          type: "bot",
          sender: "AI Mentor",
          text: res.response,
          time: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          conversationId: res.conversation_id,
        },
      ]);
    } catch {
      setChatHistory((prev) => [
        ...prev,
        {
          type: "bot",
          sender: "AI Mentor",
          text: "AI error. Try again.",
          time: now,
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleFeedbackSubmit = async (conversationId) => {
    const current = feedbackState[conversationId];
    if (!current?.rating) return;

    await submitFeedback(conversationId, {
      worked: current.rating >= 3,
      rating: current.rating,
      comment: current.comment,
    });

    setFeedbackState((prev) => ({
      ...prev,
      [conversationId]: { ...current, submitted: true },
    }));
  };

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
              className={`session-item ${
                session.id === activeSessionId ? "active" : ""
              }`}
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
            <div className="user-name">{name}</div>
          </div>
        </header>

        <div className="scrollable-content">
          <div className="assistant-header">
            <div>✨</div>
            <div>
              <h2>Hi {name}, let's improve your classroom impact</h2>
              <p>Your feedback helps personalize future suggestions.</p>
            </div>
          </div>
          
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
                <div
                  key={i}
                  className="topic"
                  onClick={() => setMessage(q)}
                >
                  <h4>{q.split("?")[0]}</h4>
                  <p>{q}</p>
                </div>
              ))}
            </div>
          )}

          <div className="chat-area">
            <div className="chat">
              {chatHistory.map((msg, index) => (
                <div key={index} className="chat-block">
                  <div className={msg.type === "bot" ? "bot-msg" : "user-msg"}>
                    {msg.text}
                  </div>

                  <small>
                    <strong>{msg.sender}</strong> · {msg.time}
                  </small>

                  {msg.type === "bot" && msg.conversationId && (
                    <div className="feedback-card">
                      {feedbackState[msg.conversationId]?.submitted ? (
                        <div className="feedback-success">
                          ✅ Thanks! I’ll adapt.
                        </div>
                      ) : (
                        <>
                          <div className="feedback-question">
                            Rate this suggestion:
                          </div>

                          <div className="rating-buttons">
                            {[1,2,3,4,5].map((n) => (
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
                            value={
                              feedbackState[msg.conversationId]?.comment || ""
                            }
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
                            onClick={() =>
                              handleFeedbackSubmit(msg.conversationId)
                            }
                          >
                            Submit
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {isTyping && (
                <div className="bot-msg">Analyzing classroom context...</div>
              )}

              <div ref={chatEndRef} />
            </div>
          </div>
        </div>

        <div className="chat-input">
          <input
            placeholder="Describe your classroom situation..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
          />
          <button className="send" onClick={handleSend}>
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}