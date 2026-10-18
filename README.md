# AlmaTracc — AMCS Alumni Network Platform

AlmaTracc is a full-stack platform for tracking, connecting, and managing AMCS alumni records across graduating batches.

---

## 📁 Project Architecture

The project is structured into clear **`frontend`** and **`backend`** workspaces:

```
AlmaTracc/
├── backend/
│   ├── almatracc.db           # Source SQLite database (migration input)
│   ├── Alumni linkedin.xlsx   # Source alumni batch dataset
│   ├── import_excel.py        # Python data ingestion script
│   ├── enrich_linkedin.py      # LinkedIn enrichment worker script
│   ├── server.js              # Express REST API (Node.js + PostgreSQL)
│   ├── database.js             # PostgreSQL connection and schema setup
│   ├── migrate_sqlite_to_postgres.js # One-time SQLite data migration
│   ├── package.json           # Backend dependencies
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

### Configure hosted PostgreSQL (no local PostgreSQL required)

Create a PostgreSQL database with a hosted provider such as Supabase or Neon.
You do **not** need to install or run PostgreSQL on your computer. When running
the app locally, its API connects over the internet to the hosted database using
`DATABASE_URL`; when deployed, set the same variable in the API host's
environment settings. Copy `backend/.env.example` to `backend/.env` for local
development and set `DATABASE_URL` to the hosted database's connection string,
`ENRICH_API_KEY` if using LinkedIn enrichment, and the session settings below.
On the first startup with an empty admin table, the app creates an admin account
in PostgreSQL. For local development its default username/password are
`admin` / `admin123`; set `ADMIN_USERNAME` and `ADMIN_PASSWORD` before that
first startup to use different credentials. The password is stored as a
one-way scrypt hash, not plain text. Do not use `admin123` for a public
production deployment: set a unique, strong `ADMIN_PASSWORD` before creating
the production admin account.

For production, also set a long, random `SESSION_SECRET`
and `FRONTEND_ORIGIN` to the deployed frontend's exact origin. Keep these values
private; `.env` files are ignored by Git. The API creates its alumni and
PostgreSQL-backed session tables at startup. Login sessions use HttpOnly cookies;
no login state is stored in browser `localStorage`.

For a frontend and API deployed on different sites, set
`SESSION_COOKIE_SAME_SITE=none` and serve both over HTTPS. For local development
or deployments on the same site, keep `SESSION_COOKIE_SAME_SITE=lax`.

The included SQLite database is only an optional, one-time migration source; it
is not used by the running API. The migration reads that local source file and
writes records directly to the hosted PostgreSQL database. After migration, the
hosted database is the app's source of truth. Set production environment
variables in the hosting provider's dashboard instead of uploading a `.env`
file.

The existing SQLite records can be moved into an empty PostgreSQL database with
Node.js 24 or later:

```bash
cd backend
npm install
npm run migrate:sqlite
```

The migration reads `backend/almatracc.db` by default and copies alumni and
career-history records. To use a different SQLite file, pass its path:

```bash
npm run migrate:sqlite -- "C:\path\to\source.db"
```

The hosted PostgreSQL tables must be empty. Migration preserves record IDs and
updates PostgreSQL sequences so new rows can be inserted afterward.

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
  - `GET /api/auth/session` - Verify the server-managed sign-in session
  - `POST /api/auth/logout` - End the server-managed sign-in session

Alumni and administrator APIs require the matching signed-in role. Alumni can
only view and update their own profile; administrator access is required for
the directory and administrative actions.

#### 2. Frontend Application
```bash
cd frontend
npm run dev
```
* Runs on: `http://127.0.0.1:5173`
* Features:
  - **Landing Page (`/`)**: Community hero and live statistics from PostgreSQL.
  - **Login (`/login`)**: Role switcher between Alumni and Administrator.
  - **Admin Dashboard (`/admin`)**: Directory of 1,319 alumni records, live batch and employment statistics, real-time search & filters, details modal, and CSV export.
  - **Alumni Dashboard (`/alumni`)**: Profile management with live database edits and updates.

---

## 🛠 Prerequisites
- **PostgreSQL**: 14+
- **Node.js**: 24+ (uses the built-in SQLite module only for the migration utility)
- **Python**: 3.10+ (only for `import_excel.py` and LinkedIn enrichment)

Install Python tools from the backend directory with `pip install -r requirements.txt`.
Both Python utilities use `DATABASE_URL`; `import_excel.py` also accepts a SQLAlchemy
database URL as its second argument.
