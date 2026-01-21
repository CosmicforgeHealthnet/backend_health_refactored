# Docker Setup & Deployment Guide

This guide explains how to run the application using Docker, the architecture of the services, and how to deploy it to production.

## 🏗 System Architecture

The application is composed of 4 main services running in Docker containers:

1.  **Backend (Node.js)**
    *   **Container Name:** `cosmic_backend`
    *   **Port:** 5000
    *   **Description:** The main API server. Connects to Postgres (external/cloud) and Redis (local/container).
2.  **AI Service (Python)**
    *   **Container Name:** `cosmic_brain`
    *   **Port:** 8001
    *   **Description:** Microservice for AI/ML tasks. Accessible internally by the backend.
3.  **Redis**
    *   **Container Name:** `cosmic_redis`
    *   **Port:** 6379 (Internal)
    *   **Description:** Caching and session store. Used by the backend.
4.  **Nginx (Gateway)**
    *   **Container Name:** `cosmic_gateway`
    *   **Port:** 80 (Public)
    *   **Description:** Reverse proxy that routes traffic to the Backend and AI Service.

---

## 🚀 Running Locally

To start the entire system locally:

1.  **Ensure Docker is running** (Docker Desktop on Windows/Mac).
2.  **Run Docker Compose:**
    ```bash
    docker-compose up --build
    ```

This command will:
*   Build the Backend and AI Service images.
*   Pull the official Redis and Nginx images.
*   Start all containers in the correct order.

### ⚡ Running with NPM

You can also use the following shortcuts:

*   **Development Mode:**
    ```bash
    npm run docker:dev
    # Runs in foreground with logs
    ```

*   **Production/Detached Mode:**
    ```bash
    npm run docker:prod
    # Runs in background (-d)
    ```

### Accessing Services
*   **Web App/API:** `http://localhost:80` (via Nginx)
*   **Backend Direct:** `http://localhost:5000`
*   **AI Service Direct:** `http://localhost:8001`

### 🌐 Accessing via Your Domain (`api.cosmicforge-healthnet.com`)

Since you are using **Nginx** as a gateway, it handles routing based on the URL path.

*   **Main Application (Backend):**
    *   URL: `https://api.cosmicforge-healthnet.com/`
    *   Example API Call: `https://api.cosmicforge-healthnet.com/api/users`
    *   *How it works:* Nginx forwards all requests at the root `/` to the Node.js backend.

*   **AI Service:**
    *   URL: `https://api.cosmicforge-healthnet.com/ai/`
    *   Example API Call: `https://api.cosmicforge-healthnet.com/ai/analyze`
    *   *How it works:* Nginx takes requests starting with `/ai/`, strips the `/ai` prefix, and forwards them to the Python AI service (e.g. `.../ai/analyze` becomes `/analyze` on the python container).

**Note:** Ensure your DNS points `api.cosmicforge-healthnet.com` to your VPS IP address.

---

## ⚙️ Configuration

### Environment Variables configuration
*   **Development:** Uses `docker-compose.yml` which loads `.env.development`.
*   **Production:** Uses `docker-compose.prod.yml` which loads `.env`.

**Important for VPS:**
On your server, rename your production env file to `.env`:
```bash
mv .env.production .env
```
Then run the production script.

### Docker Compose (`docker-compose.yml`)
*   Defines the services, networks, and volumes.
*   Maps ports and mounts code directories for live reloading (where configured).

---

## 🌍 Deployment

To deploy this stack to a server (like a VPS), follow these general steps:

### Prerequisites
*   A server (Ubuntu recommended) with **Docker** and **Docker Compose** installed.
*   Git installed to pull the repository.

### Deployment Steps
1.  **Clone the Repository:**
    ```bash
    git clone <your-repo-url>
    cd backend_health_refactored
    ```

2.  **Configure Environment:**
    *   Create a production `.env` file (e.g., `.env.production`).
    *   Update `docker-compose.yml` if needed (typically you'd use a `docker-compose.prod.yml` or override file for production to remove build contexts and point to built images, but for simple deployments, the default works).

3.  **Run in Background:**
    ```bash
    docker-compose up -d --build
    ```
    *   `-d` runs the containers in detached mode (background).

4.  **Verify Running Containers:**
    ```bash
    docker-compose ps
    ```

5.  **View Logs:**
    ```bash
    docker-compose logs -f
    ```

### Updates
To deploy code changes:
1.  `git pull`
2.  `docker-compose up -d --build` (Rebuilds and restarts only changed services)

---

## 🔧 Troubleshooting Common Issues

*   **Redis Connection Error:** Ensure the `redis` service is up and the `REDIS_URL` in the backend corresponds to the service name (`redis`) defined in `docker-compose.yml`, not `localhost`.
*   **Port Conflicts:** If ports 80, 5000, 6379, or 8001 are already in use on the host, modify the `ports` mapping in `docker-compose.yml` (e.g., `"5001:5000"`).
