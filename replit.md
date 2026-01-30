# HormiRuta

## Overview
HormiRuta es una aplicacion de planificacion y optimizacion de rutas de entrega construida con React + Vite y Node.js/Express. Servidor unificado que sirve tanto la API como el frontend desde el mismo puerto. Disenada para conductores y empresas de logistica.

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
├── package.json               # Dependencies + scripts unificados
├── vite.config.js             # Configuracion de Vite
└── index.html                 # HTML entry point
```

## Recent Changes
- 2026-01-30: Unified project structure - single root with src/, client/, public/
- 2026-01-30: Expanded ZIP validation to search by city, address, or zone name
- 2026-01-29: Integrated Respond.io API v2 for chatbot messaging
- 2026-01-29: Added respondApiService.js with all Respond.io API endpoints
- 2026-01-28: Added chatbot system with conversation flow management
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
npm start        # Run production server (port 5000)
npm run dev      # Run with --watch for development
npm run build    # Build frontend to dist/
```

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

## Development
1. Run `npm start` to start the server
2. Server runs on port 5000 serving both API and frontend
3. Database tables are auto-created on startup via Sequelize sync
4. To rebuild frontend: `npm run build`
