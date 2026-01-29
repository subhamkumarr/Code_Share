# Deployment Guide for LiveCodeShare

## The Problem

If you're seeing "Failed to initialize socket connection" in production, it's likely because:

1. **Frontend is deployed as a Static Site** (doesn't run Node.js)
2. **Backend URL is not configured** (frontend doesn't know where backend is)

## Solution Options

### Option 1: Single Service (Recommended for Render)

Deploy your app as a **Web Service** (not Static Site) on Render:

1. In Render dashboard, create a **Web Service**
2. Connect your GitHub repo
3. Build command: `npm install && npm run build`
4. Start command: `npm run server:prod`
5. Set environment variable: `NODE_ENV=production`

This runs both frontend and backend from the same service.

### Option 2: Separate Services (Frontend + Backend)

If you want separate services:

#### Backend Service:
1. Create a **Web Service** on Render
2. Build command: `npm install`
3. Start command: `node server.js`
4. Set environment variables:
   - `NODE_ENV=production`
   - `FRONTEND_URL=https://your-frontend-url.onrender.com`
   - `PORT=10000` (or let Render assign)

#### Frontend Service:
1. Create a **Static Site** on Render
2. Build command: `npm install && npm run build`
3. Publish directory: `build`
4. **IMPORTANT**: Set environment variable:
   - `REACT_APP_BACKEND_URL=https://your-backend-service.onrender.com`
   - `REACT_APP_SOCKET_URL=https://your-backend-service.onrender.com`

**Note**: After setting env vars, you MUST rebuild the frontend (env vars are baked in at build time).

### Option 3: Runtime Configuration (No Rebuild Needed)

If you can't rebuild, you can use runtime configuration:

1. After deploying, edit `public/config.js` in your deployed files
2. Set `BACKEND_URL` to your backend service URL:
   ```javascript
   window.APP_CONFIG = {
     BACKEND_URL: 'https://your-backend-service.onrender.com',
     SOCKET_URL: 'https://your-backend-service.onrender.com'
   };
   ```
3. This works without rebuilding!

## Quick Fix for Current Deployment

If you're already deployed and seeing errors:

1. **Check your backend service URL** (if separate)
2. **Edit `public/config.js`** in your deployed static site:
   ```javascript
   window.APP_CONFIG = {
     BACKEND_URL: 'https://your-actual-backend-url.onrender.com',
     SOCKET_URL: 'https://your-actual-backend-url.onrender.com'
   };
   ```
3. **Redeploy** (or just update the config.js file if you have file access)

## Verifying the Fix

After deploying, check browser console:
- Should see: `✅ Socket connected: [socket-id]`
- Should NOT see: `❌ Socket connection failed`

## Common Issues

### "WebSocket connection failed"
- Backend is not running
- Backend URL is wrong
- CORS is blocking (check `FRONTEND_URL` env var on backend)

### "Socket connection timeout"
- Backend service is sleeping (Render free tier)
- Backend URL is incorrect
- Network/firewall blocking

### "CORS error"
- Set `FRONTEND_URL` on backend service to your frontend URL
- Ensure backend allows your frontend origin
