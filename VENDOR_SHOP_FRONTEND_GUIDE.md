# CosmicForge — Vendor, Shop, Cart & Pharmacy Frontend Integration Guide

> **Base URL (Dev):** `http://dev-api.cosmicforge-healthnet.com`  
> All API endpoints are prefixed with `/api`  
> Protected routes require: `Authorization: Bearer <accessToken>`

---

## Swagger Docs (Interactive Explorer)

| Feature | URL |
|---|---|
| Vendor (auth, products, cart, promotions, analytics) | http://dev-api.cosmicforge-healthnet.com/vendor-docs |
| Vendor Orders & Wallet | http://dev-api.cosmicforge-healthnet.com/vendor-orders-docs |
| Shop (public browsing) | http://dev-api.cosmicforge-healthnet.com/shop-docs |
| Cart (patient) | http://dev-api.cosmicforge-healthnet.com/cart-docs |
| Promotions | http://dev-api.cosmicforge-healthnet.com/promotions-docs |
| Vendor Analytics | http://dev-api.cosmicforge-healthnet.com/vendor-analytics-docs |
| Hybrid Pharmacy | http://dev-api.cosmicforge-healthnet.com/hybrid-pharmacy-docs |
| Prescription-Assisted Sessions | http://dev-api.cosmicforge-healthnet.com/pharmacy-session-docs |
| Platform Fee & Commission Config (Admin) | http://dev-api.cosmicforge-healthnet.com/platform-config-docs |

---

## Platform Fee Model

> **Important — read before building any payment UI.**

| Payment Type | Customer Pays | Provider Receives | Platform Gets |
|---|---|---|---|
| Vendor order | subtotal + 7% | subtotal − commission | 7% + commission |
| Appointment | doctor fee + 7% | doctor fee − subscription commission | 7% + commission |
| Prescription cart | cart total + 7% | cart total (100%) | 7% |

- **Platform fee (7%)** is added **ON TOP** of the base amount — the customer pays it, the provider's amount is not deducted.
- **Vendor commission** rate is TBD — currently 0%. The structure is in place.
- **Pharmacies have no commission** but are subject to the 7% platform fee — the patient pays it on top, the pharmacy receives 100% of the cart total.
- **Doctor commission** is 10–30% based on their subscription tier — separate system.
- **Pharmacy invoice flow is removed** — all pharmacy payments now go through prescription cart sessions (`/api/pharmacy/sessions`).

---

## 1. Vendor Auth & Profile

### `POST /api/vendor/register` — No Auth

**Request Body:**
```json
{
  "fullName": "John Doe",
  "email": "john@example.com",
  "password": "securepass123",
  "phoneNumber": "+2348012345678",
  "businessName": "HealthZone Store",
  "businessCategory": "health_wellness",
  "businessEmail": "store@healthzone.com",
  "businessPhone": "+2348098765432",
  "country": "Nigeria",
  "state": "Lagos",
  "city": "Ikeja",
  "fullAddress": "12 Allen Avenue, Ikeja, Lagos",
  "businessWebsite": "https://healthzone.com",
  "businessDescription": "We sell quality health and wellness products."
}
```
> `businessWebsite` is optional. All other fields are required.

**Response `201`:**
```json
{
  "success": true,
  "message": "Vendor registration successful. Check your email for a verification link.",
  "vendor": {
    "id": "uuid",
    "businessName": "HealthZone Store",
    "businessCategory": "health_wellness",
    "businessEmail": "store@healthzone.com",
    "businessPhone": "+2348098765432",
    "country": "Nigeria",
    "state": "Lagos",
    "city": "Ikeja",
    "fullAddress": "12 Allen Avenue, Ikeja, Lagos",
    "verificationStatus": "pending",
    "isActive": false,
    "documentsSubmitted": false,
    "createdAt": "2026-06-07T10:00:00.000Z"
  },
  "user": {
    "id": "uuid",
    "fullName": "John Doe",
    "email": "john@example.com",
    "role": "vendor",
    "status": "pending_vendor_verification",
    "tier": "free",
    "createdAt": "2026-06-07T10:00:00.000Z"
  }
}
```

---

### `POST /api/vendor/login` — No Auth

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "securepass123",
  "deviceFingerprint": "optional-device-id"
}
```

**Response `200`:**
```json
{
  "success": true,
  "message": "Login successful",
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "vendor": {
    "id": "uuid",
    "businessName": "HealthZone Store",
    "businessCategory": "health_wellness",
    "verificationStatus": "approved",
    "isActive": true,
    "logoUrl": "https://..."
  },
  "user": {
    "id": "uuid",
    "fullName": "John Doe",
    "email": "john@example.com",
    "role": "vendor",
    "status": "vendor_active",
    "tier": "free",
    "profileImageUrl": null
  }
}
```
> If MFA is enabled, response is `206` with `{ mfaRequired: true, tempToken: "..." }`.

---

### `POST /api/vendor/forgot-password` — No Auth

**Request Body:** `{ "email": "john@example.com" }`

**Response `200`:** `{ "success": true, "message": "If that email exists, a reset link has been sent." }`

---

### `POST /api/vendor/reset-password` — No Auth

**Request Body:** `{ "token": "reset-token-from-email", "newPassword": "newpass123" }`

**Response `200`:** `{ "success": true, "message": "Password reset successful" }`

---

### `GET /api/vendor/verify-email?token=...` — No Auth

Called when vendor clicks the link in their registration email.

**Response `200`:**
```json
{ "success": true, "message": "Email verified successfully. Your vendor application is under review." }
```
> Email verification does **not** activate the account — the vendor stays in `pending_vendor_verification` until an admin approves them.

**Error responses:**
- `400` — Invalid or expired token
- Use `POST /api/vendor/resend-verification` to get a fresh link

---

### `POST /api/vendor/resend-verification` — No Auth

**Request Body:** `{ "email": "john@example.com" }`

**Response `200`:** `{ "success": true, "message": "If unverified, a new verification link has been sent." }`

> Rate limited — max 3 emails per hour. Returns `429` if exceeded.

---

### `POST /api/vendor/refresh` — No Auth

Exchange a refresh token for a new access token + new refresh token (rotating).

**Request Body:**
```json
{
  "refreshToken": "the-refresh-token-from-login",
  "deviceFingerprint": "same-fingerprint-used-at-login"
}
```

**Response `200`:**
```json
{
  "success": true,
  "accessToken": "eyJ...",
  "refreshToken": "new-refresh-token",
  "payload": { "sub": "uuid", "email": "...", "role": "vendor" }
}
```
> On `401` — session expired, redirect vendor to login. Always store the **new** `refreshToken` from this response, the old one is revoked.

---

### `GET /api/vendor/profile` — Auth Required

**Response `200`:**
```json
{
  "success": true,
  "vendor": {
    "id": "uuid",
    "businessName": "HealthZone Store",
    "businessCategory": "health_wellness",
    "businessEmail": "store@healthzone.com",
    "businessPhone": "+2348098765432",
    "country": "Nigeria",
    "state": "Lagos",
    "city": "Ikeja",
    "fullAddress": "12 Allen Avenue, Ikeja, Lagos",
    "businessWebsite": "https://healthzone.com",
    "businessDescription": "We sell quality health and wellness products.",
    "logoUrl": "https://...",
    "verificationStatus": "approved",
    "isActive": true,
    "documentsSubmitted": true,
    "isHybridPharmacy": false,
    "notificationPreferences": {},
    "documents": [],
    "createdAt": "2026-06-07T10:00:00.000Z",
    "updatedAt": "2026-06-07T10:00:00.000Z"
  },
  "user": {
    "id": "uuid",
    "fullName": "John Doe",
    "email": "john@example.com",
    "role": "vendor",
    "status": "vendor_active",
    "tier": "free",
    "profileImageUrl": null,
    "phoneNumber": "+2348012345678"
  }
}
```

---

### `PUT /api/vendor/profile` — Auth Required

**Request Body** (send only fields to update):
```json
{
  "businessName": "Updated Store Name",
  "businessDescription": "Updated description",
  "businessWebsite": "https://newsite.com",
  "businessPhone": "+2348011112222",
  "state": "Abuja",
  "city": "Garki",
  "fullAddress": "5 New Street, Garki, Abuja"
}
```
**Response `200`:** `{ "success": true, "message": "Profile updated", "vendor": { ...updatedVendorObject } }`

---

### `PUT /api/vendor/account` — Auth Required

**Request Body:** `{ "fullName": "New Full Name", "email": "newemail@example.com" }`

**Response `200`:** `{ "success": true, "message": "Account settings updated" }`

---

### `POST /api/vendor/change-password` — Auth Required

**Request Body:** `{ "currentPassword": "oldpass", "newPassword": "newpass123" }`

**Response `200`:** `{ "success": true, "message": "Password changed successfully" }`

---

### `POST /api/vendor/profile/logo` — Auth Required | `multipart/form-data`

**Response `200`:** `{ "success": true, "message": "Logo uploaded", "logoUrl": "https://..." }`

---

### `POST /api/vendor/documents` — Auth Required | `multipart/form-data`

Upload a verification document. Required before admin can approve a pending vendor account.

**Form Fields:**

| Field | Type | Required | Values |
|---|---|---|---|
| `file` | File | Yes | Image or PDF |
| `documentType` | Text | Yes | `government_id` or `business_registration` |

**Response `200`:**
```json
{
  "success": true,
  "message": "Document uploaded. Your account is now pending verification review.",
  "document": {
    "id": "uuid",
    "documentType": "government_id",
    "documentUrl": "https://...",
    "fileName": "national-id.jpg",
    "createdAt": "2026-06-10T10:00:00.000Z"
  }
}
```
> After uploading at least one document, the vendor profile `documentsSubmitted` becomes `true` and `verificationStatus` is set to `documents_required`. Admin reviews and approves.

---

## 2. Vendor Products

### Product Status Values

| Status | Meaning |
|---|---|
| `pending` | Submitted — waiting for admin approval |
| `approved` | Live on the public shop |
| `failed` | Rejected by admin — check `rejectionReason` field |

### `POST /api/vendor/products/media/upload` — Auth Required | `multipart/form-data`

Upload media **before** creating a product. Returns URLs you can pass to the create product endpoint.

**Form Fields:** One or more files (image or video).

**Response `200`:**
```json
{
  "success": true,
  "message": "Media uploaded. Pass the urls in mediaUrls when creating your product.",
  "media": [
    { "url": "https://...", "mimeType": "image/jpeg", "type": "image" },
    { "url": "https://...", "mimeType": "image/png",  "type": "image" }
  ]
}
```
> Collect the `url` values and pass them as `mediaUrls` in your `POST /api/vendor/products` body.

---

### `POST /api/vendor/products` — Auth Required

**Request Body:**
```json
{
  "title": "Vitamin C 1000mg Tablets",
  "description": "High strength vitamin C supplement, 60 tablets per pack.",
  "price": 5000,
  "stockQuantity": 100,
  "category": "nutrition_healthy_living",
  "subcategory": "vitamins_supplements",
  "prescriptionRequired": false,
  "mediaUrls": ["https://...", "https://..."]
}
```
> `stockQuantity` defaults to 0. `price` is in NGN. `prescriptionRequired` defaults to `false`. `mediaUrls` is optional — pass URLs returned from `POST /api/vendor/products/media/upload`.

**Response `201`:**
```json
{
  "success": true,
  "message": "Product submitted for admin approval",
  "product": {
    "id": "uuid",
    "title": "Vitamin C 1000mg Tablets",
    "description": "High strength vitamin C supplement, 60 tablets per pack.",
    "price": "5000.00",
    "stockQuantity": 100,
    "category": "nutrition_healthy_living",
    "subcategory": "vitamins_supplements",
    "prescriptionRequired": false,
    "status": "pending",
    "rejectionReason": null,
    "isActive": true,
    "media": [],
    "vendor": { "id": "uuid", "businessName": "HealthZone Store", "logoUrl": "https://..." },
    "createdAt": "2026-06-07T10:00:00.000Z",
    "updatedAt": "2026-06-07T10:00:00.000Z"
  }
}
```

---

### `GET /api/vendor/products` — Auth Required

**Query Params:** `status` (pending | approved | failed), `page` (default 1), `limit` (default 20)

**Response `200`:**
```json
{
  "success": true,
  "products": [ { ...productObject } ],
  "total": 15,
  "page": 1,
  "limit": 20
}
```

---

### `GET /api/vendor/products/:id` — Auth Required

**Response `200`:** `{ "success": true, "product": { ...productObject } }`

---

### `PUT /api/vendor/products/:id` — Auth Required

**Request Body** (send only fields to update):
```json
{
  "title": "Updated Title",
  "price": 6000,
  "stockQuantity": 80,
  "description": "Updated description",
  "prescriptionRequired": true
}
```
> Any update resets the product status back to `pending` for re-approval.

**Response `200`:** `{ "success": true, "message": "Product updated and resubmitted for approval", "product": { ...productObject } }`

---

### `DELETE /api/vendor/products/:id` — Auth Required

**Response `200`:** `{ "success": true, "message": "Product deleted" }`

---

### `POST /api/vendor/products/:id/media` — Auth Required | `multipart/form-data`

**Response `200`:**
```json
{
  "success": true,
  "message": "Media uploaded",
  "media": [{ "id": "uuid", "url": "https://...", "fileType": "image/jpeg" }]
}
```

---

### Product Categories Reference

| Key | Label | Subcategories |
|---|---|---|
| `health_wellness` | Health and Wellness | `skincare_beauty`, `hair_body_care`, `personal_hygiene`, `sexual_wellness`, `men_women_care` |
| `medical_supplies` | Medical Supplies | `first_aid_kits`, `diagnostic_tools`, `mobility_aids`, `surgical_disposable_supplies` |
| `baby_mother_care` | Baby and Mother Care | `baby_food`, `diapers_wipes`, `baby_clothing_care`, `nursing_maternity_products` |
| `fitness_lifestyle` | Fitness and Lifestyle | `home_workout_equipment`, `sports_accessories`, `smart_watches_trackers`, `weight_management_nutrition` |
| `nutrition_healthy_living` | Nutrition and Healthy Living | `vitamins_supplements`, `herbal_natural_remedies`, `energy_performance_products`, `healthy_snacks_drinks` |
| `others` | Others | `health_gadgets_devices`, `home_care_cleaning_essentials`, `protective_safety_items`, `aromatherapy_essential_oils` |
| `medications` | Medications *(Hybrid Pharmacy Only)* | `prescription_drugs`, `over_the_counter`, `vitamins_otc`, `topical_medications` |

---

## 3. Vendor — Incoming Cart Orders (`/api/vendor/carts`)

These are orders submitted by patients that the vendor needs to manage.

### `GET /api/vendor/carts` — Auth Required

**Query Params:** `status` (draft | submitted | confirmed | cancelled), `page`, `limit`

**Response `200`:**
```json
{
  "success": true,
  "carts": [
    {
      "id": "uuid",
      "status": "submitted",
      "patientNote": "Please pack carefully",
      "vendorNote": null,
      "confirmedTotal": null,
      "submittedAt": "2026-06-07T10:00:00.000Z",
      "confirmedAt": null,
      "cancelledAt": null,
      "cancelledBy": null,
      "patient": {
        "id": "uuid",
        "fullName": "Jane Smith",
        "phoneNumber": "+2348011112222",
        "email": "jane@example.com"
      },
      "items": [
        {
          "id": "uuid",
          "productId": "uuid",
          "productTitle": "Vitamin C 1000mg",
          "quantity": 2,
          "priceSnapshot": "5000.00",
          "lineTotal": "10000.00"
        }
      ],
      "itemCount": 1,
      "estimatedTotal": "10000.00",
      "createdAt": "2026-06-07T10:00:00.000Z",
      "updatedAt": "2026-06-07T10:00:00.000Z"
    }
  ],
  "total": 5,
  "page": 1,
  "limit": 20
}
```

---

### `GET /api/vendor/carts/:cartId` — Auth Required

**Response `200`:** `{ "success": true, "cart": { ...vendorCartObject } }`

---

### `POST /api/vendor/carts/:cartId/confirm-pricing` — Auth Required

**Request Body:**
```json
{
  "confirmedTotal": 10500,
  "vendorNote": "Added ₦500 for delivery within Ikeja"
}
```
> `vendorNote` is optional. Once confirmed, patient is notified and can proceed to checkout.

**Response `200`:**
```json
{
  "success": true,
  "message": "Cart pricing confirmed. The customer has been notified.",
  "cart": { ...vendorCartObject }
}
```

---

### `POST /api/vendor/carts/:cartId/cancel` — Auth Required

**Response `200`:** `{ "success": true, "message": "Cart cancelled. The customer has been notified.", "cart": { ...vendorCartObject } }`

---

## 4. Vendor Orders — Checkout & Payment (`/api/vendor/orders`)

After the vendor confirms cart pricing, the **patient initiates checkout** to create an order and pay.

### Full Order Flow
```
Cart confirmed by vendor
       ↓
Patient calls POST /vendor/orders/checkout/:cartId  →  Order created (status: pending, paymentStatus: unpaid)
       ↓
Patient calls POST /vendor/orders/:orderId/pay  →  Gets Paystack payment URL
       ↓
Patient redirected to Paystack → pays grossAmount (subtotal + 7% platform fee)
       ↓
Webhook confirms payment → Order status: processing, Vendor wallet credited
       ↓
Vendor dispatches → POST /vendor/shipments/vendor/:orderId/dispatch
       ↓
Vendor marks delivered → POST /vendor/shipments/vendor/:orderId/delivered → Order: completed
```

---

### `POST /api/vendor/orders/checkout/:cartId` — Auth Required (Patient)

Creates an order from a confirmed cart.

**Response `201`:**
```json
{
  "success": true,
  "message": "Checkout initiated. Proceed to payment.",
  "orderId": "uuid",
  "orderNumber": "ORD-1717804800000-AB3CD",
  "status": "pending",
  "paymentStatus": "unpaid",
  "subtotal": 10000,
  "platformFeeAmount": 700,
  "grossAmount": 10700,
  "commissionRate": 0,
  "commissionAmount": 0,
  "vendorAmount": 10000,
  "currency": "NGN"
}
```
> **`grossAmount` is what the patient pays** = subtotal + 7% platform fee. Show this as the total in the UI.

---

### `POST /api/vendor/orders/:orderId/pay` — Auth Required (Patient)

**Response `200`:**
```json
{
  "success": true,
  "message": "Proceed to the payment URL to complete your order.",
  "paymentUrl": "https://checkout.paystack.com/...",
  "reference": "COSMIC-ORD-...",
  "amount": 10700,
  "orderId": "uuid"
}
```
> Redirect patient to `paymentUrl`. Payment confirmation is automatic via Paystack webhook.

---

### `GET /api/vendor/orders/my` — Auth Required (Patient)

**Query Params:** `status` (pending | processing | completed | cancelled), `page`, `limit`

**Response `200`:**
```json
{
  "success": true,
  "orders": [
    {
      "id": "uuid",
      "orderNumber": "ORD-1717804800000-AB3CD",
      "cartId": "uuid",
      "status": "processing",
      "paymentStatus": "paid",
      "subtotal": "10000.0000",
      "platformFeeAmount": "700.0000",
      "grossAmount": "10700.0000",
      "commissionRate": "0.0000",
      "commissionAmount": "0.0000",
      "vendorAmount": "10000.0000",
      "currency": "NGN",
      "paymentAuthUrl": null,
      "patientNote": "Please pack carefully",
      "vendorNote": null,
      "cancelledBy": null,
      "cancelledAt": null,
      "completedAt": null,
      "paidAt": "2026-06-07T10:30:00.000Z",
      "vendor": { "id": "uuid", "businessName": "HealthZone Store", "logoUrl": "https://..." },
      "createdAt": "2026-06-07T10:00:00.000Z",
      "updatedAt": "2026-06-07T10:30:00.000Z"
    }
  ],
  "total": 3,
  "page": 1,
  "limit": 20
}
```

---

### `GET /api/vendor/orders/my/:orderId` — Auth Required (Patient)

**Response `200`:** `{ "success": true, "order": { ...orderObject } }`

---

### `POST /api/vendor/orders/my/:orderId/cancel` — Auth Required (Patient)

Only pending, **unpaid** orders can be cancelled.

**Response `200`:** `{ "success": true, "message": "Order cancelled", "order": { ...orderObject } }`

---

### `GET /api/vendor/orders/vendor` — Auth Required (Vendor)

**Query Params:** `status`, `paymentStatus`, `page`, `limit`

**Response `200`:** `{ "success": true, "orders": [ ...orderObjects ], "total": 10, "page": 1, "limit": 20 }`

---

### `GET /api/vendor/orders/vendor/:orderId` — Auth Required (Vendor)

**Response `200`:** `{ "success": true, "order": { ...orderObject } }`

---

### `POST /api/vendor/orders/vendor/:orderId/complete` — Auth Required (Vendor)

Marks the order as completed (use after delivery confirmation).

**Response `200`:** `{ "success": true, "message": "Order marked as completed", "order": { ...orderObject } }`

---

### `POST /api/vendor/orders/vendor/:orderId/cancel` — Auth Required (Vendor)

Only pending, **unpaid** orders can be cancelled.

**Response `200`:** `{ "success": true, "message": "Order cancelled", "order": { ...orderObject } }`

---

## 5. Vendor Wallet (`/api/vendor/wallet`)

Vendor earnings are automatically credited to the wallet when an order is paid.

### `GET /api/vendor/wallet/summary` — Auth Required (Vendor)

**Response `200`:**
```json
{
  "success": true,
  "wallet": {
    "availableBalanceNgn": 45000,
    "pendingClearanceNgn": 0,
    "totalEarningsNgn": 98000,
    "isActive": true,
    "isFrozen": false,
    "frozenReason": null,
    "lastPayoutAt": null
  }
}
```

---

### `GET /api/vendor/wallet/transactions` — Auth Required (Vendor)

**Query Params:** `category` (order_payment | payout | refund | adjustment), `page`, `limit`

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
      "amountNgn": 10000,
      "balanceAfterNgn": 45000,
      "orderId": "uuid",
      "reference": "COSMIC-ORD-...",
      "description": "Order payment — ORD-1717804800000-AB3CD (platform fee deducted)",
      "createdAt": "2026-06-07T10:30:00.000Z"
    }
  ],
  "total": 5,
  "page": 1,
  "limit": 20
}
```

---

## 6. Shipments — Delivery & Tracking (`/api/vendor/shipments`)

### `GET /api/vendor/shipments/providers` — No Auth

Use this to populate the logistics provider dropdown when vendor dispatches an order.

**Response `200`:**
```json
{
  "success": true,
  "providers": [
    { "key": "gig_logistics",   "label": "GIG Logistics" },
    { "key": "dhl",             "label": "DHL Express" },
    { "key": "jumia_logistics", "label": "Jumia Logistics" },
    { "key": "custom",          "label": "Own Delivery / Custom Courier" }
  ]
}
```

---

### `POST /api/vendor/shipments/vendor/:orderId/dispatch` — Auth Required (Vendor)

Creates the shipment and notifies the patient. Order must be `processing` and `paid`.

**Request Body:**
```json
{
  "deliveryMethod": "delivery",
  "deliveryAddress": "12 Allen Avenue, Ikeja, Lagos",
  "trackingNumber": "GIG-1234567",
  "logisticsProvider": "gig_logistics",
  "estimatedDeliveryAt": "2026-06-09T12:00:00.000Z",
  "vendorNotes": "Fragile — handle with care"
}
```

| Field | Required | Notes |
|---|---|---|
| `deliveryMethod` | Yes | `pickup` or `delivery` |
| `deliveryAddress` | If `delivery` | Required for delivery method |
| `trackingNumber` | No | Optional |
| `logisticsProvider` | No | Use key from `/providers` endpoint |
| `estimatedDeliveryAt` | No | ISO date string |
| `vendorNotes` | No | Notes for the patient |

**Response `201`:**
```json
{
  "success": true,
  "message": "Order dispatched. Customer has been notified.",
  "shipment": {
    "id": "uuid",
    "orderId": "uuid",
    "status": "dispatched",
    "deliveryMethod": "delivery",
    "deliveryAddress": "12 Allen Avenue, Ikeja, Lagos",
    "trackingNumber": "GIG-1234567",
    "logisticsProvider": "gig_logistics",
    "estimatedDeliveryAt": "2026-06-09T12:00:00.000Z",
    "dispatchedAt": "2026-06-07T11:00:00.000Z",
    "deliveredAt": null,
    "vendorNotes": "Fragile — handle with care",
    "createdAt": "2026-06-07T11:00:00.000Z",
    "updatedAt": "2026-06-07T11:00:00.000Z"
  }
}
```

---

### `POST /api/vendor/shipments/vendor/:orderId/delivered` — Auth Required (Vendor)

Marks the shipment as delivered and the order as completed. Patient is notified.

**Response `200`:** `{ "success": true, "message": "Order marked as delivered.", "shipment": { ...shipmentObject } }`

---

### `GET /api/vendor/shipments/vendor/:orderId` — Auth Required (Vendor)

**Response `200`:** `{ "success": true, "shipment": { ...shipmentObject } }`

---

### `GET /api/vendor/shipments/my/:orderId` — Auth Required (Patient)

Patient tracks the shipment for their order.

**Response `200`:**
```json
{
  "success": true,
  "shipment": {
    "id": "uuid",
    "orderId": "uuid",
    "status": "dispatched",
    "deliveryMethod": "delivery",
    "trackingNumber": "GIG-1234567",
    "logisticsProvider": "gig_logistics",
    "estimatedDeliveryAt": "2026-06-09T12:00:00.000Z",
    "dispatchedAt": "2026-06-07T11:00:00.000Z",
    "deliveredAt": null,
    "vendorNotes": "Fragile — handle with care"
  }
}
```

---

## 7. Promotions

### What Are Promotions?

Promotions are paid advertising tools vendors use to get more visibility and sales. There are **3 types:**

#### Type 1: `boost_account` — Boost Your Profile
Makes the vendor's shop/profile more visible across the platform.

| SubType | What it does |
|---|---|
| `profile_visibility_boost` | Vendor profile appears higher in search and discovery |
| `more_profile_visits` | Platform pushes vendor profile to more users |

#### Type 2: `get_sales` — Boost Specific Products
Promotes up to **5 approved products** for more orders.

| SubType | What it does |
|---|---|
| `more_product_visibility` | Products appear higher in shop browsing |
| `discounted_sales` | Products highlighted as on promotion |
| `more_orders` | Platform actively pushes products to buyers |

#### Type 3: `campaign` — Promote a New/Upcoming Product
For products that don't yet exist in the system — provide product details directly via `campaignProduct`.

#### Promotion Status Lifecycle
```
pending (created, unpaid)
    ↓ vendor pays
active (running)
    ↓ expires automatically
completed

OR → cancelled (vendor cancels)
```

#### Pricing (NGN)
| Duration | Price |
|---|---|
| 1 Day | ₦5,000 |
| 1 Week | ₦25,000 |
| 1 Month | ₦80,000 |
| Custom | ₦5,000 per day |

#### Promotion Flow
1. `GET /api/vendor/promotions/pricing` — show pricing to vendor
2. `POST /api/vendor/promotions` — create with `status: pending`
3. `POST /api/vendor/promotions/:id/pay` — get Paystack URL
4. Redirect vendor to `paymentUrl`
5. Webhook auto-activates promotion → vendor notified

---

### `GET /api/vendor/promotions/pricing` — No Auth

**Response `200`:**
```json
{
  "success": true,
  "pricing": {
    "one_day":   { "price": 5000,  "label": "1 Day" },
    "one_week":  { "price": 25000, "label": "1 Week" },
    "one_month": { "price": 80000, "label": "1 Month" },
    "custom":    { "pricePerDay": 5000, "label": "Custom (per day)" }
  },
  "types": {
    "boost_account": ["profile_visibility_boost", "more_profile_visits"],
    "get_sales":     ["more_product_visibility", "discounted_sales", "more_orders"],
    "campaign":      []
  },
  "currency": "NGN"
}
```

---

### `POST /api/vendor/promotions` — Auth Required

**Example — `boost_account`:**
```json
{
  "type": "boost_account",
  "subType": "profile_visibility_boost",
  "title": "Profile Visibility June",
  "duration": "one_week",
  "termsAccepted": true
}
```

**Example — `get_sales`:**
```json
{
  "type": "get_sales",
  "subType": "more_product_visibility",
  "title": "Vitamin Boost Promo",
  "duration": "one_week",
  "productIds": ["uuid1", "uuid2"],
  "termsAccepted": true
}
```

**Example — `campaign`:**
```json
{
  "type": "campaign",
  "title": "New Arrival — Omega 3 Capsules",
  "duration": "custom",
  "customDays": 14,
  "campaignProduct": {
    "title": "Omega 3 Fish Oil Capsules",
    "category": "nutrition_healthy_living",
    "description": "High quality omega 3 supplement.",
    "price": 7500,
    "stockQuantity": 50,
    "mediaUrls": ["https://..."]
  },
  "termsAccepted": true
}
```

**Response `201`:**
```json
{
  "success": true,
  "message": "Promotion created. Proceed to payment to activate it.",
  "promotion": {
    "id": "uuid",
    "title": "Vitamin Boost Promo",
    "type": "get_sales",
    "subType": "more_product_visibility",
    "duration": "one_week",
    "customDays": null,
    "status": "pending",
    "pricePaid": 25000,
    "paymentStatus": "unpaid",
    "paymentAuthUrl": null,
    "startDate": null,
    "endDate": null,
    "promotionProducts": [{ "productId": "uuid1", "productTitle": "Vitamin C 1000mg" }],
    "campaignProduct": null,
    "createdAt": "2026-06-07T10:00:00.000Z",
    "updatedAt": "2026-06-07T10:00:00.000Z"
  }
}
```

---

### `POST /api/vendor/promotions/:id/pay` — Auth Required

**Response `200`:**
```json
{
  "success": true,
  "message": "Proceed to the payment URL to activate your promotion",
  "paymentUrl": "https://checkout.paystack.com/...",
  "reference": "COSMIC-PROMO-..."
}
```

---

### Other Promotion Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/vendor/promotions` | Yes | List my promotions — query: `type`, `status`, `page`, `limit` |
| GET | `/api/vendor/promotions/trends` | Yes | Trends — query: `days` (default 30) |
| GET | `/api/vendor/promotions/:id` | Yes | Single promotion |
| PUT | `/api/vendor/promotions/:id` | Yes | Update (only pending promotions) |
| POST | `/api/vendor/promotions/:id/cancel` | Yes | Cancel |
| DELETE | `/api/vendor/promotions/:id` | Yes | Delete (only pending promotions) |

---

## 8. Vendor Analytics

All require Auth (vendor only).

### `GET /api/vendor/analytics/overview`

**Response `200`:**
```json
{
  "success": true,
  "overview": {
    "totalProducts": 12,
    "approvedProducts": 10,
    "totalCarts": 35,
    "submittedCarts": 20,
    "confirmedCarts": 14,
    "cancelledCarts": 1,
    "totalRevenue": "145000.00",
    "activePromotions": 2
  }
}
```

---

### `GET /api/vendor/analytics/sales`

**Query Params:** `period` (daily | weekly | monthly), `from` (ISO date), `to` (ISO date)

**Response `200`:**
```json
{
  "success": true,
  "sales": {
    "period": "daily",
    "data": [{ "date": "2026-06-07", "orders": 3, "revenue": "15000.00" }]
  }
}
```

---

### `GET /api/vendor/analytics/products`

**Response `200`:**
```json
{
  "success": true,
  "products": [
    { "productId": "uuid", "title": "Vitamin C 1000mg", "totalOrders": 14, "totalRevenue": "70000.00" }
  ]
}
```

---

### `GET /api/vendor/analytics/promotions`

**Response `200`:**
```json
{
  "success": true,
  "promotions": [
    {
      "promotionId": "uuid",
      "title": "Summer Sale Boost",
      "type": "get_sales",
      "status": "active",
      "pricePaid": "25000.00",
      "startDate": "2026-06-01T00:00:00.000Z",
      "endDate": "2026-06-08T00:00:00.000Z"
    }
  ]
}
```

---

## 9. Shop — Public Browsing (`/api/shop`) — No Auth Required

### `GET /api/shop/categories`

**Response `200`:**
```json
{
  "success": true,
  "categories": [
    { "key": "health_wellness",       "label": "Health and Wellness" },
    { "key": "medical_supplies",      "label": "Medical Supplies" },
    { "key": "baby_mother_care",      "label": "Baby and Mother Care" },
    { "key": "fitness_lifestyle",     "label": "Fitness and Lifestyle" },
    { "key": "nutrition_healthy_living", "label": "Nutrition and Healthy Living" },
    { "key": "others",                "label": "Others" },
    { "key": "medications",           "label": "Medications" }
  ]
}
```

---

### `GET /api/shop/categories/:category/subcategories`

**Response `200`:** `{ "success": true, "subcategories": ["skincare_beauty", "hair_body_care", ...] }`

---

### `GET /api/shop/products`

**Query Params:** `category`, `subcategory`, `vendorId`, `minPrice`, `maxPrice`, `search`, `sortBy` (price_asc | price_desc | newest), `page`, `limit`

**Response `200`:**
```json
{
  "success": true,
  "products": [
    {
      "id": "uuid",
      "title": "Vitamin C 1000mg Tablets",
      "description": "High strength vitamin C supplement.",
      "price": "5000.00",
      "stockQuantity": 98,
      "inStock": true,
      "category": "nutrition_healthy_living",
      "subcategory": "vitamins_supplements",
      "prescriptionRequired": false,
      "media": [{ "id": "uuid", "url": "https://..." }],
      "vendor": {
        "id": "uuid",
        "businessName": "HealthZone Store",
        "logoUrl": "https://...",
        "city": "Ikeja",
        "state": "Lagos"
      },
      "createdAt": "2026-06-07T10:00:00.000Z"
    }
  ],
  "total": 42,
  "page": 1,
  "limit": 20
}
```
> Use `prescriptionRequired: true` to show a "Prescription Required" badge on the product card.

---

### `GET /api/shop/products/:id`

**Response `200`:** `{ "success": true, "product": { ...publicProductObject } }`

---

### `GET /api/shop/vendors/:vendorId`

**Response `200`:**
```json
{
  "success": true,
  "vendor": {
    "id": "uuid",
    "businessName": "HealthZone Store",
    "businessCategory": "health_wellness",
    "businessDescription": "We sell quality health products.",
    "logoUrl": "https://...",
    "city": "Ikeja",
    "state": "Lagos",
    "country": "Nigeria"
  }
}
```

---

## 10. Cart — Patient Side (`/api/cart`) — Auth Required

> Each vendor has a **separate cart**. A patient can have multiple open carts at once.

### `POST /api/cart/vendor/:vendorId/items`

**Request Body:** `{ "productId": "uuid", "quantity": 2 }`

**Response `200`:**
```json
{
  "success": true,
  "message": "Item added to cart",
  "cart": {
    "id": "uuid",
    "status": "draft",
    "patientNote": null,
    "vendorNote": null,
    "confirmedTotal": null,
    "submittedAt": null,
    "confirmedAt": null,
    "cancelledAt": null,
    "cancelledBy": null,
    "vendor": { "id": "uuid", "businessName": "HealthZone Store", "logoUrl": "https://..." },
    "items": [
      {
        "id": "uuid",
        "productId": "uuid",
        "productTitle": "Vitamin C 1000mg Tablets",
        "quantity": 2,
        "priceSnapshot": "5000.00",
        "lineTotal": "10000.00",
        "product": { "id": "uuid", "title": "Vitamin C 1000mg Tablets", "media": [] }
      }
    ],
    "itemCount": 1,
    "estimatedTotal": "10000.00",
    "createdAt": "2026-06-07T10:00:00.000Z",
    "updatedAt": "2026-06-07T10:00:00.000Z"
  }
}
```

---

### Other Cart Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/cart` | List all my carts — query: `status`, `page`, `limit` |
| GET | `/api/cart/:cartId` | Single cart detail |
| PUT | `/api/cart/:cartId/items/:itemId` | Update quantity — body: `{ "quantity": 3 }` |
| DELETE | `/api/cart/:cartId/items/:itemId` | Remove item |
| POST | `/api/cart/:cartId/submit` | Submit to vendor — body: `{ "patientNote": "..." }` (optional) |
| POST | `/api/cart/:cartId/cancel` | Cancel cart |

---

## 11. Hybrid Pharmacy — Vendor Mode (`/api/pharmacy/vendor-mode`)

For **approved pharmacies only**. Enables listing products including medications.

### `GET /api/pharmacy/vendor-mode/status` — Auth Required (Pharmacy)

**Response `200`:**
```json
{
  "success": true,
  "isVendorEnabled": true,
  "vendorProfile": {
    "id": "uuid",
    "businessName": "HealthPlus Pharmacy Store",
    "businessCategory": "health_wellness",
    "verificationStatus": "approved",
    "isActive": true,
    "isHybridPharmacy": true,
    "createdAt": "2026-06-07T10:00:00.000Z"
  }
}
```
> If not enabled: `{ "success": true, "isVendorEnabled": false, "vendorProfile": null }`

---

### `POST /api/pharmacy/vendor-mode/enable` — Auth Required (Pharmacy)

**Request Body:**
```json
{
  "businessName": "HealthPlus Pharmacy Store",
  "businessCategory": "health_wellness",
  "description": "Quality medications and health products.",
  "state": "Lagos",
  "city": "Ikeja"
}
```
**Response `201`:** `{ "success": true, "message": "Vendor mode enabled...", "vendor": { ...vendorProfile } }`

> Shop goes **live immediately** — no extra review needed. Hybrid pharmacies can list `medications` category products.

---

### `POST /api/pharmacy/vendor-mode/disable` — Auth Required (Pharmacy)

**Response `200`:** `{ "success": true, "message": "Vendor mode disabled." }`

---

## 12. Prescription-Assisted Sessions (`/api/pharmacy/sessions`)

For patients who have a prescription and want a pharmacy to build a custom cart from it. The pharmacy reviews the prescription, adds medication items in real-time, and the patient pays directly.

### How It Works

```
Patient selects pharmacy → POST /pharmacy/sessions  (session starts, pharmacy notified)
       ↓
Pharmacy reviews prescription → adds items via POST /pharmacy/sessions/pharmacy/:id/cart/items
       ↓   ← patient sees each item added in real-time (WebSocket: prescription_cart_item_added)
Pharmacy finalises → POST /pharmacy/sessions/pharmacy/:id/cart/finalise
       ↓   ← patient notified (WebSocket: prescription_cart_ready + push notification)
Patient approves → POST /pharmacy/sessions/my/:id/approve  →  gets Paystack payment URL
       ↓
Patient pays → Webhook confirms → Prescription status: in_progress, Pharmacy wallet credited (100%)
       ↓
Existing prescription fulfilment flow continues (mark ready, dispatch, complete)
```

> **Session timeout:** Pharmacy has **30 minutes** to finalise the cart. If they don't, the session expires automatically.  
> **Multi-pharmacy:** Patient can start sessions with multiple pharmacies simultaneously to compare prices. When one is paid, the others are cancelled automatically.  
> **Platform fee:** Patient pays cart total + 7% platform fee. Pharmacy receives 100% of the cart total — the 7% is added on top, not deducted from the pharmacy.

---

### WebSocket Events (Prescription Sessions)

| Event | Direction | When |
|---|---|---|
| `prescription_session_started` | → Pharmacy | Patient starts a session |
| `prescription_cart_item_added` | → Patient | Pharmacy adds an item |
| `prescription_cart_item_removed` | → Patient | Pharmacy removes an item |
| `prescription_cart_ready` | → Patient | Pharmacy finalises cart |
| `prescription_session_approved` | → Both | Payment confirmed |
| `prescription_session_expired` | → Both | 30-min timeout reached |
| `prescription_session_cancelled` | → Both | Either party cancels |

---

### `POST /api/pharmacy/sessions` — Auth Required (Patient)

**Request Body:**
```json
{
  "prescriptionId": "uuid",
  "pharmacyId": "uuid"
}
```

**Response `201`:**
```json
{
  "success": true,
  "message": "Session started. The pharmacy has 30 minutes to build your cart.",
  "session": {
    "id": "uuid",
    "prescriptionId": "uuid",
    "pharmacyId": "uuid",
    "patientId": "uuid",
    "status": "active",
    "expiresAt": "2026-06-07T10:30:00.000Z",
    "isExpired": false,
    "cart": {
      "id": "uuid",
      "sessionId": "uuid",
      "status": "building",
      "pharmacyNote": null,
      "totalAmountNgn": null,
      "platformFeeNgn": 0,
      "pharmacyAmountNgn": null,
      "currency": "NGN",
      "paymentStatus": "unpaid",
      "paymentAuthUrl": null,
      "paidAt": null,
      "items": []
    },
    "createdAt": "2026-06-07T10:00:00.000Z",
    "updatedAt": "2026-06-07T10:00:00.000Z"
  }
}
```

---

### `GET /api/pharmacy/sessions/my` — Auth Required (Patient)

**Query Params:** `status` (active | cart_ready | approved | expired | cancelled), `page`, `limit`

**Response `200`:** `{ "success": true, "sessions": [ ...sessionObjects ], "total": 2 }`

---

### `GET /api/pharmacy/sessions/my/:sessionId` — Auth Required (Patient)

**Response `200`:** `{ "success": true, "session": { ...sessionObject } }`

---

### `POST /api/pharmacy/sessions/my/:sessionId/approve` — Auth Required (Patient)

Patient approves the cart and gets a Paystack payment URL.

**Response `200`:**
```json
{
  "success": true,
  "message": "Proceed to the payment URL to complete your purchase.",
  "paymentUrl": "https://checkout.paystack.com/...",
  "reference": "COSMIC-RX-...",
  "cartTotal": 7500,
  "platformFee": 525,
  "amount": 8025,
  "currency": "NGN",
  "sessionId": "uuid"
}
```
> **`amount` is what the patient pays** = `cartTotal` + 7% platform fee. Show this as the total in the UI. The pharmacy receives `cartTotal` (100%) — the fee is added on top.

---

### `POST /api/pharmacy/sessions/my/:sessionId/cancel` — Auth Required (Patient)

**Response `200`:** `{ "success": true, "message": "Session cancelled", "session": { ...sessionObject } }`

---

### `GET /api/pharmacy/sessions/pharmacy` — Auth Required (Pharmacy)

**Query Params:** `status`, `page`, `limit`

**Response `200`:** `{ "success": true, "sessions": [ ...sessionObjects ], "total": 5 }`

---

### `GET /api/pharmacy/sessions/pharmacy/:sessionId` — Auth Required (Pharmacy)

**Response `200`:** `{ "success": true, "session": { ...sessionObject } }`

---

### `POST /api/pharmacy/sessions/pharmacy/:sessionId/cart/items` — Auth Required (Pharmacy)

Pharmacy adds a medication/item to the patient's cart. Patient sees it in real-time.

**Request Body:**
```json
{
  "productName": "Amoxicillin 500mg Capsules x14",
  "quantity": 1,
  "unitPriceNgn": 3500,
  "note": "Dispensed as generic equivalent",
  "isSubstitute": false
}
```

**Response `200`:**
```json
{
  "success": true,
  "message": "Item added to cart",
  "cart": {
    "id": "uuid",
    "status": "building",
    "totalAmountNgn": 3500,
    "platformFeeNgn": 0,
    "pharmacyAmountNgn": 3500,
    "currency": "NGN",
    "paymentStatus": "unpaid",
    "items": [
      {
        "id": "uuid",
        "productName": "Amoxicillin 500mg Capsules x14",
        "quantity": 1,
        "unitPriceNgn": 3500,
        "totalPriceNgn": 3500,
        "note": "Dispensed as generic equivalent",
        "isSubstitute": false
      }
    ]
  }
}
```

---

### `DELETE /api/pharmacy/sessions/pharmacy/:sessionId/cart/items/:itemId` — Auth Required (Pharmacy)

**Response `200`:** `{ "success": true, "message": "Item removed", "cart": { ...cartObject } }`

---

### `POST /api/pharmacy/sessions/pharmacy/:sessionId/cart/finalise` — Auth Required (Pharmacy)

Marks the cart as ready and notifies the patient.

**Request Body:**
```json
{ "pharmacyNote": "All items in stock. Ready for same-day pickup." }
```
> `pharmacyNote` is optional.

**Response `200`:**
```json
{
  "success": true,
  "message": "Cart finalised. The patient has been notified and can now proceed to payment.",
  "session": { ...sessionObject }
}
```

---

### `POST /api/pharmacy/sessions/pharmacy/:sessionId/cancel` — Auth Required (Pharmacy)

**Response `200`:** `{ "success": true, "message": "Session cancelled", "session": { ...sessionObject } }`

---

## General Notes

### Full Vendor Order Flow

```
Patient browses shop (no auth)
       ↓
Patient adds items → POST /cart/vendor/:vendorId/items
       ↓
Patient submits cart → POST /cart/:cartId/submit
       ↓
Vendor confirms pricing → POST /vendor/carts/:cartId/confirm-pricing
       ↓
Patient initiates checkout → POST /vendor/orders/checkout/:cartId
       ↓   (show grossAmount — subtotal + 7%)
Patient pays → POST /vendor/orders/:orderId/pay → redirect to paymentUrl
       ↓
Payment confirmed (webhook) → order: processing, vendor wallet credited
       ↓
Vendor dispatches → POST /vendor/shipments/vendor/:orderId/dispatch
       ↓
Patient tracks → GET /vendor/shipments/my/:orderId
       ↓
Vendor marks delivered → POST /vendor/shipments/vendor/:orderId/delivered → order: completed
```

### Vendor vs Hybrid Pharmacy

| | Regular Vendor | Hybrid Pharmacy |
|---|---|---|
| Registers separately | Yes | No — uses pharmacy login |
| Admin approval needed | Yes | No — auto-approved |
| Can list medications | No | Yes |
| Platform fee (customer) | +7% on top | +7% on top |
| Commission | TBD (currently 0%) | None |
| Has orders/wallet/analytics | Yes | Yes |

### Payment Fee Display

Always show `grossAmount` as the total the customer will pay — not `subtotal`.

```
Subtotal:       ₦10,000
Platform fee:   +₦700 (7%)
─────────────────────────
Total to pay:   ₦10,700
```

Vendor dashboard should show `vendorAmount` as their earnings.

### File Uploads

Use `multipart/form-data` for logo and product media. Backend returns file URLs in the response.

### Prices

All amounts are in **NGN** and stored as decimal strings. Display with 2 decimal places.

### Do NOT Call from Frontend (Paystack Webhooks — Backend Only)

- `POST /api/webhooks/vendor/promotions`
- `POST /api/webhooks/vendor/orders`
- `POST /api/webhooks/pharmacy/:provider`
