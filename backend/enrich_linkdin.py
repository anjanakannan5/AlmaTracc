"""Batch worker: for every alumni with a LinkedIn URL, fetch current role / company / location
from a LICENSED data-enrichment API and save it. Safe to re-run (resumable).
Usage: python enrich_linkedin.py [DATABASE_URL] [--limit 50] [--refresh-days 180]
Set env var ENRICH_API_KEY.
"""
import os, sys, json, time, argparse, requests
from datetime import datetime, timedelta
from sqlalchemy import create_engine, text

ap = argparse.ArgumentParser()
ap.add_argument("db", nargs="?", default="sqlite:///almatracc.db")
ap.add_argument("--limit", type=int, default=50)
ap.add_argument("--refresh-days", type=int, default=180)
args = ap.parse_args()
engine = create_engine(args.db)

# ---- Provider adapter: the ONLY part you change when switching vendors ----------
def fetch_profile(linkedin_url: str) -> dict | None:
    """Returns {'role','company','location','raw'} or None if not found.
    Example shown for People Data Labs' Person Enrichment API - confirm the endpoint and
    field names against the vendor's current docs before using."""
    r = requests.get(
        "https://api.peopledatalabs.com/v5/person/enrich",
        headers={"X-Api-Key": os.environ["ENRICH_API_KEY"]},
        params={"profile": linkedin_url, "min_likelihood": 6},
        timeout=30,
    )
    if r.status_code == 404:
        return None
    r.raise_for_status()
    d = r.json().get("data", {})
    return {"role": d.get("job_title"), "company": d.get("job_company_name"),
            "location": d.get("location_name"), "raw": d}
# ---------------------------------------------------------------------------------

cutoff = datetime.utcnow() - timedelta(days=args.refresh_days)
with engine.begin() as c:
    todo = c.execute(text("""
        SELECT id, linkedin_url FROM alumni
        WHERE linkedin_url IS NOT NULL
          AND linkedin_status IN ('pending','failed','enriched')
          AND (last_enriched_at IS NULL OR last_enriched_at < :cutoff)
        ORDER BY last_enriched_at IS NOT NULL, last_enriched_at
        LIMIT :n"""), {"cutoff": cutoff, "n": args.limit}).fetchall()

print(f"{len(todo)} profiles to enrich")
for alumni_id, url in todo:
    try:
        p = fetch_profile(url)
    except Exception as e:                      # network / quota / auth errors
        print(f"  ! {url}: {e}")
        with engine.begin() as c:
            c.execute(text("UPDATE alumni SET linkedin_status='failed' WHERE id=:i"), {"i": alumni_id})
        time.sleep(2); continue
    with engine.begin() as c:
        if not p:
            c.execute(text("UPDATE alumni SET linkedin_status='failed', last_enriched_at=:t WHERE id=:i"),
                      {"t": datetime.utcnow(), "i": alumni_id})
            continue
        c.execute(text("""INSERT INTO alumni_career_history
            (alumni_id, role, company, location, source, raw_response)
            VALUES (:i,:r,:c,:l,'linkedin_api',:raw)"""),
            {"i": alumni_id, "r": p["role"], "c": p["company"], "l": p["location"],
             "raw": json.dumps(p["raw"])})
        # Never overwrite data the alumnus edited themselves or gave at a check-in
        c.execute(text("""UPDATE alumni SET
              current_role=:r, current_company=:c, location=:l,
              linkedin_status='enriched', last_enriched_at=:t, updated_at=:t,
              data_source='linkedin_api'
            WHERE id=:i AND COALESCE(data_source,'') NOT IN ('self_edit','event_checkin')"""),
            {"r": p["role"], "c": p["company"], "l": p["location"],
             "t": datetime.utcnow(), "i": alumni_id})
        print(f"  ✓ {p['role']} @ {p['company']} ({p['location']})")
    time.sleep(0.5)                              # stay under the vendor's rate limit