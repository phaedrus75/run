"""
Diagnostic: inspect recent runs + photos for a given user.

Usage (with Railway env):
    railway run python scripts/diagnose_run_photos.py [user_id]

Prints, for the most recent ~10 runs:
  - id, started_at, completed_at, distance_km, category
  - route_polyline length (just to confirm GPS run vs manual)
  - linked photo count
  - whether started_at is NULL (the suspected bug)
"""
import os
import sys
from sqlalchemy import create_engine, text

USER_ID = int(sys.argv[1]) if len(sys.argv) > 1 else 1
LIMIT = int(sys.argv[2]) if len(sys.argv) > 2 else 10

db_url = os.environ.get("DATABASE_PUBLIC_URL") or os.environ.get("DATABASE_URL")
if not db_url:
    print("ERROR: DATABASE_PUBLIC_URL/DATABASE_URL not set. Run via `railway run python ...`", file=sys.stderr)
    sys.exit(1)

if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

engine = create_engine(db_url)

with engine.connect() as conn:
    rows = conn.execute(text("""
        SELECT
            r.id,
            r.started_at,
            r.completed_at,
            r.distance_km,
            r.duration_seconds,
            r.category,
            CASE WHEN r.route_polyline IS NULL THEN 0 ELSE LENGTH(r.route_polyline) END AS poly_len,
            COALESCE(rp.photo_count, 0) AS photo_count
        FROM runs r
        LEFT JOIN (
            SELECT run_id, COUNT(*) AS photo_count
            FROM run_photos
            GROUP BY run_id
        ) rp ON rp.run_id = r.id
        WHERE r.user_id = :uid
        ORDER BY r.id DESC
        LIMIT :lim
    """), {"uid": USER_ID, "lim": LIMIT}).fetchall()

    if not rows:
        print(f"No runs found for user_id={USER_ID}")
        sys.exit(0)

    print(f"\n=== Latest {len(rows)} runs for user_id={USER_ID} ===\n")
    print(f"{'id':>6}  {'started_at':<23}  {'completed_at':<23}  {'dist':>5}  {'dur':>5}  {'cat':<9}  {'poly':>6}  {'photos':>6}  flags")
    print("-" * 120)
    for r in rows:
        flags = []
        if r.started_at is None:
            flags.append("STARTED_AT_NULL")
        if r.completed_at is None:
            flags.append("COMPLETED_AT_NULL")
        if r.poly_len > 0 and r.photo_count == 0:
            flags.append("GPS_NO_PHOTOS")
        if r.poly_len == 0 and r.category == "outdoor":
            flags.append("OUTDOOR_NO_POLY")
        sa = str(r.started_at) if r.started_at else "NULL"
        ca = str(r.completed_at) if r.completed_at else "NULL"
        print(f"{r.id:>6}  {sa:<23}  {ca:<23}  {r.distance_km:>5.2f}  {r.duration_seconds:>5}  {(r.category or ''):<9}  {r.poly_len:>6}  {r.photo_count:>6}  {' '.join(flags)}")

    null_count = sum(1 for r in rows if r.started_at is None)
    gps_runs = sum(1 for r in rows if r.poly_len > 0)
    print()
    print(f"Summary: {null_count}/{len(rows)} runs have NULL started_at")
    print(f"         {gps_runs}/{len(rows)} runs have a route polyline (GPS-tracked)")
