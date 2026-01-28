# HormiRuta

## Overview
HormiRuta es una aplicacion de planificacion y optimizacion de rutas de entrega construida con React + Vite y Node.js/Express como backend API. Disenada para conductores y empresas de logistica.

## Project Structure
```
├── frontend-react/            # Frontend React + Vite
│   ├── src/
│   │   ├── api.js             # Axios client configuration
│   │   ├── App.jsx            # Main app with routing
│   │   ├── contexts/          # React Context providers
│   │   │   ├── AuthContext.jsx    # Authentication state
│   │   │   └── MessagingContext.jsx # Messaging/orders state
│   │   ├── layouts/           # Layout components
│   │   │   ├── DashboardLayout.jsx  # Web dashboard (admin, messaging)
│   │   │   └── PlannerLayout.jsx    # Route planner (mobile-optimized)
│   │   └── pages/             # Page components
│   │       ├── Auth/          # Login, Register
│   │       ├── Admin/         # Admin panel (dashboard, users)
│   │       ├── Messaging/     # Orders, Coverage, Settings
│   │       └── Planner/       # TripPlannerPage with Google Maps
│   ├── public/                # Static assets (logos, icons)
│   ├── package.json           # React dependencies
│   └── vite.config.js         # Vite configuration
├── backend-node/              # Backend Node.js/Express API
│   ├── src/
│   │   ├── config/            # Database configuration
│   │   ├── middleware/        # Auth + role middleware
│   │   ├── models/            # Sequelize ORM models
│   │   ├── routes/            # API routes (auth, admin, messaging)
│   │   ├── services/          # Respond.io, polling, address validation
│   │   └── index.js           # Main Express app
│   └── package.json           # Node dependencies
└── attached_assets/           # Reference assets
```

## Recent Changes
- 2026-01-28: Cleaned project structure - Removed old Quasar/Vue.js frontend and Python backend
- 2026-01-28: Improved admin panel design - Modern dark theme with better UX
- 2026-01-28: Fixed Respond.io timezone error - Added required timezone parameter
- 2026-01-28: Migrated frontend from Quasar/Vue.js to React + Vite

## Technology Stack
### Frontend
- Framework: React 18 + Vite 5
- State Management: React Context API
- Routing: React Router 6
- HTTP Client: Axios
- Maps: Google Maps JavaScript API

### Backend
- Runtime: Node.js
- Framework: Express.js
- ORM: Sequelize
- Database: PostgreSQL
- Authentication: express-session (session-based)
- Password Hashing: bcryptjs

## Workflows
1. Start application - React Vite dev server (port 5000)
2. Backend API - Node.js/Express API server (port 8000)

## Key Features
- User authentication (email/password)
- Role-based access control (admin, client, driver)
- Route planning with multiple stops
- Route optimization algorithm (nearest-neighbor)
- Google Maps integration for navigation
- Respond.io integration for messaging orders
- Coverage zone management (ZIP codes)
- Admin panel for user management

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
- POST /api/routes/:id/stops - Add stop to route
- POST /api/routes/:id/start - Start navigation

### Messaging (Respond.io Integration)
- GET /api/messaging/settings - Get messaging settings
- PUT /api/messaging/settings - Update messaging settings
- POST /api/messaging/settings/test-connection - Test connection
- GET /api/messaging/orders - Get messaging orders
- GET /api/messaging/coverage-zones - Get coverage zones
- POST /api/messaging/coverage-zones - Create coverage zone
- POST /api/messaging/coverage-zones/bulk - Bulk create zones

## Environment Variables
- DATABASE_URL - PostgreSQL connection string
- SESSION_SECRET - Express session secret
- VITE_GOOGLE_MAPS_API_KEY - Google Maps API key

## Development
1. Frontend runs on port 5000 with hot reload
2. Backend runs on port 8000
3. Database tables are auto-created on startup via Sequelize sync
