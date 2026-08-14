# NIN Verification — Frontend Integration Guide

> **Base URL (Dev):** `http://dev-api.cosmicforge-healthnet.com`
> All endpoints are prefixed with `/api`
> Protected routes require: `Authorization: Bearer <accessToken>`

This covers the new NIN (National Identification Number) identity check added on top of the existing Nigerian doctor verification flow. It confirms the doctor's registered name matches the government record for the NIN they submit — it does **not** replace the MDCN license verification, it's an additional step alongside it.

**Nigeria only.** This field/step should only be shown when the doctor's verification request `countryCode === "NG"`. For every other country, don't render anything NIN-related — the endpoint will reject the call for non-Nigerian requests anyway.

---

## Where this fits in the existing flow

1. Doctor submits verification → `POST /api/doctor/verification/submit` (unchanged).
2. If `countryCode === "NG"`, show a NIN input step alongside the document upload step.
3. Doctor submits their NIN → `POST /api/doctor/verification/:id/nin` (new — this guide).
4. Doctor's own status view (`GET /api/doctor/verification/status`) now includes a `ninVerification` block for Nigerian requests.
5. Admin review screen (`GET /api/admin/verification/:id`) now includes a fuller `ninVerification` block, including the government-returned name for manual comparison.

**Important for the admin UI:** a `mismatch` result does **not** block approval today — it's informational, surfaced so a human admin can eyeball it (married names, spelling variants, etc. are common false mismatches). Don't build the admin approve button to auto-disable on `mismatch`; just make the mismatch state visually obvious (e.g. a warning badge) so the reviewer notices it.

---

## 1. Submit NIN for verification

### `POST /api/doctor/verification/:id/nin` — Auth required (doctor)

`:id` is the verification request ID (the same one returned from `/verification/submit`).

**Request Body:**
```json
{
  "nin": "12345678901"
}
```
> Must be exactly 11 digits. Client-side, validate this before submitting to avoid an avoidable round trip — but the server re-validates regardless.

**Response `200` (success — verified or mismatch or failed, all return 200):**
```json
{
  "message": "NIN submitted for verification",
  "ninVerificationStatus": "verified",
  "nameMatchScore": 96,
  "error": null
}
```

`ninVerificationStatus` is one of:

| Value | Meaning | Suggested UI treatment |
|---|---|---|
| `verified` | NIN is valid and the government name matched the doctor's platform name | Green check, "Identity verified" |
| `mismatch` | NIN is valid, but the returned name didn't match closely enough | Amber warning — "We found this NIN, but the name doesn't quite match. Our team will review it." Don't block the doctor from continuing. |
| `failed` | NIN lookup failed (invalid number, not found, provider error) | Red state with a "Try again" affordance. `error` will have a human-readable reason. |

**Response `400` — validation error (bad format, wrong country, not the request owner, etc.):**
```json
{
  "error": "A valid 11-digit NIN is required"
}
```
Other possible `error` messages from this endpoint:
- `"NIN verification only applies to Nigeria"` — shouldn't happen if you gate the UI by country, but handle it defensively.
- `"Verification request not found"` — bad/stale `:id`.

---

## 2. Doctor's own status view

### `GET /api/doctor/verification/status` — Auth required (doctor)

The existing response now includes a `ninVerification` block on `currentVerification`, present only when `countryCode === "NG"` (otherwise `null`):

```json
{
  "hasVerification": true,
  "currentVerification": {
    "id": "uuid",
    "status": "manual_review",
    "countryCode": "NG",
    "...": "...(unchanged fields)",
    "ninVerification": {
      "status": "verified",
      "nameMatchScore": 96,
      "submittedAt": "2026-07-16T10:00:00.000Z"
    }
  }
}
```

If the doctor hasn't submitted a NIN yet, `ninVerification.status` will be `"not_submitted"` and `nameMatchScore`/`submittedAt` will be `null` — use that to decide whether to show the "submit your NIN" prompt vs. a result state.

---

## 3. Admin review screen

### `GET /api/admin/verification/:id` — Auth required (admin/super_admin)

The existing response now includes a fuller `ninVerification` block:

```json
{
  "verificationRequest": {
    "id": "uuid",
    "licenseNumber": "MDCN/R/12345",
    "countryCode": "NG",
    "...": "...(unchanged fields)",
    "ninVerification": {
      "status": "mismatch",
      "last4": "6789",
      "nameMatchScore": 62,
      "verifiedData": {
        "firstName": "Chidi",
        "middleName": "Emeka",
        "lastName": "Okoro",
        "registeredName": "Chidi Emeka Okoro",
        "gender": "M",
        "dateOfBirth": "1990-04-12",
        "phoneNumber": "080********"
      },
      "submittedAt": "2026-07-16T10:00:00.000Z",
      "verifiedAt": "2026-07-16T10:00:05.000Z"
    }
  }
}
```

**UI suggestion for the review screen:** show `verifiedData.registeredName` (from NIMC, via the provider) side-by-side with the doctor's platform name and `nameMatchScore`, so the admin can make the mismatch/verified call visually rather than trusting the score blindly. The full NIN itself is never returned by any endpoint — only `last4`, for reference ("...6789").

---

## Notes / things not built yet

- **No hard gate on approval.** A `mismatch` or `failed` NIN status currently does not block `POST /api/admin/verification/:id/approve`. This is intentional for now — pending a policy decision on the grace period for doctors who signed up before this feature existed. Don't build frontend logic that assumes NIN verification is mandatory to reach `approved` yet; that may change later.
- **No retry-count limit yet** — a doctor can resubmit a different NIN by calling the endpoint again; each call overwrites the previous NIN result.
- **No dedicated "NIN mismatch" admin filter yet** on the verification queue endpoint (`GET /api/admin/verification/queue` from the doctor-verification admin routes) — if you need one, flag it and it can be added as a query filter.
