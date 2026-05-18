# Pharmacy Frontend Integration — Recent Backend Fixes

---

## 1. Forgot Password — Pharmacy Users

The forgot password email now correctly links to the **pharmacy app** URL, not the patient app.

Make sure your env has `PHARMACY_APP_URL` set to the pharmacy frontend base URL.  
No frontend change needed — just ensure the pharmacy app handles the `/reset-password?token=...` route.

---

## 2. Pharmacy Profile — serviceRadius & defaultCurrency

`GET /pharmacy/auth/profile` now returns two previously missing fields:

```json
{
  "pharmacy": {
    "serviceRadius": 10,
    "defaultCurrency": "NGN",
    ...
  }
}
```

Use `defaultCurrency` to display monetary values across the app.

---

## 3. Currency — Location-Based Consistency

Pharmacy currency is now automatically resolved from the pharmacy's registration location and saved as `defaultCurrency` on the profile.

This currency is now consistently applied across:
- **Wallet** — balances, transactions, earnings, payouts, receipts
- **Invoices** — display amounts
- **Pricing config**
- **Dashboard**

All monetary API responses include a `currency` field — always use it to format amounts, do not hardcode NGN or USD.

```json
{
  "availableBalance": 7000,
  "currency": "NGN"
}
```

---

## 4. Real-Time WebSocket Notifications

### Connection

```js
const socket = io(SERVER_URL, {
  auth: { token: "<jwt>" }
});
```

On connection, all pharmacy roles (owner, pharmacist, assistant, dispatcher) are **automatically** joined to:
- `user_<userId>` — personal notifications
- `pharmacy_<pharmacyId>` — shared room for all pharmacy staff

No manual room joining needed.

---

### Events — Pharmacy App

#### `new_prescription`
Patient has assigned a prescription to your pharmacy.

```json
{
  "prescriptionId": "uuid",
  "reference": "RX-XXXX",
  "patientName": "John Doe",
  "status": "pharmacy_assigned",
  "createdAt": "2026-05-07T10:00:00.000Z"
}
```
**Action:** Refresh the incoming prescription queue.

---

#### `prescription_status_changed`
Fires on every status transition — payment confirmed, ready, dispatched, completed, cancelled.

```json
{
  "prescriptionId": "uuid",
  "reference": "RX-XXXX",
  "status": "in_progress",
  "updatedAt": "2026-05-07T10:05:00.000Z"
}
```
**Action:** Update the matching prescription card in the UI.

---

#### `payment_received`
Patient successfully paid an invoice.

```json
{
  "invoiceId": "uuid",
  "reference": "INV-XXXX",
  "prescriptionId": "uuid"
}
```
**Action:** Move prescription to fulfilment view, refresh wallet summary.

---

#### `dispute_raised`
Patient raised a dispute on an invoice.

```json
{
  "disputeId": "uuid",
  "invoiceId": "uuid",
  "reference": "INV-XXXX"
}
```
**Action:** Show dispute alert badge.

---

#### `notification`
Generic bell notification — covers payout requested, payout completed, payout failed, dispute resolved.

```json
{
  "id": "uuid",
  "type": "payout_completed",
  "message": "Your payout (PAYOUT-XXXX) has been completed.",
  "metadata": {},
  "isRead": false,
  "createdAt": "2026-05-07T10:00:00.000Z"
}
```
**Action:** Increment notification bell count, show toast.

---

### Events — Patient App

#### `prescription_status_changed`
Same payload as above — fires whenever pharmacy updates the prescription status.  
**Action:** Update the order status screen without needing a manual refresh.

#### `invoice_sent`
Pharmacy sent an invoice to the patient.

```json
{
  "invoiceId": "uuid",
  "reference": "INV-XXXX",
  "prescriptionId": "uuid",
  "totalAmount": 7000,
  "currency": "NGN"
}
```
**Action:** Prompt patient to review and pay the invoice.

#### `notification`
Generic bell notifications — payment confirmed, invoice overdue, dispute resolved.

---

## 5. Notification REST Endpoints

All roles (pharmacy + patient).

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/notifications` | Get notifications. Query: `type`, `isRead`, `limit`, `skip` |
| `GET` | `/notifications/counts` | Get unread counts |
| `PUT` | `/notifications/:id/read` | Mark single notification as read |
| `PUT` | `/notifications/read-all` | Mark all notifications as read |
| `DELETE` | `/notifications/:id` | Delete a notification |

All require `Authorization: Bearer <token>`.

`PUT /notifications/read-all` also emits `all_notifications_read` via socket so the bell resets in real time without a page refresh.
