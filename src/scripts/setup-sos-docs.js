// src/scripts/setup-sos-docs.js
const fs = require('fs');
const path = require('path');
const yaml = require('yaml');

class SOSDocumentationSetup {
    constructor() {
        this.baseDir = path.join(__dirname, '..', 'firstaid');
        this.docsDir = path.join(this.baseDir, 'docs');
        this.componentsDir = path.join(this.docsDir, 'components');

        this.directories = [
            this.docsDir,
            this.componentsDir,
            path.join(this.componentsDir, 'schemas'),
            path.join(this.componentsDir, 'responses'),
            path.join(this.componentsDir, 'parameters')
        ];
    }

    ensureDirectories() {
        console.log('📁 Creating SOS documentation directories...');

        this.directories.forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                console.log(`✅ Created: ${dir}`);
            } else {
                console.log(`ℹ️ Already exists: ${dir}`);
            }
        });
    }

    createComponentFiles() {
        console.log('📄 Creating component files...');

        // Create additional schemas
        const additionalSchemas = {
            CountryMapping: {
                type: "object",
                properties: {
                    countryName: {
                        type: "string",
                        description: "Full country name",
                        example: "Nigeria"
                    },
                    countryCode: {
                        type: "string",
                        description: "ISO country code",
                        example: "NG"
                    },
                    aliases: {
                        type: "array",
                        items: { type: "string" },
                        description: "Alternative names for the country",
                        example: ["nigeria", "ng"]
                    }
                }
            },
            EmergencyContext: {
                type: "object",
                properties: {
                    userLocation: { "$ref": "#/components/schemas/LocationInfo" },
                    detectedAutomatically: {
                        type: "boolean",
                        description: "Whether location was detected automatically"
                    },
                    ipAddress: {
                        type: "string",
                        description: "User's IP address (masked for privacy)",
                        example: "192.168.1.xxx"
                    },
                    timezone: {
                        type: "string",
                        description: "User's timezone",
                        example: "Africa/Lagos"
                    }
                }
            }
        };

        // Create response schemas
        const commonResponses = {
            NotFoundResponse: {
                description: "Resource not found",
                content: {
                    "application/json": {
                        schema: {
                            type: "object",
                            properties: {
                                success: { type: "boolean", example: false },
                                error: {
                                    type: "string",
                                    example: "Emergency information not found for this location"
                                },
                                timestamp: { type: "string", format: "date-time" }
                            }
                        }
                    }
                }
            },
            ValidationErrorResponse: {
                description: "Validation error",
                content: {
                    "application/json": {
                        schema: {
                            type: "object",
                            properties: {
                                success: { type: "boolean", example: false },
                                error: { type: "string", example: "Invalid parameters provided" },
                                details: {
                                    type: "array",
                                    items: {
                                        type: "object",
                                        properties: {
                                            field: { type: "string", example: "emergencyType" },
                                            message: {
                                                type: "string",
                                                example: "Must be one of: police, fire, medical, general"
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

        // Create common parameters
        const commonParameters = {
            LocationHeaders: [
                {
                    name: "X-User-Country",
                    in: "header",
                    description: "Override detected country",
                    required: false,
                    schema: { type: "string", example: "NG" }
                },
                {
                    name: "X-User-City",
                    in: "header",
                    description: "Override detected city",
                    required: false,
                    schema: { type: "string", example: "Lagos" }
                }
            ],
            CommonQueryParams: [
                {
                    name: "format",
                    in: "query",
                    description: "Response format preference",
                    required: false,
                    schema: {
                        type: "string",
                        enum: ["json", "text"],
                        default: "json"
                    }
                },
                {
                    name: "lang",
                    in: "query",
                    description: "Language preference for tips (future feature)",
                    required: false,
                    schema: {
                        type: "string",
                        enum: ["en", "fr", "es"],
                        default: "en"
                    }
                }
            ]
        };

        // Write component files
        this.writeYamlFile(
            path.join(this.componentsDir, 'schemas', 'additional-schemas.yaml'),
            additionalSchemas
        );

        this.writeYamlFile(
            path.join(this.componentsDir, 'responses', 'common-responses.yaml'),
            commonResponses
        );

        this.writeYamlFile(
            path.join(this.componentsDir, 'parameters', 'common-parameters.yaml'),
            commonParameters
        );

        console.log('✅ Component files created successfully!');
    }

    writeYamlFile(filePath, data) {
        try {
            const yamlContent = yaml.stringify(data, { indent: 2 });
            fs.writeFileSync(filePath, yamlContent);
            console.log(`✅ Created: ${filePath}`);
        } catch (error) {
            console.error(`❌ Failed to write ${filePath}:`, error.message);
        }
    }

    createReadme() {
        const readmeContent = `# SOS Emergency Services API Documentation

## Overview
This directory contains the Swagger/OpenAPI documentation for the CosmicForge SOS Emergency Services API.

## Structure
\`\`\`
firstaid/
├── docs/
│   ├── components/
│   │   ├── schemas/           # Data models and schemas
│   │   ├── responses/         # Common response definitions  
│   │   └── parameters/        # Reusable parameter definitions
│   ├── sos-swagger.bundle.json # Generated bundle file
│   └── README.md             # This file
├── content/
│   └── sosSwaggerMerger.js   # Build script
└── controllers/
    └── sosController.js      # API controllers
\`\`\`

## Building Documentation

### Generate the bundle:
\`\`\`bash
npm run build:sos-swagger
\`\`\`

### View the documentation:
1. Start your server: \`npm start\` or \`npm run dev\`  
2. Visit: \`http://localhost:3000/sos-docs\`

## API Endpoints

### Emergency Numbers
- \`GET /api/sos/emergency-numbers\` - Get emergency numbers for current location
- \`GET /api/sos/emergency-numbers/by-country\` - Get emergency numbers by country

### Emergency Services  
- \`GET /api/sos/emergency/{type}\` - Get emergency info by type
- \`GET /api/sos/service/{type}\` - Get specific service info

### Safety Tips
- \`GET /api/sos/safety-tips/{type}\` - Get safety tips by type
- \`GET /api/sos/safety-tips\` - Get all safety tips

## Supported Countries
The API supports emergency numbers for 50+ countries including:
- Nigeria (NG) - 112 universal
- United States (US) - 911 universal  
- United Kingdom (GB) - 999 universal
- European Union (EU) - 112 universal
- And many more...

## Emergency Types
- \`police\` - Police/Law enforcement
- \`fire\` - Fire department
- \`medical\` - Medical/Ambulance
- \`general\` - General emergency tips

## Development

### Adding New Countries
1. Update \`emergencyNumbers\` object in \`data/repositories/emergencyNumbers.js\`
2. Add country mapping in \`countryCodeMap\`
3. Rebuild documentation: \`npm run build:sos-swagger\`

### Adding New Safety Tips
1. Update \`emergencySafetyTips\` object in the data file
2. Add new tip categories as needed
3. Update API endpoints and documentation

## Contributing
When making changes to the API:
1. Update the relevant controller
2. Update schemas in \`components/\` if needed  
3. Run \`npm run build:sos-swagger\` to regenerate docs
4. Test the API endpoints
5. Update this README if needed

## Support
For questions about this API, contact the CosmicForge Health development team.
`;

        fs.writeFileSync(path.join(this.docsDir, 'README.md'), readmeContent);
        console.log('✅ Created README.md');
    }

    setup() {
        console.log('🚀 Setting up SOS API documentation...\n');

        try {
            this.ensureDirectories();
            this.createComponentFiles();
            this.createReadme();

            console.log('\n✅ SOS documentation setup complete!');
            console.log('\nNext steps:');
            console.log('1. Run: npm run build:sos-swagger');
            console.log('2. Start server: npm run dev');
            console.log('3. Visit: http://localhost:3000/sos-docs');

        } catch (error) {
            console.error('\n❌ Setup failed:', error.message);
            throw error;
        }
    }
}

// Run setup if called directly
if (require.main === module) {
    const setup = new SOSDocumentationSetup();
    setup.setup();
}

module.exports = SOSDocumentationSetup;