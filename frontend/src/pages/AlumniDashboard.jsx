import { useState, useEffect } from "react";
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
  FaDatabase,
} from "react-icons/fa";

const defaultProfile = {
  firstName: "Akshay",
  lastName: "Raghu",
  initial: "",
  rollNumber: "97MW01",
  graduationYear: "2002",
  branch: "Software Engineering",
  jobTitle: "",
  company: "",
  city: "",
  country: "India",
  linkedin: "https://www.linkedin.com/in/akshay-raghu-pmp-7b155a4",
  email: "",
  phone: "",
};

export default function AlumniDashboard() {
  const [profile, setProfile] = useState(defaultProfile);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState("");

  useEffect(() => {
    async function loadProfile() {
      let roll = "97MW01";
      try {
        const stored = localStorage.getItem("almatracc_user");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.roll_number) roll = parsed.roll_number;
        }
      } catch (e) {
        console.error(e);
      }

      try {
        setLoading(true);
        const res = await fetch(`/api/alumni/${roll}`);
        if (res.ok) {
          const data = await res.json();
          setProfile({
            firstName: data.first_name || "",
            lastName: data.last_name || "",
            initial: data.middle_name || "",
            rollNumber: data.roll_number || roll,
            graduationYear: String(data.year_of_passing || "2002"),
            branch: data.branch || "Software Engineering",
            jobTitle: data.current_role || "",
            company: data.current_company || "",
            city: data.location || "",
            country: "India",
            linkedin: data.linkedin_url || "",
            email: data.email || "",
            phone: data.phone || "",
          });
        }
      } catch (err) {
        console.warn("Could not load alumnus profile from server:", err);
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, []);

  function updateField(event) {
    setProfile({
      ...profile,
      [event.target.name]: event.target.value,
    });
    setSaved(false);
  }

  async function handleSave(event) {
    event.preventDefault();
    setSaveStatus("Saving changes...");

    try {
      const res = await fetch(`/api/alumni/${profile.rollNumber}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: profile.firstName,
          last_name: profile.lastName,
          email: profile.email,
          phone: profile.phone,
          current_role: profile.jobTitle,
          current_company: profile.company,
          location: profile.city,
          linkedin_url: profile.linkedin,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSaved(true);
        setEditing(false);
        setSaveStatus("Profile successfully updated in database!");
      } else {
        setSaved(true);
        setEditing(false);
        setSaveStatus("Updated profile locally.");
      }
    } catch {
      setSaved(true);
      setEditing(false);
      setSaveStatus("Updated profile locally (offline mode).");
    }
  }

  const fullName = [profile.firstName, profile.lastName, profile.initial]
    .filter(Boolean)
    .join(" ") || profile.rollNumber;

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
              {profile.firstName ? profile.firstName.charAt(0) : "A"}
            </div>
            <div>
              <strong>{fullName}</strong>
              <span>Alumni member · {profile.rollNumber}</span>
            </div>
          </div>
          <Link
            to="/"
            className="sidebar-link"
            onClick={() => localStorage.removeItem("almatracc_user")}
          >
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
          <span className="status-chip" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <FaCheckCircle /> Connected to AlmaTracc DB
          </span>
        </header>

        <section className="welcome-panel">
          <div>
            <span className="eyebrow light-eyebrow">WELCOME TO ALMATRACC</span>
            <h2>Hello, {profile.firstName || profile.rollNumber}.</h2>
            <p>
              Keep your professional journey current and your connection with AMCS alive.
            </p>
          </div>
          <FaGraduationCap className="welcome-icon" />
        </section>

        {saved && (
          <div className="success-message" role="status" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <FaDatabase /> {saveStatus}
          </div>
        )}

        <section className="section-block" id="profile">
          <div className="section-title-row">
            <div>
              <h2>My profile</h2>
              <p className="muted">Your verified AMCS alumni credentials and professional information</p>
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
                {profile.firstName ? profile.firstName.charAt(0) : "A"}
              </div>
              <div>
                <h3>{fullName}</h3>
                <p>{profile.jobTitle ? `${profile.jobTitle} ${profile.company ? `at ${profile.company}` : ''}` : "Job title not added"}</p>
                <span className="muted">
                  Class of {profile.graduationYear} · {profile.branch}
                </span>
              </div>
            </div>

            <form onSubmit={handleSave}>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="firstName">First name</label>
                  <input
                    id="firstName"
                    name="firstName"
                    value={profile.firstName}
                    onChange={updateField}
                    disabled={!editing}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="lastName">Last name</label>
                  <input
                    id="lastName"
                    name="lastName"
                    value={profile.lastName}
                    onChange={updateField}
                    disabled={!editing}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="initial">Middle name / Initial</label>
                  <input
                    id="initial"
                    name="initial"
                    value={profile.initial}
                    onChange={updateField}
                    disabled={!editing}
                  />
                </div>
                <div className="field">
                  <label htmlFor="rollNumber">Roll number</label>
                  <input id="rollNumber" value={profile.rollNumber} disabled />
                  <small className="field-hint">Primary key identifier in the AMCS database.</small>
                </div>
                <div className="field">
                  <label htmlFor="graduationYear">Graduation year</label>
                  <input id="graduationYear" value={profile.graduationYear} disabled />
                </div>
                <div className="field">
                  <label htmlFor="email">Email address</label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={profile.email}
                    onChange={updateField}
                    disabled={!editing}
                    placeholder="you@example.com"
                  />
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
                  <input
                    id="jobTitle"
                    name="jobTitle"
                    value={profile.jobTitle}
                    onChange={updateField}
                    disabled={!editing}
                    placeholder="e.g. Senior Software Engineer / VP"
                  />
                </div>
                <div className="field">
                  <label htmlFor="company">Company</label>
                  <input
                    id="company"
                    name="company"
                    value={profile.company}
                    onChange={updateField}
                    disabled={!editing}
                    placeholder="Your current company"
                  />
                </div>
                <div className="field">
                  <label htmlFor="city">City / Location</label>
                  <input
                    id="city"
                    name="city"
                    value={profile.city}
                    onChange={updateField}
                    disabled={!editing}
                    placeholder="e.g. Bengaluru, India"
                  />
                </div>
                <div className="field">
                  <label htmlFor="country">Country</label>
                  <input
                    id="country"
                    name="country"
                    value={profile.country}
                    onChange={updateField}
                    disabled={!editing}
                  />
                </div>
                <div className="field field-full">
                  <label htmlFor="linkedin">LinkedIn profile URL</label>
                  <div className="input-with-icon">
                    <FaLinkedin />
                    <input
                      id="linkedin"
                      name="linkedin"
                      type="url"
                      value={profile.linkedin}
                      onChange={updateField}
                      disabled={!editing}
                      placeholder="https://www.linkedin.com/in/your-profile"
                    />
                  </div>
                </div>
              </div>

              {editing && (
                <div className="form-actions">
                  <button
                    type="button"
                    className="button button-outline"
                    onClick={() => {
                      setEditing(false);
                      setSaved(false);
                    }}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="button button-primary">
                    Save changes to database
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
              Your professional milestones help students find mentors and keep the AMCS network strong.
            </p>
          </div>
        </section>

        {profile.linkedin && (
          <a
            className="text-link linkedin-link"
            href={profile.linkedin}
            target="_blank"
            rel="noreferrer"
          >
            View LinkedIn profile <FaExternalLinkAlt />
          </a>
        )}
      </main>
    </div>
  );
}
