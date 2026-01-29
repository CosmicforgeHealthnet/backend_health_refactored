const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

// Configuration
const NEW_PROJECT_ROOT = path.join(__dirname, '../../');
const OUTPUT_FILE = path.join(NEW_PROJECT_ROOT, 'testing_matrix.xlsx');

// --- REUSED SCAN LOGIC ---
function findControllerPath(fileContent, controllerVar) {
    if (!controllerVar || typeof controllerVar !== 'string') return controllerVar;
    const safeVar = controllerVar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    try {
        const regex = new RegExp(`const\\s+${safeVar}\\s*=\\s*require\\(['"](.+)['"]\\)`);
        const match = fileContent.match(regex);
        if (match) {
            const importPath = match[1];
            return path.basename(importPath, '.js');
        }
    } catch (e) { }
    return controllerVar;
}

function scanRouteFile(filePath, basePath = '', routes = []) {
    if (!fs.existsSync(filePath)) return routes;
    let content = fs.readFileSync(filePath, 'utf-8');

    // Feature Name
    let featureName = 'Shared';
    if (filePath.includes('/features/')) {
        const parts = filePath.split('/features/');
        featureName = parts[1].split('/')[0];
        featureName = featureName.charAt(0).toUpperCase() + featureName.slice(1);
    }

    // Normalize
    content = content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').replace(/\s+/g, ' ');

    const routeRegex = /router\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]\s*,\s*(.+?)\s*\)/g;
    let match;
    while ((match = routeRegex.exec(content)) !== null) {
        const method = match[1].toUpperCase();
        const routePath = match[2];
        const argsBody = match[3];

        let fullPath = basePath + (routePath === '/' ? '' : routePath);
        fullPath = fullPath.replace(/\/\//g, '/');

        routes.push({ feature: featureName, method, path: fullPath });
    }
    return routes;
}

console.log('Scanning codebase for Testing Matrix...');
const newRoutes = [];
const featuresDir = path.join(NEW_PROJECT_ROOT, 'src/features');

if (fs.existsSync(featuresDir)) {
    const features = fs.readdirSync(featuresDir);
    features.forEach(feature => {
        const routesDir = path.join(featuresDir, feature, 'routes');
        if (fs.existsSync(routesDir)) {
            function walkJs(dir, list = []) {
                if (fs.existsSync(dir)) {
                    const files = fs.readdirSync(dir);
                    files.forEach(f => {
                        const fp = path.join(dir, f);
                        if (fs.statSync(fp).isDirectory()) walkJs(fp, list);
                        else if (f.endsWith('.js')) list.push(fp);
                    });
                }
                return list;
            }
            const files = walkJs(routesDir);
            files.forEach(filepath => {
                let prefix = `/api/${feature.toLowerCase()}`;
                // Manual Fixes
                if (feature === 'auth') prefix = '/api/auth';
                if (feature === 'patient') prefix = '/api/patient';
                if (feature === 'doctor') prefix = '/api/doctor';
                if (filepath.includes('adminVerification')) prefix = '/admin';
                if (feature === 'LAB') prefix = '/lab';
                if (filepath.includes('waitlist')) prefix = '/lab_pharm';
                if (feature === 'search') prefix = '/search';
                scanRouteFile(filepath, prefix, newRoutes);
            });
        }
    });
}

// Prepare Data for Excel
const header = ['Feature', 'Method', 'Route', 'Web Dev Testing', 'Mobile App Testing', 'Dema Testing', 'Daniel Testing', 'Notes'];
const data = [header];

newRoutes.sort((a, b) => a.feature.localeCompare(b.feature));

newRoutes.forEach(r => {
    data.push([
        r.feature,
        r.method,
        r.path,
        'Pending', // Default Status
        'Pending',
        'Pending',
        'Pending',
        ''
    ]);
});

// Create Worksheet
const ws = XLSX.utils.aoa_to_sheet(data);

// Define Dropdown Options (Data Validation)
// Note: SheetJS Community Edition writing validation is rudimentary. 
// We will try to add it manually to the worksheet object if possible, 
// strictly per OpenXML spec which SheetJS tries to support.
// Target Columns: D, E, F, G (indices 3, 4, 5, 6)
// Rows: 2 to data.length

const endRow = data.length;
const range = { s: { r: 1, c: 3 }, e: { r: endRow - 1, c: 6 } }; // 0-indexed, skip header (row 0)

// Attempt to add data validation (this might be ignored by some writers but standard for XLSX)
if (!ws['!dataValidation']) ws['!dataValidation'] = [];

for (let r = 1; r < endRow; r++) {
    for (let c = 3; c <= 6; c++) {
        const cellRef = XLSX.utils.encode_cell({ r, c });
        // We can't attach validation to cell directly in simple SheetJS CE often, 
        // but let's try pushing to the global list if the version supports it.
        // Actually, valid structure is typically array of objects with sqref
    }
}

// Validations logic for SheetJS is complex without Pro. 
// Instead, let's create a "Legend" sheet to make it clear.
// But we will stick to pre-filling "Pending".

// Column Widths
const wscols = [
    { wch: 15 }, // Feature
    { wch: 8 },  // Method
    { wch: 40 }, // Route
    { wch: 15 }, // Web
    { wch: 15 }, // Mobile
    { wch: 15 }, // Dema
    { wch: 15 }, // Daniel
    { wch: 20 }  // Notes
];
ws['!cols'] = wscols;

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Testing Matrix");

XLSX.writeFile(wb, OUTPUT_FILE);
console.log(`Generated Testing Matrix XLSX at ${OUTPUT_FILE} with ${newRoutes.length} rows.`);
