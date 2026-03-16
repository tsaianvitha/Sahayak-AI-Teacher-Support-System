import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getResources, getResourceSubjects, deleteResource } from "../services/api";
import "../styles/library.css";

const TAG_CONFIG = {
  "lesson-plan": { label: "Lesson Plan", color: "#4f46e5", bg: "#eef2ff" },
  "quiz":        { label: "Quiz",        color: "#0891b2", bg: "#e0f2fe" },
  "worksheet":   { label: "Worksheet",   color: "#7c3aed", bg: "#f5f3ff" },
  "tip":         { label: "Teaching Tip",color: "#16a34a", bg: "#dcfce7" },
  "behaviour":   { label: "Behaviour",   color: "#d97706", bg: "#fef3c7" },
  "other":       { label: "Other",       color: "#6b7280", bg: "#f3f4f6" },
};

const ALL_TAGS = ["all", ...Object.keys(TAG_CONFIG)];

function TagBadge({ tag }) {
  const cfg = TAG_CONFIG[tag] || TAG_CONFIG.other;
  return (
    <span
      className="rl-tag-badge"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      {cfg.label}
    </span>
  );
}

export default function ResourceLibrary() {
  const navigate = useNavigate();

  const [resources,  setResources]  = useState([]);
  const [subjects,   setSubjects]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState("");
  const [search,     setSearch]     = useState("");
  const [activeTag,  setActiveTag]  = useState("all");
  const [activeSub,  setActiveSub]  = useState("all");
  const [expanded,   setExpanded]   = useState(null);
  const [deleting,   setDeleting]   = useState(null);
  const [copied,     setCopied]     = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [res, subs] = await Promise.all([
        getResources({ tag: activeTag, subject: activeSub, search }),
        getResourceSubjects(),
      ]);
      setResources(res);
      setSubjects(subs);
    } catch {
      setError("Failed to load resources.");
    } finally {
      setLoading(false);
    }
  }, [activeTag, activeSub, search]);

  useEffect(() => { load(); }, [load]);

  // Group by subject
  const grouped = resources.reduce((acc, r) => {
    const key = r.subject || "General";
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  const handleDelete = async (id) => {
    setDeleting(id);
    try {
      await deleteResource(id);
      setResources((prev) => prev.filter((r) => r.id !== id));
    } catch {
      setError("Could not delete. Try again.");
    } finally {
      setDeleting(null);
    }
  };

  const handleCopy = (content, id) => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const formatDate = (iso) =>
    new Date(iso).toLocaleDateString("en-IN", {
      day: "numeric", month: "short", year: "numeric",
    });

  return (
    <div className="rl-page">

      {/* TOPBAR */}
      <div className="rl-topbar">
        <button className="rl-back-btn" onClick={() => navigate("/assistant")}>
          ← Back
        </button>
        <div className="rl-topbar-title">
          <span className="rl-icon">📚</span>
          <div>
            <strong>Resource Library</strong>
            <span>Your saved AI-generated content</span>
          </div>
        </div>
        <span className="rl-count-badge">
          {resources.length} saved
        </span>
      </div>

      <div className="rl-body">

        {/* FILTERS */}
        <div className="rl-filters">

          {/* Search */}
          <input
            className="rl-search"
            placeholder="🔍  Search by title or content…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {/* Tag filter */}
          <div className="rl-filter-row">
            <span className="rl-filter-label">Type:</span>
            <div className="rl-pills">
              {ALL_TAGS.map((t) => (
                <button
                  key={t}
                  className={`rl-pill ${activeTag === t ? "active" : ""}`}
                  onClick={() => setActiveTag(t)}
                >
                  {t === "all" ? "All" : TAG_CONFIG[t]?.label || t}
                </button>
              ))}
            </div>
          </div>

          {/* Subject filter */}
          {subjects.length > 0 && (
            <div className="rl-filter-row">
              <span className="rl-filter-label">Subject:</span>
              <div className="rl-pills">
                <button
                  className={`rl-pill ${activeSub === "all" ? "active" : ""}`}
                  onClick={() => setActiveSub("all")}
                >
                  All
                </button>
                {subjects.map((s) => (
                  <button
                    key={s}
                    className={`rl-pill ${activeSub === s ? "active" : ""}`}
                    onClick={() => setActiveSub(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* STATES */}
        {error && <div className="rl-error">⚠️ {error}</div>}

        {loading && (
          <div className="rl-loading">
            <div className="rl-spinner" />
            <p>Loading your library…</p>
          </div>
        )}

        {!loading && resources.length === 0 && (
          <div className="rl-empty">
            <div className="rl-empty-icon">📭</div>
            <h3>No saved resources yet</h3>
            <p>
              Click the <strong>🔖 Save</strong> button on any AI response in the
              assistant, quiz generator, or behaviour coach to build your library.
            </p>
            <button className="rl-goto-btn" onClick={() => navigate("/assistant")}>
              Go to Assistant
            </button>
          </div>
        )}

        {/* GROUPED RESOURCE LIST */}
        {!loading && Object.entries(grouped).map(([subject, items]) => (
          <div key={subject} className="rl-group">

            <div className="rl-group-header">
              <h2 className="rl-group-title">{subject}</h2>
              <span className="rl-group-count">{items.length}</span>
            </div>

            <div className="rl-cards">
              {items.map((r) => (
                <div
                  key={r.id}
                  className={`rl-card ${expanded === r.id ? "expanded" : ""}`}
                >
                  {/* CARD HEADER */}
                  <div
                    className="rl-card-top"
                    onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                  >
                    <div className="rl-card-meta">
                      <TagBadge tag={r.tag} />
                      {r.grade && (
                        <span className="rl-grade-badge">{r.grade}</span>
                      )}
                    </div>
                    <h3 className="rl-card-title">{r.title}</h3>
                    <div className="rl-card-footer-row">
                      <span className="rl-card-date">{formatDate(r.created_at)}</span>
                      <span className="rl-expand-icon">
                        {expanded === r.id ? "▲" : "▼"}
                      </span>
                    </div>
                  </div>

                  {/* EXPANDED CONTENT */}
                  {expanded === r.id && (
                    <div className="rl-card-body">
                      <pre className="rl-content">{r.content}</pre>
                      <div className="rl-card-actions">
                        <button
                          className={`rl-copy-btn ${copied === r.id ? "copied" : ""}`}
                          onClick={() => handleCopy(r.content, r.id)}
                        >
                          {copied === r.id ? "✓ Copied" : "Copy"}
                        </button>
                        <button
                          className="rl-delete-btn"
                          onClick={() => handleDelete(r.id)}
                          disabled={deleting === r.id}
                        >
                          {deleting === r.id ? "Deleting…" : "🗑 Delete"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

      </div>
    </div>
  );
}