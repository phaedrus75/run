/**
 * Lightweight check for Watch → JS point parsing (no Watch simulator required).
 */
import assert from 'assert';

function parsePoints(pointsJSON) {
  if (!pointsJSON) return [];
  try {
    const raw = JSON.parse(pointsJSON);
    if (!Array.isArray(raw)) return [];
    const out = [];
    for (const row of raw) {
      if (!Array.isArray(row) || row.length < 3) continue;
      const lat = Number(row[0]);
      const lng = Number(row[1]);
      const timestamp = Number(row[2]);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(timestamp)) continue;
      out.push({ lat, lng, timestamp });
    }
    return out;
  } catch {
    return [];
  }
}

const json = JSON.stringify([
  [51.5, -0.12, 1700000000000],
  [51.51, -0.121, 1700000060000],
]);

const pts = parsePoints(json);
assert.strictEqual(pts.length, 2);
assert.strictEqual(pts[0].lat, 51.5);
assert.strictEqual(pts[1].lng, -0.121);
console.log('verify-watch-bridge-payload: ok');
