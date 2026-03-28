---
name: Email Verification Journey
overview: Add email verification as the final step of onboarding. After handle setup, the user must verify their email with a 6-digit code before entering the main app.
todos:
  - id: user-model-verify
    content: Add email_verified, verification_code_hash, verification_code_expires columns to User model + migration
    status: completed
  - id: auth-schema-verify
    content: Add email_verified to UserResponse in auth.py and User interface in auth.ts
    status: completed
  - id: email-verify-func
    content: Add send_verification_email() to email_service.py
    status: completed
  - id: verify-endpoints
    content: Add POST /auth/send-verification and POST /auth/verify-email endpoints; modify signup to send verification code
    status: completed
  - id: onboarding-verify-phase
    content: Add 'verify' phase to OnboardingScreen with 6-digit input, resend button, and completion flow
    status: completed
isProject: false
---

# Email Verification Journey

## Current Flow

`Signup` -> `Onboarding (slides -> level -> goals -> beta -> handle)` -> `Main App`

## New Flow

`Signup` -> `Onboarding (slides -> level -> goals -> beta -> handle -> verify email)` -> `Main App`

The verification code is sent during signup (replaces the welcome email). The user enters it as the last onboarding step. They can resend the code from that screen.

---

## Backend Changes

### 1. Add `email_verified` column to User model

- File: [backend/models.py](backend/models.py) — add `email_verified = Column(Boolean, default=False, server_default='false')` to the `User` model

### 2. Add migration for the new column

- File: [backend/main.py](backend/main.py) — add `ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false` in `run_migrations()`

### 3. Add `email_verified` to UserResponse schema

- File: [backend/auth.py](backend/auth.py) — add `email_verified: bool = False` to the `UserResponse` class

### 4. Create email verification endpoints

- File: [backend/main.py](backend/main.py)
  - `POST /auth/send-verification` — generates a 6-digit code, hashes it (reusing `get_password_hash`), stores it in `PasswordResetToken` with a `token_type` discriminator or a new simple model, and calls `send_verification_email()`. Rate limited to 3/min.
  - `POST /auth/verify-email` — accepts `{ code }`, verifies against stored hash, sets `user.email_verified = True`. Rate limited to 5/min.

### 5. Modify signup to send verification code instead of welcome email

- File: [backend/main.py](backend/main.py) — in the `signup` endpoint, generate a verification code, store it (hashed), and send it via a new `send_verification_email()` function instead of the welcome email

### 6. Add `send_verification_email()` to email service

- File: [backend/email_service.py](backend/email_service.py) — new function similar to `send_password_reset` but with verification-specific copy: "Verify your email to start using ZenRun"

### 7. Optionally gate protected endpoints on verification

- For v1: no gating — unverified users can still use the app during onboarding. The verification step in onboarding UX handles this. Could add gating later if needed.

---

## Frontend Changes

### 8. Update `User` interface

- File: [frontend/services/auth.ts](frontend/services/auth.ts) — add `email_verified: boolean` to the `User` interface

### 9. Add 'verify' phase to OnboardingScreen

- File: [frontend/screens/OnboardingScreen.tsx](frontend/screens/OnboardingScreen.tsx)
  - Add `'verify'` to the `Phase` type: `'slides' | 'level' | 'goals' | 'beta' | 'handle' | 'verify'`
  - After `handleComplete` (handle step), transition to `'verify'` phase instead of completing
  - Build verification UI: 6-digit code input, "Resend code" button, "Verify" button
  - On successful verification, call the final onboarding completion flow (existing logic)

### 10. Update AuthContext

- File: [frontend/contexts/AuthContext.tsx](frontend/contexts/AuthContext.tsx) — add `email_verified` awareness. The `needsOnboarding` check already covers this since onboarding won't be marked complete until verification succeeds.

---

## Data Model for Verification Codes

Reuse `PasswordResetToken` but add a `type` column (`"reset"` or `"verify"`) to distinguish the two, OR create a simpler approach: store verification codes directly as a new model `EmailVerificationCode`. The simpler approach is to just store a hashed code on the User model itself (fields: `verification_code_hash`, `verification_code_expires`), avoiding a separate table entirely.

**Recommended: inline on User model** — add `verification_code_hash` (String, nullable) and `verification_code_expires` (DateTime, nullable) columns. This avoids a new table and keeps verification tightly coupled to the user.