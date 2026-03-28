# ZenRun Security Audit

**Date:** March 28, 2026  
**Scope:** Backend (FastAPI), Frontend (React Native), Website (Next.js), Deployment Infrastructure

---

## CRITICAL Severity

### 1. Unauthenticated CRUD on runs, weights, steps

**Files:** `backend/main.py`

Multiple endpoints accept unauthenticated requests and return or modify ALL users' data:

| Endpoint | Issue |
|----------|-------|
| `PUT /runs/{id}` | No auth — anyone can edit any run by ID |
| `DELETE /runs/{id}` | No auth — anyone can delete any run by ID |
| `GET /runs` | Unauthenticated requests return ALL users' runs (no user_id filter) |
| `GET /runs/{id}` | No auth — full run details for any run_id (IDOR) |
| `DELETE /weights/{id}` | No auth — anyone can delete any weight entry |
| `GET /weights` | Unauthenticated requests return ALL users' weight entries |
| `DELETE /steps/{id}` | No auth — anyone can delete any step entry |
| `GET /steps` | Unauthenticated requests return ALL users' step entries |

**Impact:** Complete data exposure and unauthorized data manipulation for all users.

**Fix:** Add `Depends(require_auth)` to all these endpoints. On update/delete, verify `entry.user_id == current_user.id`.

---

### 2. Default JWT Secret Key

**File:** `backend/auth.py` line 31

```python
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-in-production-abc123")
```

Falls back to a predictable default if the `SECRET_KEY` environment variable is not set. Anyone who reads the source code can forge valid JWT tokens.

**Impact:** Complete authentication bypass if env var is unset in production.

**Fix:** Remove the default value. Crash on startup if `SECRET_KEY` is not set. Verify it IS set on Railway.

---

### 3. Debug Endpoint Exposed

**File:** `backend/main.py` ~line 179

`GET /debug/tables` returns full database schema and table information, completely unauthenticated.

**Impact:** Database structure enumeration for attackers.

**Fix:** Remove entirely or gate behind admin authentication + IP allowlist.

---

## HIGH Severity

### 4. CORS Wildcard with Credentials

**File:** `backend/main.py` lines 56-61

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    ...
)
```

`allow_origins=["*"]` with `allow_credentials=True` is a misconfiguration. Browsers should not treat `*` as valid for credentialed requests, but the permissive origin opens cross-origin attack surface.

**Fix:** Set explicit origins: `["https://zenrun.co", "https://www.zenrun.co"]`.

---

### 5. No Rate Limiting on Auth Endpoints

**File:** `backend/main.py`

No rate limiting on any endpoint. Auth-related endpoints are vulnerable to brute force:
- `/auth/login` — unlimited login attempts
- `/auth/forgot-password` — unlimited reset code requests
- `/auth/reset-password` — 6-digit code with 15-minute window = ~1M possibilities, guessable without rate limiting

**Fix:** Add `slowapi` rate limiter: 5 attempts/min on `/auth/login`, `/auth/forgot-password`, `/auth/reset-password`.

---

### 6. 7-Day Access Tokens, No Refresh Rotation

**File:** `backend/auth.py` line 33

```python
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days
```

Long-lived access tokens increase the window for token theft and replay attacks. No refresh token mechanism exists.

**Impact:** Stolen tokens remain valid for a full week.

**Fix:** Shorten to 24h + add refresh token flow. Acceptable risk for v1 launch.

---

### 7. Unbounded Photo Uploads

**File:** `backend/main.py` — `POST /runs/{id}/photos`

Base64-encoded photo data accepted with no size limit. `RunPhoto.photo_data` stores the full base64 string in the database.

**Impact:** DoS via large payloads; database bloat.

**Fix:** Reject if decoded size > 2MB. Consider migrating to object storage (S3/R2) with URL references.

---

### 8. Website Auth Cookie Not Secure

**File:** `website/app/login/page.tsx` line 53

Session cookie set from client JavaScript: `zenrun_token=...` with `SameSite=Lax` only. No `Secure` flag, no `HttpOnly` flag. Token is readable by any script on the origin.

**Impact:** XSS on the website = session theft.

**Fix:** Add `Secure` flag. For `HttpOnly`, would need server-side cookie setting (post-launch improvement).

---

### 9. AsyncStorage for Tokens (Mobile)

**File:** `frontend/services/auth.ts`

Access tokens stored via `AsyncStorage`, which is unencrypted on-device storage. On rooted/jailbroken devices, tokens are readable.

**Impact:** Token theft on compromised devices.

**Fix:** Migrate to `expo-secure-store` (uses iOS Keychain / Android Keystore). Low risk for v1 since iOS sandbox provides baseline protection.

---

### 10. Reset Code Logged to Stdout

**File:** `backend/email_service.py`

When the Resend API key is not configured, the password reset code is printed to stdout. In production with logging, this exposes reset codes in server logs.

**Impact:** Secret disclosure in logs.

**Fix:** Remove the `print()` of reset codes. Fail closed if email service is not configured.

---

### 11. Unauthenticated Data Aggregation

**File:** `backend/main.py`

Several endpoints aggregate data across ALL users when unauthenticated:
- `GET /mood-insights` — aggregates all runs
- `GET /plans/current`, `GET /plans/{week_id}` — global shared plan (not user-scoped)
- `POST /plans` — creates plans without user association

**Fix:** Require auth on all these endpoints.

---

## MEDIUM Severity

### 12. No Security Headers on Website

**Files:** `website/next.config.js`, `website/app/layout.tsx`

No Content-Security-Policy, Strict-Transport-Security, X-Frame-Options, X-Content-Type-Options, or Referrer-Policy headers configured.

**Impact:** Reduced defense-in-depth against XSS and clickjacking.

**Fix:** Add `headers()` in `next.config.js`:
```js
async headers() {
  return [{
    source: '/(.*)',
    headers: [
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
    ],
  }];
}
```

---

### 13. Password in URL Query String on Reset

**Files:** `frontend/services/auth.ts` lines 141-151, `website/app/login/page.tsx`

Password reset sends `new_password` and `code` as URL query parameters. Query strings are logged by proxies, CDNs, and browser history.

**Fix:** Switch to JSON body POST for the reset-password endpoint.

---

### 14. Open Redirect on Login

**File:** `website/app/login/page.tsx` lines 22, 54

`redirect` query parameter passed directly to `router.push(redirect)` with no validation. Protocol-relative URLs like `//evil.com` could enable phishing.

**Fix:** Only allow redirects starting with `/` and reject values starting with `//`.

---

### 15. Duplicate user_id Columns in Models

**File:** `backend/models.py`

- `Weight` model defines `user_id` twice (lines 149 and 161)
- `StepEntry` model defines `user_id` twice (lines 213 and 216)

**Impact:** Confusing behavior; potential data integrity issues.

**Fix:** Remove duplicate column definitions.

---

### 16. Reset Code Stored in Plaintext

**File:** `backend/models.py` — `PasswordResetToken.reset_code`

The 6-digit reset code is stored as plaintext in the database. A database breach exposes all unexpired reset codes.

**Fix:** Store a hash of the code (like passwords) and compare on verification.

---

### 17. Inconsistent Password Hashing on Reset

**File:** `backend/main.py` lines 353-354

Password reset uses raw `bcrypt.hashpw` while signup uses passlib's `get_password_hash`. Inconsistent implementations increase maintenance risk.

**Fix:** Use `get_password_hash` from `auth.py` consistently.

---

### 18. Health Data in Console Logs

**File:** `frontend/components/ProfileModal.tsx` line 204

`console.log('Saving goals:', payload)` logs weight and goal fields (health-related data) to device console.

**Fix:** Remove or guard with `__DEV__` check.

---

### 19. No Email Validation on Signup

**File:** `backend/auth.py` lines 46-50

`UserCreate` uses `email: str` without validation. No `EmailStr`, no normalization, no max length.

**Fix:** Use Pydantic's `EmailStr`, normalize (lowercase, strip), enforce max length.

---

### 20. Hardcoded PII in Migration

**File:** `backend/main.py` lines 99-112

Migration code contains hardcoded email `aseem.munshi@gmail.com` for data reassignment.

**Fix:** Use environment variable or remove one-time migration code.

---

## LOW Severity

### 21. Hardcoded API URLs

**Files:** Multiple files in `frontend/` and `website/`

Production Railway URL `https://run-production-83ca.up.railway.app` is hardcoded in ~10 files. Not a secret, but exposes backend hostname and couples builds to one environment.

**Fix:** Centralize in a single config constant; consider environment-based configuration.

---

### 22. Account Enumeration on Signup

**File:** `backend/main.py` line ~223

Signup returns "Email already registered" — allows attackers to enumerate valid accounts.

**Fix:** Return generic message or same response timing.

---

### 23. Login Error Leaks Internals

**File:** `backend/main.py` line ~283

Login exception returns `detail=f"Login failed: {str(e)}"` which may leak internal error details.

**Fix:** Return generic "Login failed" message; log details server-side only.

---

### 24. Unpinned Dependencies

**File:** `backend/requirements.txt`

Uses lower bounds only (`fastapi>=0.115.0`). Builds are non-reproducible; transitive dependencies can shift.

**Fix:** Pin exact versions (`==`) or use a lockfile. Run `pip-audit` periodically.

---

### 25. No .env.example

No `.env.example` file documents required environment variables for deployment.

**Fix:** Create `.env.example` listing all required vars without values.

---

## Fix Status (Updated Feb 2026)

| # | Issue | Severity | Status |
|---|-------|----------|--------|
| 1 | Unauthenticated CRUD on runs/weights/steps | CRITICAL | FIXED |
| 2 | Default JWT Secret Key | CRITICAL | FIXED |
| 3 | Debug Endpoint Exposed | CRITICAL | FIXED (removed) |
| 4 | CORS Wildcard with Credentials | HIGH | FIXED |
| 5 | No Rate Limiting on Auth | HIGH | FIXED (slowapi) |
| 6 | 7-Day Access Tokens | HIGH | ACCEPTED (v1 trade-off) |
| 7 | Unbounded Photo Uploads | HIGH | FIXED (5MB limit) |
| 8 | Website Cookie Not Secure | HIGH | FIXED |
| 9 | AsyncStorage for Tokens | HIGH | ACCEPTED (v1, iOS sandbox) |
| 10 | Reset Code Logged to Stdout | HIGH | FIXED |
| 11 | Unauthenticated Data Aggregation | HIGH | FIXED |
| 12 | No Security Headers on Website | MEDIUM | FIXED |
| 13 | Password in URL on Reset | MEDIUM | FIXED (JSON body) |
| 14 | Open Redirect on Login | MEDIUM | FIXED |
| 15 | Duplicate user_id Columns | MEDIUM | FIXED |
| 16 | Reset Code Stored Plaintext | MEDIUM | FIXED |
| 17 | Inconsistent Password Hashing | MEDIUM | FIXED |
| 18 | Health Data in Console Logs | MEDIUM | FIXED |
| 19 | No Email Validation on Signup | MEDIUM | FIXED |
| 20 | Hardcoded PII in Migration | MEDIUM | FIXED |
| 21 | Hardcoded API URLs | LOW | FIXED |
| 22 | Account Enumeration on Signup | LOW | FIXED |
| 23 | Login Error Leaks Internals | LOW | FIXED |
| 24 | Unpinned Dependencies | LOW | FIXED |
| 25 | No .env.example | LOW | FIXED |

**Fixed:** 23 issues | **Accepted risk for v1:** 2 (items 6, 9)
