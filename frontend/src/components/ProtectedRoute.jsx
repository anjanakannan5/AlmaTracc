import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { apiFetch } from "../api";

export default function ProtectedRoute({ role, children }) {
  const [user, setUser] = useState(null);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    apiFetch("/api/auth/session")
      .then(async (response) => {
        if (!response.ok) return null;
        const data = await response.json();
        return data.user;
      })
      .then((sessionUser) => {
        if (active) setUser(sessionUser);
      })
      .catch(() => {
        if (active) setError("Could not verify your sign-in with the cloud service. Check your connection and retry.");
      })
      .finally(() => {
        if (active) setChecked(true);
      });

    return () => {
      active = false;
    };
  }, []);

  if (!checked) {
    return <main className="auth-page">Checking your sign-in...</main>;
  }
  if (error) {
    return <main className="auth-page"><div className="error-message" role="alert">{error}</div></main>;
  }
  if (!user || user.role !== role) {
    return <Navigate to="/login" replace />;
  }

  return typeof children === "function" ? children(user) : children;
}
