import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getBehaviourPlan } from "../services/api";
import "../styles/behaviour.css";
import SaveButton from "../components/SaveButton";

const GRADES = [
  "Grade 1","Grade 2","Grade 3","Grade 4","Grade 5","Grade 6",
  "Grade 7","Grade 8","Grade 9","Grade 10","Grade 11","Grade 12",
];
const LANGUAGES = ["English","Hindi","Tamil","Telugu","Kannada","Malayalam"];
const EXPERIENCES = [
  "New Teacher (0-2 years)",
  "Intermediate (3-5 years)",
  "Experienced (6-10 years)",
  "Senior (10+ years)",
];

const PROBLEM_CHIPS = [
  "Students are not listening during lessons",
  "Two students had a physical fight",
  "Most of the class seems disengaged and bored",
  "Students are using phones in class",
  "A student is being bullied by peers",
  "Students talk over each other constantly",
  "A student refuses to participate",
  "Cheating during a test",
];

const SEVERITY_CONFIG = {
  low:    { label: "Low",    color: "#16a34a", bg: "#dcfce7", dot: "#16a34a" },
  medium: { label: "Medium", color: "#d97706", bg: "#fef3c7", dot: "#d97706" },
  high:   { label: "High",   color: "#dc2626", bg: "#fee2e2", dot: "#dc2626" },
};

const STEP_COLORS = ["#4f46e5", "#0891b2", "#7c3aed"];

export default function BehaviourCoach() {
  const navigate  = useNavigate();
  const profile   = JSON.parse(localStorage.getItem("profile") || "{}");

  const [form, setForm] = useState({
    problem:    "",
    grade:      profile?.grade      || "Grade 5",
    subject:    profile?.subjects   || "",
    experience: profile?.experience || EXPERIENCES[0],
    language:   "English",
  });

  const [plan,    setPlan]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [copied,  setCopied]  = useState(null);   // index of copied script

  const handleChange = (e) =>
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleChip = (text) =>
    setForm((p) => ({ ...p, problem: text }));

  const handleSubmit = async () => {
    if (form.problem.trim().length < 10) {
      setError("Please describe the problem in more detail (at least 10 characters).");
      return;
    }
    setError("");
    setLoading(true);
    setPlan(null);

    try {
      const data = await getBehaviourPlan(form);
      setPlan(data);
    } catch {
      setError("Failed to generate plan. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyScript = (script, idx) => {
    navigator.clipboard.writeText(script).then(() => {
      setCopied(idx);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const handlePrint = () => window.print();

  const sev = plan ? (SEVERITY_CONFIG[plan.severity] || SEVERITY_CONFIG.medium) : null;

  return (
    <div className="bc-page">

      {/* TOPBAR */}
      <div className="bc-topbar no-print">
        <button className="bc-back-btn" onClick={() => navigate("/assistant")}>
          ← Back
        </button>
        <div className="bc-topbar-title">
          <span className="bc-icon">🧠</span>
          <div>
            <strong>Behaviour Coach</strong>
            <span>AI-powered classroom action plans</span>
          </div>
        </div>
        {plan && (
          <button className="bc-print-btn" onClick={handlePrint}>
            🖨 Print Plan
          </button>
        )}
      </div>

      <div className="bc-body">

        {/* INPUT PANEL */}
        <div className="bc-input-panel no-print">

          <div className="bc-field">
            <label>Describe the classroom problem</label>
            <textarea
              name="problem"
              rows={4}
              placeholder="e.g. Two students had a fight during recess and are now refusing to sit near each other in class. The rest of the class is distracted."
              value={form.problem}
              onChange={handleChange}
            />
            <span className="bc-charcount">{form.problem.length} chars</span>
          </div>

          <div className="bc-chips-label">Or pick a common scenario:</div>
          <div className="bc-chips">
            {PROBLEM_CHIPS.map((chip) => (
              <button
                key={chip}
                className={`bc-chip ${form.problem === chip ? "active" : ""}`}
                onClick={() => handleChip(chip)}
              >
                {chip}
              </button>
            ))}
          </div>

          <div className="bc-form-row">
            <div className="bc-field">
              <label>Grade</label>
              <select name="grade" value={form.grade} onChange={handleChange}>
                {GRADES.map((g) => <option key={g}>{g}</option>)}
              </select>
            </div>

            <div className="bc-field">
              <label>Subject</label>
              <input
                name="subject"
                placeholder="e.g. Science"
                value={form.subject}
                onChange={handleChange}
              />
            </div>

            <div className="bc-field">
              <label>Your experience</label>
              <select name="experience" value={form.experience} onChange={handleChange}>
                {EXPERIENCES.map((e) => <option key={e}>{e}</option>)}
              </select>
            </div>

            <div className="bc-field">
              <label>Language</label>
              <select name="language" value={form.language} onChange={handleChange}>
                {LANGUAGES.map((l) => <option key={l}>{l}</option>)}
              </select>
            </div>
          </div>

          {error && <div className="bc-error">⚠️ {error}</div>}

          <button
            className="bc-submit-btn"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? "Generating plan…" : "🧠 Get Action Plan"}
          </button>
        </div>

        {/* LOADING */}
        {loading && (
          <div className="bc-loading no-print">
            <div className="bc-spinner" />
            <p>Analysing the situation and building your plan…</p>
          </div>
        )}

        {/* PLAN OUTPUT */}
        {plan && (
          <div className="bc-plan">

            {/* PLAN HEADER */}
            <div className="bc-plan-header">
              <div className="bc-plan-title-row">
                <h2 className="bc-plan-title">{plan.title}</h2>
                <span
                  className="bc-severity-badge"
                  style={{ background: sev.bg, color: sev.color }}
                >
                  <span
                    className="bc-severity-dot"
                    style={{ background: sev.dot }}
                  />
                  {sev.label} severity
                </span>
              </div>
              <p className="bc-plan-problem">"{form.problem}"</p>
            </div>

            {/* QUICK TIP */}
            {plan.quick_tip && (
              <div className="bc-quick-tip">
                <span className="bc-quick-tip-icon">⚡</span>
                <div>
                  <strong>Do this right now:</strong>
                  <p>{plan.quick_tip}</p>
                </div>
              </div>
            )}

            {/* 3-STEP PLAN */}
            <div className="bc-steps">
              {plan.steps.map((step, i) => (
                <div
                  key={i}
                  className="bc-step-card"
                  style={{ "--step-color": STEP_COLORS[i] }}
                >
                  <div className="bc-step-header">
                    <span className="bc-step-num">Step {step.step}</span>
                    <h3 className="bc-step-title">{step.title}</h3>
                  </div>

                  <div className="bc-step-body">

                    <div className="bc-step-section">
                      <span className="bc-step-section-label">What to do</span>
                      <p>{step.action}</p>
                    </div>

                    <div className="bc-step-section bc-why">
                      <span className="bc-step-section-label">Why it works</span>
                      <p>{step.why}</p>
                    </div>

                    <div className="bc-step-section bc-script-section">
                      <div className="bc-script-header">
                        <span className="bc-step-section-label">What to say</span>
                        <button
                          className={`bc-copy-btn ${copied === i ? "copied" : ""}`}
                          onClick={() => handleCopyScript(step.script, i)}
                        >
                          {copied === i ? "✓ Copied" : "Copy"}
                        </button>
                      </div>
                      <blockquote className="bc-script">
                        "{step.script}"
                      </blockquote>
                    </div>

                  </div>
                </div>
              ))}
            </div>

            {/* ESCALATION NOTICE */}
            {plan.when_to_escalate && (
              <div className="bc-escalate">
                <span className="bc-escalate-icon">🚨</span>
                <div>
                  <strong>When to escalate:</strong>
                  <p>{plan.when_to_escalate}</p>
                </div>
              </div>
            )}

            {/* FOOTER ACTIONS */}
            <div className="bc-plan-actions no-print">
              <button
                className="bc-new-btn"
                onClick={() => { setPlan(null); setForm((p) => ({ ...p, problem: "" })); }}
              >
                ← New Problem
              </button>
                <SaveButton
                content={JSON.stringify(plan, null, 2)}
                defaultTitle={plan.title}
                source="behaviour"
                />
              <button className="bc-print-btn-lg" onClick={handlePrint}>
                🖨 Print Plan
              </button>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}