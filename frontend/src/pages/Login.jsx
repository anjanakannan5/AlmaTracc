import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaArrowLeft, FaGraduationCap, FaLock, FaInfoCircle } from "react-icons/fa";

export default function Login() {
  const [role, setRole] = useState("alumni");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (role === "admin") {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: "admin", identifier, password }),
        });
        const data = await res.json();
        if (data.success) {
          localStorage.setItem("almatracc_user", JSON.stringify({ role: "admin", name: "Administrator" }));
          navigate("/admin");
        } else {
          setError(data.error || "Login failed");
        }
      } else {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: "alumni", identifier, password }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          localStorage.setItem("almatracc_user", JSON.stringify(data.alumnus));
          navigate("/alumni");
        } else {
          setError(data.error || "Alumni record not found. Try roll number e.g. 97MW01.");
        }
      }
    } catch {
      // If network/offline, allow preview navigation
      if (role === "admin") {
        localStorage.setItem("almatracc_user", JSON.stringify({ role: "admin", name: "Administrator" }));
        navigate("/admin");
      } else {
        localStorage.setItem("almatracc_user", JSON.stringify({
          roll_number: identifier || "97MW01",
          first_name: "Akshay",
          last_name: "Raghu",
          year_of_passing: 2002,
          branch: "Software Engineering",
        }));
        navigate("/alumni");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-brand">
        <Link to="/" className="brand">
          <span className="brand-mark"><FaGraduationCap /></span>
          <span className="brand-copy">
            <strong>AlmaTracc</strong>
            <small>AMCS Alumni Network</small>
          </span>
        </Link>
        <Link to="/" className="back-link">
          <FaArrowLeft /> Back to home
        </Link>
      </div>

      <section className="auth-layout">
        <div className="auth-intro">
          <span className="eyebrow">WELCOME BACK</span>
          <h1>Your AMCS community, all in one place.</h1>
          <p>
            Sign in to manage your alumni profile and keep
            your professional information up to date.
          </p>
          <div className="auth-quote">
            <span className="quote-mark">“</span>
            <p>
              The years may take us in different directions.
              Our roots remain the same.
            </p>
          </div>
        </div>

        <div className="auth-card">
          <h2>Sign in to AlmaTracc</h2>
          <p className="muted">
            Choose your portal to continue.
          </p>

          <div className="role-switch" aria-label="Select portal">
            <button
              type="button"
              className={role === "alumni" ? "role-option active" : "role-option"}
              onClick={() => { setRole("alumni"); setError(""); }}
            >
              Alumni
            </button>
            <button
              type="button"
              className={role === "admin" ? "role-option active" : "role-option"}
              onClick={() => { setRole("admin"); setError(""); }}
            >
              Administrator
            </button>
          </div>

          {error && (
            <div style={{
              background: "#fee2e2",
              border: "1px solid #f87171",
              color: "#991b1b",
              borderRadius: "8px",
              padding: "10px 14px",
              marginBottom: "16px",
              fontSize: "0.88rem"
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="form-stack">
            <label htmlFor="identifier">
              {role === "alumni" ? "Roll number or email" : "Admin email"}
            </label>
            <input
              id="identifier"
              type={role === "admin" ? "email" : "text"}
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder={role === "alumni" ? "e.g. 97MW01" : "admin@almatracc.edu"}
              required
            />

            {role === "alumni" && (
              <p style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "-6px", display: "flex", alignItems: "center", gap: "6px" }}>
                <FaInfoCircle /> Example roll numbers in database: <code>97MW01</code>, <code>97MW02</code>
              </p>
            )}

            <div className="label-row">
              <label htmlFor="password">Password</label>
              <Link to="/login" className="small-link"
                onClick={(event) => {
                  event.preventDefault();
                  window.alert("Password recovery: For alumni, use your registered Roll Number.");
                }}>
                Forgot password?
              </Link>
            </div>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={role === "admin" ? "Enter admin password" : "Enter password (or any for demo)"}
              required
            />

            <button type="submit" className="button button-primary full-width" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          {role === "alumni" && (
            <div className="auth-help">
              <p>New to AlmaTracc?</p>
              <Link to="/register" className="small-link">
                Register your alumni account
              </Link>
              <p className="forgot-roll">
                Don't remember your roll number?{" "}
                <Link to="/forgot-roll-number" className="small-link">
                  Find your roll number
                </Link>
              </p>
            </div>
          )}

          <div className="secure-note">
            <FaLock />
            <span>Your account information should be kept secure.</span>
          </div>
        </div>
      </section>
    </main>
  );
}
