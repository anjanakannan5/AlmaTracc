
import { Link } from "react-router-dom";
import BrandLogo from "./BrandLogo";

export default function Navbar({ showLogin = true }) {
  return (
    <header className="navbar">
      <Link to="/" className="brand">
        <BrandLogo />
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
