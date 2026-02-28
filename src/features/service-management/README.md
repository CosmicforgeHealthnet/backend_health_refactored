# Service Management - Backend API

This feature provides a complete service availability management system that allows admins to set services as down, configure countdown timers, and track status history. It uses a **lazy reactivation** pattern for automatic service restoration.

## Features

- Set services to DOWN with optional countdown timers
- Automatic lazy reactivation when countdown expires
- Status change history with audit trail
- User notifications on status changes
- Downtime statistics and analytics
- Soft delete for services

---

## Installation

### 1. Register Entities

Ensure entities are registered in `src/entities/index.js`:

```javascript
const serviceManagement = require('../features/service-management/entities');

module.exports = [
  // ... other entities
  ...Object.values(serviceManagement),
];
```

### 2. Register Routes

Add to your main router (`src/routes/index.js`):

```javascript
const serviceManagementRoutes = require('../features/service-management');

router.use('/services', serviceManagementRoutes);
```

### 3. Run Migration

```bash
npm run migration:run
```

This creates the `service_availability` and `service_status_history` tables.

---

## API Endpoints

### Public Endpoints (No Auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/services` | Get all enabled services |
| GET | `/api/services/:serviceKey/status` | Get status of specific service |
| GET | `/api/services/:serviceKey/available` | Simple boolean availability check |
| POST | `/api/services/status/bulk` | Check multiple services at once |

### Admin Endpoints (Auth Required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/services/admin/all` | Get all services (includes disabled) |
| GET | `/api/services/admin/:id` | Get single service by ID |
| POST | `/api/services/admin` | Create a new service |
| PUT | `/api/services/admin/:id` | Update service details |
| POST | `/api/services/admin/:id/down` | Set service to DOWN |
| POST | `/api/services/admin/:id/active` | Set service to ACTIVE |
| POST | `/api/services/admin/:id/extend-countdown` | Extend countdown timer |
| POST | `/api/services/admin/:id/shorten-countdown` | Shorten countdown timer |
| DELETE | `/api/services/admin/:id` | Soft delete service |
| GET | `/api/services/admin/:id/history` | Get service status history |
| GET | `/api/services/admin/history/all` | Get all status history |
| GET | `/api/services/admin/:id/stats` | Get downtime statistics |

---

## Request/Response Examples

### Get All Services (Public)

**Request:**
```
GET /api/services
```

**Response:**
```json
{
  "success": true,
  "message": "Services retrieved successfully",
  "data": [
    {
      "id": "uuid",
      "serviceKey": "appointments",
      "name": "Appointments",
      "description": "Appointment booking system",
      "status": "active",
      "isAvailable": true,
      "countdownEnd": null,
      "downtimeMessage": null,
      "category": "medical",
      "iconUrl": null
    }
  ]
}
```

---

### Create Service (Admin)

**Request:**
```
POST /api/services/admin
Authorization: Bearer <token>
Content-Type: application/json

{
  "serviceKey": "telemedicine",
  "name": "Telemedicine Service",
  "description": "Video consultations with doctors",
  "category": "medical",
  "displayOrder": 5,
  "isEnabled": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Service created successfully",
  "data": {
    "id": "uuid",
    "serviceKey": "telemedicine",
    "name": "Telemedicine Service",
    "status": "active",
    "createdAt": "2026-02-28T10:00:00Z"
  }
}
```

---

### Set Service Down (Admin)

**Request:**
```
POST /api/services/admin/:id/down
Authorization: Bearer <token>
Content-Type: application/json

{
  "countdownEnd": "2026-02-28T15:00:00Z",
  "reason": "Scheduled database maintenance",
  "downtimeMessage": "We're performing scheduled maintenance. Back in 2 hours!",
  "showCountdown": true,
  "sendNotifications": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Service set to down successfully",
  "data": {
    "id": "uuid",
    "serviceKey": "appointments",
    "status": "down",
    "countdownEnd": "2026-02-28T15:00:00Z",
    "downtimeMessage": "We're performing scheduled maintenance. Back in 2 hours!",
    "showCountdown": true
  }
}
```

---

### Set Service Active (Admin)

**Request:**
```
POST /api/services/admin/:id/active
Authorization: Bearer <token>
Content-Type: application/json

{
  "sendNotifications": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Service set to active successfully",
  "data": {
    "id": "uuid",
    "serviceKey": "appointments",
    "status": "active",
    "countdownEnd": null
  }
}
```

---

### Extend Countdown (Admin)

**Request:**
```
POST /api/services/admin/:id/extend-countdown
Authorization: Bearer <token>
Content-Type: application/json

{
  "newCountdownEnd": "2026-02-28T18:00:00Z",
  "reason": "Need more time for maintenance",
  "sendNotifications": true
}
```

---

### Check Bulk Service Status (Public)

**Request:**
```
POST /api/services/status/bulk
Content-Type: application/json

{
  "serviceKeys": ["appointments", "pharmacy", "lab"]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Service statuses retrieved successfully",
  "data": {
    "appointments": {
      "serviceKey": "appointments",
      "name": "Appointments",
      "status": "active",
      "isAvailable": true,
      "countdownEnd": null
    },
    "pharmacy": {
      "serviceKey": "pharmacy",
      "name": "Pharmacy",
      "status": "down",
      "isAvailable": false,
      "countdownEnd": "2026-02-28T15:00:00Z",
      "downtimeMessage": "Back soon!"
    }
  }
}
```

---

### Get Service History (Admin)

**Request:**
```
GET /api/services/admin/:id/history?limit=50&skip=0
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "Service history retrieved successfully",
  "data": [
    {
      "id": "uuid",
      "serviceId": "uuid",
      "previousStatus": "active",
      "newStatus": "down",
      "action": "manual_down",
      "reason": "Scheduled maintenance",
      "changedBy": "admin-uuid",
      "downtimeDurationMinutes": null,
      "notificationsSent": true,
      "notificationCount": 150,
      "createdAt": "2026-02-28T10:00:00Z"
    }
  ],
  "pagination": { "limit": 50, "skip": 0 }
}
```

---

## Entities

### ServiceAvailability

```javascript
{
  id: "uuid",
  serviceKey: "appointments",       // Unique identifier
  name: "Appointments",             // Display name
  description: "...",               // Optional description
  status: "active" | "down",        // Current status
  countdownEnd: "ISO date" | null,  // Auto-reactivation time
  downtimeReason: "...",            // Internal reason
  downtimeMessage: "...",           // User-facing message
  showCountdown: true,              // Show countdown to users
  lastUpdatedBy: "admin-uuid",      // Admin who last updated
  category: "medical",              // Service category
  iconUrl: "https://...",           // Optional icon
  displayOrder: 0,                  // Sort order
  isEnabled: true,                  // Is visible to users
  isDeleted: false,                 // Soft delete flag
  createdAt: "ISO date",
  updatedAt: "ISO date"
}
```

### ServiceStatusHistory

```javascript
{
  id: "uuid",
  serviceId: "uuid",
  previousStatus: "active" | null,
  newStatus: "active" | "down",
  action: "manual_down" | "manual_active" | "auto_reactivated" | "countdown_extended" | "countdown_shortened" | "override_active" | "created",
  previousCountdownEnd: "ISO date" | null,
  newCountdownEnd: "ISO date" | null,
  reason: "...",
  changedBy: "admin-uuid" | null,   // null for system actions
  notificationsSent: true,
  notificationCount: 150,
  downtimeDurationMinutes: 120,     // Set when service comes back up
  ipAddress: "127.0.0.1",           // Audit trail
  userAgent: "...",                 // Audit trail
  metadata: {},                     // Additional data
  createdAt: "ISO date"
}
```

---

## Service Categories

| Category | Description |
|----------|-------------|
| `medical` | Medical services (appointments, consultations) |
| `pharmacy` | Pharmacy and medication services |
| `admin` | Administrative services |
| `support` | Support and help services |
| `other` | Other services |

---

## Status Change Actions

| Action | Description |
|--------|-------------|
| `manual_down` | Admin manually set service to down |
| `manual_active` | Admin manually set service to active |
| `auto_reactivated` | System auto-reactivated after countdown |
| `countdown_extended` | Admin extended the countdown |
| `countdown_shortened` | Admin shortened the countdown |
| `override_active` | Admin overrode countdown to bring back early |
| `created` | Service was created |

---

## Lazy Reactivation Pattern

Services are **automatically reactivated** when their countdown expires using a **lazy pattern**:

1. When a service is fetched (by ID, key, or list), the system checks if:
   - Status is `down`
   - `countdownEnd` is in the past

2. If both conditions are true:
   - Service is immediately set to `active`
   - History entry with `auto_reactivated` action is created
   - Notifications are sent to users
   - Downtime duration is calculated and logged

This approach avoids the need for background jobs or cron tasks.

```javascript
// This check happens automatically in:
// - getServiceById()
// - getServiceByKey()
// - getAllServices()
// - getServicesByCategory()
// - getPublicServiceStatus()
```

---

## Architecture

```
src/features/service-management/
├── entities/
│   ├── ServiceAvailability.js    # Main entity
│   ├── ServiceStatusHistory.js   # Audit history
│   └── index.js                  # Entity exports
├── repositories/
│   └── serviceAvailabilityRepository.js  # Data access
├── services/
│   ├── serviceAvailabilityService.js     # Business logic
│   └── serviceNotificationService.js     # Notifications
├── controllers/
│   └── serviceAvailabilityController.js  # HTTP handlers
├── routes/
│   └── index.js                  # Express routes
├── docs/
│   └── service-management-swagger.json
└── index.js                      # Feature entry point
```

---

## Service Methods

Located in `services/serviceAvailabilityService.js`:

| Method | Description |
|--------|-------------|
| `createService(data, adminId)` | Create a new service |
| `getServiceById(id)` | Get service by ID (with lazy check) |
| `getServiceByKey(serviceKey)` | Get service by key (with lazy check) |
| `getAllServices(includeDisabled)` | Get all services (with lazy check) |
| `setServiceDown(id, countdownEnd, ...)` | Set service to DOWN |
| `setServiceActive(id, adminId, ...)` | Set service to ACTIVE |
| `extendCountdown(id, newCountdownEnd, ...)` | Extend countdown |
| `shortenCountdown(id, newCountdownEnd, ...)` | Shorten countdown |
| `updateService(id, data, adminId)` | Update service details |
| `deleteService(id, adminId)` | Soft delete service |
| `getServiceHistory(id, limit, skip)` | Get status history |
| `getAllHistory(limit, skip)` | Get all history |
| `getDowntimeStats(id, startDate, endDate)` | Get statistics |
| `isServiceAvailable(serviceKey)` | Boolean availability check |
| `getPublicServiceStatus(serviceKey)` | Get public status |
| `getMultipleServiceStatuses(keys)` | Bulk status check |

---

## Notifications

When `sendNotifications: true` is set, the system sends:

1. **Service Down**: Email + in-app notification to all users
2. **Service Active**: Email + in-app notification to all users
3. **Countdown Extended**: Optional notification about extended downtime
4. **Countdown Shortened**: Optional notification (good news!)

Notification logic is in `services/serviceNotificationService.js`.

---

## Migration

The migration file is located at:
```
src/migrations/1761500000000-CreateServiceAvailabilityTables.js
```

To run:
```bash
npm run migration:run
```

To revert:
```bash
npm run migration:revert
```

---

## Usage Examples

### Check Service Before Performing Action

```javascript
const serviceAvailabilityService = require('../features/service-management/services/serviceAvailabilityService');

async function bookAppointment(userId, doctorId, time) {
  // Check if appointments service is available
  const isAvailable = await serviceAvailabilityService.isServiceAvailable('appointments');

  if (!isAvailable) {
    throw new Error('Appointment booking is temporarily unavailable');
  }

  // Proceed with booking...
}
```

### Get Service Status for Frontend

```javascript
async function getAppointmentPageData(req, res) {
  const status = await serviceAvailabilityService.getPublicServiceStatus('appointments');

  if (!status.isAvailable) {
    return res.json({
      available: false,
      message: status.downtimeMessage,
      countdownEnd: status.countdownEnd,
      showCountdown: status.showCountdown,
    });
  }

  // Return normal page data...
}
```

### Admin: Set Service Down for Maintenance

```javascript
const service = await serviceAvailabilityService.setServiceDown(
  serviceId,
  new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
  'Database maintenance',
  'We are performing scheduled maintenance. Service will be back in 2 hours.',
  true,  // showCountdown
  adminId,
  req.ip,
  req.get('User-Agent'),
  true   // sendNotifications
);
```

---

## Authorization

Admin endpoints require:
- Valid JWT token via `authenticateJWT` middleware
- Role: `ADMIN` or `SUPER_ADMIN` via `authorizeRoles` middleware

```javascript
const adminRoles = [USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN];

router.post(
  '/admin/:id/down',
  authenticateJWT,
  authorizeRoles(...adminRoles),
  controller.setServiceDown
);
```

---

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "message": "Service not found"
}
```

Common error codes:
- `400`: Invalid request (missing required fields, invalid countdown)
- `401`: Unauthorized (missing/invalid token)
- `403`: Forbidden (insufficient role)
- `404`: Service not found
- `409`: Conflict (duplicate service key)
- `500`: Internal server error
