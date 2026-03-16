import { useState } from "react";
import { saveResource } from "../services/api";
import "../styles/save-button.css";

const TAGS = [
  { value: "lesson-plan", label: "Lesson Plan" },
  { value: "quiz",        label: "Quiz"         },
  { value: "worksheet",   label: "Worksheet"    },
  { value: "tip",         label: "Teaching Tip" },
  { value: "behaviour",   label: "Behaviour"    },
  { value: "other",       label: "Other"        },
];

export default function SaveButton({ content, defaultTitle = "", source = "assistant" }) {
  const profile = JSON.parse(localStorage.getItem("profile") || "{}");

  const [open,    setOpen]    = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [title,   setTitle]   = useState(defaultTitle);
  const [tag,     setTag]     = useState("tip");
  const [subject, setSubject] = useState(profile?.subjects || "");
  const [error,   setError]   = useState("");

  const handleSave = async () => {
    if (!title.trim()) { setError("Please enter a title."); return; }
    setSaving(true);
    setError("");
    try {
      await saveResource({
        title:   title.trim(),
        content,
        tag,
        subject: subject.trim() || "General",
        grade:   profile?.grade || "",
        source,
      });
      setSaved(true);
      setOpen(false);
    } catch {
      setError("Could not save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  if (saved) {
    return (
      <span className="sb-saved-badge">
        ✓ Saved to library
      </span>
    );
  }

  return (
    <div className="sb-wrap">
      <button
        className="sb-trigger"
        onClick={() => setOpen((v) => !v)}
        title="Save to library"
      >
        {open ? "✕" : "🔖 Save"}
      </button>

      {open && (
        <div className="sb-popover">
          <p className="sb-popover-label">Save to your library</p>

          <input
            className="sb-input"
            placeholder="Title (e.g. Photosynthesis tip)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />

          <div className="sb-row">
            <select
              className="sb-select"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
            >
              {TAGS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>

            <input
              className="sb-input sb-subject"
              placeholder="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          {error && <p className="sb-error">{error}</p>}

          <button
            className="sb-confirm"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      )}
    </div>
  );
}