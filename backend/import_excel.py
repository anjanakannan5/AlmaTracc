"""Import alumni spreadsheet rows into the database configured by DATABASE_URL.

Usage: python import_excel.py [xlsx_path] [DATABASE_URL]
"""
import os, re, sys
import pandas as pd
from sqlalchemy import create_engine, text

xlsx = sys.argv[1] if len(sys.argv) > 1 else "Alumni linkedin.xlsx"
db_url = sys.argv[2] if len(sys.argv) > 2 else os.environ.get("DATABASE_URL")
if not db_url:
    raise SystemExit("Set DATABASE_URL or pass a database URL as the second argument.")
engine = create_engine(db_url)

DDL = """
CREATE TABLE IF NOT EXISTS alumni (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  roll_number TEXT UNIQUE NOT NULL,
  first_name TEXT, middle_name TEXT, last_name TEXT, gender TEXT,
  year_of_joining INT, year_of_passing INT, branch TEXT,
  email TEXT, phone TEXT,
  linkedin_url TEXT, linkedin_status TEXT DEFAULT 'missing',
  "current_role" TEXT, current_company TEXT, location TEXT,
  data_source TEXT, last_enriched_at TIMESTAMP,
  password TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS alumni_career_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  alumni_id INT, role TEXT, company TEXT, location TEXT, source TEXT,
  fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, raw_response TEXT
);
"""
if db_url.startswith("postgres"):
    DDL = DDL.replace("INTEGER PRIMARY KEY AUTOINCREMENT", "SERIAL PRIMARY KEY")

LI = re.compile(r"^https?://([a-z]{2,3}\.)?linkedin\.com/in/[^/\s?]+", re.I)

def clean_url(v):
    if pd.isna(v): return None, "missing"
    v = str(v).strip()
    if not v: return None, "missing"
    if v.lower().startswith("linkedin.com") or v.lower().startswith("www.linkedin"):
        v = "https://" + v
    m = LI.match(v)
    if not m: return None, "invalid"            # e.g. stray "`" characters
    return m.group(0).rstrip("/"), "pending"    # strip query strings / trailing slash

def val(row, col):
    v = row.get(col)
    return None if pd.isna(v) else str(v).strip() or None

rows, problems = [], []
for sheet, df in pd.read_excel(xlsx, sheet_name=None, header=0, dtype=str).items():
    df.columns = [str(c).strip().upper() for c in df.columns]
    # In this file the real header sits in the first data row
    if "ROLL NUM" not in df.columns:
        df.columns = df.iloc[0].astype(str).str.strip().str.upper()
        df = df.iloc[1:]
    for _, r in df.iterrows():
        roll = val(r, "ROLL NUM")
        if not roll:
            continue
        url, status = clean_url(r.get("LINKDIN PROFILE URL"))
        if status == "invalid":
            problems.append((sheet, roll, r.get("LINKDIN PROFILE URL")))
        rows.append(dict(
            roll_number=roll.upper(),
            first_name=val(r, "FIRST NAME"), middle_name=val(r, "MIDDLE NAME"),
            last_name=val(r, "LAST NAME"), gender=val(r, "GENDER"),
            year_of_joining=val(r, "YEAR OF JOINING"),
            year_of_passing=val(r, "YEAR OF PASSING OUT"),
            branch=val(r, "BRANCH"), linkedin_url=url, linkedin_status=status,
            data_source="excel_import"))

out = pd.DataFrame(rows)
dups = out[out.duplicated("roll_number", keep=False)]
out = out.drop_duplicates("roll_number", keep="first")

with engine.begin() as c:
    for stmt in DDL.strip().split(";"):
        if stmt.strip(): c.execute(text(stmt))
    c.execute(text('DELETE FROM alumni WHERE data_source=\'excel_import\' AND "current_role" IS NULL'))
out.to_sql("alumni", engine, if_exists="append", index=False)

print(f"Imported {len(out)} alumni | with LinkedIn URL: {(out.linkedin_status=='pending').sum()} "
      f"| missing: {(out.linkedin_status=='missing').sum()} | invalid: {len(problems)}")
if len(dups): print("Duplicate roll numbers skipped:\n", dups[["roll_number","first_name"]].to_string())
for p in problems: print("Invalid URL ->", p)