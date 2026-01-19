const fs = require("fs-extra");
const YAML = require("yaml");
const path = require("path");
require('dotenv').config();

(async () => {
  try {
    console.log("🚀 Starting Feature-Based Swagger bundle process...");

    const baseDir = __dirname;
    const projectRoot = path.join(__dirname, "../.."); // src/docs -> src -> root
    const srcDir = path.join(__dirname, "../");

    // 1. Recursive file finder
    async function findYamlFiles(dir, fileList = []) {
      if (!await fs.pathExists(dir)) return fileList;
      const files = await fs.readdir(dir);

      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = await fs.stat(filePath);

        if (stat.isDirectory()) {
          // Skip node_modules or excludes if needed
          if (file !== 'node_modules' && file !== '.git') {
            await findYamlFiles(filePath, fileList);
          }
        } else {
          if (file.endsWith('.yaml') || file.endsWith('.yml')) {
            // Exclude generated files
            if (file !== 'swagger.yaml' && file !== 'swagger-backup.yaml') {
              fileList.push(filePath);
            }
          }
        }
      }
      return fileList;
    }

    // 2. Define search paths
    const searchDirs = [
      path.join(srcDir, "features"),
      path.join(srcDir, "shared/docs"),
      path.join(srcDir, "docs") // For leftovers like components.yaml
    ];

    console.log("📁 Scanning directories for YAML files...");
    let allYamlFiles = [];
    for (const dir of searchDirs) {
      const files = await findYamlFiles(dir);
      allYamlFiles = [...allYamlFiles, ...files];
    }

    // De-duplicate
    allYamlFiles = [...new Set(allYamlFiles)];
    console.log(`✅ Found ${allYamlFiles.length} YAML files.`);

    // 3. Setup Base Doc
    const openApiDoc = {
      openapi: "3.0.3",
      info: {
        title: "CosmicForge Health API",
        version: "1.0.0",
        description: "API for doctor verification and health management system",
      },
      servers: (() => {
        const environment = process.env.NODE_ENV || 'development';
        const port = process.env.PORT || '3000';
        if (environment === 'production') {
          return [{ url: process.env.PROD_BACKEND_URL || "https://api.cosmicforge.com", description: "Production server" }];
        } else {
          return [{ url: process.env.DEV_BACKEND_URL || `http://localhost:${port}`, description: "Development server" }];
        }
      })(),
      paths: {},
      components: {
        schemas: {},
        parameters: {},
        responses: {},
        securitySchemes: {},
      },
    };

    // 4. Load components.yaml first (Base components)
    const componentsPath = path.join(baseDir, "components.yaml");
    if (await fs.pathExists(componentsPath)) {
      console.log("📁 Loading base components.yaml...");
      const mainComponents = YAML.parse(await fs.readFile(componentsPath, "utf8"));
      if (mainComponents.components) {
        Object.assign(openApiDoc.components.schemas, mainComponents.components.schemas || {});
        Object.assign(openApiDoc.components.parameters, mainComponents.components.parameters || {});
        Object.assign(openApiDoc.components.responses, mainComponents.components.responses || {});
        Object.assign(openApiDoc.components.securitySchemes, mainComponents.components.securitySchemes || {});
      }
      // Remove from list to avoid double loading
      allYamlFiles = allYamlFiles.filter(p => path.resolve(p) !== path.resolve(componentsPath));
    }

    // 5. Load all other files
    console.log("📁 Merging all YAML files...");
    for (const filePath of allYamlFiles) {
      try {
        const content = YAML.parse(await fs.readFile(filePath, "utf8"));

        // Merge Paths
        if (content.paths) {
          Object.assign(openApiDoc.paths, content.paths);
        }
        // Merge Components
        if (content.components) {
          Object.assign(openApiDoc.components.schemas, content.components.schemas || {});
          Object.assign(openApiDoc.components.parameters, content.components.parameters || {});
          Object.assign(openApiDoc.components.responses, content.components.responses || {});
          Object.assign(openApiDoc.components.securitySchemes, content.components.securitySchemes || {});
        }
      } catch (err) {
        console.warn(`⚠️  Error parsing ${path.basename(filePath)}: ${err.message}`);
      }
    }

    // 6. Add Common Schemas (Preserved from original script)
    const commonResponseSchemas = {
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
    Object.assign(openApiDoc.components.schemas, commonResponseSchemas);

    // 7. Fix Refs (The Critical Part)
    console.log("\n🔧 Fixing broken $ref paths...");
    const fixRefs = (obj) => {
      if (typeof obj === 'object' && obj !== null) {
        for (const key in obj) {
          if (key === '$ref' && typeof obj[key] === 'string') {
            const oldRef = obj[key];
            let newRef = obj[key];

            // Aggressively flatten all external references to local #/components/...
            // Regex: match any relative path ending in .yaml#... or just file.yaml#...
            // Replace everything before # with nothing (since we merged everything)

            // Pattern 1: ../components/foo.yaml#/components/schemas/Bar -> #/components/schemas/Bar
            if (newRef.includes('.yaml')) {
              const parts = newRef.split('#');
              if (parts.length > 1) {
                newRef = '#' + parts[1];
              }
            }
            // Pattern 2: ../anything/something#Foo -> #Foo (less common but possible)

            if (newRef !== oldRef) {
              obj[key] = newRef;
            }
          } else {
            fixRefs(obj[key]);
          }
        }
      }
    };
    fixRefs(openApiDoc);

    // 8. Generate Output
    console.log("\n📝 Generating output...");
    const finalYaml = YAML.stringify(openApiDoc, { indent: 2, lineWidth: 0, minContentWidth: 0 });
    const outputPath = path.join(baseDir, "swagger.yaml");
    await fs.writeFile(outputPath, finalYaml);

    // JSON Bundle
    const jsonBundlePath = path.join(baseDir, "swagger.bundle.json");
    await fs.writeFile(jsonBundlePath, JSON.stringify(openApiDoc, null, 2));

    console.log(`✅ Success! Bundle saved to ${jsonBundlePath}`);
    console.log(`   Paths: ${Object.keys(openApiDoc.paths).length}`);
    console.log(`   Schemas: ${Object.keys(openApiDoc.components.schemas).length}`);

  } catch (err) {
    console.error("❌ Fatal Error:", err);
    process.exit(1);
  }
})();