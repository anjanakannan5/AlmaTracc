import { useState } from "react";
import { Link } from "react-router-dom";
import {
  FaBriefcase,
  FaDownload,
  FaGraduationCap,
  FaHome,
  FaSearch,
  FaSignOutAlt,
  FaSlidersH,
  FaUsers,
} from "react-icons/fa";

const demoAlumni = [
  {
    id: 1,
    roll: "AMCS-DEMO-01",
    name: "Ananya Raman",
    year: "2022",
    company: "Example Technologies",
    title: "Software Engineer",
    city: "Coimbatore",
  },
  {
    id: 2,
    roll: "AMCS-DEMO-02",
    name: "Rahul Kumar",
    year: "2020",
    company: "Example Systems",
    title: "Data Analyst",
    city: "Chennai",
  },
  {
    id: 3,
    roll: "AMCS-DEMO-03",
    name: "Priya S",
    year: "2018",
    company: "Not provided",
    title: "Not provided",
    city: "Not provided",
  },
  {
    id: 4,
    roll: "AMCS-DEMO-04",
    name: "Arun Raj",
    year: "2024",
    company: "Example Technologies",
    title: "Graduate Engineer",
    city: "Bengaluru",
  },
  {
    id: 5,
    roll: "AMCS-DEMO-05",
    name: "Meera Nair",
    year: "2015",
    company: "Example Consulting",
    title: "Project Manager",
    city: "Coimbatore",
  },
];

export default function AdminDashboard() {
  const [alumni] = useState(demoAlumni);
  const [search, setSearch] = useState("");
  const [year, setYear] = useState("all");
  const [company, setCompany] = useState("all");
  const [selectedAlumni, setSelectedAlumni] = useState(null);

  const years = [...new Set(alumni.map((person) => person.year))].sort(
    (a, b) => Number(b) - Number(a),
  );

  const companies = [
    ...new Set(
      alumni
        .map((person) => person.company)
        .filter((name) => name && name !== "Not provided"),
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
    ].some((value) =>
      String(value ?? "")
        .toLowerCase()
        .includes(query),
    );

    const matchesYear = year === "all" || String(person.year) === year;

    const matchesCompany = company === "all" || person.company === company;

    return matchesSearch && matchesYear && matchesCompany;
  });

  const registeredCount = 0;
  const missingCompanyCount = alumni.filter(
    (person) => person.company === "Not provided",
  ).length;

  function exportCsv() {
    const headings = [
      "Roll number",
      "Name",
      "Graduation year",
      "Company",
      "Designation",
      "City",
    ];

    const rows = filteredAlumni.map((person) => [
      person.roll,
      person.name,
      person.year,
      person.company,
      person.title,
      person.city,
    ]);

    const escapeCsv = (value) => `"${String(value).replace(/"/g, '""')}"`;

    const csv = [headings, ...rows]
      .map((row) => row.map(escapeCsv).join(","))
      .join("\r\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "almatracc-alumni-preview.csv";
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
          <a href="#directory" className="sidebar-link">
            <FaBriefcase /> Professional Records
          </a>
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-user">
            <div className="avatar admin-avatar">A</div>
            <div>
              <strong>Administrator</strong>
              <span>Admin portal preview</span>
            </div>
          </div>
          <Link to="/" className="sidebar-link">
            <FaSignOutAlt /> Sign out
          </Link>
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
          <span className="demo-label">DEMO DATA</span>
        </header>

        <section className="stats-grid">
          <article className="stat-card">
            <span className="stat-icon">
              <FaUsers />
            </span>
            <span className="stat-label">Total records shown</span>
            <strong>{alumni.length}</strong>
            <small>Illustrative records</small>
          </article>
          <article className="stat-card">
            <span className="stat-icon">
              <FaGraduationCap />
            </span>
            <span className="stat-label">Graduating batches</span>
            <strong>{years.length}</strong>
            <small>In this preview</small>
          </article>
          <article className="stat-card">
            <span className="stat-icon">
              <FaBriefcase />
            </span>
            <span className="stat-label">Company not provided</span>
            <strong>{missingCompanyCount}</strong>
            <small>Needs profile information</small>
          </article>
          <article className="stat-card">
            <span className="stat-icon">
              <FaUsers />
            </span>
            <span className="stat-label">Registered accounts</span>
            <strong>{registeredCount}</strong>
            <small>Awaiting backend integration</small>
          </article>
        </section>

        <section className="directory-section" id="directory">
          <div className="section-title-row directory-heading">
            <div>
              <h2>All alumni</h2>
              <p className="muted">
                Search by name, roll number, company, or designation.
              </p>
            </div>
            <button
              type="button"
              className="button button-outline"
              onClick={exportCsv}
            >
              <FaDownload /> Export filtered CSV
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
                <option value="all">All graduating years</option>
                {years.map((value) => (
                  <option key={value} value={value}>
                    {value}
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
              {companies.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>

          <div className="table-meta">
            <span>{filteredAlumni.length} records found</span>
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
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredAlumni.map((person) => (
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
                    <td>{person.roll}</td>
                    <td>{person.year}</td>
                    <td>{person.company}</td>
                    <td>{person.city}</td>
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
                {filteredAlumni.length === 0 && (
                  <tr>
                    <td colSpan="6" className="empty-state">
                      No alumni match your search. Try changing your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <p className="table-footnote">
            This preview uses sample data. Actual alumni records will be loaded
            from the database after backend integration.
          </p>
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
                  <p>Class of {selectedAlumni.year}</p>
                </div>
              </div>
              <dl className="detail-list">
                <div>
                  <dt>Roll number</dt>
                  <dd>{selectedAlumni.roll}</dd>
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
              </dl>
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
