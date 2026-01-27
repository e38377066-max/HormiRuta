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
│   │   ├── Messaging/         # Respond.io messaging module
│   │   └── Settings/          # Settings pages
│   ├── router/                # Vue Router configuration
│   └── stores/                # Pinia stores (auth, routes, theme)
├── backend-node/              # Backend Node.js/Express API
│   ├── src/
│   │   ├── config/            # Database configuration
│   │   ├── middleware/        # Auth middleware
│   │   ├── models/            # Sequelize ORM models
│   │   ├── routes/            # API routes (auth, routes, stops, history, messaging)
│   │   ├── services/          # Optimization, Respond.io, address validation services
│   │   └── index.js           # Main Express app
│   └── package.json           # Node dependencies
├── android/                   # Capacitor Android project
├── quasar.config.js           # Quasar configuration
└── package.json               # Frontend dependencies
```

## Recent Changes
- 2026-01-27: Added polling mode for Respond.io (no webhook required)
  - Polling service to fetch new messages periodically (configurable interval)
  - List contacts with open conversations from Respond.io API
  - Fetch messages per contact for processing
  - Auto-detect addresses in incoming messages
  - Create orders automatically when address is detected
  - UI controls to start/stop polling and sync manually
  - Works without premium Respond.io webhook subscription
- 2026-01-27: Added Respond.io messaging integration module
  - Separate messaging module from route optimizer
  - Orders from chat (WhatsApp, Instagram, web) converted to deliveries
  - Automatic address validation and ZIP code coverage checking
  - Coverage zone management with bulk ZIP code import
  - Automated responses for coverage/no-coverage scenarios
  - Three attention modes: automatic, assisted, manual
  - Message logging and conversation tracking
  - New database tables: messaging_orders, coverage_zones, message_logs, messaging_settings
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

### Messaging (Respond.io Integration)
- `GET /api/messaging/settings` - Get messaging settings
- `PUT /api/messaging/settings` - Update messaging settings
- `POST /api/messaging/settings/test-connection` - Test Respond.io API connection
- `GET /api/messaging/orders` - Get messaging orders
- `POST /api/messaging/orders` - Create order manually
- `GET /api/messaging/orders/:id` - Get order detail with messages
- `PUT /api/messaging/orders/:id` - Update order
- `POST /api/messaging/orders/:id/confirm` - Confirm order
- `POST /api/messaging/orders/:id/cancel` - Cancel order
- `POST /api/messaging/orders/:id/complete` - Complete order
- `POST /api/messaging/orders/:id/send-message` - Send message to customer
- `GET /api/messaging/coverage-zones` - Get coverage zones
- `POST /api/messaging/coverage-zones` - Create coverage zone
- `POST /api/messaging/coverage-zones/bulk` - Bulk create zones
- `PUT /api/messaging/coverage-zones/:id` - Update zone
- `DELETE /api/messaging/coverage-zones/:id` - Delete zone
- `POST /api/messaging/validate-address` - Validate address coverage
- `POST /api/messaging/webhook` - Webhook endpoint for Respond.io
- `GET /api/messaging/stats` - Get messaging statistics

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Express session secret (required in production)
- `RESPOND_IO_API_TOKEN` - Respond.io API token (stored per user in database)

## Development
1. Frontend runs on port 5000 with hot reload
2. Backend runs on port 8000 with auto-reload
3. Database tables are auto-created on startup via Sequelize sync
