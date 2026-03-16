import { Routes, Route, Navigate } from "react-router-dom";

import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ProfileSetup from "./pages/ProfileSetup";
import Assistant from "./pages/Assistant";
import Profile from "./pages/Profile";
import QuizGenerator from "./pages/QuizGenerator";
import BehaviourCoach from "./pages/BehaviourCoach";
import ResourceLibrary from "./pages/ResourceLibrary";


/* ================= ROUTE GUARDS ================= */

// Public pages (login / signup) → redirect if already onboarded
function PublicRoute({ children }) {
  const token = localStorage.getItem("access_token");
  const profile = localStorage.getItem("profile");

  if (token && profile) {
    return <Navigate to="/assistant" replace />;
  }

  return children;
}

// Requires login only
function AuthRoute({ children }) {
  const token = localStorage.getItem("access_token");

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

// Requires login + profile
function ProfileRoute({ children }) {
  const token = localStorage.getItem("access_token");
  const profile = localStorage.getItem("profile");

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (!profile) {
    return <Navigate to="/profile-setup" replace />;
  }

  return children;
}


/* ================= APP ================= */

export default function App() {
  return (
    <Routes>
      {/* ===== LANDING (ALWAYS ACCESSIBLE) ===== */}
      <Route path="/" element={<Landing />} />

      {/* ===== PUBLIC ===== */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />

      <Route
        path="/signup"
        element={
          <PublicRoute>
            <Signup />
          </PublicRoute>
        }
      />

      {/* ===== AUTH ONLY ===== */}
      <Route
        path="/profile-setup"
        element={
          <AuthRoute>
            <ProfileSetup />
          </AuthRoute>
        }
      />

      {/* ===== AUTH + PROFILE ===== */}
      <Route
        path="/assistant"
        element={
          <ProfileRoute>
            <Assistant />
          </ProfileRoute>
        }
      />

      <Route
        path="/profile"
        element={
          <ProfileRoute>
            <Profile />
          </ProfileRoute>
        }
      />
      <Route path="/quiz" element={<QuizGenerator />} />
      <Route path="/behaviour-coach" element={<BehaviourCoach />} />
      <Route path="/library" element={<ResourceLibrary />} />
      {/* ===== FALLBACK ===== */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
