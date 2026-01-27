# HormiRuta

## Overview
HormiRuta es una aplicación de planificación y optimización de rutas de entrega construida con Quasar Framework (Vue.js 3) y Node.js/Express como backend API. Diseñada para conductores y empresas de logística.

## Project Structure
```
├── src/                       # Frontend Quasar/Vue.js
│   ├── boot/                  # Boot files (axios config)
│   ├── components/            # Vue components
│   ├── layouts/               # Layout components
│   ├── pages/                 # Page components
│   │   ├── Auth/              # Login, Register, Splash
│   │   ├── Routes/            # Routes management
│   │   └── Settings/          # Settings pages
│   ├── router/                # Vue Router configuration
│   └── stores/                # Pinia stores (auth, routes, theme)
├── backend-node/              # Backend Node.js/Express API
│   ├── src/
│   │   ├── config/            # Database configuration
│   │   ├── middleware/        # Auth middleware
│   │   ├── models/            # Sequelize ORM models
│   │   ├── routes/            # API routes (auth, routes, stops, history)
│   │   ├── services/          # Optimization service
│   │   └── index.js           # Main Express app
│   └── package.json           # Node dependencies
├── android/                   # Capacitor Android project
├── quasar.config.js           # Quasar configuration
└── package.json               # Frontend dependencies
```

## Recent Changes
- 2026-01-27: Added route preferences and dynamic rerouting
  - Avoid tolls, highways, ferries options in route optimization
  - Dynamic rerouting when driver deviates from route (200m threshold)
  - Reroute cooldown of 15 seconds to prevent excessive API calls
  - Route polyline tracking for deviation detection
  - UI indicators for rerouting status and active preferences
- 2026-01-27: Added GPS-based automatic stop confirmation for hands-free delivery
  - Real-time GPS tracking using Capacitor Geolocation watchPosition
  - Automatic arrival detection (50-meter threshold)
  - Auto-complete toggle for enabling/disabling automatic confirmation
  - Live distance display to next stop
  - 5-second cooldown between auto-completions
  - Vibration feedback on arrival
- 2026-01-26: Backend migrated from Python/Flask to Node.js/Express
- Frontend Quasar running on port 5000
- Backend Node.js API running on port 8000
- PostgreSQL database with Sequelize ORM

## Technology Stack
### Frontend
- **Framework**: Quasar 2.x (Vue.js 3)
- **State Management**: Pinia
- **Routing**: Vue Router
- **HTTP Client**: Axios
- **Mobile**: Capacitor for Android/iOS
- **Maps**: Google Maps API
- **Icons**: FontAwesome, Material Icons

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **ORM**: Sequelize
- **Database**: PostgreSQL
- **Authentication**: express-session (session-based)
- **Password Hashing**: bcryptjs

## Workflows
1. **Start application** - Frontend Quasar dev server (port 5000)
2. **Backend API** - Node.js/Express API server (port 8000)

## Key Features
- User authentication (email/password + Google OAuth)
- Route planning with multiple stops
- Route optimization algorithm (nearest-neighbor)
- Stop management (add, edit, delete, reorder)
- Navigation mode with step-by-step guidance
- Route history
- CSV/text import for bulk addresses
- Voice input support

## API Endpoints
### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/update` - Update user profile

### Routes
- `GET /api/routes` - Get user routes
- `POST /api/routes` - Create new route
- `GET /api/routes/:id` - Get route by ID
- `PUT /api/routes/:id` - Update route
- `DELETE /api/routes/:id` - Delete route
- `POST /api/routes/:id/optimize` - Optimize route order
- `POST /api/routes/:id/stops` - Add stop to route
- `POST /api/routes/:id/reorder` - Reorder stops
- `POST /api/routes/:id/start` - Start navigation
- `POST /api/routes/:id/complete` - Complete route

### Stops
- `PUT /api/stops/:id` - Update stop
- `DELETE /api/stops/:id` - Delete stop
- `POST /api/stops/:id/complete` - Mark stop complete
- `POST /api/stops/:id/fail` - Mark stop failed

### History
- `GET /api/history` - Get route history
- `GET /api/history/:id` - Get history detail

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Express session secret (required in production)

## Development
1. Frontend runs on port 5000 with hot reload
2. Backend runs on port 8000 with auto-reload
3. Database tables are auto-created on startup via Sequelize sync
