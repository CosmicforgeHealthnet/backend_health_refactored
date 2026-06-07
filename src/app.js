// src/app.new.js
// NEW REFACTORED APP.JS - Feature-based architecture
// This file uses the new feature-based structure while maintaining backward compatibility

const express = require("express");
const { createServer } = require("node:http");
const cors = require("cors");
const path = require('node:path');
const archiver = require('archiver');
const swaggerUi = require("swagger-ui-express");
const morgan = require("morgan");
const logger = require("./config/logger");

// ============================================
// SHARED IMPORTS
// ============================================
const config = require("./shared/config");
const errorHandler = require("./shared/middlewares/errorHandler");

// ============================================
// FEATURE IMPORTS
// ============================================
const authFeature = require("./features/auth");
const patientFeature = require("./features/patient");
const doctorFeature = require("./features/doctor");
const appointmentFeature = require("./features/appointments");
const chatFeature = require("./features/chat");
const notificationFeature = require("./features/notifications");
const subscriptionFeature = require("./features/subscriptions");
const paymentFeature = require("./features/payments");
const transactionFeature = require("./features/payments"); // Consolidated

const supportFeature = require("./features/support");

const pharmacyFeature = require("./features/pharmacy");
const complianceFeature = require("./features/compliance");
const documentsFeature = require("./features/documents");
const firstaidFeature = require("./features/firstaid");

// Legacy feature locations (to be moved)
const legacyLabRoutesEnabled = process.env.ENABLE_LEGACY_LAB_ROUTES === "true";
// const pharmacyRoutes = require("./shared/services/email/helper/index");
// const firstaidRoutes = require('./shared/services/email/helper/index');
// const sosRoutes = require('./features/firstaid/routes/content/sosRoutes');

// Other existing routes (to be refactored in future phases)
// const chatRoutes = require("./routes/chatRoutes");
// const chatbotRoutes = require("./routes/chatbotRoutes");
// const notificationRoutes = require("./routes/notificationRoutes");
// const appointmentRoutes = require("./routes/appointmentRoutes");
// const appointmentRoutes = require("./routes/appointmentRoutes");
// const subscriptionRoutes = require("./routes/subscriptionRoutes");
// const supportRoutes = require("./routes/supportRoutes");
const DocumentFileController = require("./features/documents/controllers/documentFileController");

// DEPRECATED & MOVED ROUTES (Commented out):
// const paymentRoutes = require("./routes/transactions/paymentRoutes");
// const paymentMethodRoutes = require("./routes/transactions/paymentMethodRoutes");
// const walletRoutes = require("./routes/transactions/walletRoutes");
// const disputeRoutes = require("./routes/transactions/disputeRoutes");
const fhirRoutes = require('./features/documents/routes/fhirRoutes');
// const dataGovernanceRoutes = require('./features/compliance/routes/dataGovernanceRoutes');
// const auditRoutes = require('./features/compliance/routes/auditRoutes');
// const consentRoutes = require('./features/compliance/routes/consentRoutes');
// const complianceRoutes = require('./features/compliance/routes/complianceRoutes');
// const mfaRoutes = require("./routes/mfa/mfaRoutes");
// const referralRoutes = require('./routes/referralRoutes');
// const prescription = require('./features/pharmacy/routes/prescriptionRoutes');
const search = require("./features/search/routes/searchRoutes");
// const faq = require("./routes/faqRoutes");
const marketingFeature = require('./features/marketing');
const serviceManagementFeature = require('./features/service-management');
const waitlistRoute = require("./features/marketing/routes/waitlistRoutes"); // Keep independent for legacy /lab_pharm
const whatsappRoutesNotification = require("./features/notifications/whatsapp/routes");
const adminVerificationRoutes = require("./features/auth/routes/adminVerificationRoutes");
const adminOpsFeature = require("./features/admin-ops");
const analyticsFeature = require("./features/analytics");
const vendorFeature = require("./features/vendor");
const shopFeature   = require("./features/shop");
const cartFeature   = require("./features/cart");

// Legacy Compatibility Routes


// Legacy Compatibility Routes



// LEFT FOR REFERENCE BUT FILES DELETED:
// const legacyUserRoutes = require("./routes/userRoutes");
// const legacyDoctorVerificationRoutes = require("./routes/doctorVerificationRoutes");

// ============================================
// WEBSOCKET & MIDDLEWARE
// ============================================
const { initWebSocket } = require("./config/websocket");
const ChatSocketHandler = require("./features/chat/websocket/chatSocket");
const NotificationSocketHandler = require("./features/notifications/websocket/notificationSocket");
const checkUserTier = require("./shared/middlewares/checkUserTier");
const { getLocationFromIP } = require("./shared/middlewares/locationMiddleware");

// Use auth middleware from feature
const { authenticateJWT } = authFeature;

// ============================================
// APP SETUP
// ============================================
const app = express();
const httpServer = createServer(app);

// Initialize WebSocket
const io = initWebSocket(httpServer);
app.set("io", io);

// Initialize chat WebSocket
const chatSocketHandler = new ChatSocketHandler(io);
chatSocketHandler.initialize();

// Initialize notification WebSocket
const notificationSocketHandler = new NotificationSocketHandler(io);
notificationSocketHandler.initialize();

// ============================================
// SWAGGER DOCUMENTATION
// ============================================
const loadSwaggerDoc = (docPath, title) => {
    try {
        const doc = require(docPath);
        doc.servers = [
            {
                url: process.env.NODE_ENV === "production"
                    ? process.env.PROD_BACKEND_URL || config.backendUrl
                    : `http://localhost:${process.env.PORT || "3000"}`,
                description: process.env.NODE_ENV === "production"
                    ? "Production server"
                    : "Development server"
            }
        ];
        return doc;
    } catch {
        console.warn(`⚠️ ${title} swagger bundle not found.`);
        return {
            openapi: "3.0.3",
            info: { title: `${title} API`, version: "1.0.0" },
            paths: {}
        };
    }
};

const swaggerDoc = loadSwaggerDoc("./docs/swagger.bundle.json", "Main");
const pharmacySwaggerDoc = loadSwaggerDoc("./features/pharmacy/docs/pharmacy-swagger.bundle.json", "Pharmacy");
const pharmacyPaymentSwaggerDoc = loadSwaggerDoc("./features/pharmacy/docs/pharmacy-payment-swagger.json", "Pharmacy Payment");

// Merge payment doc into pharmacy doc so /pharmacy-docs shows everything
if (pharmacyPaymentSwaggerDoc.paths) {
    Object.assign(pharmacySwaggerDoc.paths, pharmacyPaymentSwaggerDoc.paths);
}
if (pharmacyPaymentSwaggerDoc.components) {
    pharmacySwaggerDoc.components = pharmacySwaggerDoc.components || {};
    if (pharmacyPaymentSwaggerDoc.components.schemas) {
        pharmacySwaggerDoc.components.schemas = pharmacySwaggerDoc.components.schemas || {};
        Object.assign(pharmacySwaggerDoc.components.schemas, pharmacyPaymentSwaggerDoc.components.schemas);
    }
    if (pharmacyPaymentSwaggerDoc.components.securitySchemes) {
        pharmacySwaggerDoc.components.securitySchemes = pharmacySwaggerDoc.components.securitySchemes || {};
        Object.assign(pharmacySwaggerDoc.components.securitySchemes, pharmacyPaymentSwaggerDoc.components.securitySchemes);
    }
}
if (pharmacyPaymentSwaggerDoc.tags) {
    pharmacySwaggerDoc.tags = [...(pharmacySwaggerDoc.tags || []), ...pharmacyPaymentSwaggerDoc.tags];
}

// Pharmacy routes are mounted under /api, so override server URL to include /api base
pharmacySwaggerDoc.servers = [
    {
        url: process.env.NODE_ENV === "production"
            ? `${process.env.PROD_BACKEND_URL || config.backendUrl}/api`
            : `http://localhost:${process.env.PORT || "3000"}/api`,
        description: process.env.NODE_ENV === "production" ? "Production server" : "Development server"
    }
];
const labSwaggerDoc = legacyLabRoutesEnabled
    ? loadSwaggerDoc("./features/LAB/docs/lab-swagger.bundle.json", "Lab")
    : null;
const sosSwaggerDoc = loadSwaggerDoc("./features/firstaid/docs/sos-swagger.bundle.json", "SOS");
const serviceManagementSwaggerDoc = loadSwaggerDoc("./features/service-management/docs/service-management-swagger.json", "Service Management");
const adminOpsSwaggerDoc       = loadSwaggerDoc("./features/admin-ops/docs/admin-ops-swagger.json", "Admin Ops");
const platformConfigSwaggerDoc = loadSwaggerDoc("./features/admin-ops/docs/platform-config-swagger.json", "Platform Config");
const analyticsSwaggerDoc = loadSwaggerDoc("./features/analytics/docs/analytics-swagger.json", "Analytics");
const vendorSwaggerDoc        = loadSwaggerDoc("./features/vendor/docs/vendor-swagger.json", "Vendor");
const vendorPromotionsDoc     = loadSwaggerDoc("./features/vendor/docs/vendor-promotions-swagger.json", "Vendor Promotions");
const vendorAnalyticsDoc      = loadSwaggerDoc("./features/vendor/docs/vendor-analytics-swagger.json",  "Vendor Analytics");
const vendorOrdersDoc         = loadSwaggerDoc("./features/vendor/docs/vendor-orders-swagger.json",     "Vendor Orders & Wallet");
const shopSwaggerDoc          = loadSwaggerDoc("./features/shop/docs/shop-swagger.json", "Shop");
const cartSwaggerDoc          = loadSwaggerDoc("./features/cart/docs/cart-swagger.json", "Cart");
const hybridPharmacySwaggerDoc  = loadSwaggerDoc("./features/pharmacy/docs/hybrid-pharmacy-swagger.json", "Hybrid Pharmacy");
const pharmacySessionSwaggerDoc = loadSwaggerDoc("./features/pharmacy/docs/pharmacy-session-swagger.json", "Pharmacy Session");

const patientSwaggerDoc = loadSwaggerDoc("./features/pharmacy/docs/patient-swagger.bundle.json", "Patient");
patientSwaggerDoc.servers = [
    {
        url: process.env.NODE_ENV === "production"
            ? `${process.env.PROD_BACKEND_URL || config.backendUrl}/api`
            : `http://localhost:${process.env.PORT || "3000"}/api`,
        description: process.env.NODE_ENV === "production" ? "Production server" : "Development server"
    }
];

const doctorSwaggerDoc = loadSwaggerDoc("./features/pharmacy/docs/doctor-swagger.bundle.json", "Doctor");
doctorSwaggerDoc.servers = [
    {
        url: process.env.NODE_ENV === "production"
            ? `${process.env.PROD_BACKEND_URL || config.backendUrl}/api`
            : `http://localhost:${process.env.PORT || "3000"}/api`,
        description: process.env.NODE_ENV === "production" ? "Production server" : "Development server"
    }
];

// ============================================
// GLOBAL MIDDLEWARE
// ============================================
app.use(morgan("combined", {
  stream: { write: (msg) => logger.info(msg.trim()) },
}));
app.use(cors({
    origin: config.corsOrigins,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
}));
app.options("*", cors());

app.use(express.json({
    verify: (req, res, buf) => {
        req.rawBody = buf.toString();
        // console.log('📝 Raw body captured:', req.rawBody.substring(0, 50) + '...');
    }
}));
app.use(express.static("public"));
app.use(getLocationFromIP);

// Location response middleware
app.use((req, res, next) => {
    const originalJson = res.json;
    res.json = function (data) {
        if (data && typeof data === 'object' && data.success !== false) {
            data.location = {
                country: req.location?.country,
                city: req.location?.city,
                region: req.location?.regionName,
                timezone: req.location?.timezone,
                ip: req.location?.ip
            };
        }
        return originalJson.call(this, data);
    };
    next();
});

// ============================================
// SWAGGER DOCS
// ============================================
app.use('/api-docs', swaggerUi.serveFiles(swaggerDoc, {}), swaggerUi.setup(swaggerDoc, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: "CosmicForge Main API",
    swaggerOptions: { docExpansion: 'none', persistAuthorization: true },
}));

app.use('/pharmacy-docs', swaggerUi.serveFiles(pharmacySwaggerDoc, {}), swaggerUi.setup(pharmacySwaggerDoc, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: "CosmicForge Pharmacy API",
    swaggerOptions: { docExpansion: 'none', persistAuthorization: true },
}));


if (legacyLabRoutesEnabled) {
    app.use('/lab-docs', swaggerUi.serveFiles(labSwaggerDoc, {}), swaggerUi.setup(labSwaggerDoc, {
        customCss: '.swagger-ui .topbar { display: none }',
        customSiteTitle: "CosmicForge Lab API",
        swaggerOptions: { docExpansion: 'none', persistAuthorization: true },
    }));
}

app.use('/sos-docs', swaggerUi.serveFiles(sosSwaggerDoc, {}), swaggerUi.setup(sosSwaggerDoc, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: "CosmicForge SOS Emergency API"
}));

app.use('/service-docs', swaggerUi.serveFiles(serviceManagementSwaggerDoc, {}), swaggerUi.setup(serviceManagementSwaggerDoc, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: "CosmicForge Service Management API",
    swaggerOptions: { docExpansion: 'none', persistAuthorization: true },
}));

app.use('/patient-docs', swaggerUi.serveFiles(patientSwaggerDoc, {}), swaggerUi.setup(patientSwaggerDoc, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: "CosmicForge Patient API",
    swaggerOptions: { docExpansion: 'none', persistAuthorization: true },
}));

app.use('/doctor-docs', swaggerUi.serveFiles(doctorSwaggerDoc, {}), swaggerUi.setup(doctorSwaggerDoc, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: "CosmicForge Doctor API",
    swaggerOptions: { docExpansion: 'none', persistAuthorization: true },
}));

platformConfigSwaggerDoc.servers = [
    {
        url: process.env.NODE_ENV === "production"
            ? `${process.env.PROD_BACKEND_URL || config.backendUrl}/api`
            : `http://localhost:${process.env.PORT || "3000"}/api`,
        description: process.env.NODE_ENV === "production" ? "Production server" : "Development server",
    },
];
app.use('/platform-config-docs', swaggerUi.serveFiles(platformConfigSwaggerDoc, {}), swaggerUi.setup(platformConfigSwaggerDoc, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: "CosmicForge Platform Fee & Commission Config API",
    swaggerOptions: { docExpansion: 'list', persistAuthorization: true },
}));

app.use('/admin-ops-docs', swaggerUi.serveFiles(adminOpsSwaggerDoc, {}), swaggerUi.setup(adminOpsSwaggerDoc, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: "CosmicForge Admin Ops API",
    swaggerOptions: { docExpansion: 'none', persistAuthorization: true },
}));

analyticsSwaggerDoc.servers = [
    {
        url: process.env.NODE_ENV === "production"
            ? `${process.env.PROD_BACKEND_URL || config.backendUrl}/api`
            : `http://localhost:${process.env.PORT || "3000"}/api`,
        description: process.env.NODE_ENV === "production" ? "Production server" : "Development server"
    }
];
app.use('/analytics-docs', swaggerUi.serveFiles(analyticsSwaggerDoc, {}), swaggerUi.setup(analyticsSwaggerDoc, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: "CosmicForge Analytics API",
    swaggerOptions: { docExpansion: 'none', persistAuthorization: true },
}));

cartSwaggerDoc.servers = [
    {
        url: process.env.NODE_ENV === "production"
            ? `${process.env.PROD_BACKEND_URL || config.backendUrl}/api`
            : `http://localhost:${process.env.PORT || "3000"}/api`,
        description: process.env.NODE_ENV === "production" ? "Production server" : "Development server",
    },
];
app.use('/cart-docs', swaggerUi.serveFiles(cartSwaggerDoc, {}), swaggerUi.setup(cartSwaggerDoc, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: "CosmicForge Cart API",
    swaggerOptions: { docExpansion: 'none', persistAuthorization: true },
}));

shopSwaggerDoc.servers = [
    {
        url: process.env.NODE_ENV === "production"
            ? `${process.env.PROD_BACKEND_URL || config.backendUrl}/api`
            : `http://localhost:${process.env.PORT || "3000"}/api`,
        description: process.env.NODE_ENV === "production" ? "Production server" : "Development server",
    },
];
app.use('/shop-docs', swaggerUi.serveFiles(shopSwaggerDoc, {}), swaggerUi.setup(shopSwaggerDoc, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: "CosmicForge Shop API",
    swaggerOptions: { docExpansion: 'none', persistAuthorization: true },
}));

vendorAnalyticsDoc.servers = [
    {
        url: process.env.NODE_ENV === "production"
            ? `${process.env.PROD_BACKEND_URL || config.backendUrl}/api`
            : `http://localhost:${process.env.PORT || "3000"}/api`,
        description: process.env.NODE_ENV === "production" ? "Production server" : "Development server",
    },
];
app.use('/vendor-analytics-docs', swaggerUi.serveFiles(vendorAnalyticsDoc, {}), swaggerUi.setup(vendorAnalyticsDoc, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: "CosmicForge Vendor Analytics API",
    swaggerOptions: { docExpansion: 'none', persistAuthorization: true },
}));

vendorPromotionsDoc.servers = [
    {
        url: process.env.NODE_ENV === "production"
            ? `${process.env.PROD_BACKEND_URL || config.backendUrl}/api`
            : `http://localhost:${process.env.PORT || "3000"}/api`,
        description: process.env.NODE_ENV === "production" ? "Production server" : "Development server",
    },
];
app.use('/promotions-docs', swaggerUi.serveFiles(vendorPromotionsDoc, {}), swaggerUi.setup(vendorPromotionsDoc, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: "CosmicForge Promotions API",
    swaggerOptions: { docExpansion: 'none', persistAuthorization: true },
}));

vendorSwaggerDoc.servers = [
    {
        url: process.env.NODE_ENV === "production"
            ? `${process.env.PROD_BACKEND_URL || config.backendUrl}/api`
            : `http://localhost:${process.env.PORT || "3000"}/api`,
        description: process.env.NODE_ENV === "production" ? "Production server" : "Development server",
    },
];
app.use('/vendor-docs', swaggerUi.serveFiles(vendorSwaggerDoc, {}), swaggerUi.setup(vendorSwaggerDoc, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: "CosmicForge Vendor API",
    swaggerOptions: { docExpansion: 'none', persistAuthorization: true },
}));

pharmacySessionSwaggerDoc.servers = [
    {
        url: process.env.NODE_ENV === "production"
            ? `${process.env.PROD_BACKEND_URL || config.backendUrl}/api`
            : `http://localhost:${process.env.PORT || "3000"}/api`,
        description: process.env.NODE_ENV === "production" ? "Production server" : "Development server",
    },
];
app.use('/pharmacy-session-docs', swaggerUi.serveFiles(pharmacySessionSwaggerDoc, {}), swaggerUi.setup(pharmacySessionSwaggerDoc, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: "CosmicForge Prescription-Assisted Cart API",
    swaggerOptions: { docExpansion: 'none', persistAuthorization: true },
}));

vendorOrdersDoc.servers = [
    {
        url: process.env.NODE_ENV === "production"
            ? `${process.env.PROD_BACKEND_URL || config.backendUrl}/api`
            : `http://localhost:${process.env.PORT || "3000"}/api`,
        description: process.env.NODE_ENV === "production" ? "Production server" : "Development server",
    },
];
app.use('/vendor-orders-docs', swaggerUi.serveFiles(vendorOrdersDoc, {}), swaggerUi.setup(vendorOrdersDoc, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: "CosmicForge Vendor Orders & Wallet API",
    swaggerOptions: { docExpansion: 'none', persistAuthorization: true },
}));

hybridPharmacySwaggerDoc.servers = [
    {
        url: process.env.NODE_ENV === "production"
            ? `${process.env.PROD_BACKEND_URL || config.backendUrl}/api`
            : `http://localhost:${process.env.PORT || "3000"}/api`,
        description: process.env.NODE_ENV === "production" ? "Production server" : "Development server",
    },
];
app.use('/hybrid-pharmacy-docs', swaggerUi.serveFiles(hybridPharmacySwaggerDoc, {}), swaggerUi.setup(hybridPharmacySwaggerDoc, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: "CosmicForge Hybrid Pharmacy API",
    swaggerOptions: { docExpansion: 'none', persistAuthorization: true },
}));

// ============================================
// HEALTH CHECK
// ============================================
app.get("/health", (req, res) => {
    res.json({
        status: "healthy",
        version: "2.0.0",
        timestamp: new Date().toISOString(),
        env: process.env.NODE_ENV,
        uptime: process.uptime()
    });
});

// ============================================
// WELCOME ROUTE
// ============================================
app.get("/", (req, res) => {
    res.json({
        message: "Welcome to the CosmicForge Health Backend!",
        version: "2.0.0",
        architecture: "Feature-based",
        swagger: {
            main: "/api-docs",
            pharmacy: "/pharmacy-docs",
            patient: "/patient-docs",
            doctor: "/doctor-docs",
            ...(legacyLabRoutesEnabled ? { lab: "/lab-docs" } : {}),
            sos: "/sos-docs",
            serviceManagement: "/service-docs",
            adminOps: "/admin-ops-docs",
            vendor: "/vendor-docs",
            shop: "/shop-docs",
            cart: "/cart-docs",
            promotions: "/promotions-docs",
            vendorAnalytics: "/vendor-analytics-docs",
            hybridPharmacy: "/hybrid-pharmacy-docs",
            vendorOrders:      "/vendor-orders-docs",
            platformConfig:    "/platform-config-docs",
            pharmacySession:   "/pharmacy-session-docs"
        },
        routes: {
            new: {
                auth: "/api/auth/*",
                patient: "/api/patient/*",
                doctor: "/api/doctor/*"
            },
            legacy: {
                auth: "/auth/* (deprecated)",
                user: "/user/* (deprecated)",
                doctorVerification: "/doctor/verification/* (deprecated)"
            }
        }
    });
});

// Premium tier check example
app.get("/premium-only", checkUserTier("premium"), (req, res) => {
    res.send("Welcome Premium user!");
});

// File serving route
app.get("/files/:fileId", DocumentFileController.serveFile);

// Download uploads route
app.get('/download-uploads', async (req, res) => {
    const archive = archiver('zip', { zlib: { level: 9 } });
    res.attachment('uploads.zip');
    archive.pipe(res);
    archive.directory('/opt/render/project/uploads', false);
    await archive.finalize();
});

// ============================================
// NEW FEATURE ROUTES (Recommended)
// ============================================
app.use("/api/auth", authFeature.router);
app.use("/api/patient", authenticateJWT, patientFeature.router);
app.use("/api/patient", authenticateJWT, require("./features/pharmacy/routes/patientRoutes")); // Patient invoice & payment routes
app.use("/api/doctor", doctorFeature.router);
app.use("/api/appointments", authenticateJWT, appointmentFeature.router);
app.use("/api/chat", authenticateJWT, chatFeature.router);
app.use("/api/chatbot", authenticateJWT, chatFeature.chatbotRouter);
app.use("/api/notifications", authenticateJWT, notificationFeature.router);
app.use("/api/subscription", subscriptionFeature.router); // Handles both public and auth routes (auth is per-route)
app.use("/api/payments/callback", paymentFeature.callbackRouter); // Public — provider redirect, no auth
app.use("/api/payments", authenticateJWT, paymentFeature.router);
app.use("/api/webhooks/payments", paymentFeature.webhookRouter); // Public webhook route
app.use("/api/webhooks/pharmacy", require("./features/pharmacy/routes/pharmacyWebhookRoutes")); // Pharmacy payment webhooks
app.use("/api/webhooks/vendor/promotions", require("./features/vendor/routes/promotionWebhookRoutes")); // Vendor promotion payment webhooks
app.use("/api/webhooks/vendor/orders",    require("./features/vendor/routes/orderWebhookRoutes"));    // Vendor order payment webhooks
app.use("/api/transactions", authenticateJWT, transactionFeature.router);
app.use("/api/support", authenticateJWT, supportFeature.router);

app.use("/api/faq", supportFeature.faqRouter);
app.use("/api/pharmacy", pharmacyFeature.router);
app.use("/api/compliance", complianceFeature.complianceRouter);
app.use("/api", documentsFeature.documentsRouter);
app.use("/api/firstaid", firstaidFeature.router);
app.use("/api/marketing", marketingFeature.router);
app.use("/api/services", serviceManagementFeature.router);
app.use("/api/admin/verification", adminVerificationRoutes);
app.use("/api/admin/logs", require("./features/admin/routes/logsRoute"));
app.use("/api/admin/ops", adminOpsFeature.router);
app.use("/api/analytics", analyticsFeature.router);
app.use("/api/vendor",   vendorFeature.router);
app.use("/api/shop",     shopFeature.router);
app.use("/api/cart",     cartFeature.router);


// ============================================
// LEGACY ROUTES (Backward Compatibility)
// These routes are deprecated and will be removed in v2.0
// ============================================
// app.use("/auth/mfa", legacyMfaRoutes);
// app.use("/auth", legacyAuthRoutes);
// app.use("/user", authenticateJWT, legacyUserRoutes);
// app.use("/doctor/verification", legacyDoctorVerificationRoutes);
// MOUNTED MANUALLY:
// app.use("/doctor/verification", require("./routes/legacy/doctorVerificationRoutes.compatibility"));

// ============================================
// OTHER ROUTES (To be refactored in future phases)
// ============================================
// app.use("/notifications", notificationRoutes); // Deprecated: Use /api/notifications
// app.use("/chat", authenticateJWT, chatRoutes); // Deprecated: Use /api/chat
// app.use("/chatbot", chatbotRoutes); // Deprecated: Use /api/chatbot
// app.use("/auth/mfa", mfaRoutes);
// app.use("/appointments", authenticateJWT, appointmentRoutes);
// app.use("/support", authenticateJWT, supportRoutes);
// app.use("/pharmacy", pharmacyRoutes);
if (legacyLabRoutesEnabled) {
    app.use("/lab", require("./features/LAB/routes"));
}
// app.use("/api/firstaid", firstaidRoutes);
// app.use('/api/sos', sosRoutes);
// app.use("/governance", dataGovernanceRoutes);
// app.use("/audit", auditRoutes);
// app.use("/consent", consentRoutes);
// app.use("/compliance", complianceRoutes);
app.use("/whatsapp", whatsappRoutesNotification);
app.use("/lab_pharm", waitlistRoute);

// app.use("/transactions/payments", paymentRoutes);
// app.use("/transactions/payment-methods", paymentMethodRoutes);
// app.use("/transactions/wallet", walletRoutes);
// app.use("/transactions/disputes", disputeRoutes);
// app.use("/subscription", subscriptionRoutes);
app.use("/search", search);
// app.use("/faq", faq);
// app.use('/marketing', marketingRoutes);
// app.use("/prescriptions", prescription);
// app.use('/referrals', authenticateJWT, referralRoutes);

// Static file serving for uploads
const uploadsPath = process.env.UPLOAD_DIRECTORY
    ? path.join(process.env.UPLOAD_DIRECTORY, 'images')
    : process.env.NODE_ENV === 'production'
        ? '/app/uploads/images'
        : path.join(__dirname, '../uploads/images');
// Force absolute path resolution if ENV is relative
const finalUploadsPath = (process.env.UPLOAD_DIRECTORY && !path.isAbsolute(process.env.UPLOAD_DIRECTORY))
    ? path.join(__dirname, '..', process.env.UPLOAD_DIRECTORY, 'images')
    : uploadsPath;

console.log('Static file serving /images from:', finalUploadsPath);
app.use('/images', express.static(finalUploadsPath));
app.use('/images', (req, res) => {
    // DEBUG: Enhanced 404 handler for images
    const fs = require('node:fs');
    const requestedPath = path.join(finalUploadsPath, req.path);

    console.log(`[DEBUG] Image 404: Request for ${req.originalUrl}`);
    console.log(`[DEBUG] Image 404: Static Root is ${finalUploadsPath}`);
    console.log(`[DEBUG] Image 404: Looking for ${requestedPath}`);

    let exists = false;
    let dirContents = [];
    let dirError = null;

    try {
        exists = fs.existsSync(requestedPath);
        if (fs.existsSync(finalUploadsPath)) {
            dirContents = fs.readdirSync(finalUploadsPath);
        } else {
            dirError = 'Static root directory does not exist';
        }
    } catch (e) {
        dirError = e.message;
    }

    console.log(`[DEBUG] Image 404: File exists? ${exists}`);
    if (dirContents.length > 0) {
        console.log(`[DEBUG] Image 404: Directory has ${dirContents.length} files. First 5: ${dirContents.slice(0, 5).join(', ')}`);
    }

    res.status(404).json({
        error: 'Image file not found',
        path: req.originalUrl,
        debug: {
            resolvedPath: finalUploadsPath,
            requestedFile: requestedPath,
            fileExists: exists,
            directoryExists: !dirError,
            directoryError: dirError,
            filesInDirectory: dirContents.slice(0, 10), // Show first 10 files
            totalFiles: dirContents.length,
            env: {
                UPLOAD_DIRECTORY: process.env.UPLOAD_DIRECTORY,
                NODE_ENV: process.env.NODE_ENV
            }
        }
    });
});

// Debug route
app.get('/debug-files', (req, res) => {
    const fs = require('node:fs');
    try {
        // Use the same path variable as the static middleware
        const files = fs.readdirSync(finalUploadsPath);
        res.json({
            status: 'success',
            resolvedPath: finalUploadsPath,
            cwd: process.cwd(),
            filesCount: files.length,
            // Show first 20 files
            files: files.slice(0, 20)
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            error: error.message,
            resolvedPath: finalUploadsPath,
            cwd: process.cwd()
        });
    }
});

// Protect /safe routes
// app.use("/safe", authenticateJWT, legacyAuthRoutes);

// ============================================
// ERROR HANDLING
// ============================================
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
    console.log(`404 - Route not found: ${req.method} ${req.originalUrl}`);
    res.status(404).json({
        error: 'Route not found',
        method: req.method,
        url: req.originalUrl,
        hint: 'Check /api-docs for available routes'
    });
});

// Route debugging (development only)
// if (process.env.NODE_ENV !== 'production') {
//     setTimeout(() => {
//         console.log('=== REGISTERED ROUTES ===');
//         app._router.stack.forEach((r) => {
//             if (r.route && r.route.path) {
//                 console.log(`${Object.keys(r.route.methods).join(',').toUpperCase()} ${r.route.path}`);
//             } else if (r.name === 'router') {
//                 r.handle.stack.forEach((nestedRoute) => {
//                     if (nestedRoute.route) {
//                         console.log(`${Object.keys(nestedRoute.route.methods).join(',').toUpperCase()} ${r.regexp.source.replace('\\/?(?=\\/|$)', '')}${nestedRoute.route.path}`);
//                     }
//                 });
//             }
//         });
//         console.log('=== END ROUTES ===');
//     }, 1000);
// }

module.exports = { app, httpServer };
