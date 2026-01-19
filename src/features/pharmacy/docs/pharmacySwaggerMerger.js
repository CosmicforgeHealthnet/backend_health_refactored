// src/docs/pharmacy/pharmacySwaggerMerger.js
const fs = require("fs-extra");
const YAML = require("yaml");
const path = require("node:path");

(async () => {
  try {
    console.log("🚀 Starting pharmacy Swagger bundle process...");

    const baseDir = __dirname;
    
    // Base OpenAPI structure for pharmacy
    const pharmacyApiDoc = {
      openapi: "3.0.3",
      info: {
        title: "CosmicForge Pharmacy API",
        version: "1.0.0",
        description: "API for pharmacy management, registration, and verification",
      },
      servers: [
        {
          url: process.env.NODE_ENV === 'production' 
            ? process.env.PROD_BACKEND_URL || "https://api.cosmicforge.com"
            : `http://localhost:${process.env.PORT || '3000'}`,
          description: process.env.NODE_ENV === 'production' ? "Production server" : "Development server",
        }
      ],
      paths: {},
      components: {
        schemas: {},
        parameters: {},
        responses: {},
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT"
          }
        },
      },
    };

    // Load pharmacy component files
    const componentFiles = [
      "auth/pharmacyAuthComponents.yaml",
      "documents/pharmacyDocumentComponents.yaml", 
      "admin/pharmacyAdminComponents.yaml",
      "prescription/prescriptionComponents.yaml"
    ];

    for (const componentFile of componentFiles) {
      const filePath = path.join(baseDir, componentFile);
      if (await fs.pathExists(filePath)) {
        try {
          const component = YAML.parse(await fs.readFile(filePath, "utf8"));
          if (component.components) {
            Object.assign(pharmacyApiDoc.components.schemas, component.components.schemas || {});
            Object.assign(pharmacyApiDoc.components.parameters, component.components.parameters || {});
            Object.assign(pharmacyApiDoc.components.responses, component.components.responses || {});
          }
          console.log(`✅ Loaded ${componentFile}`);
        } catch (err) {
          console.log(`⚠️ Error loading ${componentFile}: ${err.message}`);
        }
      }
    }

    // Load pharmacy path files
    const pathFiles = [
      "auth/pharmacyAuth.yaml",
      "documents/pharmacyDocuments.yaml",
      "admin/pharmacyAdmin.yaml",
      "prescription/prescription.yaml"
    ];

    for (const pathFile of pathFiles) {
      const pathFilePath = path.join(baseDir, pathFile);
      if (await fs.pathExists(pathFilePath)) {
        try {
          const pathContent = YAML.parse(await fs.readFile(pathFilePath, "utf8"));
          if (pathContent.paths) {
            Object.assign(pharmacyApiDoc.paths, pathContent.paths);
            console.log(`✅ Loaded paths from ${pathFile}`);
          }
        } catch (err) {
          console.log(`⚠️ Error loading ${pathFile}: ${err.message}`);
        }
      }
    }

    // Add common response schemas
    const commonSchemas = {
      SuccessResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          message: { type: "string", example: "Operation completed successfully" },
          data: { type: "object" }
        },
        required: ["success", "message"]
      },
      ErrorResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: false },
          message: { type: "string", example: "An error occurred" },
          error: { type: "string" }
        },
        required: ["success", "message"]
      }
    };

    Object.assign(pharmacyApiDoc.components.schemas, commonSchemas);

    // Add reference to main auth endpoints
    pharmacyApiDoc.paths["/auth/verify-email"] = {
      get: {
        summary: "Verify email token (use main auth endpoint)",
        description: "Use the main application's email verification endpoint: GET /auth/verify-email",
        tags: ["PharmacyAuth"],
        responses: {
          "200": { description: "See main auth documentation" }
        }
      }
    };

    pharmacyApiDoc.paths["/auth/resend-verification"] = {
      post: {
        summary: "Resend verification email (use main auth endpoint)",
        description: "Use the main application's resend verification endpoint: POST /auth/resend-verification",
        tags: ["PharmacyAuth"],
        responses: {
          "200": { description: "See main auth documentation" }
        }
      }
    };

    // Fix $ref paths
    const fixRefs = (obj) => {
      if (typeof obj === 'object' && obj !== null) {
        for (const key in obj) {
          if (key === '$ref' && typeof obj[key] === 'string') {
            let newRef = obj[key];
            newRef = newRef.replace(/^\.\/[^#]+#/, '#');
            newRef = newRef.replace(/^\.\.\/[^#]+#/, '#');
            obj[key] = newRef;
          } else {
            fixRefs(obj[key]);
          }
        }
      }
    };

    fixRefs(pharmacyApiDoc);

    // Generate output files
    const finalYaml = YAML.stringify(pharmacyApiDoc, { indent: 2 });
    
    await fs.writeFile(path.join(baseDir, "pharmacy-swagger.yaml"), finalYaml);
    await fs.writeFile(path.join(baseDir, "pharmacy-swagger.bundle.json"), JSON.stringify(pharmacyApiDoc, null, 2));

    console.log("✅ Pharmacy Swagger bundle created successfully!");
    console.log(`   Total paths: ${Object.keys(pharmacyApiDoc.paths).length}`);
    console.log(`   Total schemas: ${Object.keys(pharmacyApiDoc.components.schemas).length}`);

  } catch (err) {
    console.error("❌ Pharmacy bundle error:", err);
    process.exit(1);
  }
})();

// Add this to package.json scripts:
// "build:pharmacy-swagger": "node src/docs/pharmacy/pharmacySwaggerMerger.js"