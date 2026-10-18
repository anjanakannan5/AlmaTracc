import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  FaBriefcase,
  FaDownload,
  FaGraduationCap,
  FaHome,
  FaSearch,
  FaSlidersH,
  FaUsers,
  FaDatabase,
  FaLinkedin,
  FaKey,
  FaUndo,
  FaCheckCircle,
  FaExclamationCircle,
  FaPlay,
  FaStop,
} from "react-icons/fa";
import { apiFetch } from "../api";
import LogoutButton from "../components/LogoutButton";

export default function AdminDashboard() {
  const [alumni, setAlumni] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [stats, setStats] = useState(null);
  const [search, setSearch] = useState("");
  const [year, setYear] = useState("all");
  const [company, setCompany] = useState("all");
  const [selectedAlumni, setSelectedAlumni] = useState(null);
  const [dbConnected, setDbConnected] = useState(false);
  const [resetRollNumber, setResetRollNumber] = useState("");
  const [resetStatus, setResetStatus] = useState({ type: "", message: "" });
  const [resetLoading, setResetLoading] = useState(false);

  // Enrich state
  const [enrichLimit, setEnrichLimit] = useState(50);
  const [enrichBatch, setEnrichBatch] = useState("all");
  const [enrichRunning, setEnrichRunning] = useState(false);
  const [enrichLogs, setEnrichLogs] = useState([]);
  const enrichAbortRef = useRef(null);
  const enrichLogEndRef = useRef(null);

  async function handleRunEnrich() {
    if (enrichRunning) {
      // Abort
      if (enrichAbortRef.current) enrichAbortRef.current.abort();
      return;
    }
    setEnrichLogs([]);
    setEnrichRunning(true);
    const controller = new AbortController();
    enrichAbortRef.current = controller;

    try {
      const res = await apiFetch("/api/admin/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          limit: enrichLimit,
          year: enrichBatch !== "all" ? enrichBatch : undefined,
        }),
        signal: controller.signal,
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop(); // keep incomplete last chunk
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const msg = JSON.parse(line.slice(6));
              setEnrichLogs((prev) => [...prev, msg]);
              setTimeout(() => enrichLogEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
            } catch { /* ignore malformed */ }
          }
        }
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        setEnrichLogs((prev) => [...prev, { type: "err", text: "Connection error: " + err.message }]);
      } else {
        setEnrichLogs((prev) => [...prev, { type: "info", text: "⛔ Aborted by admin." }]);
      }
    } finally {
      setEnrichRunning(false);
      enrichAbortRef.current = null;
      await loadData();
    }
  }

  async function handleResetPassword(e) {
    if (e) e.preventDefault();
    const roll = resetRollNumber.trim().toUpperCase();
    if (!roll) return;

    setResetLoading(true);
    setResetStatus({ type: "", message: "" });

    try {
      const res = await apiFetch("/api/admin/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rollNumber: roll }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setResetStatus({ type: "success", message: data.message });
        setResetRollNumber("");
      } else {
        setResetStatus({ type: "error", message: data.error || "Failed to reset password." });
      }
    } catch {
      setResetStatus({ type: "error", message: "Failed to connect to backend server." });
    } finally {
      setResetLoading(false);
    }
  }

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [statsRes, alumniRes] = await Promise.all([
        apiFetch("/api/stats"),
        apiFetch("/api/alumni?limit=all"),
      ]);

      if (!statsRes.ok) throw new Error("Could not load cloud statistics.");
      if (!alumniRes.ok) throw new Error("Could not load the alumni directory from the cloud.");
      const statsData = await statsRes.json();
      setStats(statsData);

      const rows = await alumniRes.json();
      const mapped = rows.map((r) => ({
        id: r.id,
        roll: r.roll_number,
        name: [r.first_name, r.middle_name, r.last_name].filter(Boolean).join(" ") || r.roll_number,
        year: String(r.year_of_passing || "Not specified"),
        company: r.current_company || "Not provided",
        title: r.current_role || "Not provided",
        city: r.location || "Not provided",
        branch: r.branch || "Software Engineering",
        email: r.email || "Not provided",
        phone: r.phone || "Not provided",
        linkedin_url: r.linkedin_url,
        linkedin_status: r.linkedin_status || "missing",
      }));
      setAlumni(mapped);
      setDbConnected(true);
      setLoadError("");
    } catch (err) {
      console.error("Could not load cloud data:", err);
      setAlumni([]);
      setDbConnected(false);
      setLoadError(err.message || "Could not load data from the cloud.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const years = [
    ...new Set(
      alumni
        .map((person) => person.year)
        .filter((y) => y && y !== "Not specified")
    ),
  ].sort((a, b) => Number(b) - Number(a));

  const companies = [
    ...new Set(
      alumni
        .map((person) => person.company)
        .filter((name) => name && name !== "Not provided")
    ),
  ].sort();

  const query = search.trim().toLowerCase();

  const filteredAlumni = alumni.filter((person) => {
    const matchesSearch = [
      person.name,
      person.roll,
      person.company,
      person.title,
      person.city,
      person.branch,
    ].some((value) =>
      String(value ?? "")
        .toLowerCase()
        .includes(query)
    );

    const matchesYear = year === "all" || String(person.year) === year;
    const matchesCompany = company === "all" || person.company === company;

    return matchesSearch && matchesYear && matchesCompany;
  });

  const totalCount = stats ? stats.total : alumni.length;
  const batchCount = stats ? stats.batches : years.length;
  const missingCompanyCount = stats
    ? stats.missingCompany
    : alumni.filter((person) => person.company === "Not provided").length;
  const registeredCount = stats ? stats.registered : 0;

  function exportCsv() {
    const headings = [
      "Roll number",
      "Name",
      "Graduation year",
      "Branch",
      "Company",
      "Designation",
      "Location",
      "LinkedIn Status",
      "LinkedIn URL",
    ];

    const rows = filteredAlumni.map((person) => [
      person.roll,
      person.name,
      person.year,
      person.branch,
      person.company,
      person.title,
      person.city,
      person.linkedin_status,
      person.linkedin_url || "",
    ]);

    const escapeCsv = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;

    const csv = [headings, ...rows]
      .map((row) => row.map(escapeCsv).join(","))
      .join("\r\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `almatracc-alumni-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <Link to="/" className="brand sidebar-brand">
          <span className="brand-mark">
            <FaGraduationCap />
          </span>
          <span className="brand-copy">
            <strong>AlmaTracc</strong>
            <small>AMCS Alumni Network</small>
          </span>
        </Link>

        <span className="sidebar-label">ADMINISTRATION</span>
        <nav className="sidebar-nav">
          <a href="#admin-overview" className="sidebar-link">
            <FaHome /> Overview
          </a>
          <a href="#directory" className="sidebar-link active">
            <FaUsers /> Alumni Directory
          </a>
          <a href="#enrich-linkedin" className="sidebar-link">
            <FaLinkedin /> Enrich LinkedIn
          </a>
          <a href="#reset-password" className="sidebar-link">
            <FaKey /> Change Alumni Password
          </a>
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-user">
            <div className="avatar admin-avatar">A</div>
            <div>
              <strong>Administrator</strong>
              <span>Admin portal</span>
            </div>
          </div>
          <LogoutButton />
        </div>
      </aside>

      <main className="dashboard-main" id="admin-overview">
        <header className="dashboard-topbar">
          <div>
            <span className="eyebrow">ADMINISTRATION</span>
            <h1>Alumni Directory</h1>
            <p className="muted">
              Search and review alumni records across graduating years.
            </p>
          </div>
          <span
            className="demo-label"
            style={{
              backgroundColor: dbConnected ? "#ecfdf5" : "#fef3c7",
              color: dbConnected ? "#047857" : "#b45309",
              borderColor: dbConnected ? "#a7f3d0" : "#fde68a",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <FaDatabase />
            {dbConnected ? `LIVE DB: ${totalCount} RECORDS` : "CONNECTING..."}
          </span>
        </header>

        {loadError && <div className="error-message" role="alert">{loadError}</div>}
        <section className="stats-grid">
          <article className="stat-card">
            <span className="stat-icon">
              <FaUsers />
            </span>
            <span className="stat-label">Total records</span>
            <strong>{totalCount}</strong>
            <small>Imported alumni records</small>
          </article>
          <article className="stat-card">
            <span className="stat-icon">
              <FaGraduationCap />
            </span>
            <span className="stat-label">Graduating batches</span>
            <strong>{batchCount}</strong>
            <small>From 2002 to present</small>
          </article>
          <article className="stat-card">
            <span className="stat-icon">
              <FaBriefcase />
            </span>
            <span className="stat-label">Company not provided</span>
            <strong>{missingCompanyCount}</strong>
            <small>Pending career updates</small>
          </article>
          <article className="stat-card">
            <span className="stat-icon">
              <FaUsers />
            </span>
            <span className="stat-label">Registered / Active</span>
            <strong>{registeredCount}</strong>
            <small>Self-updated profiles</small>
          </article>
        </section>

        {/* ── LinkedIn Enrichment Panel ── */}
        <section className="section-block" id="enrich-linkedin" style={{ marginBottom: "28px" }}>
          <div className="section-title-row">
            <div>
              <h2>LinkedIn Enrichment</h2>
              <p className="muted">
                Run the enrichment script against alumni LinkedIn profiles to fetch current role, company &amp; location.
              </p>
            </div>
          </div>

          <div className="profile-card" style={{ maxWidth: "700px" }}>
            {/* Controls row */}
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "flex-end", marginBottom: "18px" }}>
              <div className="field" style={{ flex: "1 1 160px", marginBottom: 0 }}>
                <label htmlFor="enrichBatch">Batch (graduating year)</label>
                <select
                  id="enrichBatch"
                  value={enrichBatch}
                  onChange={(e) => setEnrichBatch(e.target.value)}
                  style={{ marginTop: "6px", width: "100%" }}
                  disabled={enrichRunning}
                >
                  <option value="all">All batches</option>
                  {years.map((y) => (
                    <option key={y} value={y}>Class of {y}</option>
                  ))}
                </select>
              </div>

              <div className="field" style={{ flex: "1 1 120px", marginBottom: 0 }}>
                <label htmlFor="enrichLimit">Limit (profiles)</label>
                <input
                  id="enrichLimit"
                  type="number"
                  min={1}
                  max={500}
                  value={enrichLimit}
                  onChange={(e) => setEnrichLimit(Math.max(1, Number(e.target.value)))}
                  style={{ marginTop: "6px", width: "100%" }}
                  disabled={enrichRunning}
                />
              </div>

              <button
                id="enrich-run-btn"
                type="button"
                className={enrichRunning ? "button button-outline" : "button button-primary"}
                style={{ display: "inline-flex", alignItems: "center", gap: "8px", minWidth: "160px", alignSelf: "flex-end" }}
                onClick={handleRunEnrich}
              >
                {enrichRunning ? <><FaStop /> Abort</> : <><FaPlay /> Run Enrichment</>}
              </button>
            </div>

            <small className="field-hint" style={{ marginBottom: "14px", display: "block" }}>
              Requires <code>ENRICH_API_KEY</code> env var set on the backend server.
              Only processes alumni with a LinkedIn URL whose status is <em>pending</em>, <em>failed</em>, or <em>enriched</em> (older than 180 days).
            </small>

            {/* Live log output */}
            {enrichLogs.length > 0 && (
              <div style={{
                background: "#0f172a",
                borderRadius: "8px",
                padding: "14px 16px",
                maxHeight: "280px",
                overflowY: "auto",
                fontFamily: "monospace",
                fontSize: "12.5px",
                lineHeight: "1.7",
              }}>
                {enrichLogs.map((msg, i) => (
                  <div key={i} style={{
                    color: msg.type === "err" ? "#f87171"
                         : msg.type === "done" ? "#34d399"
                         : msg.type === "info" ? "#60a5fa"
                         : "#e2e8f0",
                  }}>
                    {msg.text}
                  </div>
                ))}
                <div ref={enrichLogEndRef} />
              </div>
            )}
          </div>
        </section>

        <section className="section-block" id="reset-password" style={{ marginBottom: "28px" }}>
          <div className="section-title-row">
            <div>
              <h2>Change Password for Alumni</h2>
              <p className="muted">
                Clear an alumnus's custom password and revert their login password back to their roll number.
              </p>
            </div>
          </div>

          <div className="profile-card" style={{ maxWidth: "640px" }}>
            {resetStatus.message && (
              <div style={{
                padding: "12px 16px",
                borderRadius: "6px",
                marginBottom: "18px",
                fontSize: "13px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                background: resetStatus.type === "success" ? "#EAF0E9" : "#FDE8E8",
                color: resetStatus.type === "success" ? "#426B52" : "#9B1C1C",
                border: `1px solid ${resetStatus.type === "success" ? "#426B52" : "#F87171"}`
              }}>
                {resetStatus.type === "success" ? <FaCheckCircle /> : <FaExclamationCircle />}
                <span>{resetStatus.message}</span>
              </div>
            )}

            <form onSubmit={handleResetPassword}>
              <div className="field">
                <label htmlFor="resetRollNumber">Alumnus Roll Number</label>
                <div style={{ display: "flex", gap: "10px", marginTop: "6px" }}>
                  <input
                    id="resetRollNumber"
                    type="text"
                    value={resetRollNumber}
                    onChange={(e) => setResetRollNumber(e.target.value.toUpperCase())}
                    placeholder="e.g. 97MW01"
                    style={{ flex: 1, textTransform: "uppercase" }}
                    required
                  />
                  <button
                    type="submit"
                    className="button button-primary"
                    disabled={resetLoading || !resetRollNumber.trim()}
                    style={{ whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: "6px" }}
                  >
                    <FaUndo /> {resetLoading ? "Resetting..." : "Reset to Roll Number"}
                  </button>
                </div>
                <small className="field-hint" style={{ marginTop: "6px", display: "block" }}>
                  Clears their custom password in the database. The user can immediately log in with their roll number.
                </small>
              </div>
            </form>
          </div>
        </section>

        <section className="directory-section" id="directory">
          <div className="section-title-row directory-heading">
            <div>
              <h2>All alumni</h2>
              <p className="muted">
                Search by name, roll number, company, designation, or branch.
              </p>
            </div>
            <button
              type="button"
              className="button button-outline"
              onClick={exportCsv}
              disabled={filteredAlumni.length === 0}
            >
              <FaDownload /> Export filtered CSV ({filteredAlumni.length})
            </button>
          </div>

          <div className="filter-bar">
            <div className="search-field">
              <FaSearch />
              <input
                aria-label="Search alumni"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search alumni, roll number, company..."
              />
            </div>

            <div className="select-field">
              <FaSlidersH />
              <select
                aria-label="Filter by graduation year"
                value={year}
                onChange={(event) => setYear(event.target.value)}
              >
                <option value="all">All graduating years ({years.length})</option>
                {years.map((value) => (
                  <option key={value} value={value}>
                    Class of {value}
                  </option>
                ))}
              </select>
            </div>

            <select
              aria-label="Filter by company"
              className="filter-select"
              value={company}
              onChange={(event) => setCompany(event.target.value)}
            >
              <option value="all">All companies</option>
              <option value="Not provided">Not provided</option>
              {companies.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>

          <div className="table-meta">
            <span>
              {loading
                ? "Loading records from database..."
                : `${filteredAlumni.length} of ${alumni.length} records shown`}
            </span>
            <button
              type="button"
              className="clear-filters"
              onClick={() => {
                setSearch("");
                setYear("all");
                setCompany("all");
              }}
            >
              Clear filters
            </button>
          </div>

          <div className="table-wrapper">
            <table className="alumni-table">
              <thead>
                <tr>
                  <th>Alumni</th>
                  <th>Roll number</th>
                  <th>Batch</th>
                  <th>Company</th>
                  <th>Location</th>
                  <th>LinkedIn</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredAlumni.slice(0, 100).map((person) => (
                  <tr key={person.id}>
                    <td>
                      <div className="table-person">
                        <span className="table-avatar">
                          {person.name.charAt(0)}
                        </span>
                        <div>
                          <strong>{person.name}</strong>
                          <small>{person.title}</small>
                        </div>
                      </div>
                    </td>
                    <td><code>{person.roll}</code></td>
                    <td>{person.year}</td>
                    <td>{person.company}</td>
                    <td>{person.city}</td>
                    <td>
                      <span
                        style={{
                          fontSize: "0.75rem",
                          padding: "2px 8px",
                          borderRadius: "12px",
                          fontWeight: 500,
                          backgroundColor:
                            person.linkedin_status === "enriched"
                              ? "#ecfdf5"
                              : person.linkedin_status === "pending"
                              ? "#eff6ff"
                              : "#f1f5f9",
                          color:
                            person.linkedin_status === "enriched"
                              ? "#047857"
                              : person.linkedin_status === "pending"
                              ? "#1d4ed8"
                              : "#64748b",
                        }}
                      >
                        {person.linkedin_status}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="view-button"
                        onClick={() => setSelectedAlumni(person)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
                {!loading && filteredAlumni.length === 0 && (
                  <tr>
                    <td colSpan="7" className="empty-state">
                      No alumni match your search. Try changing your filters.
                    </td>
                  </tr>
                )}
                {loading && (
                  <tr>
                    <td colSpan="7" className="empty-state">
                      Loading alumni database...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {filteredAlumni.length > 100 && (
            <p className="table-footnote" style={{ textAlign: "center", marginTop: "12px" }}>
              Showing top 100 of {filteredAlumni.length} matching alumni. Use the search bar above to narrow down specific names or companies.
            </p>
          )}
        </section>

        {selectedAlumni && (
          <div
            className="modal-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setSelectedAlumni(null);
              }
            }}
          >
            <section
              className="detail-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="detail-title"
            >
              <div className="section-title-row">
                <h2 id="detail-title">Alumni details</h2>
                <button
                  type="button"
                  className="modal-close"
                  onClick={() => setSelectedAlumni(null)}
                  aria-label="Close details"
                >
                  ×
                </button>
              </div>
              <div className="profile-heading">
                <div className="profile-avatar">
                  {selectedAlumni.name.charAt(0)}
                </div>
                <div>
                  <h3>{selectedAlumni.name}</h3>
                  <p>Class of {selectedAlumni.year} · {selectedAlumni.branch}</p>
                </div>
              </div>
              <dl className="detail-list">
                <div>
                  <dt>Roll number</dt>
                  <dd><code>{selectedAlumni.roll}</code></dd>
                </div>
                <div>
                  <dt>Designation</dt>
                  <dd>{selectedAlumni.title}</dd>
                </div>
                <div>
                  <dt>Company</dt>
                  <dd>{selectedAlumni.company}</dd>
                </div>
                <div>
                  <dt>Location</dt>
                  <dd>{selectedAlumni.city}</dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd>{selectedAlumni.email}</dd>
                </div>
                <div>
                  <dt>LinkedIn</dt>
                  <dd>
                    {selectedAlumni.linkedin_url ? (
                      <a
                        href={selectedAlumni.linkedin_url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: "#2563eb", display: "inline-flex", alignItems: "center", gap: "4px" }}
                      >
                        <FaLinkedin /> Open profile
                      </a>
                    ) : (
                      "Not provided"
                    )}
                  </dd>
                </div>
              </dl>
              <button
                type="button"
                className="button button-outline full-width"
                style={{ marginBottom: "10px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                onClick={async () => {
                  if (window.confirm(`Reset password for ${selectedAlumni.name} (${selectedAlumni.roll}) back to their roll number?`)) {
                    try {
                      const res = await apiFetch("/api/admin/reset-password", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ rollNumber: selectedAlumni.roll }),
                      });
                      const data = await res.json();
                      if (res.ok && data.success) {
                        alert(data.message);
                      } else {
                        alert(data.error || "Failed to reset password.");
                      }
                    } catch {
                      alert("Failed to connect to backend server.");
                    }
                  }
                }}
              >
                <FaKey /> Reset Password to Roll Number
              </button>
              <button
                type="button"
                className="button button-primary full-width"
                onClick={() => setSelectedAlumni(null)}
              >
                Close details
              </button>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
