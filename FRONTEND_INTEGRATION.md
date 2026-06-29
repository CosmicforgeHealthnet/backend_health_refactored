# CosmicForge Health — Frontend Integration Guide

**Base URL:** `https://dev-api.cosmicforge-healthnet.com/api`

All protected endpoints (`🔒`) require:
```
Authorization: Bearer <accessToken>
Content-Type: application/json
```

---

## Table of Contents
1. [How the Cart Works](#how-the-cart-works)
2. [Vendor Endpoints](#vendor-endpoints)
3. [Pharmacy Endpoints](#pharmacy-endpoints)
4. [Patient Cart Endpoints](#patient-cart-endpoints)
5. [WebSocket Notifications](#websocket-notifications)
6. [Test Credentials](#test-credentials)
7. [Environment Variables Required](#environment-variables-required)

---

## How the Cart Works

The cart is a **direct shop flow** — no back and forth with the pharmacy/vendor. The patient browses, adds to cart, and pays directly like a normal online store.

### Full Flow

```
1. Patient finds a pharmacy
   GET /pharmacy/:id  →  gets { vendorId, pharmacyName, ... }

2. Patient browses products from that pharmacy
   GET /vendor/products/public?vendorId=<vendorId>

3. Patient adds items to cart
   POST /cart/vendor/:vendorId/items  →  cart is created automatically (status: draft)

4. Patient can add more items, update quantities, or remove items
   PUT  /cart/:cartId/items/:itemId   →  change quantity
   DELETE /cart/:cartId/items/:itemId →  remove item

5. Patient submits the cart
   POST /cart/:cartId/submit  →  cart auto-confirms at product prices (status: confirmed)
   Optionally pass prescriptionId if the patient has a prescription for these drugs

6. Patient pays
   POST /cart/:cartId/pay  →  returns a redirectUrl from Paystack or Flutterwave

7. Redirect the patient to redirectUrl
   Patient completes payment on Paystack/Flutterwave page

8. Payment webhook fires automatically (no action needed from frontend)
   - Cart status → paid
   - 93% of total → credited to vendor's wallet (available immediately)
   - 7% → CosmicForge platform fee
   - If prescriptionId was passed → prescription automatically marked as completed
   - Vendor receives a real-time notification via WebSocket
```

### Cart Statuses
| Status | Meaning |
|---|---|
| `draft` | Patient is still adding items |
| `confirmed` | Cart submitted and prices confirmed — ready for payment |
| `paid` | Payment successful |
| `cancelled` | Cancelled by patient or vendor |

### Key Rules
- One draft cart per patient per vendor at a time. Adding a new item to the same vendor's shop adds to the existing draft cart automatically.
- Cart must be `confirmed` before you can call `/pay`.
- Once `paid`, it cannot be cancelled or modified.
- `prescriptionId` is optional. Pass it during submit if the patient is buying drugs against a prescription.

---

## Vendor Endpoints

### Register
```
POST /vendor/auth/register
```
**Request:**
```json
{
  "fullName": "John Doe",
  "email": "vendor@example.com",
  "password": "SecurePass123",
  "phoneNumber": "+2348012345678",
  "businessName": "HealthPlus Store",
  "businessCategory": "health_wellness",
  "businessEmail": "business@healthplus.com",
  "businessPhone": "+2348012345678",
  "country": "Nigeria",
  "state": "Lagos",
  "city": "Ikeja",
  "fullAddress": "12 Allen Avenue, Ikeja, Lagos",
  "businessDescription": "Premium health and wellness products",
  "businessWebsite": "https://healthplus.com"
}
```
**businessCategory options:** `health_wellness`, `medical_supplies`, `baby_mother_care`, `fitness_lifestyle`, `nutrition_healthy_living`, `others`

**Response `201`:**
```json
{
  "success": true,
  "message": "Vendor registration successful. Check your email for a verification link.",
  "vendor": {
    "id": "uuid",
    "businessName": "HealthPlus Store",
    "businessCategory": "health_wellness",
    "businessEmail": "business@healthplus.com",
    "businessPhone": "+2348012345678",
    "country": "Nigeria",
    "state": "Lagos",
    "city": "Ikeja",
    "fullAddress": "12 Allen Avenue, Ikeja, Lagos",
    "verificationStatus": "pending",
    "isActive": false,
    "documentsSubmitted": false,
    "createdAt": "2026-06-28T10:00:00Z"
  },
  "user": {
    "id": "uuid",
    "fullName": "John Doe",
    "email": "vendor@example.com",
    "role": "vendor",
    "status": "active",
    "tier": "free",
    "createdAt": "2026-06-28T10:00:00Z"
  }
}
```

---

### Login
```
POST /vendor/auth/login
```
**Request:**
```json
{
  "email": "vendor@example.com",
  "password": "SecurePass123",
  "deviceFingerprint": "device-unique-string"
}
```
**Response `200`:**
```json
{
  "success": true,
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "payload": {
    "sub": "user-uuid",
    "email": "vendor@example.com",
    "role": "vendor"
  },
  "vendor": {
    "id": "uuid",
    "businessName": "HealthPlus Store",
    "businessCategory": "health_wellness",
    "verificationStatus": "approved",
    "isActive": true,
    "documentsSubmitted": true
  }
}
```

---

### Forgot Password
```
POST /vendor/auth/forgot-password
```
**Request:**
```json
{ "email": "vendor@example.com" }
```
**Response `200`:**
```json
{ "success": true, "message": "If that email is registered, a reset link has been sent." }
```
Email link goes to: `VENDOR_APP_URL/auth/reset-password?token=xxx`

---

### Reset Password
```
POST /vendor/auth/reset-password
```
**Request:**
```json
{ "token": "token-from-email", "newPassword": "NewPass123" }
```
**Response `200`:**
```json
{ "success": true, "message": "Password reset successful. You can now log in." }
```

---

### Refresh Token
```
POST /vendor/auth/refresh
```
**Request:**
```json
{ "refreshToken": "eyJ..." }
```
**Response `200`:**
```json
{ "success": true, "accessToken": "eyJ...", "refreshToken": "eyJ..." }
```

---

### Get Profile `🔒`
```
GET /vendor/auth/profile
```
**Response `200`:**
```json
{
  "success": true,
  "vendor": {
    "id": "uuid",
    "businessName": "HealthPlus Store",
    "businessCategory": "health_wellness",
    "businessEmail": "business@healthplus.com",
    "businessPhone": "+2348012345678",
    "country": "Nigeria",
    "state": "Lagos",
    "city": "Ikeja",
    "fullAddress": "12 Allen Avenue, Ikeja, Lagos",
    "businessWebsite": "https://healthplus.com",
    "businessDescription": "Premium health and wellness products",
    "logoUrl": "https://dev-api.cosmicforge-healthnet.com/api/documents/images/uuid",
    "verificationStatus": "approved",
    "isActive": true,
    "documentsSubmitted": true,
    "isHybridPharmacy": false,
    "createdAt": "2026-06-28T10:00:00Z"
  },
  "user": {
    "id": "uuid",
    "fullName": "John Doe",
    "email": "vendor@example.com",
    "role": "vendor"
  }
}
```

---

### Upload Logo `🔒`
```
POST /vendor/auth/logo
Content-Type: multipart/form-data
```
**Form field:** `file` (image)

**Response `200`:**
```json
{
  "success": true,
  "message": "Logo uploaded successfully",
  "logoUrl": "https://dev-api.cosmicforge-healthnet.com/api/documents/images/uuid"
}
```

---

### Upload Document `🔒`
```
POST /vendor/auth/documents
Content-Type: multipart/form-data
```
**Form fields:** `file` (document), `documentType` (`government_id` or `business_registration`)

**Response `200`:**
```json
{
  "success": true,
  "message": "Document uploaded. Your account is now pending verification review.",
  "document": {
    "id": "uuid",
    "documentType": "government_id",
    "documentUrl": "https://dev-api.cosmicforge-healthnet.com/api/documents/images/uuid",
    "fileName": "id_card.jpg",
    "createdAt": "2026-06-28T10:00:00Z"
  }
}
```

---

### Products — Create `🔒`
```
POST /vendor/products
```
**Request:**
```json
{
  "title": "Vitamin C 1000mg Tablets x 30",
  "description": "High-strength vitamin C supplement",
  "price": 3500,
  "stockQuantity": 100,
  "category": "health_wellness",
  "subcategory": "vitamins_supplements",
  "prescriptionRequired": false,
  "mediaUrls": [
    { "url": "https://dev-api.cosmicforge-healthnet.com/api/documents/images/uuid", "type": "image" }
  ]
}
```
**Response `201`:**
```json
{
  "success": true,
  "message": "Product submitted for admin approval",
  "product": {
    "id": "uuid",
    "title": "Vitamin C 1000mg Tablets x 30",
    "description": "High-strength vitamin C supplement",
    "price": "3500.00",
    "stockQuantity": 100,
    "category": "health_wellness",
    "subcategory": "vitamins_supplements",
    "prescriptionRequired": false,
    "status": "pending",
    "rejectionReason": null,
    "isActive": true,
    "media": [],
    "createdAt": "2026-06-28T10:00:00Z"
  }
}
```

> **Tip:** Upload media first via `POST /vendor/products/media/upload`, get the URLs, then pass them in `mediaUrls` when creating the product.

---

### Products — Upload Media First `🔒`
```
POST /vendor/products/media/upload
Content-Type: multipart/form-data
```
**Form field:** `file` (image or video)

**Response `200`:**
```json
{
  "success": true,
  "message": "Media uploaded. Pass the urls in mediaUrls when creating your product.",
  "media": [
    {
      "url": "https://dev-api.cosmicforge-healthnet.com/api/documents/images/uuid",
      "mimeType": "image/jpeg",
      "type": "image"
    }
  ]
}
```

---

### Products — List My Products `🔒`
```
GET /vendor/products?status=approved&page=1&limit=20
```
**Response `200`:**
```json
{
  "success": true,
  "products": [
    {
      "id": "uuid",
      "title": "Vitamin C 1000mg Tablets x 30",
      "price": "3500.00",
      "stockQuantity": 100,
      "category": "health_wellness",
      "subcategory": "vitamins_supplements",
      "prescriptionRequired": false,
      "status": "approved",
      "isActive": true,
      "media": [
        { "id": "uuid", "mediaUrl": "https://...", "mediaType": "image", "isPrimary": true }
      ],
      "createdAt": "2026-06-28T10:00:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20
}
```
**status filter:** `pending`, `approved`, `failed`

---

### Products — Out of Stock `🔒`
```
GET /vendor/products/out-of-stock
```
**Response `200`:**
```json
{
  "success": true,
  "products": [
    {
      "id": "uuid",
      "title": "Paracetamol 500mg",
      "price": "650.00",
      "stockQuantity": 0,
      "status": "approved",
      "media": []
    }
  ],
  "total": 1
}
```

---

### Products — Get Single `🔒`
```
GET /vendor/products/:id
```
**Response `200`:** Same product object as above.

---

### Products — Update `🔒`
```
PUT /vendor/products/:id
```
**Request:** (any combination of these fields)
```json
{
  "title": "Updated Title",
  "description": "Updated description",
  "price": 4000,
  "stockQuantity": 50,
  "isActive": true,
  "prescriptionRequired": false
}
```
**Response `200`:**
```json
{
  "success": true,
  "message": "Product updated and resubmitted for approval",
  "product": { "...updated product object..." }
}
```

---

### Products — Delete `🔒`
```
DELETE /vendor/products/:id
```
**Response `200`:**
```json
{ "success": true, "message": "Product deleted" }
```

---

### Vendor Cart — View Orders `🔒`
```
GET /vendor/carts?status=confirmed&page=1&limit=20
```
**Response `200`:**
```json
{
  "success": true,
  "carts": [
    {
      "id": "uuid",
      "status": "confirmed",
      "confirmedTotal": "9300.00",
      "patientNote": "Please deliver by evening",
      "submittedAt": "2026-06-28T10:00:00Z",
      "confirmedAt": "2026-06-28T10:00:00Z",
      "paidAt": null,
      "patient": { "id": "uuid", "fullName": "Jane Patient" },
      "items": [
        {
          "id": "uuid",
          "productTitle": "Vitamin C 1000mg",
          "quantity": 2,
          "priceSnapshot": "3500.00",
          "lineTotal": "7000.00"
        }
      ],
      "itemCount": 1,
      "estimatedTotal": "7000.00"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20
}
```

---

### Vendor Cart — Cancel Order `🔒`
```
POST /vendor/carts/:cartId/cancel
```
**Response `200`:**
```json
{ "success": true, "message": "Cart cancelled", "cart": { "...cart object..." } }
```

---

### Wallet Summary `🔒`
```
GET /vendor/wallet/summary
```
**Response `200`:**
```json
{
  "success": true,
  "wallet": {
    "availableBalanceNgn": 9300.00,
    "pendingClearanceNgn": 0.00,
    "totalEarningsNgn": 9300.00,
    "isActive": true,
    "isFrozen": false,
    "frozenReason": null,
    "lastPayoutAt": null
  }
}
```

---

### Wallet Transactions `🔒`
```
GET /vendor/wallet/transactions?page=1&limit=20
```
**Response `200`:**
```json
{
  "success": true,
  "transactions": [
    {
      "id": "uuid",
      "type": "credit",
      "category": "order_payment",
      "status": "completed",
      "amountNgn": 9300.00,
      "balanceAfterNgn": 9300.00,
      "description": "Cart order — patient paid ₦10,000 (platform fee: ₦700.00)",
      "reference": "transaction-uuid",
      "createdAt": "2026-06-28T10:00:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20
}
```

---

### Notifications `🔒`
```
GET    /vendor/notifications?type=all&isRead=all&limit=20&skip=0
GET    /vendor/notifications/counts
PUT    /vendor/notifications/read-all
PUT    /vendor/notifications/:id/read
DELETE /vendor/notifications/:id
```

**GET /vendor/notifications Response `200`:**
```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "id": "uuid",
        "type": "notification",
        "message": "Payment received for order. Amount: ₦9,300. Funds are in your wallet.",
        "isRead": false,
        "metadata": { "cartId": "uuid" },
        "createdAt": "2026-06-28T10:00:00Z",
        "readAt": null
      }
    ],
    "counts": {
      "total": 5,
      "unread": 2,
      "notifications": 4,
      "alerts": 1,
      "unreadNotifications": 1,
      "unreadAlerts": 1
    },
    "pagination": { "limit": 20, "skip": 0, "total": 5 }
  }
}
```

**GET /vendor/notifications/counts Response `200`:**
```json
{
  "success": true,
  "data": {
    "total": 5,
    "unread": 2,
    "unreadNotifications": 1,
    "unreadAlerts": 1
  }
}
```

---

## Pharmacy Endpoints

### Register
```
POST /pharmacy/auth/register
```
**Request:**
```json
{
  "fullName": "Chidi Stanley",
  "email": "pharmacy@example.com",
  "password": "SecurePass123",
  "pharmacyName": "HealthNet Pharmacy",
  "registrationNumber": "PCN/2024/00123",
  "address": "45 Marina Road, Lagos Island",
  "phone": "+2348012345678",
  "primaryContactPerson": "Chidi Stanley",
  "preferredUsername": "healthnet_pharmacy"
}
```
**Response `201`:**
```json
{
  "message": "Pharmacy registration successful. Check your email for a verification link, then upload required documents.",
  "pharmacy": {
    "id": "uuid",
    "pharmacyName": "HealthNet Pharmacy",
    "registrationNumber": "PCN/2024/00123",
    "address": "45 Marina Road, Lagos Island",
    "phone": "+2348012345678",
    "primaryContactPerson": "Chidi Stanley",
    "email": "pharmacy@example.com",
    "username": "healthnet_pharmacy",
    "verificationStatus": "pending",
    "isActive": false,
    "documentsSubmitted": false,
    "createdAt": "2026-06-28T10:00:00Z"
  },
  "user": {
    "id": "uuid",
    "fullName": "Chidi Stanley",
    "email": "pharmacy@example.com",
    "role": "pharmacy"
  }
}
```

---

### Login
```
POST /pharmacy/auth/login
```
**Request:**
```json
{
  "email": "pharmacy@example.com",
  "password": "SecurePass123",
  "deviceFingerprint": "device-unique-string"
}
```
**Response `200`:**
```json
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "payload": { "sub": "uuid", "role": "pharmacy" },
  "pharmacy": {
    "id": "uuid",
    "pharmacyName": "HealthNet Pharmacy",
    "verificationStatus": "approved",
    "isActive": true,
    "documentsSubmitted": true,
    "documents": [],
    "branches": [],
    "accountState": {
      "stage": "approved",
      "isApproved": true,
      "canAccessShop": true,
      "canReceiveOrders": true,
      "vendorModeEnabled": true,
      "vendorId": "vendor-profile-uuid",
      "documentsSubmitted": true,
      "nextStep": null,
      "pendingActions": []
    }
  }
}
```

**accountState stages:**

| stage | isApproved | What to show |
|---|---|---|
| `pending` | false | Prompt to upload documents |
| `documents_required` | false | Prompt to upload documents |
| `under_review` | false | "Awaiting admin review" |
| `approved` | true | Full dashboard |
| `rejected` | false | Re-upload documents |
| `suspended` | false | Contact support |

---

### Forgot Password
```
POST /pharmacy/auth/forgot-password
```
**Request:**
```json
{ "email": "pharmacy@example.com" }
```
**Response `200`:**
```json
{ "success": true, "message": "If that email is registered, a reset link has been sent." }
```
Email link goes to: `PHARMACY_APP_URL/auth/reset-password?token=xxx`

---

### Reset Password
```
POST /pharmacy/auth/reset-password
```
**Request:**
```json
{ "token": "token-from-email", "newPassword": "NewPass123" }
```
**Response `200`:**
```json
{ "success": true, "message": "Password reset successful. You can now log in." }
```

---

### Get Profile `🔒`
```
GET /pharmacy/auth/profile
```
Returns full profile with `accountState` — same structure as login response.

---

### Upload Logo `🔒`
```
POST /pharmacy/auth/logo
Content-Type: multipart/form-data
```
**Form field:** `file` (image)

**Response `200`:**
```json
{
  "success": true,
  "message": "Logo uploaded successfully",
  "data": { "logoUrl": "https://dev-api.cosmicforge-healthnet.com/api/documents/images/uuid" }
}
```

---

### Upload Documents `🔒`
```
POST /pharmacy/documents/upload
Content-Type: multipart/form-data
```
**Form fields:** `file`, `documentType` (`pharmacy_license`, `government_id`, `business_registration`)

**Response `200`:**
```json
{
  "success": true,
  "message": "Document uploaded successfully"
}
```

---

### List Approved Pharmacies (Patient-facing)
```
GET /pharmacy/list
```
**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "pharmacyName": "HealthNet Pharmacy",
      "address": "45 Marina Road, Lagos Island",
      "phone": "+2348012345678",
      "email": "pharmacy@example.com",
      "verificationStatus": "approved",
      "isActive": true,
      "logoUrl": "https://...",
      "createdAt": "2026-06-28T10:00:00Z"
    }
  ]
}
```

---

### Get Single Pharmacy (Patient-facing)
```
GET /pharmacy/:id
```
**Response `200`:**
```json
{
  "success": true,
  "pharmacy": {
    "id": "uuid",
    "pharmacyName": "HealthNet Pharmacy",
    "registrationNumber": "PCN/2024/00123",
    "address": "45 Marina Road, Lagos Island",
    "phone": "+2348012345678",
    "email": "pharmacy@example.com",
    "website": null,
    "logoUrl": "https://...",
    "description": null,
    "operatingHours": null,
    "verificationStatus": "approved",
    "isActive": true,
    "vendorId": "vendor-profile-uuid"
  }
}
```
> `vendorId` is what you pass to all cart endpoints.

---

## Patient Cart Endpoints

All require: `🔒` patient Bearer token.

---

### Add Item to Cart
```
POST /cart/vendor/:vendorId/items
```
Use `vendorId` from `GET /pharmacy/:id` → `pharmacy.vendorId`

**Request:**
```json
{
  "productId": "product-uuid",
  "quantity": 2
}
```
**Response `200`:**
```json
{
  "success": true,
  "message": "Item added to cart",
  "cart": {
    "id": "cart-uuid",
    "status": "draft",
    "prescriptionId": null,
    "patientNote": null,
    "confirmedTotal": null,
    "paidAt": null,
    "vendor": {
      "id": "vendor-uuid",
      "businessName": "HealthNet Pharmacy",
      "logoUrl": "https://..."
    },
    "items": [
      {
        "id": "item-uuid",
        "productId": "product-uuid",
        "productTitle": "Vitamin C 1000mg Tablets x 30",
        "quantity": 2,
        "priceSnapshot": "3500.00",
        "lineTotal": "7000.00",
        "product": {
          "id": "product-uuid",
          "title": "Vitamin C 1000mg Tablets x 30",
          "media": []
        }
      }
    ],
    "itemCount": 1,
    "estimatedTotal": "7000.00",
    "createdAt": "2026-06-28T10:00:00Z"
  }
}
```

---

### Update Item Quantity
```
PUT /cart/:cartId/items/:itemId
```
**Request:**
```json
{ "quantity": 3 }
```
**Response `200`:**
```json
{ "success": true, "message": "Item updated", "cart": { "...full cart object..." } }
```

---

### Remove Item
```
DELETE /cart/:cartId/items/:itemId
```
**Response `200`:**
```json
{ "success": true, "message": "Item removed", "cart": { "...full cart object..." } }
```

---

### List My Carts
```
GET /cart/my
GET /cart/?status=confirmed
```
**Query params:** `status` (draft, confirmed, paid, cancelled), `page`, `limit`

**Response `200`:**
```json
{
  "success": true,
  "carts": [
    {
      "id": "cart-uuid",
      "status": "paid",
      "confirmedTotal": "7000.00",
      "paidAt": "2026-06-28T11:00:00Z",
      "vendor": { "id": "uuid", "businessName": "HealthNet Pharmacy" },
      "items": [],
      "itemCount": 1,
      "estimatedTotal": "7000.00"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20
}
```

---

### Get Single Cart
```
GET /cart/:cartId
```
**Response `200`:**
```json
{
  "success": true,
  "cart": {
    "id": "cart-uuid",
    "status": "confirmed",
    "prescriptionId": "prescription-uuid-or-null",
    "patientNote": "Please deliver by evening",
    "vendorNote": null,
    "confirmedTotal": "7000.00",
    "submittedAt": "2026-06-28T10:30:00Z",
    "confirmedAt": "2026-06-28T10:30:00Z",
    "paidAt": null,
    "cancelledAt": null,
    "cancelledBy": null,
    "vendor": { "id": "uuid", "businessName": "HealthNet Pharmacy", "logoUrl": "https://..." },
    "items": [
      {
        "id": "item-uuid",
        "productId": "product-uuid",
        "productTitle": "Vitamin C 1000mg Tablets x 30",
        "quantity": 2,
        "priceSnapshot": "3500.00",
        "lineTotal": "7000.00",
        "product": { "id": "uuid", "title": "Vitamin C 1000mg Tablets x 30", "media": [] }
      }
    ],
    "itemCount": 1,
    "estimatedTotal": "7000.00",
    "createdAt": "2026-06-28T10:00:00Z"
  }
}
```

---

### Submit Cart
```
POST /cart/:cartId/submit
```
Cart must be in `draft` status. Prices are auto-confirmed at product listed prices.

**Request:**
```json
{
  "patientNote": "Please pack carefully",
  "prescriptionId": "prescription-uuid"
}
```
Both fields are optional. Pass `prescriptionId` only if the patient is buying against a prescription — it will be auto-marked as `completed` once payment succeeds.

**Response `200`:**
```json
{
  "success": true,
  "message": "Cart submitted to vendor. They will review and confirm pricing.",
  "cart": {
    "id": "cart-uuid",
    "status": "confirmed",
    "prescriptionId": "prescription-uuid",
    "confirmedTotal": "7000.00",
    "submittedAt": "2026-06-28T10:30:00Z",
    "confirmedAt": "2026-06-28T10:30:00Z"
  }
}
```

---

### Pay for Cart
```
POST /cart/:cartId/pay
```
Cart must be in `confirmed` status.

**Request:**
```json
{
  "provider": "paystack",
  "email": "patient@example.com",
  "name": "Jane Patient",
  "phone": "+2348012345678",
  "currency": "NGN",
  "callbackUrl": "https://yourapp.com/payment/success"
}
```
**provider:** `paystack` or `flutterwave`

**Response `200`:**
```json
{
  "success": true,
  "message": "Payment initiated. Redirect the patient to redirectUrl to complete payment.",
  "data": {
    "transactionId": "transaction-uuid",
    "redirectUrl": "https://checkout.paystack.com/xxxxxxxx",
    "amount": 7000.00,
    "currency": "NGN",
    "paymentProvider": "paystack",
    "providerReference": "PST-uuid-1234567890"
  }
}
```

> **After getting `redirectUrl`:** Redirect the patient there. They complete payment on Paystack/Flutterwave. The webhook fires automatically — no further API call needed. When they return to your `callbackUrl`, fetch the cart again to confirm `status: "paid"`.

---

### Cancel Cart
```
POST /cart/:cartId/cancel
```
Only works on `draft` status carts.

**Response `200`:**
```json
{ "success": true, "message": "Cart cancelled", "cart": { "...cart object with status: cancelled..." } }
```

---

### Browse Products (Public — Patient-facing)
```
GET /vendor/products/public
```
**Query params:**
| Param | Example | Description |
|---|---|---|
| `vendorId` | `uuid` | Filter by specific pharmacy/vendor |
| `category` | `medications` | Filter by category |
| `subcategory` | `antibiotics` | Filter by subcategory |
| `search` | `paracetamol` | Search by title/description |
| `minPrice` | `500` | Minimum price |
| `maxPrice` | `5000` | Maximum price |
| `sortBy` | `price_asc` | `price_asc`, `price_desc`, `newest` |
| `page` | `1` | Page number |
| `limit` | `20` | Items per page |

**Response `200`:**
```json
{
  "success": true,
  "products": [
    {
      "id": "uuid",
      "title": "Paracetamol 500mg Tablets x 20",
      "description": "Pain and fever relief",
      "price": "650.00",
      "stockQuantity": 200,
      "category": "medications",
      "subcategory": "pain_relief",
      "prescriptionRequired": false,
      "status": "approved",
      "isActive": true,
      "media": [
        { "id": "uuid", "mediaUrl": "https://...", "mediaType": "image", "isPrimary": true }
      ],
      "vendor": {
        "id": "vendor-uuid",
        "businessName": "HealthNet Pharmacy",
        "logoUrl": "https://..."
      },
      "createdAt": "2026-06-28T10:00:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20
}
```

---

## WebSocket Notifications

**Connection:**
```js
import { io } from "socket.io-client";

const socket = io("wss://dev-api.cosmicforge-healthnet.com", {
  auth: { token: "<accessToken>" }
});
```

**On connect — rooms auto-joined:**
- Every user → `user_{userId}`
- Vendor/Pharmacy → `vendor_{vendorProfileId}`
- Pharmacy → `pharmacy_{pharmacyProfileId}`

**Events to listen for:**
```js
socket.on("connection-confirmed", ({ userId, room }) => {
  console.log("Connected:", room);
});

socket.on("notification", (notif) => {
  // { id, type, message, metadata, isRead, createdAt }
  showToast(notif.message);
  updateBadgeCount();
});

socket.on("notification_read", ({ id, readAt }) => {
  markNotifAsRead(id);
});

socket.on("all_notifications_read", () => {
  clearAllBadges();
});

socket.on("notification_deleted", ({ id }) => {
  removeNotifFromList(id);
});
```

**Events to emit:**
```js
// Get counts
socket.emit("get_notification_counts");
socket.on("notification_counts", (counts) => { /* update badge */ });

// Mark as read via socket
socket.emit("mark_notification_read", { notificationId: "uuid" });

// Keep-alive
socket.emit("ping");
socket.on("pong", () => {});
```

---

## Test Credentials

| Role | Email | Password |
|---|---|---|
| Patient | `testpatient@cosmicforge.com` | `Test@1234` |
| Doctor | `testdoctor@cosmicforge.com` | `Test@1234` |
| Pharmacy | `chiderastanley3272@gmail.com` | Chidex's password |
| Vendor | `testvendor@cosmicforge.com` | `Test@1234` |

---

## Environment Variables Required (DevOps)

```env
# Frontend URLs — used in password reset and verification emails
APP_BASE_URL=https://app.cosmicforge-healthnet.com         # Patient / Doctor frontend
PHARMACY_APP_URL=https://pharmacy.cosmicforge-healthnet.com # Pharmacy frontend
VENDOR_APP_URL=https://vendor.cosmicforge-healthnet.com     # Vendor frontend

# Payment providers
PAYSTACK_SECRET_KEY=sk_live_xxx
FLUTTERWAVE_SECRET_KEY=FLWxxx
PAYSTACK_SECRET_HASH=xxx
FLUTTERWAVE_SECRET_HASH=xxx
```
