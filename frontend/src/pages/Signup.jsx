import "../styles/auth.css";
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { signup } from "../services/api";

export default function Signup() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: ""
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Validation
    if (!formData.name || !formData.email || !formData.password) {
      setError("All fields are required");
      return;
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      await signup(formData.name, formData.email, formData.password);
      navigate("/login");
    } catch (err) {
      setError(err.response?.data?.msg || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        
        {/* Icon */}
        <div className="auth-icon">
          🎓
        </div>

        {/* Header */}
        <div className="auth-header">
          <h1>Create Account</h1>
          <p>Join TeachAssist and empower your teaching</p>
        </div>

        {/* Form */}
        <form className="auth-form" onSubmit={handleSubmit}>
          
          {/* Name */}
          <div className="form-group">
            <label>
              👤 Full Name
            </label>
            <input
              type="text"
              name="name"
              placeholder="Enter your name"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>

          {/* Email */}
          <div className="form-group">
            <label>
              📧 Email
            </label>
            <input
              type="email"
              name="email"
              placeholder="Enter your email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          {/* Password */}
          <div className="form-group">
            <label>
              🔒 Password
            </label>
            <input
              type="password"
              name="password"
              placeholder="Create a password (min 6 characters)"
              value={formData.password}
              onChange={handleChange}
              required
              minLength={6}
            />
          </div>

          {/* Confirm Password */}
          <div className="form-group">
            <label>
              🔒 Confirm Password
            </label>
            <input
              type="password"
              name="confirmPassword"
              placeholder="Confirm your password"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="error-message">
              ⚠️ {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            className="submit-btn"
            disabled={loading}
          >
            {loading ? "Creating Account..." : "Sign Up"}
          </button>

        </form>

        {/* ✅✅✅ FORCED INLINE STYLES - THIS MUST SHOW ✅✅✅ */}
        <div style={{
          textAlign: "center",
          marginTop: "24px",
          paddingTop: "24px",
          borderTop: "1px solid #e5e7eb",
          display: "block",
          width: "100%",
          visibility: "visible"
        }}>
          <p style={{
            fontSize: "14px",
            color: "#6b7280",
            margin: 0
          }}>
            Already have an account?{" "}
            <Link 
              to="/login"
              style={{
                color: "#667eea",
                textDecoration: "none",
                fontWeight: "600",
                marginLeft: "4px"
              }}
            >
              Log In
            </Link>
          </p>
        </div>

      </div>
    </div>
  );
}