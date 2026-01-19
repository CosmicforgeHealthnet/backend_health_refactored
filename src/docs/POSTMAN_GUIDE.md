# Postman Testing Guide

This guide explains how to import and use the feature-based Postman collections generated for the CosmicForge Health API.

## 1. Locating the Collections
Collections are located inside each feature directory:
- `src/features/auth/postman_collection.json`
- `src/features/payments/postman_collection.json`
- `src/features/marketing/postman_collection.json`
- (and so on for other features)

Shared or uncategorized endpoints can be found in:
- `src/docs/postman/postman_collection.json`

## 2. Importing into Postman
1. Open Postman.
2. Click **Import** (top left).
3. Drag and drop the `postman_collection.json` file(s) you want to test.
4. You will see a new collection appear (e.g., "CosmicForge - Auth Feature").

## 3. Configuration (Critical!)
The collections use a variable `{{baseUrl}}` for the server address. You must define this.

### Option A: Environment Variable (Recommended)
1. In Postman, click **Environments** (sidebar) -> **+** (Create new).
2. Name it "CosmicForge Local".
3. Add a variable:
   - **Variable**: `baseUrl`
   - **Type**: `default`
   - **Initial Value**: `http://localhost:5001` (or your active port)
   - **Current Value**: `http://localhost:5001`
4. Save the environment.
5. Select "CosmicForge Local" from the environment dropdown (top right) before sending requests.

### Option B: Collection Variable
1. Click the **three dots (...)** next to the specific collection name -> **Edit**.
2. Go to the **Variables** tab.
3. Add `baseUrl` with value `http://localhost:5001`.
4. Click **Save**.

## 4. Authentication (JWT)
Most endpoints are protected and require a Bearer Token.

1. **Login First**:
   - Go to the **Auth Feature** collection.
   - Run the **Login** request (`POST /api/auth/login`) with valid credentials in the Body.
   - Copy the `accessToken` from the response.

2. **Set Token**:
   - **Global Method**: 
     - Go to your Environment ("CosmicForge Local").
     - Add a variable named `token` (or similar).
     - Paste the access token.
   - **Collection Method**:
     - Edit the Collection -> **Authorization**.
     - Choose Type: **Bearer Token**.
     - Token: `{{token}}` (if using environment) or paste the token directly.
     - **Note**: Ensure individual requests are set to "Inherit auth from parent".

## 5. Testing Workflow
1. **Start Server**: Ensure your backend is running (`npm start`).
2. **Select Environment**: distinct env selected in Postman.
3. **Login**: Get your fresh token.
4. **Test**: Run endpoints in other features (e.g., Payments, Appointments). 
   - If you get `401 Unauthorized`, check if your token is expired or not pasted correctly.

## 6. Troubleshooting
- **"Connection Refused"**: Check if `baseUrl` is correct and server is running.
- **"404 Not Found"**: Check if the route path is correct or if the feature is enabled in `app.js`.
- **"401 Unauthorized"**: Your Bearer Token is missing or invalid.
