// src/firstaid/content/sosSwaggerMerger.js
const fs = require('fs');
const path = require('path');
const yaml = require('yaml');

class SOSSwaggerMerger {
    constructor() {
        this.basePath = path.join(__dirname, '..');
        this.docsPath = path.join(this.basePath, 'docs');
        this.componentsPath = path.join(this.docsPath, 'components');
        this.outputPath = path.join(this.docsPath, 'sos-swagger.bundle.json');

        // Ensure directories exist
        this.ensureDirectoryExists(this.docsPath);
        this.ensureDirectoryExists(this.componentsPath);
    }

    ensureDirectoryExists(dirPath) {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
            console.log(`✅ Created directory: ${dirPath}`);
        }
    }

    loadYamlFile(filePath) {
        try {
            if (!fs.existsSync(filePath)) {
                console.warn(`⚠️ File not found: ${filePath}`);
                return null;
            }
            const content = fs.readFileSync(filePath, 'utf8');
            return yaml.parse(content);
        } catch (error) {
            console.error(`❌ Error loading YAML file ${filePath}:`, error.message);
            return null;
        }
    }

    loadJsonFile(filePath) {
        try {
            if (!fs.existsSync(filePath)) {
                console.warn(`⚠️ File not found: ${filePath}`);
                return null;
            }
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        } catch (error) {
            console.error(`❌ Error loading JSON file ${filePath}:`, error.message);
            return null;
        }
    }

    createBaseSwagger() {
        return {
            openapi: "3.0.3",
            info: {
                title: "CosmicForge SOS Emergency Services API",
                description: "Emergency services and safety information API providing global emergency numbers and safety tips",
                version: "1.0.0",
                contact: {
                    name: "CosmicForge Health Support",
                    email: "support@cosmicforgehealth.com"
                },
                license: {
                    name: "MIT",
                    url: "https://opensource.org/licenses/MIT"
                }
            },
            servers: [
                {
                    url: "https://api.cosmicforgehealth.com",
                    description: "Production server"
                },
                {
                    url: "http://localhost:3000",
                    description: "Development server"
                }
            ],
            tags: [
                {
                    name: "Emergency Numbers",
                    description: "Get emergency contact numbers by location"
                },
                {
                    name: "Safety Tips",
                    description: "Emergency safety tips and guidelines"
                },
                {
                    name: "Emergency Services",
                    description: "Specific emergency service information"
                }
            ],
            paths: {},
            components: {
                schemas: {},
                responses: {},
                parameters: {},
                securitySchemes: {
                    BearerAuth: {
                        type: "http",
                        scheme: "bearer",
                        bearerFormat: "JWT"
                    }
                }
            }
        };
    }

    createSchemas() {
        return {
            EmergencyNumbers: {
                type: "object",
                properties: {
                    police: {
                        type: "string",
                        description: "Police emergency number",
                        example: "112"
                    },
                    fire: {
                        type: "string",
                        description: "Fire department emergency number",
                        example: "112"
                    },
                    medical: {
                        type: "string",
                        description: "Medical emergency number",
                        example: "112"
                    },
                    universal: {
                        type: "string",
                        description: "Universal emergency number",
                        example: "112"
                    },
                    notes: {
                        type: "string",
                        description: "Additional notes about emergency numbers",
                        example: "112 is the universal emergency number in Nigeria"
                    }
                },
                required: ["police", "fire", "medical", "universal"]
            },
            LocationInfo: {
                type: "object",
                properties: {
                    country: {
                        type: "string",
                        description: "Country name",
                        example: "Nigeria"
                    },
                    countryCode: {
                        type: "string",
                        description: "ISO country code",
                        example: "NG"
                    },
                    city: {
                        type: "string",
                        description: "City name",
                        example: "Lagos"
                    },
                    detected: {
                        type: "boolean",
                        description: "Whether location was automatically detected",
                        example: true
                    }
                }
            },
            SafetyTips: {
                type: "object",
                properties: {
                    tips: {
                        type: "array",
                        items: {
                            type: "string"
                        },
                        description: "Array of safety tips",
                        example: [
                            "Stay calm and speak clearly when calling",
                            "Provide your exact location immediately"
                        ]
                    }
                }
            },
            EmergencyResponse: {
                type: "object",
                properties: {
                    success: {
                        type: "boolean",
                        example: true
                    },
                    emergency: {
                        type: "object",
                        properties: {
                            location: {
                                "$ref": "#/components/schemas/LocationInfo"
                            },
                            numbers: {
                                "$ref": "#/components/schemas/EmergencyNumbers"
                            },
                            safetyTips: {
                                "$ref": "#/components/schemas/SafetyTips"
                            },
                            formattedMessage: {
                                type: "string",
                                description: "Formatted emergency message for display"
                            }
                        }
                    },
                    timestamp: {
                        type: "string",
                        format: "date-time",
                        example: "2024-01-15T10:30:00.000Z"
                    }
                }
            },
            SafetyTipsResponse: {
                type: "object",
                properties: {
                    success: {
                        type: "boolean",
                        example: true
                    },
                    emergencyType: {
                        type: "string",
                        enum: ["police", "fire", "medical", "general"],
                        example: "fire"
                    },
                    safetyTips: {
                        "$ref": "#/components/schemas/SafetyTips"
                    },
                    timestamp: {
                        type: "string",
                        format: "date-time"
                    }
                }
            },
            ErrorResponse: {
                type: "object",
                properties: {
                    success: {
                        type: "boolean",
                        example: false
                    },
                    error: {
                        type: "string",
                        example: "Invalid emergency type"
                    }
                }
            }
        };
    }

    createPaths() {
        return {
            "/api/sos/emergency-numbers": {
                get: {
                    tags: ["Emergency Numbers"],
                    summary: "Get emergency numbers for current location",
                    description: "Returns emergency numbers based on automatically detected location with optional safety tips",
                    parameters: [
                        {
                            name: "includeTips",
                            in: "query",
                            description: "Include safety tips in response",
                            required: false,
                            schema: {
                                type: "string",
                                enum: ["true", "false"],
                                default: "false"
                            }
                        },
                        {
                            name: "emergencyType",
                            in: "query",
                            description: "Type of emergency for relevant safety tips",
                            required: false,
                            schema: {
                                type: "string",
                                enum: ["police", "fire", "medical", "general"],
                                default: "general"
                            }
                        }
                    ],
                    responses: {
                        "200": {
                            description: "Emergency numbers retrieved successfully",
                            content: {
                                "application/json": {
                                    schema: {
                                        "$ref": "#/components/schemas/EmergencyResponse"
                                    }
                                }
                            }
                        },
                        "500": {
                            description: "Server error",
                            content: {
                                "application/json": {
                                    schema: {
                                        "$ref": "#/components/schemas/ErrorResponse"
                                    }
                                }
                            }
                        }
                    }
                }
            },
            "/api/sos/emergency-numbers/by-country": {
                get: {
                    tags: ["Emergency Numbers"],
                    summary: "Get emergency numbers by country",
                    description: "Returns emergency numbers for a specific country using country code or name",
                    parameters: [
                        {
                            name: "countryCode",
                            in: "query",
                            description: "ISO country code (e.g., 'NG', 'US')",
                            required: false,
                            schema: {
                                type: "string",
                                example: "NG"
                            }
                        },
                        {
                            name: "countryName",
                            in: "query",
                            description: "Country name (e.g., 'Nigeria', 'United States')",
                            required: false,
                            schema: {
                                type: "string",
                                example: "Nigeria"
                            }
                        },
                        {
                            name: "includeTips",
                            in: "query",
                            description: "Include safety tips in response",
                            required: false,
                            schema: {
                                type: "string",
                                enum: ["true", "false"]
                            }
                        },
                        {
                            name: "emergencyType",
                            in: "query",
                            description: "Type of emergency for safety tips",
                            required: false,
                            schema: {
                                type: "string",
                                enum: ["police", "fire", "medical", "general"]
                            }
                        }
                    ],
                    responses: {
                        "200": {
                            description: "Emergency numbers retrieved successfully",
                            content: {
                                "application/json": {
                                    schema: {
                                        "$ref": "#/components/schemas/EmergencyResponse"
                                    }
                                }
                            }
                        },
                        "400": {
                            description: "Bad request - missing required parameters",
                            content: {
                                "application/json": {
                                    schema: {
                                        "$ref": "#/components/schemas/ErrorResponse"
                                    }
                                }
                            }
                        }
                    }
                }
            },
            "/api/sos/emergency/{type}": {
                get: {
                    tags: ["Emergency Services"],
                    summary: "Get emergency information by type",
                    description: "Returns emergency numbers and safety tips for a specific emergency type",
                    parameters: [
                        {
                            name: "type",
                            in: "path",
                            description: "Type of emergency",
                            required: true,
                            schema: {
                                type: "string",
                                enum: ["police", "fire", "medical", "general"]
                            }
                        }
                    ],
                    responses: {
                        "200": {
                            description: "Emergency information retrieved successfully",
                            content: {
                                "application/json": {
                                    schema: {
                                        allOf: [
                                            {
                                                "$ref": "#/components/schemas/EmergencyResponse"
                                            },
                                            {
                                                type: "object",
                                                properties: {
                                                    emergencyType: {
                                                        type: "string",
                                                        example: "fire"
                                                    }
                                                }
                                            }
                                        ]
                                    }
                                }
                            }
                        },
                        "400": {
                            description: "Invalid emergency type",
                            content: {
                                "application/json": {
                                    schema: {
                                        "$ref": "#/components/schemas/ErrorResponse"
                                    }
                                }
                            }
                        }
                    }
                }
            },
            "/api/sos/service/{type}": {
                get: {
                    tags: ["Emergency Services"],
                    summary: "Get specific emergency service information",
                    description: "Returns emergency information highlighting a specific service type",
                    parameters: [
                        {
                            name: "type",
                            in: "path",
                            description: "Type of emergency service",
                            required: true,
                            schema: {
                                type: "string",
                                enum: ["police", "fire", "medical"]
                            }
                        }
                    ],
                    responses: {
                        "200": {
                            description: "Service information retrieved successfully",
                            content: {
                                "application/json": {
                                    schema: {
                                        allOf: [
                                            {
                                                "$ref": "#/components/schemas/EmergencyResponse"
                                            },
                                            {
                                                type: "object",
                                                properties: {
                                                    serviceType: {
                                                        type: "string",
                                                        example: "police"
                                                    },
                                                    serviceNumber: {
                                                        type: "string",
                                                        example: "112"
                                                    },
                                                    quickCall: {
                                                        type: "object",
                                                        properties: {
                                                            message: {
                                                                type: "string",
                                                                example: "For police emergency, call: 112"
                                                            },
                                                            number: {
                                                                type: "string",
                                                                example: "112"
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        ]
                                    }
                                }
                            }
                        },
                        "400": {
                            description: "Invalid service type"
                        }
                    }
                }
            },
            "/api/sos/safety-tips/{type}": {
                get: {
                    tags: ["Safety Tips"],
                    summary: "Get safety tips by emergency type",
                    description: "Returns safety tips for a specific type of emergency",
                    parameters: [
                        {
                            name: "type",
                            in: "path",
                            description: "Type of emergency",
                            required: true,
                            schema: {
                                type: "string",
                                enum: ["police", "fire", "medical", "general"]
                            }
                        }
                    ],
                    responses: {
                        "200": {
                            description: "Safety tips retrieved successfully",
                            content: {
                                "application/json": {
                                    schema: {
                                        "$ref": "#/components/schemas/SafetyTipsResponse"
                                    }
                                }
                            }
                        },
                        "400": {
                            description: "Invalid emergency type"
                        }
                    }
                }
            },
            "/api/sos/safety-tips": {
                get: {
                    tags: ["Safety Tips"],
                    summary: "Get all safety tips",
                    description: "Returns safety tips for all emergency types",
                    responses: {
                        "200": {
                            description: "All safety tips retrieved successfully",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            success: {
                                                type: "boolean",
                                                example: true
                                            },
                                            safetyTips: {
                                                type: "object",
                                                properties: {
                                                    police: {
                                                        "$ref": "#/components/schemas/SafetyTips"
                                                    },
                                                    fire: {
                                                        "$ref": "#/components/schemas/SafetyTips"
                                                    },
                                                    medical: {
                                                        "$ref": "#/components/schemas/SafetyTips"
                                                    },
                                                    general: {
                                                        "$ref": "#/components/schemas/SafetyTips"
                                                    }
                                                }
                                            },
                                            timestamp: {
                                                type: "string",
                                                format: "date-time"
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        };
    }

    mergeSwagger() {
        console.log('🔄 Starting SOS Swagger documentation merge...');

        // Create base swagger structure
        const swagger = this.createBaseSwagger();

        // Add schemas
        swagger.components.schemas = this.createSchemas();

        // Add paths
        swagger.paths = this.createPaths();

        // Load and merge any additional component files
        this.mergeComponentFiles(swagger);

        // Write the final bundle
        this.writeBundleFile(swagger);

        console.log('✅ SOS Swagger bundle created successfully!');
        console.log(`📄 Output: ${this.outputPath}`);

        return swagger;
    }

    mergeComponentFiles(swagger) {
        const componentTypes = ['schemas', 'responses', 'parameters'];

        componentTypes.forEach(type => {
            const componentDir = path.join(this.componentsPath, type);
            if (fs.existsSync(componentDir)) {
                const files = fs.readdirSync(componentDir).filter(file =>
                    file.endsWith('.yaml') || file.endsWith('.yml')
                );

                files.forEach(file => {
                    const filePath = path.join(componentDir, file);
                    const componentData = this.loadYamlFile(filePath);

                    if (componentData) {
                        Object.assign(swagger.components[type], componentData);
                        console.log(`✅ Merged ${type}/${file}`);
                    }
                });
            }
        });
    }

    writeBundleFile(swagger) {
        try {
            fs.writeFileSync(this.outputPath, JSON.stringify(swagger, null, 2));
            console.log(`✅ Bundle written to: ${this.outputPath}`);
        } catch (error) {
            console.error('❌ Error writing bundle file:', error.message);
            throw error;
        }
    }
}

// Create and export the merger function
function createSOSSwaggerBundle() {
    const merger = new SOSSwaggerMerger();
    return merger.mergeSwagger();
}

// Run if called directly
if (require.main === module) {
    try {
        createSOSSwaggerBundle();
        console.log('✅ SOS Swagger documentation generated successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Failed to generate SOS Swagger documentation:', error.message);
        process.exit(1);
    }
}

module.exports = { createSOSSwaggerBundle, SOSSwaggerMerger };