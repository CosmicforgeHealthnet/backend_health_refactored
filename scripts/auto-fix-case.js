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

// Build a map of all actual JS files (case-insensitive key -> exact absolute path)
const allFilesMap = new Map();
const allJsFiles = findJsFiles(srcDir);
for (const file of allJsFiles) {
    allFilesMap.set(path.basename(file).toLowerCase(), file);
}

function findCorrectPath(targetBaseName) {
    return allFilesMap.get(targetBaseName.toLowerCase() + '.js');
}

console.log("🛠️ Running Auto-Fixer for Case Sensitivity...");

for (const file of allJsFiles) {
    let content = fs.readFileSync(file, 'utf-8');
    const requireRegex = /(?:require|loadSwaggerDoc)\(['"](\.[^'"]+)['"]\)/g;
    let match;
    let modified = false;

    // We replace using a function so we can modify the string dynamically
    let newContent = content.replace(requireRegex, (fullMatch, importStr) => {
        let resolvedRaw = path.resolve(path.dirname(file), importStr);
        const possiblePaths = [resolvedRaw, resolvedRaw + '.js', resolvedRaw + '.json', path.join(resolvedRaw, 'index.js')];
        let exists = false;

        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                exists = true;
                break;
            }
        }

        if (!exists) {
            // Find the correct file via our map
            const targetBase = path.basename(resolvedRaw);
            const correctAbsPath = findCorrectPath(targetBase);
            if (correctAbsPath) {
                // Compute new relative path
                let newRelPath = path.relative(path.dirname(file), correctAbsPath);
                if (!newRelPath.startsWith('.')) newRelPath = './' + newRelPath;
                // remove .js natively
                newRelPath = newRelPath.replace(/\.js$/, '');
                console.log(`✅ Fixed in ${path.basename(file)}: ${importStr} -> ${newRelPath}`);
                modified = true;
                return fullMatch.replace(importStr, newRelPath);
            } else {
                console.log(`❌ Could not auto-fix ${importStr} in ${path.basename(file)}`);
            }
        }
        return fullMatch;
    });

    if (modified) {
        fs.writeFileSync(file, newContent, 'utf-8');
    }
}
console.log("Done.");
