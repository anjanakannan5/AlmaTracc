
import { Link, useLocation } from "react-router-dom";
import { FaArrowLeft, FaGraduationCap } from "react-icons/fa";

export default function AccountHelp() {
  const { pathname } = useLocation();
  const isRecovery = pathname === "/forgot-roll-number";

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
        <Link to="/login" className="back-link">
          <FaArrowLeft /> Back to sign in
        </Link>
      </div>

      <section className="help-page-content">
        <span className="eyebrow">AMCS ALUMNI NETWORK</span>
        <h1>{isRecovery ? "Find your roll number" : "Join AlmaTracc"}</h1>

        <p>
          {isRecovery
            ? "Roll number recovery will help alumni identify their existing record and verify their identity securely."
            : "Registration will help you claim your existing alumni record and create your account."}
        </p>

        <div className="help-notice">
          <strong>{isRecovery ? "Recovery setup pending" : "Registration setup pending"}</strong>
          <p>
            This step will be connected to the alumni database
            and identity-verification process before launch.
          </p>
        </div>

        <Link to="/login" className="button button-primary">
          Return to sign in
        </Link>
      </section>
    </main>
  );
}
