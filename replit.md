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
│   │       ├── Dashboard/     # Main dashboard
│   │       ├── Messaging/     # Orders, Coverage, Settings
│   │       └── Planner/       # TripPlannerPage with Google Maps
│   ├── public/                # Static assets
│   ├── package.json           # React dependencies
│   ├── vite.config.js         # Vite configuration
│   └── capacitor.config.json  # Capacitor for mobile
├── backend-node/              # Backend Node.js/Express API
│   ├── src/
│   │   ├── config/            # Database configuration
│   │   ├── middleware/        # Auth + role middleware
│   │   ├── models/            # Sequelize ORM models
│   │   ├── routes/            # API routes (auth, admin, messaging)
│   │   ├── services/          # Respond.io, polling, address validation
│   │   └── index.js           # Main Express app
│   └── package.json           # Node dependencies
├── android/                   # Capacitor Android project
└── src/                       # Old Quasar frontend (deprecated)
```

## Recent Changes
- 2026-01-28: **Migrated frontend from Quasar/Vue.js to React + Vite**
  - Complete React implementation with Vite bundler
  - React Context API for state management (Auth, Messaging)
  - React Router for navigation with protected routes
  - All pages migrated: Login, Register, Dashboard, Admin, Messaging, TripPlanner
  - Google Maps integration in TripPlannerPage
  - Capacitor configured for mobile builds
- 2026-01-28: Added role-based access control and admin panel
  - User roles: admin, client, driver
  - Admin dashboard with user statistics
  - User management: list, edit, activate/deactivate, change roles
- 2026-01-27: Added polling mode for Respond.io (no webhook required)
  - Polling service to fetch new messages periodically
  - Auto-detect addresses in incoming messages
  - Create orders automatically when address is detected
- 2026-01-27: Added Respond.io messaging integration module
  - Orders from chat (WhatsApp, Instagram, web) converted to deliveries
  - Coverage zone management with bulk ZIP code import
  - Three attention modes: automatic, assisted, manual
- 2026-01-26: Backend migrated from Python/Flask to Node.js/Express

## Technology Stack
### Frontend
- **Framework**: React 18 + Vite 5
- **State Management**: React Context API
- **Routing**: React Router 6
- **HTTP Client**: Axios
- **Mobile**: Capacitor 6 for Android/iOS
- **Maps**: Google Maps JavaScript API

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **ORM**: Sequelize
- **Database**: PostgreSQL
- **Authentication**: express-session (session-based)
- **Password Hashing**: bcryptjs

## Workflows
1. **Start application** - React Vite dev server (port 5000)
2. **Backend API** - Node.js/Express API server (port 8000)

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
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user

### Admin
- `GET /api/admin/stats` - Admin statistics
- `GET /api/admin/users` - List all users
- `PUT /api/admin/users/:id` - Update user

### Routes
- `GET /api/routes` - Get user routes
- `POST /api/routes` - Create new route
- `GET /api/routes/:id` - Get route by ID
- `POST /api/routes/:id/optimize` - Optimize route order
- `POST /api/routes/:id/stops` - Add stop to route
- `POST /api/routes/:id/start` - Start navigation

### Stops
- `DELETE /api/stops/:id` - Delete stop
- `POST /api/stops/:id/complete` - Mark stop complete

### Messaging (Respond.io Integration)
- `GET /api/messaging/settings` - Get messaging settings
- `PUT /api/messaging/settings` - Update messaging settings
- `POST /api/messaging/settings/test-connection` - Test connection
- `GET /api/messaging/orders` - Get messaging orders
- `POST /api/messaging/orders/:id/confirm` - Confirm order
- `POST /api/messaging/orders/:id/cancel` - Cancel order
- `POST /api/messaging/orders/:id/complete` - Complete order
- `GET /api/messaging/coverage-zones` - Get coverage zones
- `POST /api/messaging/coverage-zones` - Create coverage zone
- `POST /api/messaging/coverage-zones/bulk` - Bulk create zones
- `DELETE /api/messaging/coverage-zones/:id` - Delete zone
- `GET /api/messaging/stats` - Get messaging statistics
- `GET /api/messaging/polling/status` - Get polling status
- `POST /api/messaging/polling/start` - Start polling
- `POST /api/messaging/polling/stop` - Stop polling
- `POST /api/messaging/polling/sync` - Manual sync

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Express session secret (required in production)

## Development
1. Frontend runs on port 5000 with hot reload
2. Backend runs on port 8000
3. Database tables are auto-created on startup via Sequelize sync
4. Use `cd frontend-react && npm run dev` to start frontend
5. Use `cd backend-node && npm start` to start backend
