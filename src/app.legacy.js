// app.js
const express = require("express");
const { createServer } = require("node:http");
const { Server } = require("socket.io");
const swaggerUi = require("swagger-ui-express");
const config = require("./config");
const cors = require("cors");
const path = require('node:path');
const archiver = require('archiver');
// const swaggerDoc = require("./docs/swagger.bundle.json");

// Routes
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const documentRoutes = require("./routes/documentRoutes");

// In your main app.js or router file - IMPORTANT: Add this BEFORE your /api routes
const DocumentFileController = require("./controllers/documentFileController");
const chatRoutes = require("./routes/chatRoutes");
const chatbotRoutes = require("./routes/chatbotRoutes");
const files = require("./routes/fileRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const doctorVerificationRoutes = require("./routes/doctorVerificationRoutes");
const adminVerificationRoutes = require("./routes/adminVerificationRoutes");
const appointmentRoutes = require("./routes/appointmentRoutes");
const subscriptionRoutes = require("./routes/subscriptionRoutes");
const supportRoutes = require("./routes/supportRoutes");
const dynamicCurrecy = require('./routes/dynamicCurrencyRoutes');
const ChatSocketHandler = require("./websocket/chatSocket");

//payment routes
const paymentRoutes = require("./routes/transactions/paymentRoutes");
const paymentMethodRoutes = require("./routes/transactions/paymentMethodRoutes");
const walletRoutes = require("./routes/transactions/walletRoutes");
const disputeRoutes = require("./routes/transactions/disputeRoutes");
const pharmacyRoutes = require("./routes/pharmacy/index");
const labRoutes = require("./features/LAB/routes")
// Import the new FHIR compliance routes
const fhirRoutes = require('./routes/fhirRoutes');
const dataGovernanceRoutes = require('./routes/dataGovernanceRoutes');
const auditRoutes = require('./routes/auditRoutes');
const consentRoutes = require('./routes/consentRoutes');
const complianceRoutes = require('./routes/complianceRoutes');
// const analyticsRoutes = require('./routes/analyticsRoutes');

const whatsappRoutesNotification = require("./features/NOTIFICATION/whatsapp/routes");


const marketingRoutes = require('./routes/marketingRoutes');

const mfaRoutes = require("./routes/mfa/mfaRoutes");
const sosRoutes = require('./routes/firstaid/content/sosRoutes');

// Import routes
const referralRoutes = require('./routes/referralRoutes');
// const referralDrawRoutes = require('./src/routes/referralDrawRoutes');

//prescriptions 
const prescription = require('./routes/prescription/prescriptionRoutes');

// Import middlewares
// const ReferralMiddleware = require('./src/middlewares/referralMiddleware');
// const referralMiddleware = new ReferralMiddleware();

//search route 
const search = require("./routes/searchRoutes");

//FAQ
const faq = require("./routes/faqRoutes");

// Fast Healthcare interoperationbility request
// const fhirRoutes = require('./routes/fhirRoutes');

//firstaid route 
const firstaid = require('./routes/firstaid/index')

//waitlist route
const waitlistRoute = require("./routes/waitlistRoutes");


// Middleware
const { authenticateJWT } = require("./middlewares/authMiddleware");

// WebSocket
const { initWebSocket } = require("./config/websocket");

// Notification socket instance
// const {
//   createNotificationSocket,
// } = require("./services/notificationSocketInstance");
const checkUserTier = require("./middlewares/checkUserTier");

const app = express();

const httpServer = createServer(app);

// Serve static files from the "public" directory
app.use(express.static("public"));

// Initialize WebSocket and get the io instance
const io = initWebSocket(httpServer);

// Initialize notification socket instance
// createNotificationSocket(io);

// Initialize chat
const chatSocketHandler = new ChatSocketHandler(io);
chatSocketHandler.initialize();


const loadSwaggerDoc = (path, title) => {
  try {
    const doc = require(path);
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
    console.warn(`⚠️ ${title} swagger bundle not found. Run: npm run build:${title.toLowerCase()}-swagger`);
    return {
      openapi: "3.0.3",
      info: { title: `${title} API`, version: "1.0.0" },
      paths: {}
    };
  }
};
const sosSwaggerDoc = loadSwaggerDoc("./firstaid/docs/sos-swagger.bundle.json", "SOS");
const pharmacySwaggerDoc = loadSwaggerDoc("./pharmacy/pharmacy-swagger.bundle.json", "Pharmacy");
const labSwaggerDoc = loadSwaggerDoc("./features/LAB/docs/lab-swagger.bundle.json", "Lab");
const swaggerDoc = loadSwaggerDoc("./docs/swagger.bundle.json", "Index");


// CORS
app.use(
  cors({
    origin: config.corsOrigins,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
  })
);

app.options("*", cors());

// Make io available to routes
app.set("io", io);

// JSON Body Parser
app.use(express.json());

// 🔥 ADD THIS LINE HERE
const { getLocationFromIP } = require("./middlewares/locationMiddleware");
app.use(getLocationFromIP);

// Add this global response middleware
app.use((req, res, next) => {
  const originalJson = res.json;
  
  res.json = function(data) {
    // Only add location if response is successful and has data
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

// ----------------------- PLEASE DONT UNCOMMET THIS ---------------------------------------------------- //
// app.use(getLocationFromIPCached); --- if the trafic get to high (lunch day)
// Why You'll Need getClientIP:

// Security logging - Track suspicious IPs
// Rate limiting - Limit requests per IP
// Analytics - User geographic analytics     ----- DONT UNCOMMET OR DELETE THIS COMMENT ------
// Search logging - Add IP to search logs
// Admin dashboards - Show user locations

// Log searches with IP
// async logSearch(query, userRole, req) {
//   const userIP = getClientIP(req);
//   // Save search with IP for analytics
// }

// In security middleware
// const userIP = getClientIP(req);
// if (isSuspiciousIP(userIP)) {
//   // Block or flag request
// }

// ----------------------- PLEASE DONT UNCOMMET THIS ---------------------------------------------------- //

// Main API
// // Main Swagger
// app.use(
//   "/api-docs",
//   swaggerUi.serve,
//   swaggerUi.setup(swaggerDoc, {
//     customCss: '.swagger-ui .topbar { display: none }',
//     customSiteTitle: "CosmicForge Main API"
//   })
// );

// app.get('/api-docs', (req, res) => {
//   res.send(swaggerUi.generateHTML(swaggerDoc, {
//     customCss: '.swagger-ui .topbar { display: none }',
//     customSiteTitle: "CosmicForge Pharmacy API"
//   }));
// } );

// // Pharmacy API - use a completely different path
// app.use("/pharmacy-docs", swaggerUi.serve);
// app.get("/pharmacy-docs", (req, res) => {
//   res.send(swaggerUi.generateHTML(pharmacySwaggerDoc, {
//     customCss: '.swagger-ui .topbar { display: none }',
//     customSiteTitle: "CosmicForge Pharmacy API"
//   }));
// });

// // Lab Swagger
// app.use(
//   "/lab-docs",
//   swaggerUi.serve,
//   swaggerUi.setup(labSwaggerDoc, {
//     customCss: '.swagger-ui .topbar { display: none }',
//     customSiteTitle: "CosmicForge Lab API"
//   })
// );

// Main API Docs
// Main API
app.use('/api-docs', swaggerUi.serveFiles(swaggerDoc, {}), swaggerUi.setup(swaggerDoc, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: "CosmicForge Main API",
  swaggerOptions: {
    docExpansion: 'none', // 👈 fully collapsed
    persistAuthorization: true, // optional: keeps auth token
  },
}));

// Pharmacy API  
app.use('/pharmacy-docs', swaggerUi.serveFiles(pharmacySwaggerDoc, {}), swaggerUi.setup(pharmacySwaggerDoc, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: "CosmicForge Pharmacy API"
}));

// Lab API
app.use('/lab-docs', swaggerUi.serveFiles(labSwaggerDoc, {}), swaggerUi.setup(labSwaggerDoc, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: "CosmicForge Lab API",
  swaggerOptions: {
    docExpansion: 'none', // 👈 fully collapsed
    persistAuthorization: true, // optional: keeps auth token
  },
}));


app.use('/sos-docs', swaggerUi.serveFiles(sosSwaggerDoc, {}), swaggerUi.setup(sosSwaggerDoc, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: "CosmicForge SOS Emergency API"
}));
// app.use('/images', express.static(path.join(__dirname, 'uploads/images')));


// Welcome route
app.get("/", (req, res) => {
    res.json({
        message: "Welcome to the CosmicForge Health Backend!",
        swagger: {
            main: "/api-docs",
            pharmacy: "/pharmacy-docs",
            lab: "/lab-docs",
            sos: "/sos-docs"
        }
    });
});
// app.get("/", (req, res) => {
//   res.json({
//     message: "Welcome to the CosmicForge Health Backend!",
//     swagger: {
//       main: "/api-docs",
//       pharmacy: "/pharmacy-docs"
//     }
//   });
// });

app.get("/premium-only", checkUserTier("premium"), (req, res) => {
  res.send("Welcome Premium user!");
});

// File serving route (no authentication required for signed URLs)
app.get("/files/:fileId", DocumentFileController.serveFile);

app.get('/download-uploads', async (req, res) => {
     const archive = archiver('zip', { zlib: { level: 9 } });
     res.attachment('uploads.zip');
     archive.pipe(res);
     archive.directory('/opt/render/project/uploads', false);
     await archive.finalize();
   });

// Mount routes
app.use("/auth", authRoutes);
app.use("/user", authenticateJWT, userRoutes);
app.use("/notifications", notificationRoutes);
app.use("/doctor/verification", doctorVerificationRoutes);
app.use("/chat", authenticateJWT, chatRoutes);
app.use("/chatbot", chatbotRoutes);
app.use("/auth/mfa", mfaRoutes);
app.use("/appointments", authenticateJWT, appointmentRoutes);
app.use("/support", authenticateJWT, supportRoutes);

app.use("/notifications", authenticateJWT, notificationRoutes);
app.use("/doctor/verification", doctorVerificationRoutes);
app.use("/admin/verification", adminVerificationRoutes);
app.use("/admin", adminVerificationRoutes); // This handles /admin/documents/*
app.use("/pharmacy", pharmacyRoutes);
app.use("/lab", labRoutes);
app.use("/api/firstaid", firstaid);
app.use('/api/sos', sosRoutes);
app.use("/dynamicCurrency", dynamicCurrecy);

//
// Add these with your other app.use statements
app.use("/fhir", fhirRoutes);
app.use("/governance", dataGovernanceRoutes);
app.use("/audit", auditRoutes);
app.use("/consent", consentRoutes);
app.use("/compliance", complianceRoutes);
// app.use("/analytics", analyticsRoutes);

//notification - whatsapp
app.use("/whatsapp", whatsappRoutesNotification);

//waitlist
app.use("/lab_pharm", waitlistRoute);




app.get('/debug-files', (req, res) => {
  const fs = require('node:fs');
  try {
    const files = fs.readdirSync('../uploads/images');
    res.json({ files, cwd: process.cwd() });
  } catch (error) {
    res.json({ error: error.message, cwd: process.cwd() });
  }
});

// In your app.js
const uploadsPath = process.env.NODE_ENV === 'production' 
  ? '/opt/render/project/uploads/images'  // Render production path
  : path.join(__dirname, '../uploads/images');  // Local development path

app.use('/images', express.static(uploadsPath));

app.use("/api/documents", documentRoutes);

//static server 
// payment routes
app.use("/transactions/payments", paymentRoutes);
app.use("/transactions/payment-methods", paymentMethodRoutes);
app.use("/transactions/wallet", walletRoutes);
app.use("/transactions/disputes", disputeRoutes);

app.use("/subscription", subscriptionRoutes);
app.use("/search", search);
app.use("/faq", faq);
// CHDA has been removed
app.use('/marketing', marketingRoutes);
app.use("/prescriptions", prescription);

//referral
app.use('/referrals', authenticateJWT, referralRoutes);

// Optional: Protect everything under /safe
app.use("/safe", authenticateJWT, authRoutes);

// Global error handling middleware
const errorHandler = require('./utils/errorHandler');
app.use(errorHandler);

// Add after all routes are registered
app.use('*', (req, res) => {
  console.log(`404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ 
    error: 'Route not found', 
    method: req.method, 
    url: req.originalUrl,
    availableRoutes: 'Check server logs'
  });
});

// Add this after route registration
setTimeout(() => {
  console.log('=== REGISTERED ROUTES ===');
  app._router.stack.forEach((r) => {
    if (r.route && r.route.path) {
      console.log(`${Object.keys(r.route.methods).join(',').toUpperCase()} ${r.route.path}`);
    } else if (r.name === 'router') {
      r.handle.stack.forEach((nestedRoute) => {
        if (nestedRoute.route) {
          console.log(`${Object.keys(nestedRoute.route.methods).join(',').toUpperCase()} ${r.regexp.source.replace('\\/?(?=\\/|$)', '')}${nestedRoute.route.path}`);
        }
      });
    }
  });
  console.log('=== END ROUTES ===');
}, 1000);

module.exports = { app, httpServer };