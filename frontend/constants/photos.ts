/**
 * Photo limits shared by run + walk capture flows.
 *
 * The cap exists to protect the detail-screen fetch (which currently returns
 * every photo's base64 in a single response) and the per-walk DB row size.
 * It is enforced in three places and must stay in lockstep with the backend
 * value in `backend/main.py`:
 *
 *   1. Active capture (camera) — `useActivityPhotoCapture`
 *   2. Post-save attach (library) — WalkDetailScreen / EditRunModal / RunScreen
 *   3. Server-side upload guard — `upload_run_photo` / `upload_walk_photo`
 *
 * 100 is well above any realistic single-walk usage (the median scenic walk
 * has 3–5 photos) and well below the point where the detail screen response
 * starts to feel slow.
 */
export const MAX_PHOTOS_PER_ACTIVITY = 100;
