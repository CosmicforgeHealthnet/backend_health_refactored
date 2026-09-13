# CosmicForge Patient Dashboard API Requirements
## Frontend Integration Specification for Existing Robust Backend

## 1. Purpose

This document defines the API contracts required by the frontend to implement the redesigned **CosmicForge Patient Dashboard**.

The backend is assumed to already be robust and to already contain mature domain logic for:

- Patient accounts
- Appointments
- Doctors
- Prescriptions
- Drug interactions
- Medical records
- Lab orders/results
- Pharmacy
- Stores/marketplace
- Orders
- Wallet/payments
- Communities
- Notifications
- AI Health Assistant
- Location/vendor discovery

The goal is therefore **not to rebuild or duplicate backend services**.

The frontend should consume the existing domain APIs wherever they already provide the required data. New endpoints should only be introduced where the dashboard needs a lightweight aggregation, summary, recommendation, discovery or activity feed that does not currently exist.

---

# 2. Core Backend Principle

The dashboard is a presentation layer over existing backend capabilities.

The backend should remain the source of truth for:

- Appointment state
- Payment state
- Prescription state
- Drug interaction detection
- Lab result state
- Medical record counts
- Doctor availability
- Doctor ratings/reviews
- Vendor availability
- Pharmacy/store opening state
- Product availability
- Prescription requirements
- Community membership
- Notifications
- Wallet balance
- Location-based vendor ranking

The frontend should **never calculate or infer these business states itself**.

---

# 3. Recommended Dashboard Integration Model

Because the backend is already robust, use the following model:

```text
Existing Domain APIs
        ↓
Optional Dashboard Read/Aggregation Layer
        ↓
Patient Dashboard Frontend
```

The dashboard can use:

1. Existing endpoints directly where they are already efficient.
2. A dashboard aggregation/read endpoint for initial page hydration.
3. Dedicated domain endpoints for drill-down, pagination, actions and full-page views.

Do not duplicate business logic inside a new dashboard service.

---

# 4. Recommended Main Dashboard Endpoint

If the current backend does not already expose a consolidated patient dashboard read model, add:

```http
GET /api/patient/dashboard/
```

This endpoint should aggregate lightweight data only.

It should not replace the underlying domain APIs.

### Suggested Response

```json
{
  "patient": {
    "id": "patient_001",
    "first_name": "Test Patient",
    "profile_image": null
  },
  "summary": {
    "upcoming_appointments": 1,
    "active_prescriptions": 2,
    "new_lab_results": 1,
    "medical_records": 8,
    "wallet_balance": 12400
  },
  "next_appointment": {},
  "alerts": [],
  "recommended_doctors": [],
  "recommended_communities": [],
  "nearby_vendors": [],
  "recent_activity": [],
  "news": []
}
```

### Important

This endpoint should:

- Be optimised for read performance.
- Return only dashboard-level data.
- Avoid returning full resource payloads unnecessarily.
- Reuse existing serializers/services/domain logic.
- Respect existing permissions and patient ownership checks.
- Remain safe if one optional section fails internally.

---

# 5. Patient Summary API

If the dashboard aggregation endpoint is not used, expose or reuse:

```http
GET /api/patient/dashboard/summary/
```

### Response

```json
{
  "upcoming_appointments": 1,
  "active_prescriptions": 2,
  "new_lab_results": 1,
  "medical_records": 8,
  "wallet_balance": 12400
}
```

### Data Sources

The backend should derive these values from the real existing services.

Do not hardcode counters.

---

# 6. Patient Alerts / Drug Interaction API

The dashboard contains a patient safety banner for Drug-Drug Interaction alerts.

Prefer a unified patient alerts endpoint:

```http
GET /api/patient/alerts/
```

### Example

```json
{
  "alerts": [
    {
      "id": "alert_001",
      "type": "drug_interaction",
      "severity": "high",
      "title": "Drug Interaction Alert",
      "message": "Potential interaction detected between Warfarin and Ibuprofen.",
      "resource_type": "prescription",
      "resource_id": "pres_123",
      "is_read": false,
      "requires_action": true,
      "created_at": "2026-08-28T09:30:00Z"
    }
  ]
}
```

### Rules

The backend should determine:

- Whether an interaction exists.
- The severity.
- The medications involved.
- Whether the alert is active.
- Whether it requires patient action.
- Whether it may be dismissed.

The frontend must not calculate DDI logic.

If the backend already has a dedicated DDI service, reuse it and expose its output through the patient alert layer.

---

# 7. Upcoming Appointment API

Reuse the existing appointment endpoint if available.

Preferred dashboard-friendly form:

```http
GET /api/patient/appointments/upcoming/?limit=1
```

### Response

```json
{
  "appointments": [
    {
      "id": "appt_123",
      "doctor": {
        "id": "doc_001",
        "name": "Dr. TEST ACCOUNT",
        "specialty": "General Physician",
        "profile_image": null
      },
      "date": "2026-08-31",
      "time": "11:20",
      "consultation_type": "video",
      "status": "awaiting_doctor_approval",
      "payment_status": "completed",
      "reason": "General consultation",
      "can_reschedule": true,
      "can_cancel": true
    }
  ]
}
```

### Backend Owns

- Appointment state
- Payment state
- Reschedule eligibility
- Cancellation eligibility
- Consultation type
- Approval state

The frontend should render exactly what the backend returns.

---

# 8. Appointment Calendar API

The dashboard calendar requires an efficient month-based endpoint.

```http
GET /api/patient/appointments/calendar/?month=2026-08
```

### Response

```json
{
  "month": "2026-08",
  "events": [
    {
      "id": "appt_123",
      "date": "2026-08-31",
      "time": "11:20",
      "type": "appointment",
      "title": "Appointment with Dr. TEST ACCOUNT",
      "status": "confirmed"
    }
  ]
}
```

This should be a lightweight read endpoint, not a full appointment serializer.

---

# 9. Active Prescriptions API

Reuse existing prescription endpoints.

Preferred:

```http
GET /api/patient/prescriptions/?status=active
```

or:

```http
GET /api/patient/prescriptions/active/
```

### Dashboard Response Requirement

At minimum:

```json
{
  "count": 2,
  "prescriptions": [
    {
      "id": "pres_001",
      "medication": "Paracetamol 500mg",
      "status": "active",
      "doctor_name": "Dr. TEST ACCOUNT",
      "start_date": "2026-08-25",
      "end_date": "2026-08-30"
    }
  ]
}
```

The dashboard mainly needs the count. Full medication details can remain on the prescription page.

---

# 10. Lab Result Summary API

Reuse the current lab service.

If no summary endpoint exists:

```http
GET /api/patient/lab-results/summary/
```

### Response

```json
{
  "total": 5,
  "new": 1,
  "latest": {
    "id": "lab_123",
    "test_name": "Full Blood Count",
    "status": "available",
    "is_read": false,
    "created_at": "2026-08-27T10:00:00Z"
  }
}
```

---

# 11. Medical Records Summary API

Reuse the Health Records domain.

If required:

```http
GET /api/patient/health-records/summary/
```

### Response

```json
{
  "total_records": 8,
  "latest_record": {
    "id": "record_123",
    "title": "Medical Report",
    "type": "consultation",
    "created_at": "2026-08-27T10:00:00Z"
  }
}
```

---

# 12. Wallet API

Only use this if the wallet already exists in the product.

Reuse the existing wallet endpoint.

Example:

```http
GET /api/patient/wallet/
```

### Dashboard Requirement

```json
{
  "balance": 12400,
  "currency": "NGN"
}
```

The frontend must not calculate balances from transaction history.

---

# 13. Recommended Doctors API

Reuse the current doctor discovery/search service where possible.

If a recommendation endpoint is required:

```http
GET /api/patient/doctors/recommended/?limit=3
```

### Response

```json
{
  "doctors": [
    {
      "id": "doc_01",
      "name": "Dr. Dianne Russell",
      "specialty": "Cardiologist",
      "profile_image": null,
      "rating": 4.8,
      "review_count": 156,
      "next_available": "2026-08-28T14:00:00Z"
    }
  ]
}
```

### Recommendation Logic

This logic belongs in the backend.

Possible backend ranking inputs:

- Availability
- Specialty relevance
- Popularity
- Patient search history
- Previous consultations
- Geographic availability
- General featured doctors

Do not infer sensitive medical conditions on the frontend.

Do not return ratings/reviews unless the platform genuinely supports them.

---

# 14. Recommended Communities API

Reuse the existing Health Community service.

Suggested read endpoint:

```http
GET /api/patient/communities/recommended/?limit=3
```

### Response

```json
{
  "communities": [
    {
      "id": "community_01",
      "name": "Healthy Living Group",
      "description": "A community for sharing healthy living information and support.",
      "member_count": 1200,
      "joined": false,
      "image": null
    }
  ]
}
```

Existing membership actions should be reused.

Example:

```http
POST /api/communities/{community_id}/join/
POST /api/communities/{community_id}/leave/
```

The frontend should not update membership optimistically without reconciling the backend response.

---

# 15. Nearby Pharmacy & Store Discovery API

The dashboard needs a unified discovery endpoint for nearby pharmacies and stores.

If existing Pharmacy and Store services are separate, the backend can either:

- Reuse both directly, or
- Provide a lightweight unified discovery/read endpoint.

Recommended:

```http
GET /api/patient/nearby-vendors/
```

### Query Parameters

```text
lat
lng
radius
type
limit
```

Example:

```http
GET /api/patient/nearby-vendors/?lat=9.0765&lng=7.3986&radius=10&type=all&limit=3
```

Allowed `type` values:

```text
all
pharmacy
store
```

### Response

```json
{
  "vendors": [
    {
      "id": "vendor_001",
      "name": "LifeCare Pharmacy",
      "type": "pharmacy",
      "logo": null,
      "distance_km": 1.2,
      "address": "Example Address",
      "is_open": true,
      "closes_at": "21:00",
      "delivery_available": true,
      "pickup_available": true
    }
  ]
}
```

### Backend Responsibilities

The backend should own:

- Distance calculation
- Vendor ranking
- Open/closed state
- Trading hours
- Vendor activation state
- Service availability
- Delivery availability
- Pickup availability

The frontend should not calculate this independently.

---

# 16. Vendor / Pharmacy Storefront API

When the patient clicks **Shop Now**, reuse the existing marketplace/storefront APIs.

Typical endpoints:

```http
GET /api/vendors/{vendor_id}/
GET /api/vendors/{vendor_id}/products/
```

### Product Query Parameters

Support existing filters such as:

```text
search
category
page
page_size
availability
```

Example:

```http
GET /api/vendors/{vendor_id}/products/?search=paracetamol&page=1
```

### Product Response

```json
{
  "products": [
    {
      "id": "prod_001",
      "name": "Paracetamol 500mg",
      "image": null,
      "price": 2500,
      "currency": "NGN",
      "in_stock": true,
      "requires_prescription": false
    }
  ]
}
```

The backend must remain the source of truth for:

- Price
- Inventory
- Prescription requirement
- Vendor ownership
- Availability
- Product status

---

# 17. Recent Activity API

The dashboard needs a unified timeline.

This should aggregate real patient events from existing domains.

Recommended endpoint:

```http
GET /api/patient/activity/?limit=5
```

### Example

```json
{
  "activities": [
    {
      "id": "activity_001",
      "type": "prescription",
      "title": "Prescription Refill",
      "description": "Paracetamol 500mg",
      "status": "completed",
      "resource_id": "pres_001",
      "created_at": "2026-08-26T10:00:00Z"
    },
    {
      "id": "activity_002",
      "type": "lab_result",
      "title": "Lab Result Available",
      "description": "Full Blood Count",
      "status": "new",
      "resource_id": "lab_123",
      "created_at": "2026-08-25T16:00:00Z"
    }
  ]
}
```

Possible activity types:

- appointment
- prescription
- lab_result
- medical_record
- payment
- pharmacy_order
- store_order
- community
- consultation

The backend should create the canonical activity representation.

---

# 18. Health News API

The frontend should consume CosmicForge's own API, not WHO directly.

Recommended:

```http
GET /api/health/news/?limit=4
```

### Response

```json
{
  "articles": [
    {
      "id": "news_001",
      "title": "Five Daily Habits for a Stronger Heart",
      "summary": "Short article summary",
      "category": "Heart Health",
      "image": null,
      "source": "WHO",
      "source_url": "https://...",
      "published_at": "2026-08-27T08:00:00Z"
    }
  ]
}
```

### Backend Flow

```text
WHO / Other Approved Health Sources
        ↓
Backend Fetcher
        ↓
Validation / Sanitisation
        ↓
Normalisation
        ↓
Caching
        ↓
CosmicForge News API
        ↓
Frontend
```

This keeps the frontend independent of external API changes.

---

# 19. Notifications API

Reuse the existing notification service.

Required dashboard calls:

```http
GET /api/patient/notifications/
```

and ideally:

```http
GET /api/patient/notifications/unread-count/
```

### Example

```json
{
  "unread_count": 3
}
```

Existing actions may include:

```http
PATCH /api/patient/notifications/{id}/read/
POST /api/patient/notifications/read-all/
```

Use existing conventions if already implemented.

---

# 20. Search API

The current header already contains global search.

If the backend already supports global search, reuse it.

Recommended conceptual interface:

```http
GET /api/search/?q=term
```

Search may return:

- Doctors
- Medical records
- Medications
- Pharmacy products
- Store products

The frontend should not implement separate local search logic for each dashboard widget unless required.

---

# 21. Location Handling

The frontend may request browser location permission.

The backend should then receive coordinates for nearby discovery.

Example:

```http
GET /api/patient/nearby-vendors/?lat={latitude}&lng={longitude}
```

If location permission is unavailable, backend/API should support alternative discovery by:

- Saved address
- Patient-selected city
- Saved location
- Default service area

Do not make location permission mandatory for the entire dashboard.

---

# 22. Pagination

Full list endpoints should remain paginated.

Examples:

```http
GET /api/patient/doctors/recommended/?page=1&page_size=20
GET /api/patient/communities/?page=1&page_size=20
GET /api/patient/activity/?page=1&page_size=20
GET /api/patient/notifications/?page=1&page_size=20
GET /api/vendors/{vendor_id}/products/?page=1&page_size=20
```

Dashboard previews should generally use:

```text
limit=3
limit=4
limit=5
```

rather than downloading full collections.

---

# 23. API Response Consistency

All dashboard-facing APIs should follow the backend's existing response convention.

If no standard currently exists, use consistent fields such as:

```json
{
  "success": true,
  "data": {},
  "message": null
}
```

or the existing platform serializer format.

Do not introduce a different response envelope only for the dashboard.

---

# 24. Error Handling Contract

Use meaningful HTTP status codes.

Examples:

```text
200  Successful request
201  Successful creation
400  Invalid request
401  Unauthenticated
403  Not permitted
404  Resource not found
409  Business state conflict
422  Validation/business rule failure
429  Rate limited
500  Internal server error
```

For frontend-displayable errors, return a safe message and structured error code where possible.

Example:

```json
{
  "code": "APPOINTMENT_CANNOT_BE_RESCHEDULED",
  "message": "This appointment can no longer be rescheduled."
}
```

Do not expose internal exception traces.

---

# 25. Permissions and Security

Every endpoint must enforce the existing backend permissions.

The frontend must never be trusted to determine ownership.

Examples:

- A patient must only see their own medical records.
- A patient must only see their own prescriptions.
- A patient must only see their own lab results.
- A patient must only see their own wallet.
- A patient must only modify their own appointments.
- Pharmacy/store access must follow existing product/vendor rules.
- Community actions must follow existing membership rules.

The dashboard aggregation layer must not bypass domain-level access control.

---

# 26. Performance Expectations

Because this is the home dashboard, performance matters.

Recommended:

- Keep dashboard payloads lightweight.
- Avoid returning complete objects where summaries are enough.
- Reuse existing query optimisation.
- Avoid N+1 doctor/vendor lookups.
- Cache safe public/recommendation data where appropriate.
- Cache external health news.
- Keep patient-specific state fresh.
- Paginate full collections.
- Allow dashboard sections to fail independently where practical.

---

# 27. Frontend Caching / Refresh Expectations

The backend should expose data in a way compatible with frontend query caching.

Recommended refresh behaviour:

### Refresh after:

- Appointment booking
- Appointment approval
- Appointment reschedule
- Payment completion
- Prescription creation
- Lab result publication
- Medical record upload
- Community join/leave
- Pharmacy/store order
- Notification read
- Wallet transaction

The frontend should invalidate/refetch the relevant domain query rather than force a full browser reload.

---

# 28. Recommended API Priority

## Priority 0 – Required for First Dashboard Release

| API | Purpose |
|---|---|
| `GET /api/patient/dashboard/` | Initial dashboard hydration |
| Existing Upcoming Appointment API | Next appointment card |
| Existing Prescription API | Prescription summary |
| Existing Lab Result API | Lab summary |
| Existing Health Records API | Medical record summary |
| `GET /api/patient/alerts/` | DDI / safety banner |
| `GET /api/patient/appointments/calendar/` | Calendar |
| `GET /api/patient/nearby-vendors/` | Nearby pharmacies/stores |
| Existing Vendor Products API | Shop Now flow |
| Existing Notifications API | Bell / unread state |

## Priority 1 – Dashboard Experience

| API | Purpose |
|---|---|
| `GET /api/patient/doctors/recommended/` | Recommended doctors |
| `GET /api/patient/communities/recommended/` | Community card |
| `GET /api/patient/activity/` | Recent activity |
| `GET /api/health/news/` | Health news |
| Existing Wallet API | Wallet summary |

## Priority 2 – Optimisation / Enhancements

| API | Purpose |
|---|---|
| Global Search | Header search |
| Advanced nearby-vendor filters | Pharmacy/store discovery |
| Personalised doctor ranking | Better recommendations |
| Personalised community ranking | Better community discovery |
| Dashboard preference APIs | Optional future personalisation |

---

# 29. What Should NOT Be Rebuilt

Because CosmicForge already has a robust backend, do not create parallel dashboard-specific versions of:

- Appointment booking logic
- Payment logic
- Prescription management
- DDI calculation engine
- Lab workflows
- Medical record permissions
- Doctor scheduling
- Pharmacy inventory
- Marketplace orders
- Community membership
- Notification delivery
- Wallet calculations

The dashboard should **consume these existing services**.

Only create new read/aggregation endpoints where the frontend cannot efficiently retrieve the required dashboard view from the existing API layer.

---

# 30. Recommended Final Architecture

```text
                    COSMICFORGE BACKEND

Appointments ──────────────┐
Prescriptions ─────────────┤
DDI / Alerts ──────────────┤
Lab Results ───────────────┤
Medical Records ───────────┤
Doctors ───────────────────┤
Communities ───────────────┤
Pharmacy ──────────────────┤
Stores ────────────────────┤
Orders ────────────────────┤
Wallet ────────────────────┤
Notifications ─────────────┤
                           ↓
                Dashboard Read / Aggregation
                       (where needed)
                           ↓
                  Patient Dashboard UI
```

For drill-down:

```text
Dashboard Card
      ↓
Existing Domain API
      ↓
Existing Module / Page
```

Example:

```text
Nearby Pharmacy
      ↓
Shop Now
      ↓
Existing Vendor Storefront API
      ↓
Existing Product / Cart / Checkout Flow
```

---

# 31. Final Backend Direction

The backend team does not need to build a separate dashboard backend.

The requirement is to expose the already-existing backend capabilities to the frontend in a **dashboard-friendly form**.

The main additions likely required are:

1. A lightweight patient dashboard aggregation endpoint.
2. A unified patient alert endpoint for DDI and other important alerts.
3. A lightweight appointment calendar endpoint.
4. A nearby pharmacy/store discovery endpoint.
5. A recommended doctors read endpoint if one does not already exist.
6. A recommended communities read endpoint if one does not already exist.
7. A unified recent patient activity endpoint.
8. A backend-normalised health news endpoint.

Everything else should reuse the existing robust CosmicForge APIs and business logic.

The frontend should receive **real, permission-safe, backend-derived data**, while the backend remains the single source of truth for all healthcare, commercial and workflow states.
