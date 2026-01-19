# SOS Emergency Services API Documentation

## Overview
This directory contains the Swagger/OpenAPI documentation for the CosmicForge SOS Emergency Services API.

## Structure
```
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
```

## Building Documentation

### Generate the bundle:
```bash
npm run build:sos-swagger
```

### View the documentation:
1. Start your server: `npm start` or `npm run dev`  
2. Visit: `http://localhost:3000/sos-docs`

## API Endpoints

### Emergency Numbers
- `GET /api/sos/emergency-numbers` - Get emergency numbers for current location
- `GET /api/sos/emergency-numbers/by-country` - Get emergency numbers by country

### Emergency Services  
- `GET /api/sos/emergency/{type}` - Get emergency info by type
- `GET /api/sos/service/{type}` - Get specific service info

### Safety Tips
- `GET /api/sos/safety-tips/{type}` - Get safety tips by type
- `GET /api/sos/safety-tips` - Get all safety tips

## Supported Countries
The API supports emergency numbers for 50+ countries including:
- Nigeria (NG) - 112 universal
- United States (US) - 911 universal  
- United Kingdom (GB) - 999 universal
- European Union (EU) - 112 universal
- And many more...

## Emergency Types
- `police` - Police/Law enforcement
- `fire` - Fire department
- `medical` - Medical/Ambulance
- `general` - General emergency tips

## Development

### Adding New Countries
1. Update `emergencyNumbers` object in `data/repositories/emergencyNumbers.js`
2. Add country mapping in `countryCodeMap`
3. Rebuild documentation: `npm run build:sos-swagger`

### Adding New Safety Tips
1. Update `emergencySafetyTips` object in the data file
2. Add new tip categories as needed
3. Update API endpoints and documentation

## Contributing
When making changes to the API:
1. Update the relevant controller
2. Update schemas in `components/` if needed  
3. Run `npm run build:sos-swagger` to regenerate docs
4. Test the API endpoints
5. Update this README if needed

## Support
For questions about this API, contact the CosmicForge Health development team.
