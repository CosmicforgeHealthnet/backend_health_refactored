const fs = require("fs-extra");
const path = require("path");

(async () => {
    try {
        console.log("🚀 Starting Postman Collection generation...");

        const srcDir = path.join(__dirname, "../");
        const featuresDir = path.join(srcDir, "features");
        const bundlePath = path.join(__dirname, "swagger.bundle.json");

        if (!await fs.pathExists(bundlePath)) {
            throw new Error("swagger.bundle.json not found! Run mergeSwaggerComponents.js first.");
        }

        const swagger = await fs.readJson(bundlePath);
        const features = await fs.readdir(featuresDir);

        // Map feature names to collections
        const collections = {};

        // Initialize collections for each feature found on disk
        for (const feature of features) {
            const stat = await fs.stat(path.join(featuresDir, feature));
            if (stat.isDirectory()) {
                collections[feature.toLowerCase()] = {
                    info: {
                        name: `CosmicForge - ${feature.charAt(0).toUpperCase() + feature.slice(1)} Feature`,
                        schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
                    },
                    item: []
                };
            }
        }

        // Add a fallback collection
        collections['shared'] = {
            info: { name: "CosmicForge - Shared/Other", schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json" },
            item: []
        };

        // Helper to find collection by tag
        function findCollectionKey(tags) {
            if (!tags || !Array.isArray(tags) || tags.length === 0) return 'shared';
            for (let tag of tags) {
                if (!tag) continue;
                if (typeof tag === 'object' && tag.name) tag = tag.name; // Handle {name: 'Auth'}
                if (typeof tag !== 'string') continue;

                const normalized = tag.toLowerCase().replace(/\s+/g, ''); // "UserAuth" -> "userauth"

                // Direct match
                if (collections[normalized]) return normalized;

                // Partial match (e.g. "Appointments" -> "appointments")
                // Check if any feature name is included in tag or vice versa
                for (const feature of Object.keys(collections)) {
                    if (normalized.includes(feature) || feature.includes(normalized)) {
                        return feature;
                    }

                    // Special mappings
                    if (feature === 'payments' && (normalized.includes('transaction') || normalized.includes('wallet') || normalized.includes('dispute'))) return 'payments';
                    if (feature === 'auth' && (normalized.includes('adminverification') || normalized.includes('referral'))) return 'auth';
                    if (feature === 'documents' && (normalized.includes('file') || normalized.includes('image'))) return 'documents';
                    if (feature === 'marketing' && (normalized.includes('gamification'))) return 'marketing';
                    if (feature === 'chat' && normalized.includes('chatbot')) return 'chat';
                }
            }
            return 'shared';
        }

        let count = 0;
        // Iterate Paths
        for (const [routePath, methods] of Object.entries(swagger.paths)) {
            for (const [method, details] of Object.entries(methods)) {
                if (method === 'parameters' || method === 'servers') continue;

                const collectionKey = findCollectionKey(details.tags);

                // Construct Postman Item
                const item = {
                    name: details.summary || `${method.toUpperCase()} ${routePath}`,
                    request: {
                        method: method.toUpperCase(),
                        header: [],
                        url: {
                            raw: `{{baseUrl}}${routePath}`,
                            host: ["{{baseUrl}}"],
                            path: routePath.split('/').filter(p => p.length > 0).map(p => {
                                // Handle path params {id} -> :id
                                if (p.startsWith('{') && p.endsWith('}')) {
                                    return ':' + p.slice(1, -1);
                                }
                                return p;
                            }),
                            variable: [] // Could parse params here
                        },
                        description: details.description || ""
                    }
                };

                // Basic auth header if protected
                // (Looking at security schema logic is complex, skipping for brevity)

                // Add to collection
                collections[collectionKey].item.push(item);
                count++;
            }
        }

        console.log(`✅ Processed ${count} endpoints.`);

        // Save collections
        for (const [feature, collection] of Object.entries(collections)) {
            if (collection.item.length > 0) {
                let saveDir;
                if (feature === 'shared') {
                    saveDir = path.join(srcDir, "docs/postman"); // fallback
                } else {
                    saveDir = path.join(featuresDir, feature); // Root of feature or docs?
                    // User asked "inside all the features". root is visible.
                }

                await fs.ensureDir(saveDir);
                const filePath = path.join(saveDir, "postman_collection.json");
                await fs.writeJson(filePath, collection, { spaces: 2 });
                console.log(`💾 Saved ${feature} collection to ${filePath} (${collection.item.length} items)`);
            }
        }

        console.log("\n🎉 Postman generation complete!");

    } catch (err) {
        console.error("❌ Error generating Postman collections:", err);
        process.exit(1);
    }
})();
