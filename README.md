# AlmaTracc — AMCS Alumni Network Platform

AlmaTracc is a full-stack platform for tracking, connecting, and managing AMCS alumni records across graduating batches.

---

## 📁 Project Architecture

The project is structured into clear **`frontend`** and **`backend`** workspaces:

```
AlmaTracc/
├── backend/
│   ├── almatracc.db           # SQLite database with 1,319 alumni records
│   ├── Alumni linkedin.xlsx   # Source alumni batch dataset
│   ├── import_excel.py        # Python data ingestion script
│   ├── enrich_linkdin.py      # LinkedIn enrichment worker script
│   ├── server.js              # Express REST API (Node.js + node:sqlite)
│   ├── package.json           # Backend dependencies (express, cors)
│   └── node_modules/
├── frontend/
│   ├── src/
│   │   ├── components/        # UI components (Navbar, etc.)
│   │   ├── pages/             # Pages (Home, Login, AdminDashboard, AlumniDashboard, AccountHelp)
│   │   ├── App.jsx            # React router routes
│   │   ├── main.jsx           # React root
│   │   └── styles.css         # Styling system
│   ├── public/                # Static assets
│   ├── index.html             # Vite entry point
│   ├── vite.config.js         # Vite configuration with API proxy to port 4000
│   ├── package.json           # Frontend dependencies (React 19, Vite 8, React Router, React Icons)
│   └── node_modules/
├── package.json               # Root workspace scripts to run both apps concurrently
└── README.md
```

---

## 🚀 How to Run

### Option 1: Run Both (Recommended)

From the project root:

```bash
npm run dev
```

This starts both the **Backend API** (`http://localhost:4000`) and the **Frontend Vite Dev Server** (`http://localhost:5173`) concurrently in a single terminal.

---

### Option 2: Run Frontend and Backend Independently

#### 1. Backend Server
```bash
cd backend
npm start
```
* Runs on: `http://localhost:4000`
* Endpoints:
  - `GET /api/health` - Health check & alumni count
  - `GET /api/stats` - Total alumni, batch counts, company status
  - `GET /api/alumni` - Search & filter alumni with query parameters (`q`, `year`, `company`, `status`, `limit`)
  - `GET /api/alumni/:rollNumber` - Detailed alumnus profile & career history
  - `PUT /api/alumni/:rollNumber` - Update alumni profile details
  - `POST /api/auth/login` - Sign in authentication for alumni and admin

#### 2. Frontend Application
```bash
cd frontend
npm run dev
```
* Runs on: `http://127.0.0.1:5173`
* Features:
  - **Landing Page (`/`)**: Community hero and live statistics from SQLite DB.
  - **Login (`/login`)**: Role switcher between Alumni and Administrator.
  - **Admin Dashboard (`/admin`)**: Directory of 1,319 alumni records, live batch and employment statistics, real-time search & filters, details modal, and CSV export.
  - **Alumni Dashboard (`/alumni`)**: Profile management with live database edits and updates.

---

## 🛠 Prerequisites
- **Node.js**: v18+ (Node 24 recommended, built-in SQLite support)
- **Python**: 3.10+ (optional, only for re-running `import_excel.py` or `enrich_linkdin.py`)
