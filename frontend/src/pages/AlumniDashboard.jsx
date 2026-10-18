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
  FaUser,
  FaDatabase,
  FaKey,
  FaLock,
} from "react-icons/fa";
import { apiFetch } from "../api";
import LogoutButton from "../components/LogoutButton";

const defaultProfile = {
  firstName: "",
  lastName: "",
  initial: "",
  rollNumber: "",
  graduationYear: "",
  branch: "",
  jobTitle: "",
  company: "",
  city: "",
  country: "",
  linkedin: "",
  email: "",
  phone: "",
};

export default function AlumniDashboard({ user }) {
  const [profile, setProfile] = useState(defaultProfile);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState("");
  const [profileError, setProfileError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordStatus, setPasswordStatus] = useState({ type: "", message: "" });
  const [passwordLoading, setPasswordLoading] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      try {
        setLoading(true);
        const res = await apiFetch(`/api/alumni/${encodeURIComponent(user.roll_number)}`);
        if (!res.ok) throw new Error("Could not load your profile from the cloud.");
        const data = await res.json();
        setProfile({
          firstName: data.first_name || "",
          lastName: data.last_name || "",
          initial: data.middle_name || "",
          rollNumber: data.roll_number,
          graduationYear: String(data.year_of_passing || ""),
          branch: data.branch || "",
          jobTitle: data.current_role || "",
          company: data.current_company || "",
          city: data.location || "",
          country: "",
          linkedin: data.linkedin_url || "",
          email: data.email || "",
          phone: data.phone || "",
        });
        setProfileError("");
      } catch (err) {
        setProfileError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [user.roll_number]);

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
    setSaveError("");

    try {
      const res = await apiFetch(`/api/alumni/${encodeURIComponent(profile.rollNumber)}`, {
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

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Could not save your profile to the cloud.");
      }
      await res.json();
      setSaved(true);
      setEditing(false);
      setSaveStatus("Profile successfully updated in the cloud database!");
    } catch (err) {
      setSaved(false);
      setSaveError(err.message || "Could not save your profile to the cloud.");
    }
  }

  async function handlePasswordChange(e) {
    e.preventDefault();
    setPasswordStatus({ type: "", message: "" });

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordStatus({ type: "error", message: "New passwords do not match." });
      return;
    }

    if (passwordForm.newPassword.length < 4) {
      setPasswordStatus({ type: "error", message: "New password must be at least 4 characters long." });
      return;
    }

    setPasswordLoading(true);
    try {
      const res = await apiFetch(`/api/alumni/${encodeURIComponent(profile.rollNumber)}/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setPasswordStatus({ type: "success", message: data.message });
        setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      } else {
        setPasswordStatus({ type: "error", message: data.error || "Failed to update password." });
      }
    } catch {
      setPasswordStatus({ type: "error", message: "Unable to connect to server. Please try again later." });
    } finally {
      setPasswordLoading(false);
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
          <a href="#security" className="sidebar-link">
            <FaKey /> Change Password
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
          <LogoutButton />
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

        {profileError && <div className="error-message" role="alert">{profileError}</div>}
        {saveError && <div className="error-message" role="alert">{saveError}</div>}
        {loading && <p className="muted">Loading your profile from the cloud...</p>}
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

        <section className="section-block" id="security">
          <div className="section-title-row">
            <div>
              <h2>Account Security & Password</h2>
              <p className="muted">
                Your initial password is your roll number (<code>{profile.rollNumber}</code>). You can change it below anytime.
              </p>
            </div>
          </div>

          <div className="profile-card">
            {passwordStatus.message && (
              <div style={{
                padding: "12px 16px",
                borderRadius: "6px",
                marginBottom: "18px",
                fontSize: "13px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                background: passwordStatus.type === "success" ? "#EAF0E9" : "#FDE8E8",
                color: passwordStatus.type === "success" ? "#426B52" : "#9B1C1C",
                border: `1px solid ${passwordStatus.type === "success" ? "#426B52" : "#F87171"}`
              }}>
                {passwordStatus.type === "success" ? <FaCheckCircle /> : <FaLock />}
                <span>{passwordStatus.message}</span>
              </div>
            )}

            <form onSubmit={handlePasswordChange}>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="currentPassword">Current password</label>
                  <input
                    id="currentPassword"
                    name="currentPassword"
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                    placeholder="Current password (or roll number if default)"
                    required
                  />
                  <small className="field-hint">If this is your first time, enter your Roll Number.</small>
                </div>

                <div className="field">
                  <label htmlFor="newPassword">New password</label>
                  <input
                    id="newPassword"
                    name="newPassword"
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    placeholder="Enter new password (min. 4 characters)"
                    required
                  />
                </div>

                <div className="field">
                  <label htmlFor="confirmPassword">Confirm new password</label>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    placeholder="Re-enter new password"
                    required
                  />
                </div>
              </div>

              <div className="form-actions" style={{ marginTop: "20px" }}>
                <button
                  type="submit"
                  className="button button-primary"
                  disabled={passwordLoading}
                >
                  {passwordLoading ? "Updating password..." : "Update Password"}
                </button>
              </div>
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
