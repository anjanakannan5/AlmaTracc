# -*- coding: utf-8 -*-
"""Batch worker: for every alumni with a LinkedIn URL, fetch current role / company / location
from a LICENSED data-enrichment API and save it. Safe to re-run (resumable).
Usage: python enrich_linkedin.py [DATABASE_URL] [--limit 50] [--refresh-days 180]
Set env var ENRICH_API_KEY.
"""
import os, sys, json, time, argparse, requests
from datetime import datetime, timedelta, timezone
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

def log(msg):
    """Print and flush immediately so Node.js SSE stream gets each line in real time."""
    print(msg, flush=True)

def now():
    return datetime.now(timezone.utc).replace(tzinfo=None)

def clean(v):
    """Providers return True/False/None for fields hidden by your plan; keep real text only."""
    return v.strip() if isinstance(v, str) and v.strip() else None

def build_location(d):
    """Prefer the full location_name; otherwise join whatever real text parts exist."""
    full = clean(d.get("location_name"))
    if full:
        return full
    parts = [clean(d.get(k)) for k in ("location_locality", "location_region", "location_country")]
    return ", ".join(p for p in parts if p) or None

ap = argparse.ArgumentParser()
ap.add_argument("db", nargs="?", default=os.environ.get("DATABASE_URL"))
ap.add_argument("--limit", type=int, default=50)
ap.add_argument("--refresh-days", type=int, default=180)
args = ap.parse_args()
if args.limit < 1 or args.limit > 500:
    ap.error("--limit must be between 1 and 500.")
if args.refresh_days < 0:
    ap.error("--refresh-days cannot be negative.")
if not args.db:
    ap.error("Set DATABASE_URL or pass a database URL.")
if not os.environ.get("ENRICH_API_KEY"):
    log("ERROR: ENRICH_API_KEY environment variable is not set. Cannot enrich profiles.")
    sys.exit(1)
db_url = make_url(args.db)
if db_url.drivername in ("postgres", "postgresql"):
    db_url = db_url.set(drivername="postgresql+psycopg2")
engine = create_engine(db_url)

# ---- Provider adapter: the ONLY part you change when switching vendors ----------
def fetch_profile(linkedin_url: str) -> dict | None:
    """Returns {'role','company','location','raw'} or None if not found."""
    r = requests.get(
        "https://api.peopledatalabs.com/v5/person/enrich",
        headers={"X-Api-Key": os.environ["ENRICH_API_KEY"]},
        params={"profile": linkedin_url, "min_likelihood": 6},
        timeout=30,
    )
    if r.status_code == 404:
        return None
    if r.status_code in (401, 402, 403, 429):
        raise SystemExit(f"Stopped: API returned {r.status_code} ({r.text[:120]}). "
                         "Check your key and credits; nothing was marked failed.")
    r.raise_for_status()
    d = r.json().get("data", {})
    return {"role": clean(d.get("job_title")), "company": clean(d.get("job_company_name")),
            "location": build_location(d), "raw": d}
# ---------------------------------------------------------------------------------

cutoff = now() - timedelta(days=args.refresh_days)
enrich_year = os.environ.get("ENRICH_YEAR", "").strip()
try:
    year = int(enrich_year) if enrich_year else None
except ValueError:
    ap.error("ENRICH_YEAR must be a valid year.")
if year is not None and not 1900 <= year <= 2200:
    ap.error("ENRICH_YEAR must be between 1900 and 2200.")

with engine.begin() as c:
    year_filter = " AND year_of_passing = :yr" if year is not None else ""
    params = {"cutoff": cutoff, "n": args.limit}
    if year is not None:
        params["yr"] = year
    todo = c.execute(text(f"""
        SELECT id, roll_number, linkedin_url FROM alumni
        WHERE linkedin_url IS NOT NULL AND TRIM(linkedin_url) <> ''
          AND (linkedin_status IN ('pending','failed','enriched','missing')
               OR linkedin_status IS NULL)
          AND COALESCE(data_source, '') NOT IN ('self_edit','event_checkin')
          AND (last_enriched_at IS NULL OR last_enriched_at < :cutoff)
          {year_filter}
        ORDER BY last_enriched_at IS NOT NULL, last_enriched_at
        LIMIT :n"""), params).fetchall()

log(f"{len(todo)} profiles to enrich")
ok = 0
fail = 0

for alumni_id, roll_number, url in todo:
    try:
        p = fetch_profile(url)
    except SystemExit as e:
        log(f"  [STOP] {e}")
        sys.exit(1)
    except Exception as e:
        log(f"  [ERR] {roll_number}: {e}")
        fail += 1
        with engine.begin() as c:
            c.execute(text("""UPDATE alumni SET linkedin_status='failed'
                WHERE id=:i AND COALESCE(data_source,'') NOT IN ('self_edit','event_checkin')"""),
                {"i": alumni_id})
        time.sleep(2)
        continue

    with engine.begin() as c:
        if not p:
            log(f"  [NOT FOUND] {roll_number}: no matching profile returned")
            fail += 1
            c.execute(text("""UPDATE alumni SET linkedin_status='failed', last_enriched_at=:t
                WHERE id=:i AND COALESCE(data_source,'') NOT IN ('self_edit','event_checkin')"""),
                      {"t": now(), "i": alumni_id})
            continue
        if not any((p["role"], p["company"], p["location"])):
            log(f"  [NO DATA] {roll_number}: provider returned no role, company, or location")
            fail += 1
            c.execute(text("""UPDATE alumni SET linkedin_status='failed', last_enriched_at=:t
                WHERE id=:i AND COALESCE(data_source,'') NOT IN ('self_edit','event_checkin')"""),
                      {"t": now(), "i": alumni_id})
            continue
        updated = c.execute(text("""UPDATE alumni SET
              "current_role"=COALESCE(:r, "current_role"),
              current_company=COALESCE(:c, current_company),
              location=COALESCE(:l, location),
              linkedin_status='enriched', last_enriched_at=:t, updated_at=:t,
              data_source='linkedin_api'
            WHERE id=:i AND COALESCE(data_source,'') NOT IN ('self_edit','event_checkin')"""),
            {"r": p["role"], "c": p["company"], "l": p["location"],
             "t": now(), "i": alumni_id})
        if not updated.rowcount:
            log(f"  [SKIPPED] {roll_number}: profile was edited during enrichment")
            continue
        c.execute(text("""INSERT INTO alumni_career_history
            (alumni_id, role, company, location, source, raw_response)
            VALUES (:i,:r,:c,:l,'linkedin_api',:raw)"""),
            {"i": alumni_id, "r": p["role"], "c": p["company"], "l": p["location"],
             "raw": json.dumps(p["raw"])})
        missing = []
        if not p["role"]:
            missing.append("role")
        if not p["company"]:
            missing.append("company")
        partial = f"; no {', '.join(missing)} returned" if missing else ""
        log(f"  [OK] {roll_number}: {p['role'] or 'role unavailable'} @ "
            f"{p['company'] or 'company unavailable'} "
            f"({p['location'] or 'location unavailable'}){partial}")
        ok += 1
    time.sleep(0.5)

log(f"Done: {ok} enriched, {fail} failed.")