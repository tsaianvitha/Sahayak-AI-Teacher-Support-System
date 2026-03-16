import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { generateQuiz } from "../services/api";
import "../styles/quiz.css";
import SaveButton from "../components/SaveButton";

const GRADES = [
  "Grade 1","Grade 2","Grade 3","Grade 4","Grade 5",
  "Grade 6","Grade 7","Grade 8","Grade 9","Grade 10",
  "Grade 11","Grade 12",
];

const LANGUAGES = ["English","Hindi","Tamil","Telugu","Kannada","Malayalam"];

export default function QuizGenerator() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    topic:        "",
    grade:        "Grade 5",
    subject:      "",
    numQuestions: 5,
    language:     "English",
  });

  const [questions, setQuestions]   = useState([]);
  const [selected, setSelected]     = useState({});   // { qIndex: "A" }
  const [revealed, setRevealed]     = useState(false);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");
  const [score, setScore]           = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleGenerate = async () => {
    if (!form.topic.trim()) { setError("Please enter a topic."); return; }
    if (!form.subject.trim()) { setError("Please enter a subject."); return; }

    setError("");
    setLoading(true);
    setQuestions([]);
    setSelected({});
    setRevealed(false);
    setScore(null);

    try {
      const data = await generateQuiz({
        grade:        form.grade,
        subject:      form.subject,
        topic:        form.topic,
        numQuestions: Number(form.numQuestions),
        language:     form.language,
      });

      if (!data.questions?.length) {
        setError("No questions returned. Try a different topic.");
      } else {
        setQuestions(data.questions);
      }
    } catch {
      setError("Failed to generate quiz. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (qIndex, letter) => {
    if (revealed) return;
    setSelected((prev) => ({ ...prev, [qIndex]: letter }));
  };

  const handleReveal = () => {
    const total   = questions.length;
    const correct = questions.filter(
      (q, i) => selected[i] === q.answer
    ).length;
    setScore({ correct, total });
    setRevealed(true);
  };

  const handleReset = () => {
    setSelected({});
    setRevealed(false);
    setScore(null);
  };

  const handlePrint = () => window.print();

  const optionState = (qIndex, letter) => {
    if (!revealed) {
      return selected[qIndex] === letter ? "selected" : "";
    }
    const correct = questions[qIndex].answer;
    if (letter === correct) return "correct";
    if (selected[qIndex] === letter && letter !== correct) return "wrong";
    return "";
  };

  return (
    <div className="quiz-page">

      {/* HEADER */}
      <div className="quiz-topbar">
        <button className="quiz-back-btn" onClick={() => navigate("/assistant")}>
          ← Back
        </button>
        <div className="quiz-topbar-title">
          <span className="quiz-icon">📝</span>
          <div>
            <strong>Quiz Generator</strong>
            <span>AI-powered MCQ creator</span>
          </div>
        </div>
        {questions.length > 0 && (
          <button className="quiz-print-btn" onClick={handlePrint}>
            🖨 Print
          </button>
        )}
      </div>

      {/* FORM CARD */}
      <div className="quiz-form-card">
        <div className="quiz-form-grid">

          <div className="quiz-field">
            <label>Topic</label>
            <input
              name="topic"
              placeholder="e.g. Photosynthesis, Fractions, World War II"
              value={form.topic}
              onChange={handleChange}
            />
          </div>

          <div className="quiz-field">
            <label>Subject</label>
            <input
              name="subject"
              placeholder="e.g. Science, Mathematics, History"
              value={form.subject}
              onChange={handleChange}
            />
          </div>

          <div className="quiz-field">
            <label>Grade</label>
            <select name="grade" value={form.grade} onChange={handleChange}>
              {GRADES.map((g) => <option key={g}>{g}</option>)}
            </select>
          </div>

          <div className="quiz-field">
            <label>Language</label>
            <select name="language" value={form.language} onChange={handleChange}>
              {LANGUAGES.map((l) => <option key={l}>{l}</option>)}
            </select>
          </div>

          <div className="quiz-field quiz-field-num">
            <label>No. of Questions <span className="quiz-count-badge">{form.numQuestions}</span></label>
            <input
              type="range"
              name="numQuestions"
              min="1"
              max="20"
              step="1"
              value={form.numQuestions}
              onChange={handleChange}
              className="quiz-slider"
            />
            <div className="quiz-slider-labels">
              <span>1</span><span>5</span><span>10</span><span>15</span><span>20</span>
            </div>
          </div>

        </div>

        {error && <div className="quiz-error">⚠️ {error}</div>}

        <button
          className="quiz-generate-btn"
          onClick={handleGenerate}
          disabled={loading}
        >
          {loading ? "Generating…" : "✨ Generate Quiz"}
        </button>
      </div>

      {/* LOADING */}
      {loading && (
        <div className="quiz-loading">
          <div className="quiz-spinner" />
          <p>Creating {form.numQuestions} questions on <strong>{form.topic}</strong>…</p>
        </div>
      )}

      {/* QUESTIONS */}
      {questions.length > 0 && (
        <div className="quiz-results">

          {/* META BAR */}
          <div className="quiz-meta-bar">
            <div className="quiz-meta-info">
              <span className="quiz-meta-pill">{form.grade}</span>
              <span className="quiz-meta-pill">{form.subject}</span>
              <span className="quiz-meta-pill">{form.language}</span>
              <strong className="quiz-meta-topic">{form.topic}</strong>
            </div>
            <span className="quiz-meta-count">{questions.length} questions</span>
            <SaveButton
                content={questions.map((q, i) =>
                    `Q${i+1}. ${q.question}\n${q.options.join("\n")}\nAnswer: ${q.answer}`
                ).join("\n\n")}
                defaultTitle={`${form.topic} Quiz — ${form.grade}`}
                source="quiz"
                />
          </div>

          {/* SCORE BANNER */}
          {score && (
            <div className={`quiz-score-banner ${score.correct === score.total ? "perfect" : score.correct >= score.total / 2 ? "good" : "low"}`}>
              <span className="quiz-score-num">{score.correct}/{score.total}</span>
              <span className="quiz-score-label">
                {score.correct === score.total
                  ? "Perfect score! 🎉"
                  : score.correct >= score.total / 2
                  ? "Good effort! 👍"
                  : "Keep practising 💪"}
              </span>
              <button className="quiz-retry-btn" onClick={handleReset}>Try Again</button>
            </div>
          )}

          {/* QUESTION CARDS */}
          {questions.map((q, qi) => (
            <div
              key={qi}
              className={`quiz-question-card ${revealed ? "revealed" : ""}`}
            >
              <div className="quiz-q-header">
                <span className="quiz-q-num">Q{qi + 1}</span>
                <p className="quiz-q-text">{q.question}</p>
              </div>

              <div className="quiz-options">
                {q.options.map((opt, oi) => {
                  const letter = ["A","B","C","D"][oi];
                  const state  = optionState(qi, letter);
                  return (
                    <button
                      key={oi}
                      className={`quiz-option ${state}`}
                      onClick={() => handleSelect(qi, letter)}
                      disabled={revealed}
                    >
                      <span className="quiz-option-letter">{letter}</span>
                      <span className="quiz-option-text">
                        {/* Strip leading "A. " prefix if model included it */}
                        {opt.replace(/^[A-D]\.\s*/, "")}
                      </span>
                      {revealed && letter === q.answer && (
                        <span className="quiz-tick">✓</span>
                      )}
                      {revealed && selected[qi] === letter && letter !== q.answer && (
                        <span className="quiz-cross">✗</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* FOOTER ACTIONS */}
          <div className="quiz-footer-actions">
            {!revealed ? (
              <button
                className="quiz-check-btn"
                onClick={handleReveal}
                disabled={Object.keys(selected).length === 0}
              >
                Check Answers
              </button>
            ) : (
              <button className="quiz-retry-btn-lg" onClick={handleReset}>
                ↺ Try Again
              </button>
            )}
            <button className="quiz-new-btn" onClick={handleGenerate}>
              ✨ New Quiz
            </button>
          </div>

        </div>
      )}
    </div>
  );
}