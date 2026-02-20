import "../styles/profile.css";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";

export default function Profile() {
  const profile = JSON.parse(localStorage.getItem("profile")) || {};
  const navigate = useNavigate();

  const [questionsAsked, setQuestionsAsked] = useState(null); // null = loading
  const [error, setError] = useState(false);

  /* Fetch stats from backend on mount */
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get("/stats");
        setQuestionsAsked(res.data.questions_asked);
      } catch (err) {
        console.error("Failed to load stats:", err);
        setError(true);
        setQuestionsAsked(0);
      }
    };

    fetchStats();
  }, []);

  return (
    <div className="profile-page">

      {/* BACK BUTTON */}
      <button
        className="back-btn"
        onClick={() => navigate("/assistant", { state: { name: profile.name } })}
      >
        ← Back to Assistant
      </button>

      {/* PROFILE CARD */}
      <div className="profile-card-main">
        <div className="profile-header">
          <div className="avatar">👤</div>

          <div className="profile-info">
            <h2>{profile.name || "Teacher"}</h2>
            <p>{profile.experience}</p>
          </div>

          <button className="edit-btn">✏️ Edit Profile</button>
        </div>

        <div className="profile-grid">
          <div>
            <h4>📘 Subjects</h4>
            <span className="pill">{profile.subjects}</span>
          </div>

          <div>
            <h4>📍 Location</h4>
            <p>{profile.location}</p>
          </div>
        </div>

        <div className="challenges">
          <h4>🧠 Main Challenges</h4>
          <p>{profile.challenges}</p>
        </div>
      </div>

      {/* IMPACT */}
      <div className="impact-card">
        <h3>📈 Your Impact</h3>
        <p className="muted">Track how TeachAssist is helping you grow</p>

        <div className="impact-grid">
          <div className="impact-box blue">
            <strong>
              {questionsAsked === null ? (
                <span className="stat-loading">...</span>
              ) : (
                questionsAsked
              )}
            </strong>
            <span>Questions Asked</span>
          </div>

          <div className="impact-box green">
            <strong>0</strong>
            <span>Feedback Given</span>
          </div>

          <div className="impact-box yellow">
            <strong>0/5</strong>
            <span>Avg. Satisfaction</span>
          </div>
        </div>

        {error && (
          <p className="stat-error">Could not load live stats. Showing cached data.</p>
        )}
      </div>
    </div>
  );
}