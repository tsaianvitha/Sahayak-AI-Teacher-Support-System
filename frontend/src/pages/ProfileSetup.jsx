import "../styles/profile-setup.css";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

export default function ProfileSetup() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    experience: "",
    subjects: "",
    location: "",
    challenges: "",
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    localStorage.setItem("profile", JSON.stringify(form));
const token = localStorage.getItem("access_token");

if (!token) {
  navigate("/login");
  return;
}

navigate("/assistant", { state: { name: form.name } });
  };

  return (
    <div className="profile-bg">
      <div className="profile-card">
        <div className="profile-icon">🎓</div>

        <h1>Welcome to TeachAssist</h1>
        <p className="subtitle">
          Let's set up your profile so we can provide you with personalized support
        </p>

        <form onSubmit={handleSubmit}>
          <div>
            <label>👤 Your Name</label>
            <input
              required
              placeholder="Enter your name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div>
            <label>📖 Teaching Experience</label>
            <select
              required
              value={form.experience}
              onChange={(e) => setForm({ ...form, experience: e.target.value })}
            >
              <option value="">Select your experience level</option>
              <option>New Teacher (0-2 years)</option>
              <option>Intermediate (3-5 years)</option>
              <option>Experienced (6-10 years)</option>
              <option>Senior (10+ years)</option>
            </select>
          </div>

          <div>
            <label>Subjects You Teach</label>
            <input
              required
              placeholder="e.g., Mathematics, Science, English"
              value={form.subjects}
              onChange={(e) => setForm({ ...form, subjects: e.target.value })}
            />
          </div>

          <div>
            <label>Location/Area</label>
            <input
              required
              placeholder="e.g., Rural district, City name"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
          </div>

          <div>
            <label>Main Challenges You Face</label>
            <textarea
              required
              placeholder="Tell us about the main difficulties you encounter in teaching (e.g., large class sizes, student engagement, resource limitations, etc.)"
              value={form.challenges}
              onChange={(e) => setForm({ ...form, challenges: e.target.value })}
            />
          </div>

          <button type="submit">Get Started</button>
        </form>
      </div>
    </div>
  );
}