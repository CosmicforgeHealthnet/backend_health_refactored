const fs = require('fs');
const path = require('path');

// Configuration
const NEW_PROJECT_ROOT = '/Users/mosesbenjamin/Desktop/DEVELOPMENT/CLIENT/BACKEND APPLICATION/backend_health';
const OLD_PROJECT_ROOT = '/Users/mosesbenjamin/Desktop/DEVELOPMENT/CLIENT/BACKEND APPLICATION/backend_health_backup';
const OUTPUT_FILE = path.join(NEW_PROJECT_ROOT, 'src/docs/route_comparison.html');

// Helper to find controller definition in file
function findControllerPath(fileContent, controllerVar) {
    if (!controllerVar || typeof controllerVar !== 'string') return controllerVar;

    // Escape special regex chars
    const safeVar = controllerVar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    try {
        const regex = new RegExp(`const\\s+${safeVar}\\s*=\\s*require\\(['"](.+)['"]\\)`);
        const match = fileContent.match(regex);
        if (match) {
            const importPath = match[1];
            const basename = path.basename(importPath, '.js');
            return basename;
        }
    } catch (e) {
        // console.warn('Regex error for var:', controllerVar, e.message);
    }
    return controllerVar;
}

// Improved scan function that handles multi-line routes
function scanRouteFile(filePath, basePath = '', routes = []) {
    if (!fs.existsSync(filePath)) return routes;

    let content = fs.readFileSync(filePath, 'utf-8');

    // 1. Determine Feature Name
    let featureName = 'Shared';
    if (filePath.includes('/features/')) {
        const parts = filePath.split('/features/');
        featureName = parts[1].split('/')[0];
        featureName = featureName.charAt(0).toUpperCase() + featureName.slice(1);
    }

    // Logic for "OLD" codebase where features didn't exist
    if (filePath.includes('backend_health_backup')) {
        const filename = path.basename(filePath);
        featureName = 'Legacy';
        // Try to guess useful feature name from file
        if (filename.includes('auth')) featureName = 'Auth';
        if (filename.includes('user')) featureName = 'User';
        if (filename.includes('doctor')) featureName = 'Doctor';
        if (filename.includes('payment')) featureName = 'Payments';
    }

    // 2. Pre-process Content: Strip Comments & Normalize Whitespace
    content = content.replace(/\/\*[\s\S]*?\*\//g, '');
    content = content.replace(/\/\/.*$/gm, '');
    const normalizedContent = content.replace(/\s+/g, ' ');

    // 3. Robust Regex for router.METHOD matches on normalized string
    const routeRegex = /router\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]\s*,\s*(.+?)\s*\)/g;

    let match;
    while ((match = routeRegex.exec(normalizedContent)) !== null) {
        const method = match[1].toUpperCase();
        const routePath = match[2];
        const argsBody = match[3];

        // 4. Analyze Arguments to find Controller
        const args = argsBody.split(',');
        const lastArg = args[args.length - 1].trim();

        let controller = 'Inline/Unknown';
        let action = 'Unknown';

        // Check if last arg matches 'controller.method'
        if (lastArg.includes('.')) {
            const parts = lastArg.split('.');
            const controllerVar = parts[0];
            action = parts[1];

            // Resolve controller variable to file name from original content
            controller = findControllerPath(content, controllerVar);
        } else {
            action = lastArg;
            controller = 'DirectImport';
        }

        let fullPath = basePath + (routePath === '/' ? '' : routePath);
        fullPath = fullPath.replace(/\/\//g, '/');

        routes.push({
            method,
            path: fullPath,
            controller,
            action,
            feature: featureName,
            file: filePath
        });
    }

    return routes;
}

// ---------------------------------------------------------
// 1. Scan NEW Project
// ---------------------------------------------------------
console.log('Scanning NEW codebase...');
const newRoutes = [];
const featuresDir = path.join(NEW_PROJECT_ROOT, 'src/features');

if (fs.existsSync(featuresDir)) {
    const features = fs.readdirSync(featuresDir);
    features.forEach(feature => {
        const routesDir = path.join(featuresDir, feature, 'routes');
        if (fs.existsSync(routesDir)) {
            // Find all .js files explicitly
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
                // Determine mount prefix logic
                let prefix = `/api/${feature.toLowerCase()}`;

                // Manual Overrides based on app.js analysis
                if (feature === 'auth') prefix = '/api/auth';
                if (feature === 'patient') prefix = '/api/patient';
                if (feature === 'doctor') prefix = '/api/doctor';
                if (feature === 'appointments') prefix = '/api/appointments';

                const filename = path.basename(filepath);

                if (filename.includes('adminVerificationRoutes')) prefix = '/admin';
                if (feature === 'LAB') prefix = '/lab';
                if (filename.includes('waitlistRoutes')) prefix = '/lab_pharm';
                if (feature === 'search') prefix = '/search';
                if (filename.includes('dynamicCurrency')) prefix = '/dynamicCurrency';

                if (feature === 'payments' && filename.includes('index')) prefix = '/api/payments';
                if (feature === 'payments' && filename.includes('transaction')) prefix = '/api/transactions';

                scanRouteFile(filepath, prefix, newRoutes);
            });
        }
    });
}

// ---------------------------------------------------------
// 2. Scan OLD Project
// ---------------------------------------------------------
console.log('Scanning OLD codebase...');
const oldRoutes = [];
const oldRoutesDir = path.join(OLD_PROJECT_ROOT, 'src/routes');

function walkDir(dir, fileList = []) {
    if (!fs.existsSync(dir)) return fileList;
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const filepath = path.join(dir, file);
        if (fs.statSync(filepath).isDirectory()) {
            walkDir(filepath, fileList);
        } else if (file.endsWith('.js')) {
            fileList.push(filepath);
        }
    });
    return fileList;
}

const oldFiles = walkDir(oldRoutesDir);
oldFiles.forEach(file => {
    // Determine Legacy Mount Prefix based on old app.js
    let prefix = '';
    const filename = path.basename(file);

    if (filename.includes('authRoutes')) prefix = '/auth';
    else if (filename.includes('userRoutes')) prefix = '/user';
    else if (filename.includes('doctorVerificationRoutes')) prefix = '/doctor/verification';
    else if (filename.includes('adminVerificationRoutes')) prefix = '/admin/verification';
    else if (filename.includes('notificationRoutes')) prefix = '/notifications';
    else if (filename.includes('chatRoutes')) prefix = '/chat';
    else if (filename.includes('appointmentRoutes')) prefix = '/appointments';
    else if (filename.includes('subscriptionRoutes')) prefix = '/subscription';
    else if (filename.includes('supportRoutes')) prefix = '/support';
    else if (filename.includes('paymentRoutes')) prefix = '/transactions/payments'; // check app.js mounting
    else if (filename.includes('paymentMethodRoutes')) prefix = '/transactions/payment-methods';
    else if (filename.includes('walletRoutes')) prefix = '/transactions/wallet';
    else if (filename.includes('disputeRoutes')) prefix = '/transactions/disputes';
    else if (filename.includes('pharmacy')) prefix = '/pharmacy';
    else if (filename.includes('lab')) prefix = '/lab';
    else if (filename.includes('mfaRoutes')) prefix = '/auth/mfa';
    else if (filename.includes('search')) prefix = '/search';
    else if (filename.includes('referralRoutes')) prefix = '/referrals';

    // Pass explicit legacy prefix
    scanRouteFile(file, prefix, oldRoutes);
});


// ---------------------------------------------------------
// 3. Match & Generate
// ---------------------------------------------------------

const mappings = newRoutes.map(newItem => {
    // 1. Strict Match: Controller (Semantic) + Action
    const match = oldRoutes.find(oldItem =>
        oldItem.action === newItem.action &&
        oldItem.controller.toLowerCase() === newItem.controller.toLowerCase()
    );

    // 2. Loose Match: Controller (Name only) + Action
    const looseMatch = !match ? oldRoutes.find(oldItem =>
        oldItem.action === newItem.action &&
        oldItem.controller.toLowerCase().includes(newItem.controller.toLowerCase().replace('controller', ''))
    ) : null;

    // 3. Path Fallback (Last Resort)
    let fallbackMatch = null;
    if (!match && !looseMatch) {
        const newSuffix = newItem.path.split('/').pop(); // "login"
        fallbackMatch = oldRoutes.find(oldItem =>
            oldItem.method === newItem.method &&
            oldItem.path.endsWith(newSuffix) &&
            newSuffix.length > 2
        );
    }

    const finalMatch = match || looseMatch || fallbackMatch;

    return {
        feature: newItem.feature,
        newMethod: newItem.method,
        newPath: newItem.path,
        controller: newItem.controller,
        action: newItem.action,
        // Show Explicit Legacy Path if available
        oldRoutePath: finalMatch ? finalMatch.path : 'N/A',
        oldRouteSource: finalMatch ? `${path.basename(finalMatch.file)}` : '-',
        status: finalMatch ? 'Migrated' : 'New Feature'
    };
});

mappings.sort((a, b) => a.feature.localeCompare(b.feature));

const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>CosmicForge Detailed API Structure</title>
    <style>
        body { font-family: 'Segoe UI', sans-serif; padding: 20px; background: #f9f9f9; color: #333; }
        h1 { text-align: center; color: #2c3e50; }
        .stats { text-align: center; color: #7f8c8d; margin-bottom: 20px; font-size: 0.9em; }
        table { width: 100%; border-collapse: collapse; background: white; box-shadow: 0 2px 5px rgba(0,0,0,0.1); font-size: 0.9em; }
        th, td { text-align: left; padding: 12px 15px; border-bottom: 1px solid #eee; }
        th { background: #2c3e50; color: white; position: sticky; top: 0; }
        tr:hover { background: #f1f1f1; }
        
        .method { font-weight: bold; padding: 4px 8px; border-radius: 4px; color: white; font-size: 0.75em; min-width: 50px; text-align: center; display: inline-block; }
        .GET { background: #3498db; }
        .POST { background: #2ecc71; }
        .PUT { background: #f39c12; }
        .DELETE { background: #e74c3c; }
        .PATCH { background: #1abc9c; }
        
        .controller { color: #7f8c8d; font-size: 0.85em; display: block; margin-top: 3px; font-style: italic; }
        .action { font-weight: 600; color: #34495e; }
        
        .feature-badge { padding: 4px 8px; border-radius: 12px; font-size: 0.8em; font-weight: bold; background: #ecf0f1; color: #2c3e50; }
        
        .status-new { color: #3498db; font-weight: bold; }
        .status-migrated { color: #27ae60; font-weight: bold; }
        
        .legacy-path { font-family: monospace; font-weight: bold; color: #cf6679; display: block; }
        .legacy-source { font-size: 0.8em; color: #999; }
        .na { color: #bdc3c7; font-style: italic; }
    </style>
</head>
<body>
    <h1>🚀 API Route Audit & Comparison</h1>
    <p class="stats">
        Generated: ${new Date().toLocaleString()} | 
        Total Routes: <strong>${mappings.length}</strong> | 
        Refactored Source: <code>src/features/*/routes/*.js</code>
    </p>
    <table>
        <thead>
            <tr>
                <th width="12%">Feature</th>
                <th width="8%">Method</th>
                <th width="30%">New Route (Refactored)</th>
                <th width="20%">Implementation (Controller)</th>
                <th width="30%">Old Route (Legacy)</th>
            </tr>
        </thead>
        <tbody>
            ${mappings.map(m => `
            <tr>
                <td><span class="feature-badge">${m.feature}</span></td>
                <td><span class="method ${m.newMethod}">${m.newMethod}</span></td>
                <td><code>${m.newPath}</code></td>
                <td>
                    <span class="action">${m.action}</span>
                    <span class="controller">${m.controller}</span>
                </td>
                <td>
                    ${m.status === 'Migrated'
        ? `<span class="legacy-path">${m.oldRoutePath}</span><span class="legacy-source">(${m.oldRouteSource})</span>`
        : '<span class="na">-- New Feature --</span>'}
                </td>
            </tr>
            `).join('')}
        </tbody>
    </table>
</body>
</html>`;

fs.writeFileSync(OUTPUT_FILE, html);
console.log(`Generated robust audit for ${mappings.length} routes.`);
