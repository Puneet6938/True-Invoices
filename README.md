# True Invoices

A MERN billing system with:

- Email and phone based registration/login
- Firm profile with GST number, address, and mobile number
- Customer and product management
- Invoice generation with paid, partial, and unpaid status
- Payment collection and invoice balance tracking
- Print-ready invoices
- WhatsApp payment reminders

## Structure

- `backend` - Express + MongoDB API
- `frontend` - React + Vite client

## Deployment

This project can be deployed as a single Node service:

- Build the frontend with `npm run build`
- Start the backend with `npm start`
- The backend will automatically serve `frontend/dist` when that build exists

### Required environment variables

Backend:

```bash
PORT=5000
MONGODB_URI=your-mongodb-connection-string
JWT_SECRET=your-strong-secret
CLIENT_URL=https://your-app-domain.com
WHATSAPP_BASE_URL=https://wa.me
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

Frontend:

```bash
VITE_API_URL=/api
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

### Deploy flow

1. Create a MongoDB database, for example on MongoDB Atlas.
2. Set the backend environment variables.
3. Set `VITE_API_URL=/api` so the frontend uses the same domain as the backend.
4. Run `npm install`.
5. Run `npm run build`.
6. Start the app with `npm start`.

### Notes

- `CLIENT_URL` must match your deployed frontend URL exactly for CORS.
- If you do not want Google login, leave `GOOGLE_CLIENT_ID` empty.
- Existing local development still works with `npm run dev:backend` and `npm run dev:frontend`.

## Deploy On Render

This repo now includes [render.yaml](/g:/True%20Invoices/render.yaml), so you can deploy it with Render Blueprints as a single web service.

### Before you start

You need a MongoDB connection string. The easiest option is MongoDB Atlas.

### Render steps

1. Push this project to GitHub.
2. In Render, click `New +` -> `Blueprint`.
3. Select your GitHub repo.
4. Render will detect `render.yaml` and create one web service named `true-invoices`.
5. When prompted, set `MONGODB_URI` to your MongoDB Atlas connection string.
6. Finish the deploy.

### Optional environment variables on Render

Add these in the Render dashboard only if you need them:

- `GOOGLE_CLIENT_ID` for backend Google auth verification
- `VITE_GOOGLE_CLIENT_ID` for showing the Google login button in the frontend build
- `CLIENT_URL` if you want to override the default Render URL detection

### Build and start commands

Render will use:

```bash
npm install && npm run build
npm start
```

### Health check

Render health checks should point to:

```bash
/api/health
```

## Setup

### 1. Install dependencies

```bash
npm run install:all
```

### 2. Configure environment

Copy:

- `backend/.env.example` -> `backend/.env`
- `frontend/.env.example` -> `frontend/.env`

### 3. Start MongoDB

Use a local MongoDB instance or a hosted MongoDB URI.

### 4. Run the apps

Backend:

```bash
npm run dev:backend
```

Frontend:

```bash
npm run dev:frontend
```

## WhatsApp reminders

By default the app creates a WhatsApp deep link (`wa.me`) that opens a reminder message.

If you want server-side sending, connect a provider in `backend/src/services/whatsappService.js`.
