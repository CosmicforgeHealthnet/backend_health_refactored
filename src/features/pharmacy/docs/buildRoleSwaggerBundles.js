// Converts patient-swagger.yaml and doctor-swagger.yaml into JSON bundles
// that app.js can load via loadSwaggerDoc().
// Run: node src/features/pharmacy/docs/buildRoleSwaggerBundles.js

const fs = require("fs-extra");
const YAML = require("yaml");
const path = require("node:path");

const docsDir = __dirname;

const roles = [
  { input: "patient-swagger.yaml", output: "patient-swagger.bundle.json" },
  { input: "doctor-swagger.yaml",  output: "doctor-swagger.bundle.json"  },
];

(async () => {
  for (const { input, output } of roles) {
    const inputPath  = path.join(docsDir, input);
    const outputPath = path.join(docsDir, output);

    const raw  = await fs.readFile(inputPath, "utf8");
    const doc  = YAML.parse(raw);

    await fs.writeJson(outputPath, doc, { spaces: 2 });
    console.log(`✅ ${output} written (${Object.keys(doc.paths || {}).length} paths)`);
  }
})();
