# Route Migration & Refactoring Presentation

This document outlines the changes made during the system refactoring from a legacy chaotic structure to a clean, Feature-Based Architecture.

## 1. Top-Level Changes

| **Feature** | **Legacy Route (Old)** | **Refactored Route (New)** | **Status** |
| :--- | :--- | :--- | :--- |
| **Auth** | `/auth/*` | `/api/auth/*` | ✅ Migrated |
| **Patient** | `/user/*` | `/api/patient/*` | ✅ Migrated |
| **Doctor** | `/doctor/*` | `/api/doctor/*` | ✅ Migrated |
| **Appointments** | `/appointments/*` | `/api/appointments/*` | ✅ Migrated |
| **Chat** | `/chat/*` | `/api/chat/*` | ✅ Migrated |
| **Legacy Chatbot** | `/chatbot/*` | `/api/chatbot/*` | ✅ Migrated |

## 2. Consolidated Features

### 💳 Payments & Transactions
*Merged `transactions` into `payments`*

| **Description** | **Old Route** | **New Route** |
| :--- | :--- | :--- |
| **Payments** | `/transactions/payments/*` | `/api/payments/*` |
| **Payment Methods** | `/transactions/payment-methods/*` | `/api/payments/methods/*` (Unified) |
| **Wallets** | `/transactions/wallet/*` | `/api/payments/wallet/*` |
| **Disputes** | `/transactions/disputes/*` | `/api/payments/disputes/*` |

> **Note**: The legacy `/transactions` routes have been deprecated but may still be active for backward compatibility if uncommented in `app.js`, but new development should use `/api/payments`.

### 📣 Marketing & Gamification
*Merged `gamification` into `marketing`*

| **Description** | **Old Route** | **New Route** |
| :--- | :--- | :--- |
| **Spinning Wheel** | `(No clear previous root)` | `/api/marketing/spin/*` |
| **Waitlist** | `/lab_pharm` | `/lab_pharm` (Maintained for legacy) |
| **Marketing (General)**| `/marketing/*` | `/api/marketing/*` |

### 🔐 Admin Verification
*Merged `admin` into `auth`*

| **Description** | **Old Route** | **New Route** |
| :--- | :--- | :--- |
| **Admin Verification**| `/admin/verification/*` | `/api/auth/verification/*` (Recommended) <br> `/admin/verification/*` (Maintained) |

## 3. Documentation Changes

### Swagger
- **Old**: Centralized `swagger.bundle.json` manually built.
- **New**: Feature-distributed YAML files (`src/features/*/docs/*.yaml`) merged dynamically.
- **Access**: [http://localhost:5001/api-docs](http://localhost:5001/api-docs)

### Postman
- **Old**: Single undocumented collection.
- **New**: Individual collections per feature:
  - `src/features/auth/postman_collection.json`
  - `src/features/payments/postman_collection.json`
  - `src/features/marketing/postman_collection.json`
  - ...and more.

## 4. Verification Steps
To verify the migration:
1.  **Check `app.js`**: See `FEATURE IMPORTS` vs `LEGACY ROUTES` sections.
2.  **Test Endpoints**: Use the new Postman collections with `/api/` prefix.
3.  **Review Folder Structure**:
    - `src/transactions` (Deleted) ➡️ `src/features/payments`
    - `src/gamification` (Deleted) ➡️ `src/features/marketing`
    - `src/admin` (Deleted) ➡️ `src/features/auth`
