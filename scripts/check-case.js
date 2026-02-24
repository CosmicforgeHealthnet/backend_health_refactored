const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../src');

function findJsFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            findJsFiles(filePath, fileList);
        } else if (filePath.endsWith('.js') && !filePath.includes('node_modules')) {
            fileList.push(filePath);
        }
    }
    return fileList;
}

function checkExactCaseExists(filePath) {
    let currentPath = filePath;
    while (currentPath !== path.parse(currentPath).root) {
        const dir = path.dirname(currentPath);
        const base = path.basename(currentPath);

        if (!fs.existsSync(dir)) return false;

        const actualContents = fs.readdirSync(dir);
        if (!actualContents.includes(base)) {
            return false; // Case mismatch found!
        }

        currentPath = dir;
        if (currentPath === path.resolve(__dirname, '..')) break;
    }
    return true;
}

let hasError = false;
console.log("🔍 Running Pre-Push Validation: Checking internal imports for proper Case-Sensitivity...");
const jsFiles = findJsFiles(srcDir);

for (const file of jsFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    // Simple regex to grab relative require paths: require('./...') or require('../...')
    const requireRegex = /(?:require|loadSwaggerDoc)\(['"](\.[^'"]+)['"]\)/g;
    let match;

    while ((match = requireRegex.exec(content)) !== null) {
        const importStr = match[1];
        let resolvedRaw = path.resolve(path.dirname(file), importStr);

        // Possible extensions Node.js tries
        const possiblePaths = [
            resolvedRaw,
            resolvedRaw + '.js',
            resolvedRaw + '.json',
            path.join(resolvedRaw, 'index.js')
        ];

        let actualExistingPath = null;

        // Find what path actually resolves physically
        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                actualExistingPath = p;
                break;
            }
        }

        // Verify if the strict exact case matches
        if (actualExistingPath) {
            if (!checkExactCaseExists(actualExistingPath)) {
                console.error(`\n❌ CASE SENSITIVITY ERROR DETECTED`);
                console.error(`   File: ${file}`);
                console.error(`   Import: '${importStr}'`);
                console.error(`   The import path exists locally, but the uppercase/lowercase letters are wrong!`);
                console.error(`   This will CRASH the production Linux server 🚨`);
                hasError = true;
            }
        } else {
            console.warn(`\n⚠️  WARNING: BROKEN IMPORT DETECTED`);
            console.warn(`   File: ${file}`);
            console.warn(`   Import: '${importStr}'`);
            console.warn(`   This relative path does not exist on disk! It might be dead code.`);
        }
    }
}

if (hasError) {
    console.error(`\n❌ Pre-push check failed. Please fix the imports above to deploy safely.`);
    process.exit(1);
} else {
    console.log(`✅ Awesome! All ${jsFiles.length} files passed case-sensitivity checks. Ready for deploy!`);
    process.exit(0);
}
