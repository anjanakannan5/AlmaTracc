import { useCallback, useEffect, useMemo, useState } from "react";
import { FaCheckCircle, FaFileUpload, FaPlus, FaTrash, FaUsers } from "react-icons/fa";
import { apiFetch } from "../api";

const EMPTY_FORM = {
  full_name: "",
  roll_number: "",
  year_of_passing: "",
  branch: "",
  email: "",
  phone: "",
  linkedin_url: "",
};

function downloadTemplate() {
  const contents = [
    ["Name", "Roll Number", "Graduation Year", "Branch", "Email", "Phone", "LinkedIn URL"],
    ["Example Name", "AMCS2026-001", "2026", "Computer Science", "", "", ""],
  ].map((row) => row.map((value) => `"${value.replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF", contents], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "almatracc-new-graduates-template.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export default function NewGraduateIntake() {
  const [records, setRecords] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [uploadReport, setUploadReport] = useState(null);

  const loadRecords = useCallback(async () => {
    try {
      const response = await apiFetch("/api/admin/new-graduates");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load new graduate records.");
      setRecords(data.records);
      setSelected([]);
      setError("");
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    apiFetch("/api/admin/new-graduates")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load new graduate records.");
        if (active) {
          setRecords(data.records);
          setError("");
        }
      })
      .catch((loadError) => {
        if (active) setError(loadError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return records;
    return records.filter((record) =>
      [record.full_name, record.roll_number, record.branch, record.email]
        .some((value) => String(value || "").toLowerCase().includes(query))
    );
  }, [records, search]);

  const importableRecords = filteredRecords.filter(
    (record) => !record.imported_at && !record.matching_alumni_id
  );
  const selectedImportable = importableRecords.filter((record) => selected.includes(record.id));

  async function handleAdd(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const response = await apiFetch("/api/admin/new-graduates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not add this graduate.");
      setForm(EMPTY_FORM);
      setMessage("Graduate added to the intake list.");
      await loadRecords();
    } catch (addError) {
      setError(addError.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleUpload(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const file = formElement.elements.namedItem("graduate-file")?.files?.[0];
    if (!file) {
      setError("Choose a CSV or Excel file first.");
      return;
    }
    setBusy(true);
    setMessage("");
    setError("");
    setUploadReport(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await apiFetch("/api/admin/new-graduates/upload", {
        method: "POST",
        body,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not upload the file.");
      setUploadReport(data);
      setMessage(`${data.added} added; ${data.skipped.length} skipped.`);
      formElement.reset();
      await loadRecords();
    } catch (uploadError) {
      setError(uploadError.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleImport() {
    if (!selectedImportable.length) return;
    if (!window.confirm(`Import ${selectedImportable.length} graduate(s) into the main alumni directory?`)) return;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const response = await apiFetch("/api/admin/new-graduates/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedImportable.map((record) => record.id) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not import the selected graduates.");
      setMessage(`${data.imported.length} imported; ${data.skipped.length} skipped.`);
      setSelected([]);
      await loadRecords();
    } catch (importError) {
      setError(importError.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(record) {
    if (!window.confirm(`Remove ${record.full_name} (${record.roll_number}) from the intake list?`)) return;
    setBusy(true);
    setError("");
    try {
      const response = await apiFetch(`/api/admin/new-graduates/${record.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not remove this record.");
      await loadRecords();
    } catch (deleteError) {
      setError(deleteError.message);
    } finally {
      setBusy(false);
    }
  }

  function toggleSelected(id) {
    setSelected((current) => current.includes(id)
      ? current.filter((value) => value !== id)
      : [...current, id]);
  }

  function toggleAll() {
    const allSelected = importableRecords.every((record) => selected.includes(record.id));
    setSelected((current) => allSelected
      ? current.filter((id) => !importableRecords.some((record) => record.id === id))
      : [...new Set([...current, ...importableRecords.map((record) => record.id)])]);
  }

  return (
    <section className="section-block new-graduate-section" id="new-graduates">
      <div className="section-title-row">
        <div>
          <h2>New Graduates</h2>
          <p className="muted">
            Review already-graduated students, then import selected records into the alumni directory.
          </p>
        </div>
        <button type="button" className="button button-outline" onClick={downloadTemplate}>
          Download CSV template
        </button>
      </div>

      {message && <div className="intake-notice intake-success" role="status"><FaCheckCircle />{message}</div>}
      {error && <div className="intake-notice intake-error" role="alert">{error}</div>}

      <div className="new-graduate-tools">
        <form className="profile-card intake-form" onSubmit={handleAdd}>
          <h3><FaPlus /> Add one graduate</h3>
          <div className="intake-fields">
            <label>Name<input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></label>
            <label>Roll number<input required value={form.roll_number} onChange={(e) => setForm({ ...form, roll_number: e.target.value.toUpperCase() })} /></label>
            <label>Graduation year<input required type="number" min="1900" max="2200" value={form.year_of_passing} onChange={(e) => setForm({ ...form, year_of_passing: e.target.value })} /></label>
            <label>Branch / department<input required value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })} /></label>
            <label>Email (optional)<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
            <label>Phone (optional)<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
            <label className="intake-field-wide">LinkedIn URL (optional)<input type="url" value={form.linkedin_url} onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })} /></label>
          </div>
          <button type="submit" className="button button-primary" disabled={busy}>
            <FaPlus /> Add to intake
          </button>
        </form>

        <form className="profile-card intake-upload" onSubmit={handleUpload}>
          <h3><FaFileUpload /> Import a batch file</h3>
          <p className="muted">Upload CSV or XLSX (up to 5 MB). Required columns: name, roll number, graduation year, branch.</p>
          <label className="intake-file-input">
            Select file
            <input required name="graduate-file" type="file" accept=".csv,.xlsx" />
          </label>
          <button type="submit" className="button button-outline" disabled={busy}>
            <FaFileUpload /> {busy ? "Working..." : "Upload batch"}
          </button>
          {uploadReport?.skipped?.length > 0 && (
            <details className="upload-skips">
              <summary>{uploadReport.skipped.length} rows skipped — view details</summary>
              <ul>
                {uploadReport.skipped.map((item) => (
                  <li key={`${item.row}-${item.roll_number}`}>Row {item.row} ({item.roll_number || "no roll number"}): {item.reason}</li>
                ))}
              </ul>
            </details>
          )}
        </form>
      </div>

      <div className="intake-list-heading">
        <div>
          <h3><FaUsers /> Graduate intake ({records.length})</h3>
          <p className="muted">Importing creates alumni accounts; matching roll numbers are flagged and not overwritten.</p>
        </div>
        <button type="button" className="button button-primary" disabled={busy || selectedImportable.length === 0} onClick={handleImport}>
          Import selected ({selectedImportable.length})
        </button>
      </div>

      <div className="filter-bar intake-filter">
        <input aria-label="Search graduate intake" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, roll number, branch..." />
        <button
          type="button"
          className="button button-outline"
          onClick={() => {
            setLoading(true);
            loadRecords();
          }}
          disabled={loading}
        >
          Refresh
        </button>
      </div>

      <div className="table-wrapper">
        <table className="alumni-table">
          <thead>
            <tr>
              <th><input aria-label="Select all importable records" type="checkbox" checked={importableRecords.length > 0 && importableRecords.every((record) => selected.includes(record.id))} onChange={toggleAll} /></th>
              <th>Name</th><th>Roll number</th><th>Year</th><th>Branch</th><th>Email</th><th>Import status</th><th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="8">Loading intake records...</td></tr>
            ) : filteredRecords.length === 0 ? (
              <tr><td colSpan="8">No graduate records in the intake list.</td></tr>
            ) : filteredRecords.map((record) => {
              const status = record.imported_at
                ? "Imported"
                : record.matching_alumni_id
                  ? "Already in alumni directory"
                  : "Ready to import";
              return (
                <tr key={record.id}>
                  <td>
                    <input
                      aria-label={`Select ${record.full_name}`}
                      type="checkbox"
                      checked={selected.includes(record.id)}
                      disabled={Boolean(record.imported_at || record.matching_alumni_id)}
                      onChange={() => toggleSelected(record.id)}
                    />
                  </td>
                  <td>{record.full_name}</td>
                  <td><code>{record.roll_number}</code></td>
                  <td>{record.year_of_passing}</td>
                  <td>{record.branch}</td>
                  <td>{record.email || "—"}</td>
                  <td>{status}</td>
                  <td>
                    {!record.imported_at && (
                      <button type="button" className="intake-delete" aria-label={`Remove ${record.full_name}`} disabled={busy} onClick={() => handleDelete(record)}>
                        <FaTrash />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
