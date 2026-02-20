import { useNavigate } from "react-router-dom";

export default function Hero() {
  const navigate = useNavigate();   // ✅ hook INSIDE component

  return (
    <section className="hero">
      <div className="hero-container">
        <div className="hero-icon">
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 3L1 9L12 15L23 9L12 3Z"
              stroke="white"
              strokeWidth="2"
            />
            <path
              d="M5 11V16C5 18.5 9 21 12 21C15 21 19 18.5 19 16V11"
              stroke="white"
              strokeWidth="2"
            />
          </svg>
        </div>

        <h1 className="hero-title">
          Welcome to <span>TeachAssist</span>
        </h1>

        <p className="hero-description">
          Your personal AI teaching companion, designed especially for educators
          in under-resourced areas. Get expert guidance on classroom management,
          teaching methods, and student engagement—anytime, anywhere.
        </p>

        <div className="hero-actions">
          {/* ✅ NAVIGATION BUTTON */}
          <button
            className="primary-btn"
            onClick={() => navigate("/signup")}
          >
            Get Started Free →
          </button>

          <div className="hero-note">
            <span className="check">✔</span>
            No registration required
          </div>
        </div>

        <div className="hero-stats">
          <div>
            <strong className="blue">24/7</strong>
            <span>Available</span>
          </div>
          <div>
            <strong className="green">Free</strong>
            <span>Forever</span>
          </div>
          <div>
            <strong className="orange">AI</strong>
            <span>Powered</span>
          </div>
        </div>
      </div>
    </section>
  );
}
