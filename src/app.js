// src/app.new.js
// NEW REFACTORED APP.JS - Feature-based architecture
// This file uses the new feature-based structure while maintaining backward compatibility

const express = require("express");
const { createServer } = require("node:http");
const cors = require("cors");
const path = require('node:path');
const archiver = require('archiver');
const swaggerUi = require("swagger-ui-express");

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
const labRoutes = require("./features/LAB/routes");
// const pharmacyRoutes = require("./routes/pharmacy/index");
// const firstaidRoutes = require('./routes/firstaid/index');
// const sosRoutes = require('./routes/firstaid/content/sosRoutes');

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
// const dataGovernanceRoutes = require('./routes/dataGovernanceRoutes');
// const auditRoutes = require('./routes/auditRoutes');
// const consentRoutes = require('./routes/consentRoutes');
// const complianceRoutes = require('./routes/complianceRoutes');
// const mfaRoutes = require("./routes/mfa/mfaRoutes");
// const referralRoutes = require('./routes/referralRoutes');
// const prescription = require('./routes/prescription/prescriptionRoutes');
const search = require("./features/search/routes/searchRoutes");
// const faq = require("./routes/faqRoutes");
const marketingFeature = require('./features/marketing');
const waitlistRoute = require("./features/marketing/routes/waitlistRoutes"); // Keep independent for legacy /lab_pharm
const whatsappRoutesNotification = require("./features/notifications/whatsapp/routes");
const adminVerificationRoutes = require("./features/auth/routes/adminVerificationRoutes");

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
const labSwaggerDoc = loadSwaggerDoc("./features/lab/docs/lab-swagger.bundle.json", "Lab");
const sosSwaggerDoc = loadSwaggerDoc("./features/firstaid/docs/sos-swagger.bundle.json", "SOS");

// ============================================
// GLOBAL MIDDLEWARE
// ============================================
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
    customSiteTitle: "CosmicForge Pharmacy API"
}));

app.use('/lab-docs', swaggerUi.serveFiles(labSwaggerDoc, {}), swaggerUi.setup(labSwaggerDoc, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: "CosmicForge Lab API",
    swaggerOptions: { docExpansion: 'none', persistAuthorization: true },
}));

app.use('/sos-docs', swaggerUi.serveFiles(sosSwaggerDoc, {}), swaggerUi.setup(sosSwaggerDoc, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: "CosmicForge SOS Emergency API"
}));

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
            lab: "/lab-docs",
            sos: "/sos-docs"
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
app.use("/api/doctor", doctorFeature.router);
app.use("/api/appointments", authenticateJWT, appointmentFeature.router);
app.use("/api/chat", authenticateJWT, chatFeature.router);
app.use("/api/chatbot", authenticateJWT, chatFeature.chatbotRouter);
app.use("/api/notifications", authenticateJWT, notificationFeature.router);
app.use("/api/subscription", authenticateJWT, subscriptionFeature.router);
app.use("/api/payments", authenticateJWT, paymentFeature.router);
app.use("/api/webhooks/payments", paymentFeature.webhookRouter); // Public webhook route
app.use("/api/transactions", authenticateJWT, transactionFeature.router);
app.use("/api/support", authenticateJWT, supportFeature.router);

app.use("/api/faq", supportFeature.faqRouter);
app.use("/api/pharmacy", pharmacyFeature.router);
app.use("/api/compliance", complianceFeature.complianceRouter);
app.use("/api", documentsFeature.documentsRouter);
app.use("/api/firstaid", firstaidFeature.router);
app.use("/api/marketing", marketingFeature.router);
app.use("/api/admin/verification", adminVerificationRoutes);


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
app.use("/lab", labRoutes);
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
