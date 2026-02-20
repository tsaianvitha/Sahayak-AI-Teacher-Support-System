import { useNavigate } from "react-router-dom";

export default function CTA() {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate("/signup");
  };

  return (
    <section className="cta">
      <button
        type="button"
        className="cta-btn"
        onClick={handleClick}
      >
        Get Started Free →
      </button>
    </section>
  );
}
