const fs = require('fs');
const path = require('path');

const swaggerPath = path.join(__dirname, 'swagger.bundle.json');
const outputPath = path.join(__dirname, 'route_comparison.html');

try {
    const swagger = require(swaggerPath);
    const paths = Object.keys(swagger.paths).sort();

    const mappings = paths.map(newRoute => {
        let oldRoute = 'N/A';
        let feature = 'Unknown';
        let status = 'New';

        if (newRoute.startsWith('/api/auth')) {
            feature = 'Auth';
            oldRoute = newRoute.replace('/api/auth', '/auth');
            status = 'Migrated';
        } else if (newRoute.startsWith('/api/patient')) {
            feature = 'Patient (User)';
            oldRoute = newRoute.replace('/api/patient', '/user');
            status = 'Migrated & Renamed';
        } else if (newRoute.startsWith('/api/doctor')) {
            feature = 'Doctor';
            oldRoute = newRoute.replace('/api/doctor', '/doctor');
            status = 'Migrated';
        } else if (newRoute.startsWith('/api/appointments')) {
            feature = 'Appointments';
            oldRoute = newRoute.replace('/api/appointments', '/appointments');
            status = 'Migrated';
        } else if (newRoute.startsWith('/api/payments')) {
            feature = 'Payments';
            oldRoute = newRoute.replace('/api/payments', '/transactions/payments');
            status = 'Consolidated';
        } else if (newRoute.startsWith('/api/notifications')) {
            feature = 'Notifications';
            oldRoute = newRoute.replace('/api/notifications', '/notifications');
            status = 'Migrated';
        } else if (newRoute.startsWith('/api/chat')) {
            feature = 'Chat';
            oldRoute = newRoute.replace('/api/chat', '/chat');
            if (newRoute.startsWith('/api/chatbot')) oldRoute = newRoute.replace('/api/chatbot', '/chatbot');
            status = 'Migrated';
        } else if (newRoute.startsWith('/api/subscription')) {
            feature = 'Subscription';
            oldRoute = newRoute.replace('/api/subscription', '/subscription');
            status = 'Migrated';
        } else if (newRoute.startsWith('/api/support')) {
            feature = 'Support';
            oldRoute = newRoute.replace('/api/support', '/support');
            status = 'Migrated';
        } else if (newRoute.startsWith('/api/pharmacy')) {
            feature = 'Pharmacy';
            oldRoute = newRoute.replace('/api/pharmacy', '/pharmacy');
            status = 'Migrated';
        } else if (newRoute.startsWith('/api/compliance')) {
            feature = 'Compliance';
            oldRoute = newRoute.replace('/api/compliance', '/compliance');
            status = 'Migrated';
        } else if (newRoute.startsWith('/api/documents')) {
            feature = 'Documents';
            oldRoute = 'N/A';
            status = 'New Feature';
        } else if (newRoute.startsWith('/api/firstaid')) {
            feature = 'First Aid';
            oldRoute = newRoute.replace('/api/firstaid', '/api/firstaid'); // Was likely same or similar
            status = 'Migrated';
        } else if (newRoute.startsWith('/lab')) {
            feature = 'Lab';
            oldRoute = newRoute;
            status = 'Maintained';
        }

        return { feature, oldRoute, newRoute, status };
    });

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CosmicForge API Refactoring: Comprehensive Route List</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7f6; color: #333; margin: 0; padding: 20px; }
        h1 { text-align: center; color: #2c3e50; margin-bottom: 10px; }
        p.subtitle { text-align: center; color: #7f8c8d; margin-bottom: 30px; }
        .container { max-width: 1400px; margin: 0 auto; background: white; box-shadow: 0 5px 15px rgba(0,0,0,0.1); border-radius: 8px; overflow: hidden; }
        table { width: 100%; border-collapse: collapse; font-size: 0.9em; }
        th, td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #eee; }
        th { background-color: #2c3e50; color: white; text-transform: uppercase; font-size: 0.85em; letter-spacing: 1px; position: sticky; top: 0; }
        tr:hover { background-color: #f1f1f1; }
        .new-route { color: #27ae60; font-weight: bold; font-family: 'Consolas', 'Monaco', monospace; }
        .old-route { color: #95a5a6; font-family: 'Consolas', 'Monaco', monospace; font-size: 0.9em; }
        .feature-badge { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 0.75em; font-weight: bold; background-color: #3498db; color: white; min-width: 80px; text-align: center; }
        .status-new { color: #2980b9; font-weight: bold; }
        .status-migrated { color: #27ae60; font-weight: bold; }
        .status-consolidated { color: #8e44ad; font-weight: bold; }
        .status-maintained { color: #7f8c8d; font-weight: bold; }
    </style>
</head>
<body>
    <h1>🚀 Complete API Route Migration Map</h1>
    <p class="subtitle">Total Routes: ${mappings.length} | Generated from swagger.bundle.json</p>
    <div class="container">
        <table>
            <thead>
                <tr>
                    <th>Feature</th>
                    <th>Legacy Route (Old)</th>
                    <th>Refactored Route (New)</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                ${mappings.map(m => `
                <tr>
                    <td><span class="feature-badge" style="background-color: ${getFeatureColor(m.feature)}">${m.feature}</span></td>
                    <td><span class="old-route">${m.oldRoute}</span></td>
                    <td><span class="new-route">${m.newRoute}</span></td>
                    <td class="${getStatusClass(m.status)}">${m.status}</td>
                </tr>`).join('')}
            </tbody>
        </table>
    </div>
</body>
</html>`;

    function getFeatureColor(feature) {
        const colors = {
            'Auth': '#e74c3c',
            'Patient (User)': '#3498db',
            'Doctor': '#9b59b6',
            'Appointments': '#1abc9c',
            'Payments': '#f1c40f',
            'Notifications': '#e67e22',
            'Chat': '#34495e',
            'Pharmacy': '#2ecc71',
            'Lab': '#95a5a6'
        };
        return colors[feature] || '#3498db';
    }

    function getStatusClass(status) {
        if (status.includes('New')) return 'status-new';
        if (status.includes('Migrated')) return 'status-migrated';
        if (status.includes('Consolidated')) return 'status-consolidated';
        return 'status-maintained';
    }

    fs.writeFileSync(outputPath, html);
    console.log(`Successfully generated route comparison with ${mappings.length} routes.`);

} catch (error) {
    console.error('Error generating comparison:', error);
}
