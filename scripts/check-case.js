const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const srcDir = path.join(__dirname, '../src');
const repoRoot = path.resolve(__dirname, '..');

// Build map: lowercase_rel_path → exact_git_rel_path
// This gives us the ground truth about what casing git/Linux will use.
const gitFileMap = new Map();
try {
    const output = execSync('git ls-files src/', { cwd: repoRoot, encoding: 'utf-8' });
    for (const line of output.trim().split('\n')) {
        if (line) gitFileMap.set(line.toLowerCase(), line);
    }
} catch (e) { /* git unavailable — will fall back to filesystem check */ }

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

/**
 * Check case-sensitivity using git as the source of truth.
 *
 * Only the FORWARD segments of the import string are verified — segments
 * inherited from the importer's own directory are excluded, because those
 * are not under the author's control at the point of writing the import.
 *
 * isDirectoryImport: true when the import resolved via <dir>/index.js lookup
 * (i.e. the import string doesn't end with 'index' but the file is index.js).
 * In that case we strip the trailing /index.js from the git path before comparing.
 */
function checkImportCasing(importStr, resolvedAbsPath, isDirectoryImport) {
    if (!gitFileMap.size) {
        return checkFilesystemCasing(resolvedAbsPath);
    }

    const rel = path.relative(repoRoot, resolvedAbsPath).replace(/\\/g, '/');

    // Try to find the file in git (case-insensitive key lookup)
    const gitPath =
        gitFileMap.get(rel.toLowerCase()) ||
        gitFileMap.get(rel.toLowerCase() + '.js') ||
        gitFileMap.get(rel.toLowerCase() + '.json');

    if (!gitPath) return true; // Not tracked in git — no authoritative case to check against

    // Extract only the forward path segments written in the import string
    // (filter out '..' and '.' which just navigate to a base directory)
    const importForwardSegs = importStr.replace(/\\/g, '/').split('/')
        .filter(s => s !== '..' && s !== '.');

    if (importForwardSegs.length === 0) return true;

    // For directory imports (require('./utils') → utils/index.js), the git path
    // has an extra /index.js segment that isn't in the import string. Strip it
    // so that segment counts align correctly.
    let normGitPath = gitPath;
    if (isDirectoryImport && normGitPath.endsWith('/index.js')) {
        normGitPath = normGitPath.slice(0, -'/index.js'.length);
    }
    // Strip plain .js/.json extension from the final segment so we can compare
    // 'lab_order' (import) against 'lab_order.js' (git path).
    else {
        normGitPath = normGitPath.replace(/\.(js|json|ts)$/, '');
    }

    const gitParts = normGitPath.split('/');
    const N = importForwardSegs.length;

    // The forward segments correspond to the LAST N parts of the git path
    const relevantGitParts = gitParts.slice(-N);

    for (let i = 0; i < N; i++) {
        // Strip any explicit extension from both sides before comparing
        const importSeg = importForwardSegs[i].replace(/\.(js|json|ts)$/, '');
        const gitSeg = (relevantGitParts[i] || '').replace(/\.(js|json|ts)$/, '');
        if (importSeg !== gitSeg) return false; // Case mismatch in an import-controlled segment
    }
    return true;
}

// Fallback: filesystem-based check. Accurate on Linux; unreliable on Windows
// (case-insensitive FS makes it unable to detect wrong-case imports).
function checkFilesystemCasing(filePath) {
    let currentPath = filePath;
    while (currentPath !== path.parse(currentPath).root) {
        const dir = path.dirname(currentPath);
        const base = path.basename(currentPath);
        if (!fs.existsSync(dir)) return false;
        if (!fs.readdirSync(dir).includes(base)) return false;
        currentPath = dir;
        if (currentPath === repoRoot) break;
    }
    return true;
}

let hasError = false;
console.log("🔍 Running Pre-Push Validation: Checking internal imports for proper Case-Sensitivity...");
const jsFiles = findJsFiles(srcDir);

for (const file of jsFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    const requireRegex = /(?:require|loadSwaggerDoc)\(['"](\.[^'"]+)['"]\)/g;
    let match;

    while ((match = requireRegex.exec(content)) !== null) {
        const importStr = match[1];
        const resolvedRaw = path.resolve(path.dirname(file), importStr);

        // Possible extensions Node.js tries — order matters
        const possiblePaths = [
            resolvedRaw,
            resolvedRaw + '.js',
            resolvedRaw + '.json',
            path.join(resolvedRaw, 'index.js')
        ];

        let actualExistingPath = null;
        let isDirectoryImport = false;

        for (let i = 0; i < possiblePaths.length; i++) {
            if (fs.existsSync(possiblePaths[i])) {
                actualExistingPath = possiblePaths[i];
                isDirectoryImport = (i === 3); // index 3 = <dir>/index.js lookup
                break;
            }
        }

        if (actualExistingPath) {
            if (!checkImportCasing(importStr, actualExistingPath, isDirectoryImport)) {
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
