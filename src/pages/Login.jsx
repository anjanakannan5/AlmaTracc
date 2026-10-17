
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaArrowLeft, FaGraduationCap, FaLock } from "react-icons/fa";

export default function Login() {
  const [role, setRole] = useState("alumni");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  function handleSubmit(event) {
    event.preventDefault();

    // Frontend preview only. Real authentication comes later.
    navigate(role === "admin" ? "/admin" : "/alumni");
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
              onClick={() => setRole("alumni")}
            >
              Alumni
            </button>
            <button
              type="button"
              className={role === "admin" ? "role-option active" : "role-option"}
              onClick={() => setRole("admin")}
            >
              Administrator
            </button>
          </div>

          <form onSubmit={handleSubmit} className="form-stack">
            <label htmlFor="identifier">
              {role === "alumni" ? "Roll number or email" : "Admin email"}
            </label>
            <input
              id="identifier"
              type={role === "admin" ? "email" : "text"}
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder={role === "alumni" ? "Enter your roll number" : "Enter your admin email"}
              required
            />

            <div className="label-row">
              <label htmlFor="password">Password</label>
              <Link to="/login" className="small-link"
                onClick={(event) => {
                  event.preventDefault();
                  window.alert("Password recovery will be connected to the backend.");
                }}>
                Forgot password?
              </Link>
            </div>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              required
            />

            <button type="submit" className="button button-primary full-width">
              Sign in
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
