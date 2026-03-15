/**
 * Rebuilds pharmacy-swagger.bundle.json:
 *  1. Renames all wrong doubled prescription paths to correct relative paths
 *  2. Adds all missing endpoints (dispatch, delivered, status, active, contacts, search, dashboard, logo)
 *  3. Ensures Dispatch tag exists with correct status enum (out_for_delivery)
 *
 * Run: node src/features/pharmacy/docs/rebuildSwaggerBundle.js
 */
const fs   = require("node:fs");
const path = require("node:path");

const FILE = path.join(__dirname, "pharmacy-swagger.bundle.json");
const swagger = JSON.parse(fs.readFileSync(FILE, "utf8"));

const auth = [{ bearerAuth: [] }];
const prescriptionIdParam = {
  in: "path", name: "prescriptionId", required: true,
  schema: { type: "string", format: "uuid" },
  description: "Prescription ID",
};

// ── 1. Rename wrong doubled paths ─────────────────────────────────────────────
const RENAMES = {
  "/pharmacy/prescriptions/pharmacy/prescriptions/{prescriptionId}/start-processing":    "/pharmacy/prescriptions/{prescriptionId}/start-processing",
  "/pharmacy/prescriptions/pharmacy/prescriptions/{prescriptionId}/provide-costs":       "/pharmacy/prescriptions/{prescriptionId}/provide-costs",
  "/pharmacy/prescriptions/pharmacy/prescriptions/{prescriptionId}/mark-ready":          "/pharmacy/prescriptions/{prescriptionId}/mark-ready",
  "/pharmacy/prescriptions/pharmacy/prescriptions/{prescriptionId}/complete":            "/pharmacy/prescriptions/{prescriptionId}/complete",
  "/pharmacy/prescriptions/pharmacy/prescriptions/{prescriptionId}/confirm-availability":"/pharmacy/prescriptions/{prescriptionId}/confirm-availability",
  "/pharmacy/prescriptions/pharmacy/prescriptions/{prescriptionId}/internal-notes":      "/pharmacy/prescriptions/{prescriptionId}/internal-notes",
  "/pharmacy/prescriptions/pharmacy/prescriptions/{prescriptionId}/propose-alternative": "/pharmacy/prescriptions/{prescriptionId}/propose-alternative",
  "/pharmacy/prescriptions/pharmacy/prescriptions":      "/pharmacy/prescriptions",
  "/pharmacy/prescriptions/pharmacy/orders":             "/pharmacy/prescriptions/active",
  "/pharmacy/prescriptions/pharmacy/contacts":           "/pharmacy/prescriptions/contacts",
  "/pharmacy/prescriptions/pharmacy/dashboard/stats":    "/pharmacy/prescriptions/dashboard/stats",
  "/pharmacy/prescriptions/pharmacy/dashboard/activity": "/pharmacy/prescriptions/dashboard/activity",
};

const fixedPaths = {};
for (const [p, def] of Object.entries(swagger.paths)) {
  fixedPaths[RENAMES[p] || p] = def;
}
swagger.paths = fixedPaths;

// ── 2. Ensure tags ─────────────────────────────────────────────────────────────
if (!swagger.tags) swagger.tags = [];
if (!swagger.tags.find(t => t.name === "Dispatch")) {
  swagger.tags.push({ name: "Dispatch", description: "Prescription dispatch and delivery management" });
}

// ── 3. Add / overwrite dispatch endpoints ─────────────────────────────────────

// GET /pharmacy/prescriptions/dispatch
swagger.paths["/pharmacy/prescriptions/dispatch"] = {
  get: {
    tags: ["Dispatch"],
    summary: "List dispatch items",
    description: "Returns prescriptions in dispatch-relevant statuses (ready_for_pickup, out_for_delivery, completed). Returns DispatchItem shape — not the full prescription object.",
    security: auth,
    parameters: [
      {
        in: "query", name: "status",
        schema: { type: "string", enum: ["ready_for_pickup", "out_for_delivery", "completed"] },
        description: "Filter by dispatch status",
      },
      { in: "query", name: "page",  schema: { type: "integer", default: 1 } },
      { in: "query", name: "limit", schema: { type: "integer", default: 20, maximum: 100 } },
    ],
    responses: {
      "200": {
        description: "Paginated dispatch item list",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                items: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id:          { type: "string", format: "uuid" },
                      reference:   { type: "string" },
                      status:      { type: "string", enum: ["ready_for_pickup", "out_for_delivery", "completed"] },
                      patient: {
                        type: "object", nullable: true,
                        properties: {
                          id:       { type: "string" },
                          fullName: { type: "string" },
                          phone:    { type: "string", nullable: true },
                        },
                      },
                      medications: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            name:     { type: "string" },
                            dosage:   { type: "string" },
                            quantity: { type: "number" },
                          },
                        },
                      },
                      deliveryAddress:      { type: "string", nullable: true },
                      deliveryInstructions: { type: "string", nullable: true },
                      deliveryFee:          { type: "number",  nullable: true },
                      dispatchedAt:         { type: "string",  format: "date-time", nullable: true },
                      estimatedDelivery:    { type: "string",  format: "date-time", nullable: true },
                      createdAt:            { type: "string",  format: "date-time" },
                      updatedAt:            { type: "string",  format: "date-time" },
                    },
                  },
                },
                total: { type: "integer" },
                page:  { type: "integer" },
                limit: { type: "integer" },
              },
            },
          },
        },
      },
      "401": { description: "Unauthorized" },
      "403": { description: "Forbidden — not a pharmacy account" },
    },
  },
};

// POST /pharmacy/prescriptions/{prescriptionId}/dispatch
swagger.paths["/pharmacy/prescriptions/{prescriptionId}/dispatch"] = {
  post: {
    tags: ["Dispatch"],
    summary: "Initiate dispatch (ready_for_pickup → out_for_delivery)",
    description: "Sets dispatchedAt timestamp. Sends push notification to patient: 'Your order is on the way'.",
    security: auth,
    parameters: [prescriptionIdParam],
    requestBody: {
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              estimatedDelivery: { type: "string", format: "date-time", description: "Expected delivery ISO 8601" },
              note:              { type: "string", description: "Internal dispatch note (e.g. driver info)" },
            },
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Prescription dispatched",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                id:                { type: "string", format: "uuid" },
                reference:         { type: "string" },
                status:            { type: "string", enum: ["out_for_delivery"] },
                dispatchedAt:      { type: "string", format: "date-time" },
                estimatedDelivery: { type: "string", format: "date-time", nullable: true },
                updatedAt:         { type: "string", format: "date-time" },
              },
            },
          },
        },
      },
      "404": { description: "Prescription not found" },
      "422": { description: "Prescription is not in ready_for_pickup status" },
    },
  },
};

// POST /pharmacy/prescriptions/{prescriptionId}/delivered
swagger.paths["/pharmacy/prescriptions/{prescriptionId}/delivered"] = {
  post: {
    tags: ["Dispatch"],
    summary: "Mark as delivered (out_for_delivery → completed)",
    description: "Notifies patient (push) and pharmacy (push, dashboard refresh).",
    security: auth,
    parameters: [prescriptionIdParam],
    responses: {
      "200": {
        description: "Prescription marked as delivered",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                id:           { type: "string", format: "uuid" },
                reference:    { type: "string" },
                status:       { type: "string", enum: ["completed"] },
                dispatchedAt: { type: "string", format: "date-time", nullable: true },
                updatedAt:    { type: "string", format: "date-time" },
              },
            },
          },
        },
      },
      "404": { description: "Prescription not found" },
      "422": { description: "Prescription is not in out_for_delivery status" },
    },
  },
};

// PATCH /pharmacy/prescriptions/{prescriptionId}/status
swagger.paths["/pharmacy/prescriptions/{prescriptionId}/status"] = {
  patch: {
    tags: ["Prescription"],
    summary: "Update prescription status (generic)",
    security: auth,
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
                  "in_progress", "ready_for_pickup", "out_for_delivery",
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

// ── 4. Add other missing static paths if absent ────────────────────────────────
if (!swagger.paths["/pharmacy/prescriptions/active"]) {
  swagger.paths["/pharmacy/prescriptions/active"] = {
    get: { tags: ["Prescription"], summary: "Active orders (in_progress, under_review)", security: auth, responses: { "200": { description: "Active order list" } } },
  };
}
if (!swagger.paths["/pharmacy/prescriptions/contacts"]) {
  swagger.paths["/pharmacy/prescriptions/contacts"] = {
    get: { tags: ["Prescription"], summary: "Messaging contacts", security: auth, responses: { "200": { description: "Contact list" } } },
  };
}
if (!swagger.paths["/pharmacy/prescriptions/search"]) {
  swagger.paths["/pharmacy/prescriptions/search"] = {
    get: {
      tags: ["Prescription"], summary: "Search prescriptions", security: auth,
      parameters: [
        { in: "query", name: "q",     required: true, schema: { type: "string" } },
        { in: "query", name: "page",  schema: { type: "integer", default: 1 } },
        { in: "query", name: "limit", schema: { type: "integer", default: 20 } },
      ],
      responses: { "200": { description: "Search results" } },
    },
  };
}
if (!swagger.paths["/pharmacy/prescriptions/dashboard/stats"]) {
  swagger.paths["/pharmacy/prescriptions/dashboard/stats"] = {
    get: { tags: ["Prescription"], summary: "Dashboard statistics", security: auth, responses: { "200": { description: "Stats" } } },
  };
}
if (!swagger.paths["/pharmacy/prescriptions/dashboard/activity"]) {
  swagger.paths["/pharmacy/prescriptions/dashboard/activity"] = {
    get: {
      tags: ["Prescription"], summary: "Dashboard activity feed", security: auth,
      parameters: [{ in: "query", name: "limit", schema: { type: "integer", default: 10 } }],
      responses: { "200": { description: "Activity feed" } },
    },
  };
}

// Logo upload
if (!swagger.paths["/pharmacy/auth/profile/logo"]) {
  swagger.paths["/pharmacy/auth/profile/logo"] = {
    post: {
      tags: ["Pharmacy Auth"],
      summary: "Upload pharmacy profile logo",
      security: auth,
      requestBody: {
        required: true,
        content: {
          "multipart/form-data": {
            schema: { type: "object", properties: { file: { type: "string", format: "binary" } } },
          },
        },
      },
      responses: {
        "200": {
          description: "Logo uploaded",
          content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean" }, message: { type: "string" }, data: { type: "object", properties: { logoUrl: { type: "string" } } } } } } },
        },
        "400": { description: "No file uploaded" },
      },
    },
  };
}

// ── 5. Save ────────────────────────────────────────────────────────────────────
fs.writeFileSync(FILE, JSON.stringify(swagger, null, 2));

const allPaths = Object.keys(swagger.paths);
const dispatchPaths = allPaths.filter(p => p.includes("dispatch") || p.includes("delivered"));
console.log(`✅ Done. Total paths: ${allPaths.length}`);
console.log(`✅ Dispatch paths: ${dispatchPaths.join(", ")}`);
console.log(`✅ Tags: ${(swagger.tags || []).map(t => t.name).join(", ")}`);
