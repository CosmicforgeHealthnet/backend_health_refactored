/**
 * One-time script: fix wrong prescription paths in pharmacy-swagger.bundle.json
 * and add missing routes to both swagger files.
 * Run: node src/features/pharmacy/docs/fixSwaggerPaths.js
 */
const fs   = require("node:fs");
const path = require("node:path");

const BUNDLE_PATH  = path.join(__dirname, "pharmacy-swagger.bundle.json");
const PAYMENT_PATH = path.join(__dirname, "pharmacy-payment-swagger.json");

// ── 1. Fix bundle ─────────────────────────────────────────────────────────────
const bundle = JSON.parse(fs.readFileSync(BUNDLE_PATH, "utf8"));

const PATH_RENAMES = {
  // Fix doubled parameterized prescription paths
  "/pharmacy/prescriptions/pharmacy/prescriptions/{prescriptionId}/start-processing":
    "/pharmacy/prescriptions/{prescriptionId}/start-processing",
  "/pharmacy/prescriptions/pharmacy/prescriptions/{prescriptionId}/provide-costs":
    "/pharmacy/prescriptions/{prescriptionId}/provide-costs",
  "/pharmacy/prescriptions/pharmacy/prescriptions/{prescriptionId}/mark-ready":
    "/pharmacy/prescriptions/{prescriptionId}/mark-ready",
  "/pharmacy/prescriptions/pharmacy/prescriptions/{prescriptionId}/complete":
    "/pharmacy/prescriptions/{prescriptionId}/complete",
  "/pharmacy/prescriptions/pharmacy/prescriptions/{prescriptionId}/confirm-availability":
    "/pharmacy/prescriptions/{prescriptionId}/confirm-availability",
  "/pharmacy/prescriptions/pharmacy/prescriptions/{prescriptionId}/internal-notes":
    "/pharmacy/prescriptions/{prescriptionId}/internal-notes",
  "/pharmacy/prescriptions/pharmacy/prescriptions/{prescriptionId}/propose-alternative":
    "/pharmacy/prescriptions/{prescriptionId}/propose-alternative",
  // Fix wrong static paths
  "/pharmacy/prescriptions/pharmacy/prescriptions":   "/pharmacy/prescriptions",
  "/pharmacy/prescriptions/pharmacy/orders":          "/pharmacy/prescriptions/active",
  "/pharmacy/prescriptions/pharmacy/contacts":        "/pharmacy/prescriptions/contacts",
  "/pharmacy/prescriptions/pharmacy/dashboard/stats": "/pharmacy/prescriptions/dashboard/stats",
  "/pharmacy/prescriptions/pharmacy/dashboard/activity": "/pharmacy/prescriptions/dashboard/activity",
};

const fixedPaths = {};
for (const [p, def] of Object.entries(bundle.paths)) {
  const corrected = PATH_RENAMES[p] || p;
  fixedPaths[corrected] = def;
}

// ── 2. Add missing prescription paths ─────────────────────────────────────────
const prescriptionIdParam = {
  in: "path", name: "prescriptionId", required: true,
  schema: { type: "string", format: "uuid" },
  description: "Prescription ID",
};
const bearerSecurity = [{ bearerAuth: [] }];

// GET /pharmacy/prescriptions (pharmacy list) — may already exist under old wrong key
if (!fixedPaths["/pharmacy/prescriptions/pharmacy/prescriptions"] &&
    !fixedPaths["/pharmacy/prescriptions"]) {
  fixedPaths["/pharmacy/prescriptions"] = {
    get: {
      tags: ["Prescription"],
      summary: "List pharmacy prescriptions",
      security: bearerSecurity,
      parameters: [
        { in: "query", name: "status", schema: { type: "string" }, description: "Filter by status" },
        { in: "query", name: "page",   schema: { type: "integer", default: 1 } },
        { in: "query", name: "limit",  schema: { type: "integer", default: 20 } },
      ],
      responses: {
        "200": { description: "Paginated prescription list" },
        "401": { description: "Unauthorized" },
      },
    },
  };
}

// GET /pharmacy/prescriptions/dispatch
if (!fixedPaths["/pharmacy/prescriptions/dispatch"]) {
  fixedPaths["/pharmacy/prescriptions/dispatch"] = {
    get: {
      tags: ["Dispatch"],
      summary: "List dispatch items",
      description: "Returns prescriptions eligible for dispatch or in transit (ready_for_pickup, ready_for_delivery, completed).",
      security: bearerSecurity,
      parameters: [
        {
          in: "query", name: "status", schema: {
            type: "string",
            enum: ["ready_for_pickup", "ready_for_delivery", "completed"],
          }, description: "Filter by dispatch status",
        },
        { in: "query", name: "page",  schema: { type: "integer", default: 1 } },
        { in: "query", name: "limit", schema: { type: "integer", default: 20 } },
      ],
      responses: {
        "200": {
          description: "Dispatch items",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean" },
                  data: {
                    type: "object",
                    properties: {
                      items: { type: "array" },
                      total: { type: "integer" },
                      page:  { type: "integer" },
                      limit: { type: "integer" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  };
}

// GET /pharmacy/prescriptions/active
if (!fixedPaths["/pharmacy/prescriptions/active"]) {
  fixedPaths["/pharmacy/prescriptions/active"] = {
    get: {
      tags: ["Prescription"],
      summary: "Active orders",
      description: "Returns prescriptions currently being processed (in_progress, under_review).",
      security: bearerSecurity,
      responses: { "200": { description: "Active order list" } },
    },
  };
}

// GET /pharmacy/prescriptions/contacts
if (!fixedPaths["/pharmacy/prescriptions/contacts"]) {
  fixedPaths["/pharmacy/prescriptions/contacts"] = {
    get: {
      tags: ["Prescription"],
      summary: "Messaging contacts",
      description: "Returns a list of patients the pharmacy has prescription conversations with.",
      security: bearerSecurity,
      responses: {
        "200": {
          description: "Contact list",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean" },
                  data: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id:               { type: "string" },
                        patientName:      { type: "string" },
                        lastMessage:      { type: "string" },
                        lastMessageAt:    { type: "string", format: "date-time" },
                        prescriptionId:   { type: "string" },
                        unreadCount:      { type: "integer" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  };
}

// GET /pharmacy/prescriptions/dashboard/stats
if (!fixedPaths["/pharmacy/prescriptions/dashboard/stats"]) {
  fixedPaths["/pharmacy/prescriptions/dashboard/stats"] = {
    get: {
      tags: ["Prescription"],
      summary: "Dashboard statistics",
      security: bearerSecurity,
      responses: {
        "200": {
          description: "Stats",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success:            { type: "boolean" },
                  data: {
                    type: "object",
                    properties: {
                      pendingRequests: { type: "integer" },
                      activeOrders:    { type: "integer" },
                      completedToday:  { type: "integer" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  };
}

// GET /pharmacy/prescriptions/dashboard/activity
if (!fixedPaths["/pharmacy/prescriptions/dashboard/activity"]) {
  fixedPaths["/pharmacy/prescriptions/dashboard/activity"] = {
    get: {
      tags: ["Prescription"],
      summary: "Dashboard activity feed",
      security: bearerSecurity,
      parameters: [
        { in: "query", name: "limit", schema: { type: "integer", default: 10 } },
      ],
      responses: { "200": { description: "Activity feed array" } },
    },
  };
}

// GET /pharmacy/prescriptions/search
if (!fixedPaths["/pharmacy/prescriptions/search"]) {
  fixedPaths["/pharmacy/prescriptions/search"] = {
    get: {
      tags: ["Prescription"],
      summary: "Search prescriptions",
      security: bearerSecurity,
      parameters: [
        { in: "query", name: "q",     required: true, schema: { type: "string" }, description: "Search term" },
        { in: "query", name: "page",  schema: { type: "integer", default: 1 } },
        { in: "query", name: "limit", schema: { type: "integer", default: 20 } },
      ],
      responses: { "200": { description: "Search results" } },
    },
  };
}

// POST /pharmacy/prescriptions/{prescriptionId}/dispatch
if (!fixedPaths["/pharmacy/prescriptions/{prescriptionId}/dispatch"]) {
  fixedPaths["/pharmacy/prescriptions/{prescriptionId}/dispatch"] = {
    post: {
      tags: ["Dispatch"],
      summary: "Initiate dispatch",
      description: "Transitions prescription from ready_for_pickup to ready_for_delivery (out for delivery).",
      security: bearerSecurity,
      parameters: [prescriptionIdParam],
      requestBody: {
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                estimatedDelivery: { type: "string", format: "date-time", description: "Expected delivery ISO8601" },
                note:              { type: "string" },
              },
            },
          },
        },
      },
      responses: {
        "200": { description: "Prescription dispatched" },
        "409": { description: "Prescription not in ready_for_pickup status" },
      },
    },
  };
}

// POST /pharmacy/prescriptions/{prescriptionId}/delivered
if (!fixedPaths["/pharmacy/prescriptions/{prescriptionId}/delivered"]) {
  fixedPaths["/pharmacy/prescriptions/{prescriptionId}/delivered"] = {
    post: {
      tags: ["Dispatch"],
      summary: "Mark as delivered",
      description: "Transitions prescription from ready_for_delivery to completed.",
      security: bearerSecurity,
      parameters: [prescriptionIdParam],
      responses: {
        "200": { description: "Prescription marked as delivered" },
        "409": { description: "Prescription not in ready_for_delivery status" },
      },
    },
  };
}

// PATCH /pharmacy/prescriptions/{prescriptionId}/status
if (!fixedPaths["/pharmacy/prescriptions/{prescriptionId}/status"]) {
  fixedPaths["/pharmacy/prescriptions/{prescriptionId}/status"] = {
    patch: {
      tags: ["Prescription"],
      summary: "Update prescription status",
      description: "Generic status update. Accepts any valid PrescriptionStatus value.",
      security: bearerSecurity,
      parameters: [prescriptionIdParam],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["status"],
              properties: {
                status: {
                  type: "string",
                  enum: [
                    "pending", "patient_uploaded", "pharmacy_assigned",
                    "pharmacy_processing", "under_review", "awaiting_payment",
                    "in_progress", "ready_for_pickup", "ready_for_delivery",
                    "completed", "cancelled",
                  ],
                },
              },
            },
          },
        },
      },
      responses: {
        "200": { description: "Status updated" },
        "400": { description: "Invalid status value" },
        "404": { description: "Prescription not found" },
      },
    },
  };
}

// Add Dispatch tag if missing
if (!bundle.tags) bundle.tags = [];
if (!bundle.tags.find(t => t.name === "Dispatch")) {
  bundle.tags.push({ name: "Dispatch", description: "Prescription dispatch and delivery management" });
}

bundle.paths = fixedPaths;
fs.writeFileSync(BUNDLE_PATH, JSON.stringify(bundle, null, 2));
console.log(`✅ pharmacy-swagger.bundle.json updated — ${Object.keys(fixedPaths).length} paths`);

// ── 3. Fix payment swagger ─────────────────────────────────────────────────────
const payment = JSON.parse(fs.readFileSync(PAYMENT_PATH, "utf8"));

// Add GET /pharmacy/wallet/transactions/{id}/receipt
if (!payment.paths["/pharmacy/wallet/transactions/{id}/receipt"]) {
  payment.paths["/pharmacy/wallet/transactions/{id}/receipt"] = {
    get: {
      tags: ["Pharmacy Wallet"],
      summary: "Get transaction receipt",
      description: "Returns transaction details suitable for a receipt. Amount returned in pharmacy display currency.",
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          in: "path", name: "id", required: true,
          schema: { type: "string", format: "uuid" },
          description: "Transaction ID",
        },
      ],
      responses: {
        "200": {
          description: "Transaction receipt",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success:     { type: "boolean" },
                  data: {
                    type: "object",
                    properties: {
                      id:          { type: "string" },
                      reference:   { type: "string" },
                      type:        { type: "string", enum: ["credit", "debit"] },
                      status:      { type: "string" },
                      category:    { type: "string" },
                      amount:      { type: "number" },
                      currency:    { type: "string" },
                      description: { type: "string" },
                      invoiceRef:  { type: "string", nullable: true },
                      settledAt:   { type: "string", format: "date-time", nullable: true },
                      createdAt:   { type: "string", format: "date-time" },
                    },
                  },
                },
              },
            },
          },
        },
        "404": { description: "Transaction not found" },
      },
    },
  };
  console.log("✅ Added /pharmacy/wallet/transactions/{id}/receipt to payment swagger");
}

// Ensure DELETE /pharmacy/wallet/bank-accounts/{accountId} is documented
if (payment.paths["/pharmacy/wallet/bank-accounts/{accountId}"] &&
    !payment.paths["/pharmacy/wallet/bank-accounts/{accountId}"].delete) {
  payment.paths["/pharmacy/wallet/bank-accounts/{accountId}"].delete = {
    tags: ["Pharmacy Payouts"],
    summary: "Delete bank account",
    security: [{ bearerAuth: [] }],
    parameters: [
      {
        in: "path", name: "accountId", required: true,
        schema: { type: "string", format: "uuid" },
        description: "Bank account ID",
      },
    ],
    responses: {
      "204": { description: "Deleted" },
      "404": { description: "Bank account not found" },
    },
  };
  console.log("✅ Added DELETE bank account to payment swagger");
}

fs.writeFileSync(PAYMENT_PATH, JSON.stringify(payment, null, 2));
console.log(`✅ pharmacy-payment-swagger.json updated — ${Object.keys(payment.paths).length} paths`);
console.log("\n🎉 All swagger files updated successfully.");
