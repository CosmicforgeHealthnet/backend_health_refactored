// src/docs/lab/labSwaggerMerger.js
const fs = require("fs-extra");
const YAML = require("yaml");
const path = require("node:path");

(async () => {
  try {
    console.log("🚀 Starting lab Swagger bundle process...");

    const baseDir = __dirname;
    
    // Base OpenAPI structure for lab
    const labApiDoc = {
      openapi: "3.0.3",
      info: {
        title: "CosmicForge Lab Management API",
        version: "1.0.0",
        description: "API for lab facility management, personnel management, and lab operations",
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

    // Load lab component files
    const componentFiles = [
      "facilities/components.yaml",
      "personnel/components.yaml", 
      "admin/components.yaml",
      "orders/components.yaml",
      "wallet/components.yaml",
      "waitlist/components.yaml"
    ];

    for (const componentFile of componentFiles) {
      const filePath = path.join(baseDir, componentFile);
      if (await fs.pathExists(filePath)) {
        try {
          const component = YAML.parse(await fs.readFile(filePath, "utf8"));
          if (component.components) {
            Object.assign(labApiDoc.components.schemas, component.components.schemas || {});
            Object.assign(labApiDoc.components.parameters, component.components.parameters || {});
            Object.assign(labApiDoc.components.responses, component.components.responses || {});
          }
          console.log(`✅ Loaded ${componentFile}`);
        } catch (err) {
          console.log(`⚠️ Error loading ${componentFile}: ${err.message}`);
        }
      }
    }

    // Load lab path files
    const pathFiles = [
      "facilities/paths.yaml",
      "personnel/paths.yaml",
      "admin/paths.yaml",
      "orders/paths.yaml",
      "wallet/paths.yaml",
      "waitlist/path.yaml"
    ];

    for (const pathFile of pathFiles) {
      const pathFilePath = path.join(baseDir, pathFile);
      if (await fs.pathExists(pathFilePath)) {
        try {
          const pathContent = YAML.parse(await fs.readFile(pathFilePath, "utf8"));
          if (pathContent.paths) {
            Object.assign(labApiDoc.paths, pathContent.paths);
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
      },
      ValidationError: {
        type: "object",
        properties: {
          success: { type: "boolean", example: false },
          error: { type: "string", example: "Validation failed" },
          details: {
            type: "array",
            items: {
              type: "object",
              properties: {
                field: { type: "string" },
                message: { type: "string" },
                value: { type: "string" }
              }
            }
          }
        },
        required: ["success", "error"]
      }
    };

    Object.assign(labApiDoc.components.schemas, commonSchemas);

    // Add reference to main auth endpoints
    labApiDoc.paths["/auth/verify-email"] = {
      get: {
        summary: "Verify email token (use main auth endpoint)",
        description: "Use the main application's email verification endpoint: GET /auth/verify-email",
        tags: ["LabAuth"],
        responses: {
          "200": { description: "See main auth documentation" }
        }
      }
    };

    labApiDoc.paths["/auth/login"] = {
      post: {
        summary: "Login (use main auth endpoint)",
        description: "Use the main application's login endpoint: POST /auth/login",
        tags: ["LabAuth"],
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

    fixRefs(labApiDoc);

    // Generate output files
    const finalYaml = YAML.stringify(labApiDoc, { indent: 2 });
    
    await fs.writeFile(path.join(baseDir, "lab-swagger.yaml"), finalYaml);
    await fs.writeFile(path.join(baseDir, "lab-swagger.bundle.json"), JSON.stringify(labApiDoc, null, 2));

    console.log("✅ Lab Swagger bundle created successfully!");
    console.log(`   Total paths: ${Object.keys(labApiDoc.paths).length}`);
    console.log(`   Total schemas: ${Object.keys(labApiDoc.components.schemas).length}`);

  } catch (err) {
    console.error("❌ Lab bundle error:", err);
    process.exit(1);
  }
})();

