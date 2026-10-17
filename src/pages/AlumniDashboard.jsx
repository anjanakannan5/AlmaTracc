
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  FaBriefcase,
  FaCalendarAlt,
  FaCheckCircle,
  FaExternalLinkAlt,
  FaGraduationCap,
  FaHome,
  FaLinkedin,
  FaSignOutAlt,
  FaUser,
} from "react-icons/fa";

const initialProfile = {
  firstName: "Ananya",
  lastName: "Raman",
  initial: "S",
  rollNumber: "AMCS-DEMO-01",
  graduationYear: "2022",
  jobTitle: "Software Engineer",
  company: "Example Technologies",
  city: "Coimbatore",
  country: "India",
  linkedin: "",
  email: "",
};

export default function AlumniDashboard() {
  const [profile, setProfile] = useState(initialProfile);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);

  function updateField(event) {
    setProfile({
      ...profile,
      [event.target.name]: event.target.value,
    });
    setSaved(false);
  }

  function handleSave(event) {
    event.preventDefault();
    setEditing(false);
    setSaved(true);
    // Later: send the updated profile to the backend API.
  }

  const fullName = [
    profile.firstName,
    profile.lastName,
    profile.initial,
  ].filter(Boolean).join(" ");

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <Link to="/" className="brand sidebar-brand">
          <span className="brand-mark"><FaGraduationCap /></span>
          <span className="brand-copy">
            <strong>AlmaTracc</strong>
            <small>AMCS Alumni Network</small>
          </span>
        </Link>

        <span className="sidebar-label">WORKSPACE</span>
        <nav className="sidebar-nav">
          <a href="#overview" className="sidebar-link active">
            <FaHome /> Overview
          </a>
          <a href="#profile" className="sidebar-link">
            <FaUser /> My Profile
          </a>
          <a href="#professional" className="sidebar-link">
            <FaBriefcase /> Professional Details
          </a>
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-user">
            <div className="avatar">
              {profile.firstName.charAt(0)}
            </div>
            <div>
              <strong>{profile.firstName} {profile.lastName}</strong>
              <span>Alumni member</span>
            </div>
          </div>
          <Link to="/" className="sidebar-link">
            <FaSignOutAlt /> Sign out
          </Link>
        </div>
      </aside>

      <main className="dashboard-main" id="overview">
        <header className="dashboard-topbar">
          <div>
            <span className="eyebrow">ALUMNI PORTAL</span>
            <h1>My Dashboard</h1>
          </div>
          <span className="status-chip">
            <FaCheckCircle /> Profile overview
          </span>
        </header>

        <section className="welcome-panel">
          <div>
            <span className="eyebrow light-eyebrow">WELCOME TO ALMATRACC</span>
            <h2>Hello, {profile.firstName}.</h2>
            <p>
              Keep your professional journey current and
              your connection with AMCS alive.
            </p>
          </div>
          <FaGraduationCap className="welcome-icon" />
        </section>

        {saved && (
          <div className="success-message" role="status">
            Your changes are saved in this preview.
            They have not yet been sent to a database.
          </div>
        )}

        <section className="section-block" id="profile">
          <div className="section-title-row">
            <div>
              <h2>My profile</h2>
              <p className="muted">Your alumni and professional information</p>
            </div>
            <button
              type="button"
              className="button button-outline"
              onClick={() => {
                setEditing(!editing);
                setSaved(false);
              }}
            >
              {editing ? "Cancel editing" : "Edit profile"}
            </button>
          </div>

          <div className="profile-card">
            <div className="profile-heading">
              <div className="profile-avatar">
                {profile.firstName.charAt(0)}
              </div>
              <div>
                <h3>{fullName}</h3>
                <p>{profile.jobTitle || "Job title not added"}</p>
                <span className="muted">
                  Class of {profile.graduationYear}
                </span>
              </div>
            </div>

            <form onSubmit={handleSave}>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="firstName">First name</label>
                  <input id="firstName" name="firstName" value={profile.firstName}
                    onChange={updateField} disabled={!editing} required />
                </div>
                <div className="field">
                  <label htmlFor="lastName">Last name</label>
                  <input id="lastName" name="lastName" value={profile.lastName}
                    onChange={updateField} disabled={!editing} required />
                </div>
                <div className="field">
                  <label htmlFor="initial">Initial</label>
                  <input id="initial" name="initial" value={profile.initial}
                    onChange={updateField} disabled={!editing} />
                </div>
                <div className="field">
                  <label htmlFor="rollNumber">Roll number</label>
                  <input id="rollNumber" value={profile.rollNumber} disabled />
                  <small className="field-hint">Contact an administrator to correct this.</small>
                </div>
                <div className="field">
                  <label htmlFor="graduationYear">Graduation year</label>
                  <input id="graduationYear" value={profile.graduationYear} disabled />
                </div>
                <div className="field">
                  <label htmlFor="email">Email address</label>
                  <input id="email" name="email" type="email" value={profile.email}
                    onChange={updateField} disabled={!editing}
                    placeholder="you@example.com" />
                </div>
              </div>

              <div className="form-divider" id="professional">
                <h3>Professional details</h3>
                <p className="muted">
                  Help the department keep your career information up to date.
                </p>
              </div>

              <div className="form-grid">
                <div className="field">
                  <label htmlFor="jobTitle">Current designation</label>
                  <input id="jobTitle" name="jobTitle" value={profile.jobTitle}
                    onChange={updateField} disabled={!editing}
                    placeholder="e.g. Software Engineer" />
                </div>
                <div className="field">
                  <label htmlFor="company">Company</label>
                  <input id="company" name="company" value={profile.company}
                    onChange={updateField} disabled={!editing}
                    placeholder="Your current company" />
                </div>
                <div className="field">
                  <label htmlFor="city">City</label>
                  <input id="city" name="city" value={profile.city}
                    onChange={updateField} disabled={!editing} />
                </div>
                <div className="field">
                  <label htmlFor="country">Country</label>
                  <input id="country" name="country" value={profile.country}
                    onChange={updateField} disabled={!editing} />
                </div>
                <div className="field field-full">
                  <label htmlFor="linkedin">LinkedIn profile URL</label>
                  <div className="input-with-icon">
                    <FaLinkedin />
                    <input id="linkedin" name="linkedin" type="url"
                      value={profile.linkedin} onChange={updateField}
                      disabled={!editing} placeholder="https://www.linkedin.com/in/your-profile" />
                  </div>
                </div>
              </div>

              {editing && (
                <div className="form-actions">
                  <button type="button" className="button button-outline"
                    onClick={() => {
                      setProfile(initialProfile);
                      setEditing(false);
                      setSaved(false);
                    }}>
                    Reset demo data
                  </button>
                  <button type="submit" className="button button-primary">
                    Save changes
                  </button>
                </div>
              )}
            </form>
          </div>
        </section>

        <section className="update-note">
          <FaCalendarAlt />
          <div>
            <strong>Keep your profile current</strong>
            <p>
              You'll be able to confirm or update your details
              during the department's periodic alumni updates.
            </p>
          </div>
        </section>

        {profile.linkedin && (
          <a className="text-link linkedin-link"
            href={profile.linkedin} target="_blank" rel="noreferrer">
            View LinkedIn profile <FaExternalLinkAlt />
          </a>
        )}
      </main>
    </div>
  );
}
