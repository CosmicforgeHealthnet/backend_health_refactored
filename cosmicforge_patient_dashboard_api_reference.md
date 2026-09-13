# CosmicForge Patient Dashboard — API Reference (Implemented)

Real response shapes, taken directly from the backend code — not illustrative examples. All new endpoints below are prefixed `/api/patient/*` and require `Authorization: Bearer <token>` unless noted otherwise.

---

## 1. `GET /api/patient/dashboard`

Full page hydration. Each section is fetched independently — a failing domain returns an empty/default value for that section only.

```json
{
  "patient": { "id": "uuid" },
  "summary": {
    "upcoming_appointments": 1,
    "active_prescriptions": 2,
    "new_lab_results": 1,
    "medical_records": 8,
    "wallet_balance": 12400,
    "currency": "NGN"
  },
  "next_appointment": { "...see section 4 shape, or null" },
  "alerts": [ "...see section 2 shape" ],
  "recommended_doctors": [ "...see section 7 shape" ],
  "recommended_communities": [ "...see section 10 shape" ],
  "nearby_vendors": [],
  "recent_activity": [ "...see section 9 shape" ]
}
```

> `nearby_vendors` is always `[]` here — it needs `lat`/`lng`, which the dashboard doesn't have. Call section 8 separately once you have the client's coordinates.

---

## 2. `GET /api/patient/alerts`

Real drug-drug interaction check, computed live against **NIH/NLM RxNav** from the patient's current (non-cancelled) prescriptions. No fabricated interaction data — if the lookup can't resolve or RxNav is unreachable, this returns `{ "alerts": [] }`, not an error.

```json
{
  "alerts": [
    {
      "id": "alert_ddi_<patientId>_0",
      "type": "drug_interaction",
      "severity": "unspecified",
      "title": "Drug Interaction Alert",
      "message": "Warfarin and Ibuprofen may increase the risk of bleeding.",
      "resource_type": "prescription",
      "resource_id": "uuid",
      "is_read": false,
      "requires_action": true,
      "created_at": "2026-08-28T09:30:00.000Z"
    }
  ]
}
```

`severity` is only as good as what RxNav returns for that pair — often `"unspecified"`. Treat `alerts.length > 0` as "show the banner," not `severity`, for now.

---

## 3. `GET /api/patient/dashboard/summary`

```json
{
  "upcoming_appointments": 1,
  "active_prescriptions": 2,
  "new_lab_results": 1,
  "medical_records": 8,
  "wallet_balance": 12400,
  "currency": "NGN"
}
```

---

## 4. `GET /api/patient/appointments/upcoming?limit=1`

```json
{
  "appointments": [
    {
      "id": "uuid",
      "doctor": {
        "id": "uuid",
        "name": "Dr. Jane Doe",
        "specialty": "General Physician",
        "profile_image": "https://..."
      },
      "date": "2026-08-31",
      "time": "11:20:00",
      "consultation_type": "consultation",
      "status": "scheduled",
      "payment_status": "completed",
      "reason": "General consultation",
      "can_reschedule": true,
      "can_cancel": true
    }
  ]
}
```

`consultation_type` values: `consultation | follow-up | routine-checkup | urgent`. `status` values: `pending | scheduled | completed | cancelled | rescheduled`. `can_reschedule`/`can_cancel` are a UI hint (status is open + date hasn't passed) — the real cancel/reschedule endpoints still enforce the actual business rules.

---

## 5. `GET /api/patient/appointments/calendar?month=2026-08`

```json
{
  "month": "2026-08",
  "events": [
    {
      "id": "uuid",
      "date": "2026-08-31",
      "time": "11:20:00",
      "type": "appointment",
      "title": "Appointment with Dr. Jane Doe",
      "status": "scheduled"
    }
  ]
}
```

`month` is required, format `YYYY-MM`. Returns `400 { "code": "INVALID_MONTH", "message": "..." }` otherwise.

---

## 6. `GET /api/patient/lab-results/summary`

```json
{
  "total": 5,
  "new": 1,
  "latest": {
    "id": "uuid",
    "test_name": "Full Blood Count",
    "status": "results_approved",
    "is_read": false,
    "created_at": "2026-08-27T10:00:00.000Z"
  }
}
```

`status` values (relevant ones for "available" results): `results_ready | under_review | results_approved | completed`. `"new"` = delivered within the last 7 days (there's no real read/unread tracking on lab orders yet, this is a recency proxy). `latest` is `null` if there are no results yet.

---

## 7. `GET /api/patient/health-records/summary`

```json
{
  "total_records": 8,
  "latest_record": {
    "id": "uuid",
    "title": "blood_test_results.pdf",
    "type": "medical_records",
    "created_at": "2026-08-27T10:00:00.000Z"
  }
}
```

Backed by uploaded documents (`DocumentFileService`), not the structured health-profile fields (allergies/medications/etc. — those live under `/api/patient/health-records` from the original profile endpoints).

---

## 8. `GET /api/patient/nearby-vendors?lat=&lng=&radius=&type=&limit=`

`lat`/`lng` required (`400 LOCATION_REQUIRED` otherwise). `radius` in km, default `10`. `type`: `all | pharmacy | store`, default `all`. `limit` default `20`.

```json
{
  "vendors": [
    {
      "id": "uuid",
      "name": "LifeCare Pharmacy",
      "type": "pharmacy",
      "logo": "https://...",
      "distance_km": 1.2,
      "address": "12 Example Street",
      "is_open": null,
      "closes_at": null,
      "operating_hours": null,
      "delivery_available": true,
      "pickup_available": true
    }
  ]
}
```

⚠️ **Currently always returns `"vendors": []`.** The DB columns for `latitude`/`longitude` exist (migration applied), but there's no write endpoint yet for pharmacies/vendors to set their coordinates, so every profile has `NULL` coordinates. This needs a follow-up (extend pharmacy/vendor profile update endpoints + backfill) before this endpoint returns real data. `is_open`/`closes_at` are also always `null` — `operating_hours` has no fixed format in the DB (free text or arbitrary JSON depending on how each pharmacy filled it in), so open/closed state can't be reliably computed yet.

---

## 9. `GET /api/patient/activity?limit=5`

```json
{
  "activities": [
    {
      "id": "appointment_<uuid>",
      "type": "appointment",
      "title": "Appointment with Dr. Jane Doe",
      "description": "General consultation",
      "status": "completed",
      "resource_id": "uuid",
      "created_at": "2026-08-26T10:00:00.000Z"
    },
    {
      "id": "prescription_<uuid>",
      "type": "prescription",
      "title": "Prescription",
      "description": "Paracetamol 500mg, Amoxicillin",
      "status": "completed",
      "resource_id": "uuid",
      "created_at": "2026-08-25T16:00:00.000Z"
    },
    {
      "id": "lab_result_<uuid>",
      "type": "lab_result",
      "title": "Full Blood Count",
      "description": null,
      "status": "completed",
      "resource_id": "uuid",
      "created_at": "2026-08-24T09:00:00.000Z"
    },
    {
      "id": "medical_record_<uuid>",
      "type": "medical_record",
      "title": "blood_test_results.pdf",
      "description": "medical_records",
      "status": "completed",
      "resource_id": "uuid",
      "created_at": "2026-08-20T09:00:00.000Z"
    }
  ]
}
```

Covers `appointment | prescription | lab_result | medical_record` today (not yet `payment | pharmacy_order | store_order | community` — same pattern, can be added later).

---

## 10. `GET /api/patient/doctors/recommended?limit=3`

```json
{
  "doctors": [
    {
      "id": "uuid",
      "name": "Dr. Dianne Russell",
      "specialty": "Cardiologist",
      "profile_image": "https://...",
      "rating": 4.8,
      "review_count": 156,
      "next_available": "2026-08-29T09:00"
    }
  ]
}
```

Only verified (`status === 'doctor_active'`) **and** bookable (has pricing + availability configured) doctors are returned, ranked by `rating` desc. `next_available` can be `null` if nothing's open in the next 14 days.

---

## 11. `GET /api/health/news?limit=4` — public, no auth required

```json
{
  "articles": [
    {
      "id": "0ce5fa04-9ac3-465f-89cf-15a8e5a748dd",
      "title": "WHO Director-General visits Jordan to recognize strong collaboration on health system delivery",
      "summary": "The Director-General of the World Health Organization...",
      "category": null,
      "image": null,
      "source": "World Health Organization (WHO)",
      "source_url": "https://www.who.int/news/item/...",
      "published_at": "2026-02-25T18:06:55.000Z"
    }
  ]
}
```

Live from WHO's public RSS feed, cached server-side 30 minutes. `category` and `image` are always `null` — WHO's feed doesn't carry either.

---

## Reused existing endpoints (no new code, just point the frontend here)

### `GET /api/community/communities/discover?privacyType=public&page=1&limit=20`
This **is** the "join a community" list — already excludes communities the patient is in.

```json
{
  "success": true,
  "total": 42,
  "page": 1,
  "limit": 20,
  "communities": [
    {
      "id": "uuid",
      "name": "Healthy Living Group",
      "slug": "healthy-living-group",
      "description": "A community for sharing healthy living information and support.",
      "category": "wellness",
      "tags": ["nutrition", "fitness"],
      "privacyType": "public",
      "bannerUrl": null,
      "avatarUrl": null,
      "memberCount": 1200,
      "postCount": 340,
      "isActive": true,
      "createdAt": "2026-01-01T00:00:00.000Z",
      "createdBy": { "id": "uuid", "fullName": "...", "profileImageUrl": null, "role": "patient" },
      "chatRoomId": "uuid"
    }
  ]
}
```

Join: `POST /api/community/communities/{id}/join`
Leave: `POST /api/community/communities/{id}/leave`

### `GET /api/patient/wallet/summary`
```json
{ "success": true, "data": { "balance": 12400, "totalSpent": 3200, "totalTopUps": 15600, "currency": "NGN" } }
```

### `GET /api/notifications/counts`
```json
{
  "success": true,
  "data": {
    "total": 12,
    "unread": 3,
    "notifications": 9,
    "alerts": 3,
    "unreadNotifications": 2,
    "unreadAlerts": 1
  }
}
```

### `GET /api/patient/prescriptions?status=in_progress`
Status values: `pending | patient_uploaded | pharmacy_assigned | pharmacy_processing | under_review | awaiting_payment | in_progress | ready_for_pickup | out_for_delivery | completed | cancelled` (there's no literal `"active"` status — omit the filter or use one of these).

```json
{ "success": true, "data": [ { "id": "uuid", "reference": "RX-20260828-001", "medications": [ { "name": "Paracetamol 500mg", "dosage": "500mg", "frequency": "Twice daily", "duration": "7 days", "quantity": 14, "route": "oral" } ], "status": "in_progress", "..." : "..." } ] }
```

---

## Known gaps

1. **Nearby-vendors returns empty** until pharmacy/vendor profiles have `latitude`/`longitude` set (no write endpoint yet).
2. **`is_open`/`closes_at`** on nearby-vendors are always `null` (no fixed schema for `operatingHours` in the DB yet).
3. **Recent activity** doesn't yet include payments, pharmacy/store orders, or community events.
4. Priority-2 items from the original spec (global search, personalized ranking, dashboard preferences) were intentionally not built — lower priority, flag if you need them next.
