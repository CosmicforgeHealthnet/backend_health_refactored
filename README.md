# cosmicForge\_health\_backend.

A simple, robust backend for the CosmicForge Health application built with Node.js, Express, PostgreSQL, and an ORM (TypeORM).

---

## Table of Contents

* [Features](#features)
* [Prerequisites](#prerequisites)
* [Installation](#installation)
* [Configuration](#configuration)
* [Database (ORM)](#database-orm)
* [Running the App](#running-the-app)
* [API Documentation](#api-documentation)
* [Contributing](#contributing)
* [License](#license)

---

## Features

* **Express** server with a Welcome route (`GET /`)
* **PostgreSQL** database connection
* **TypeORM** as the Object Relational Mapper (ORM) for modeling and querying database
* **Swagger** UI available at `/api-docs`
* Environment-specific configurations (`.env.development`, `.env.production`)

---

## Prerequisites

* [Node.js](https://nodejs.org/) (>= 14.x)
* [npm](https://www.npmjs.com/)
* Access to a PostgreSQL database

---

## Installation

1. **Clone** the repository:

   ```bash
   git clone https://github.com/<your-username>/cosmicForge_health_backend.git
   cd cosmicForge_health_backend
   ```

2. **Install** dependencies:
   ```bash
   npm install
   ```
---

## Configuration

1. **Copy** environment files:

   ```bash
   cp .env.development .env.production .env.example
   ```

2. **Edit** `.env.development` and `.env.production` to set your database credentials and other settings:

   ```ini
   NODE_ENV=development
   PORT=3000
   DB_HOST=<your-db-host>
   DB_PORT=5432
   DB_USER=<your-db-user>
   DB_PASS=<your-db-password>
   DB_NAME=<your-db-name>
   ```

---

## Database (ORM)

This project uses **TypeORM** (an ORM) to define and interact with PostgreSQL tables via JavaScript/TypeScript entities:

* **Entities** live in `src/entities/`
* **DataSource** config in `src/config/database.js`
* Automatic schema synchronization **only in development**
* SSL support for production databases (e.g., Render-hosted Postgres)

---

## Running the App

* **Development** (with hot reload):

  ```bash
  npm run dev
  ```

* **Production**:

  ```bash
  npm run start
  ```

You should see:

```
✔️  Database connected
🚀  Server running on http://localhost:3000
📚  Swagger UI at http://localhost:3000/api-docs
```

---

## API Documentation

Open your browser to:

```
http://localhost:3000/api-docs
```

This Swagger UI will show all available endpoints, including the Welcome route.

---

## Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'feat: add ...'`)
4. Push to branch (`git push origin feature/my-feature`)
5. Open a Pull Request

---

## 📋 API Documentation

This project uses OpenAPI 3.0.3 for API documentation. The Swagger UI shows all available endpoints at `/api-docs`.

### 🏗️ Structure

```
docs/
├── components.yaml              # Main schemas
├── auth.yaml                   # Auth endpoints
├── doctorVerification.yaml     # Doctor verification
├── adminVerification.yaml      # Admin verification
├── file.yaml                   # File management
├── notification.yaml           # Notifications
├── userProfile/                # Profile schemas
│   ├── doctor.yaml
│   ├── patient.yaml
│   └── profileOptions.yaml
└── swagger.yaml                # Final bundled docs
```

### 🚀 Quick Start

**Generate documentation:**
```bash
# Generate complete swagger.yaml from modular files
node node src/docs/mergeSwaggerComponents.js

# Validate the bundled documentation
node docs/debug-swagger.js
```
**NPM Scripts:**
```bash

# Bundle and validate documentation
npm run swagger:bundle

# Start development server with live docs
npm run dev
```

### 📚 Key Features

- **Modular Architecture**: Each feature has its own path and component files
- **Auto-validation**: Built-in validation catches missing references and schema errors  
- **Component Reuse**: Shared schemas for consistent data structures
- **Comprehensive Coverage**: Documents all endpoints including:
  - Authentication (login, magic links, OAuth)
  - Doctor verification workflows
  - Admin management interfaces
  - File upload and management
  - Patient and doctor profiles
  - Real-time notifications

### 🔍 Accessing Documentation

- **Swagger UI**: Available at `/api-docs` when server is running
- **Raw OpenAPI**: Complete specification in `docs/swagger.yaml`
- **Backup**: Auto-generated backup in `docs/swagger-backup.yaml`

### 🛠️ Development Workflow

When adding new endpoints:

1. **Add path definitions** to the appropriate feature file (e.g., `auth.yaml`)
2. **Define schemas** in `components.yaml` or relevant component files
3. **Run the merge command** to generate complete documentation: `node src/docs/mergeSwaggerComponents.js`
4. **Validate** the result: `node docs/debug-swagger.js`
5. **Build it to the bundle** the result: `npm run swagger:bundle`
5. **Test** in Swagger UI at `/api-docs`

The bundling system automatically handles schema validation and will alert you to any missing references or structural issues.

---
## Setup Summary

Here’s what we’ve implemented so far:

1. **Project Scaffold**  
   - Established the directory layout under `src/` (config, docs, entities, etc.) and `tests/`.  
   - Created core files: `app.js`, `server.js`, `database.js`, `entities/index.js`, Swagger spec (`swagger.yaml`), and environment files.

2. **Environment Configuration**  
   - Defined `.env.development` and `.env.production` for environment-specific variables.  
   - Centralized loader in `src/config/index.js` that picks the correct file based on `NODE_ENV`.

3. **Database & ORM Setup**  
   - Configured PostgreSQL connection in `src/config/database.js` using TypeORM’s `DataSource`, enabling SSL for hosted DBs.  
   - `synchronize: true` is used in development; migrations are configured for production.

4. **Entity Definitions**  
   - Modeled `User`, `DoctorProfile`, `EmailVerification`, `MagicLinkToken`, `RefreshToken`, and `AuthEvent` via TypeORM `EntitySchema`.  
   - Defined relations (one‑to‑one, one‑to‑many) to generate the correct foreign keys.
   - Aggregated all schemas in `src/entities/index.js`.

5. **Migration Workflow**  
   - Switched off full schema sync in production and configured a `migrations/` directory.
   - Generated and applied migrations with TypeORM CLI (`npm run migration:generate` and `npm run migration:run`) to ensure incremental, non‑destructive updates.

Each of these steps lays the foundation for building out authentication controllers and routes.

## License
This project is licensed under the MIT License.# backend_health_refactored
# backend_health_refactored
