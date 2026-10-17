
import { Link } from "react-router-dom";
import { FaGraduationCap } from "react-icons/fa";

export default function Navbar({ showLogin = true }) {
  return (
    <header className="navbar">
      <Link to="/" className="brand">
        <span className="brand-mark">
          <FaGraduationCap />
        </span>
        <span className="brand-copy">
          <strong>AlmaTracc</strong>
          <small>AMCS Alumni Network</small>
        </span>
      </Link>

      <nav className="nav-links">
        <a href="/#about">About</a>
        {showLogin && (
          <Link to="/login" className="button button-primary nav-cta">
            Alumni Sign In
          </Link>
        )}
      </nav>
    </header>
  );
}
