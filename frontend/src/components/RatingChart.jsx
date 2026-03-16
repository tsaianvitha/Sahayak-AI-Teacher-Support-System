import "../styles/profile.css";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { getRatingTrends } from "../services/api";
import RatingChart from "./RatingChart";

export default function Profile() {
  const profile  = JSON.parse(localStorage.getItem("profile")) || {};
  const navigate = useNavigate();

  const [questionsAsked, setQuestionsAsked] = useState(null);
  const [statsError,     setStatsError]     = useState(false);

  const [ratingData,  setRatingData]  = useState(null);   // { labels, averages, counts }
  const [ratingError, setRatingError] = useState(false);
  const [ratingLoad,  setRatingLoad]  = useState(true);

  /* ── fetch question count ── */
  useEffect(() => {
    api.get("/stats")
      .then((res) => setQuestionsAsked(res.data.questions_asked))
      .catch(() => { setStatsError(true); setQuestionsAsked(0); });
  }, []);

  /* ── fetch rating trends ── */
  useEffect(() => {
    setRatingLoad(true);
    getRatingTrends()
      .then((data) => setRatingData(data))
      .catch(() => setRatingError(true))
      .finally(() => setRatingLoad(false));
  }, []);

  /* derived stats from rating data */
  const totalFeedback = ratingData?.counts?.reduce((a, b) => a + b, 0) ?? 0;
  const overallAvg    = ratingData?.averages?.length
    ? (ratingData.averages.reduce((a, b) => a + b, 0) / ratingData.averages.length).toFixed(1)
    : null;

  const latestAvg  = ratingData?.averages?.at(-1)  ?? null;
  const prevAvg    = ratingData?.averages?.at(-2)   ?? null;
  const trend      = latestAvg !== null && prevAvg !== null
    ? latestAvg > prevAvg  ? "up"
    : latestAvg < prevAvg  ? "down"
    : "flat"
    : null;

  const trendIcon  = trend === "up" ? "↑" : trend === "down" ? "↓" : "→";
  const trendColor = trend === "up" ? "#16a34a" : trend === "down" ? "#ef4444" : "#6b7280";

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

      {/* IMPACT STATS */}
      <div className="impact-card">
        <h3>📈 Your Impact</h3>
        <p className="muted">Track how TeachAssist is helping you grow</p>

        <div className="impact-grid">

          <div className="impact-box blue">
            <strong>
              {questionsAsked === null
                ? <span className="stat-loading">…</span>
                : questionsAsked}
            </strong>
            <span>Questions Asked</span>
          </div>

          <div className="impact-box green">
            <strong>
              {ratingLoad
                ? <span className="stat-loading">…</span>
                : totalFeedback}
            </strong>
            <span>Feedback Given</span>
          </div>

          <div className="impact-box yellow">
            <strong>
              {ratingLoad
                ? <span className="stat-loading">…</span>
                : overallAvg
                  ? `${overallAvg}/5`
                  : "—"}
            </strong>
            <span>Avg. Satisfaction</span>
          </div>

        </div>

        {(statsError || ratingError) && (
          <p className="stat-error">Could not load live stats. Showing cached data.</p>
        )}
      </div>

      {/* RATING TRENDS CHART */}
      <div className="impact-card">
        <div className="chart-card-header">
          <div>
            <h3>⭐ Satisfaction Trends</h3>
            <p className="muted">Average rating per week from your feedback</p>
          </div>

          {latestAvg !== null && (
            <div className="chart-latest">
              <span className="chart-latest-val">{latestAvg.toFixed(1)}</span>
              <span className="chart-latest-label">this week</span>
              {trend && (
                <span className="chart-trend" style={{ color: trendColor }}>
                  {trendIcon} vs last week
                </span>
              )}
            </div>
          )}
        </div>

        {ratingLoad && (
          <div className="chart-loading">
            <div className="chart-spinner" />
            <span>Loading chart…</span>
          </div>
        )}

        {!ratingLoad && !ratingError && ratingData?.averages?.length > 0 && (
          <>
            <div className="chart-wrap">
              <RatingChart
                labels={ratingData.labels}
                averages={ratingData.averages}
                counts={ratingData.counts}
              />
            </div>

            {/* WEEKLY BREAKDOWN TABLE */}
            <div className="chart-table-wrap">
              <table className="chart-table">
                <thead>
                  <tr>
                    <th>Week</th>
                    <th>Avg Rating</th>
                    <th>Responses</th>
                    <th>Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {ratingData.labels.map((label, i) => {
                    const avg   = ratingData.averages[i];
                    const prev  = ratingData.averages[i - 1];
                    const delta = prev !== undefined ? avg - prev : null;
                    const stars = "★".repeat(Math.round(avg)) + "☆".repeat(5 - Math.round(avg));
                    return (
                      <tr key={i} className={i === ratingData.labels.length - 1 ? "latest-row" : ""}>
                        <td>{label}</td>
                        <td>
                          <span className="chart-stars">{stars}</span>
                          <span className="chart-avg-val">{avg.toFixed(1)}</span>
                        </td>
                        <td>{ratingData.counts[i]}</td>
                        <td>
                          {delta !== null && (
                            <span style={{
                              color: delta > 0 ? "#16a34a" : delta < 0 ? "#ef4444" : "#6b7280",
                              fontWeight: 500,
                              fontSize: 13,
                            }}>
                              {delta > 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1)}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {!ratingLoad && !ratingError && ratingData?.averages?.length === 0 && (
          <div className="chart-empty">
            <p>No feedback ratings yet.</p>
            <p className="muted">Rate AI responses in the assistant to start tracking your satisfaction over time.</p>
          </div>
        )}

        {!ratingLoad && ratingError && (
          <p className="stat-error">Could not load rating trends.</p>
        )}
      </div>

    </div>
  );
}