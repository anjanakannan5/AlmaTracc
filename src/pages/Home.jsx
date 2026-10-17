
import { Link } from "react-router-dom";
import {
  FaArrowRight,
  FaBriefcase,
  FaLink,
  FaUsers,
} from "react-icons/fa";
import Navbar from "../components/Navbar";

export default function Home() {
  return (
    <div className="home-page">
      <Navbar />

      <main>
        <section className="hero">
          <div className="hero-content">
            <span className="eyebrow">
              AMCS · ALUMNI NETWORK
            </span>

            <h1>
              A connection that
              <br />
              lasts beyond <em>graduation.</em>
            </h1>

            <p className="hero-description">
              AlmaTracc brings AMCS alumni together in one place.
              Keep your professional journey updated and stay
              connected with the people and department you know.
            </p>

            <div className="hero-actions">
              <Link to="/login" className="button button-primary">
                Access your account <FaArrowRight />
              </Link>
              <a href="#about" className="text-link">
                Learn about AlmaTracc
              </a>
            </div>

            <p className="hero-note">
              An alumni network for every graduating generation.
            </p>
          </div>

          <div className="hero-art" aria-label="Alumni network illustration">
            <div className="art-circle art-circle-one" />
            <div className="art-circle art-circle-two" />

            <div className="art-card art-card-main">
              <span className="art-label">OUR COMMUNITY</span>
              <div className="art-monogram">A</div>
              <h2>Connected by our roots.</h2>
              <p>AMCS Alumni Network</p>
            </div>

            <div className="art-card art-card-note">
              <FaUsers />
              <div>
                <strong>One community</strong>
                <span>Across generations</span>
              </div>
            </div>

            <div className="art-card art-card-note art-card-note-bottom">
              <FaBriefcase />
              <div>
                <strong>Growing careers</strong>
                <span>Staying connected</span>
              </div>
            </div>
          </div>
        </section>

        <section className="about-section" id="about">
          <div className="section-heading">
            <span className="eyebrow">WHY ALMATRACC</span>
            <h2>Where your journey stays connected.</h2>
            <p>
              A shared space to keep track of our alumni community
              and the professional paths each graduate takes.
            </p>
          </div>

          <div className="feature-grid">
            <article className="feature">
              <span className="feature-icon"><FaUsers /></span>
              <h3>One alumni directory</h3>
              <p>
                Bring alumni records from different graduating
                years into one organized directory.
              </p>
            </article>

            <article className="feature">
              <span className="feature-icon"><FaBriefcase /></span>
              <h3>Professional journeys</h3>
              <p>
                Keep company, designation, and work location
                information up to date.
              </p>
            </article>

            <article className="feature">
              <span className="feature-icon"><FaLink /></span>
              <h3>Meaningful connections</h3>
              <p>
                Maintain professional links and a lasting
                connection with the AMCS community.
              </p>
            </article>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <Link to="/" className="footer-brand">AlmaTracc</Link>
        <span>AMCS Alumni Network</span>
        <span>Connecting generations.</span>
      </footer>
    </div>
  );
}
