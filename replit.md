# HormiRuta

## Overview
HormiRuta es una aplicacion de planificacion y optimizacion de rutas de entrega construida con React + Vite y Node.js/Express. Servidor unificado que sirve tanto la API como el frontend desde el mismo puerto. Diseñada para conductores y empresas de logistica en el area metropolitana de Dallas.

## Project Structure
```
├── src/                       # Backend - Servidor Express
│   ├── config/                # Database configuration
│   ├── middleware/            # Auth + role middleware
│   ├── models/                # Sequelize ORM models
│   ├── routes/                # API routes (auth, admin, messaging)
│   ├── services/              # Respond.io, polling, address validation
│   └── index.js               # Main Express app
├── client/                    # Frontend - Codigo fuente React
│   ├── api.js                 # Axios client configuration
│   ├── App.jsx                # Main app with routing
│   ├── contexts/              # React Context providers
│   ├── layouts/               # Layout components
│   ├── pages/                 # Page components
│   └── main.jsx               # React entry point
├── public/                    # Archivos estaticos (imagenes, iconos)
├── dist/                      # Frontend compilado (generado por build)
├── android/                   # Proyecto Android (Capacitor)
├── ios/                       # Proyecto iOS (Capacitor)
├── capacitor.config.ts        # Configuracion Capacitor para mobile
├── package.json               # Dependencies + scripts unificados
├── vite.config.js             # Configuracion de Vite
└── index.html                 # HTML entry point
```

## Recent Changes
- 2026-01-30: Created comprehensive DOCUMENTATION.md for development team
- 2026-01-30: Removed all platform-specific references from codebase for client delivery
- 2026-01-30: Added SERVER_URL and SERVER_DOMAIN environment variables for flexible deployment
- 2026-01-30: Added Capacitor configuration for Android and iOS mobile compilation
- 2026-01-30: Generated Android project (android/) and iOS project (ios/)
- 2026-01-30: Updated .gitignore to exclude platform-specific files
- 2026-01-30: Unified project structure - single root with src/, client/, public/
- 2026-01-30: Expanded ZIP validation to search by city, address, or zone name
- 2026-01-29: Integrated Respond.io API v2 for chatbot messaging
- 2026-01-28: Migrated frontend from Quasar/Vue.js to React + Vite

## Technology Stack
### Frontend
- Framework: React 18 + Vite 5
- State Management: React Context API
- Routing: React Router 6
- HTTP Client: Axios
- Maps: Google Maps JavaScript API
- Mobile: Capacitor 6 (iOS/Android)

### Backend
- Runtime: Node.js
- Framework: Express.js
- ORM: Sequelize
- Database: PostgreSQL
- Authentication: express-session (session-based)
- Password Hashing: bcryptjs

## Scripts
```bash
npm start              # Run production server (port 5000)
npm run dev            # Run with --watch for development
npm run build          # Build frontend to dist/
npm run build:mobile   # Build + sync with Capacitor
npm run cap:sync       # Sync web assets to mobile projects
npm run cap:android    # Open Android Studio
npm run cap:ios        # Open Xcode (Mac only)
npm run cap:add:android # Add Android platform
npm run cap:add:ios     # Add iOS platform
```

## Mobile Compilation

### Android (Windows/Mac/Linux)
1. Run `npm run build` to compile frontend
2. Run `npx cap sync android` to sync with Android project
3. Open Android Studio and select the `android/` folder
4. Connect device or use emulator and click Run

### iOS (Mac only)
1. Run `npm run build` to compile frontend
2. Run `npx cap sync ios` to sync with iOS project
3. Run `cd ios/App && pod install` to install dependencies
4. Open `ios/App/App.xcworkspace` in Xcode
5. Select device/simulator and click Run

## Key Features
- User authentication (email/password)
- Role-based access control (admin, client, driver)
- Route planning with multiple stops
- Route optimization algorithm (nearest-neighbor)
- Google Maps integration for navigation
- Respond.io integration for messaging orders
- Coverage zone management (ZIP codes)
- Admin panel for user management
- Multi-criteria validation (ZIP, city, address, zone name)

## API Endpoints
### Authentication
- POST /api/auth/register - User registration
- POST /api/auth/login - User login
- POST /api/auth/logout - User logout
- GET /api/auth/me - Get current user

### Admin
- GET /api/admin/stats - Admin statistics
- GET /api/admin/users - List all users
- PUT /api/admin/users/:id - Update user

### Routes
- GET /api/routes - Get user routes
- POST /api/routes - Create new route
- GET /api/routes/:id - Get route by ID
- POST /api/routes/:id/optimize - Optimize route order

### Messaging (Respond.io Integration)
- GET /api/messaging/settings - Get messaging settings
- PUT /api/messaging/settings - Update messaging settings
- POST /api/messaging/validate-zip - Validate ZIP/city/address
- GET /api/messaging/coverage-zones - Get coverage zones

## Environment Variables
- DATABASE_URL - PostgreSQL connection string
- SESSION_SECRET - Express session secret
- VITE_GOOGLE_MAPS_API_KEY - Google Maps API key

## Git Exclusions
The following Replit-specific files/folders are excluded from Git:
- `.replit` - Replit configuration
- `.cache/` - Replit cache
- `.config/` - Replit config
- `.local/` - Local Replit data
- `.upm/` - Replit package manager
- `attached_assets/` - Replit attached files

## Development Notes
1. Server runs on port 5000 serving both API and frontend
2. Database tables are auto-created on startup via Sequelize sync
3. Frontend build output goes to `dist/` folder
4. Mobile apps read from `dist/` via Capacitor sync
