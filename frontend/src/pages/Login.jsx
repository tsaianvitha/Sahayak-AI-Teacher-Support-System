import "../styles/auth.css";
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { login } from "../services/api";

export default function Login() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: "",
    password: ""
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

    if (!formData.email || !formData.password) {
      setError("All fields are required");
      return;
    }

    setLoading(true);

    try {
      await login(formData.email, formData.password);
      
      // Check if profile is set up
      const profile = localStorage.getItem("profile");
      if (profile) {
        navigate("/assistant");
      } else {
        navigate("/profile-setup");
      }
    } catch (err) {
      setError(err.response?.data?.msg || "Invalid credentials");
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
          <h1>Welcome Back</h1>
          <p>Sign in to continue to TeachAssist</p>
        </div>

        {/* Form */}
        <form className="auth-form" onSubmit={handleSubmit}>
          
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
              placeholder="Enter your password"
              value={formData.password}
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
            {loading ? "Signing In..." : "Sign In"}
          </button>

        </form>

        {/* Footer - Link to Signup */}
        <div className="auth-footer">
          <p>
            Don't have an account?
            <Link to="/signup">Sign Up</Link>
          </p>
        </div>

      </div>
    </div>
  );
}