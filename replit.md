# HormiRuta - Route Optimization App

## Overview
HormiRuta is a Quasar (Vue.js) route optimization application designed to replicate Circuit/Spoke Route Planner functionality. Built with Capacitor for mobile deployment (Android/iOS) and web support.

## Current State
- **Frontend**: Quasar v2.18.5 with Vue 3 running on port 5000
- **Backend**: Flask API running on port 8000 with PostgreSQL database
- **Authentication**: Local email/password + Google OAuth v2
- **Language**: Spanish interface throughout

## Project Architecture

### Backend (Flask)
```
backend/
  app.py          - Main Flask application with all API routes
  models.py       - SQLAlchemy models (User, Route, Stop, RouteHistory)
  optimization.py - Route optimization algorithms (TSP with nearest-neighbor + 2-opt)
  google_auth.py  - Google OAuth integration
```

### Frontend (Quasar/Vue)
```
src/
  boot/axios.js           - API client configuration
  layouts/MainLayout.vue  - Main app layout with navigation drawer
  pages/
    Auth/
      LoginPage.vue       - Login with email/password and Google OAuth
      RegisterPage.vue    - User registration
      SplashScreem.vue    - Initial splash screen
    Routes/
      RoutesPage.vue      - List of user routes
      RouteDetailPage.vue - Route details with stops management
      HistoryPage.vue     - Completed routes history
  stores/
    auth-store.js         - Pinia store for authentication
    route-store.js        - Pinia store for routes and stops
  router/routes.js        - Vue Router configuration
```

## Key Features Implemented

### Route Management
- Create, update, delete routes
- Add stops manually, via CSV import, or text paste
- Drag-and-drop stop reordering
- Route optimization using TSP algorithm
- ETA calculation for each stop
- Persist optimization results to database

### Stop Features
- Address with coordinates
- Customer name and phone
- Time windows (delivery time constraints)
- Priority levels (normal, high, urgent)
- Package location (for quick retrieval)
- Duration at stop
- Notes

### Proof of Delivery (POD)
- Mark stops as completed or failed
- Capture recipient name
- Photo capture (mobile only)
- Signature capture (mobile only)
- Delivery notes
- Failed reason selection

### Navigation
- Google Maps integration for directions
- Deep link to Google Maps app on mobile
- Support for Waze navigation

### History
- Complete route history with POD data
- Per-stop audit trail
- Distance and duration tracking

## API Endpoints

### Authentication
- POST /api/auth/register - User registration
- POST /api/auth/login - Email/password login
- POST /api/auth/logout - Logout
- GET /api/auth/me - Get current user
- PUT /api/auth/update - Update user profile
- GET /api/auth/google/login - Google OAuth initiation
- GET /api/auth/google/callback - Google OAuth callback

### Routes
- GET /api/routes - List user routes
- POST /api/routes - Create new route
- GET /api/routes/:id - Get route details
- PUT /api/routes/:id - Update route
- DELETE /api/routes/:id - Delete route
- POST /api/routes/:id/optimize - Optimize route order
- POST /api/routes/:id/start - Start route navigation
- POST /api/routes/:id/complete - Complete route
- POST /api/routes/:id/reorder - Reorder stops
- POST /api/routes/:id/import-csv - Import stops from CSV
- POST /api/routes/:id/import-text - Import stops from text
- GET /api/routes/:id/directions - Get Google directions

### Stops
- POST /api/routes/:id/stops - Add stop to route
- PUT /api/stops/:id - Update stop
- DELETE /api/stops/:id - Delete stop
- POST /api/stops/:id/complete - Complete stop with POD
- POST /api/stops/:id/fail - Mark stop as failed

### History
- GET /api/history - List route history
- GET /api/history/:id - Get history details

## Environment Variables Required
- DATABASE_URL - PostgreSQL connection string
- SESSION_SECRET - Flask session secret
- GOOGLE_OAUTH_CLIENT_ID - Google OAuth client ID
- GOOGLE_OAUTH_CLIENT_SECRET - Google OAuth client secret
- QUASAR_GOOGLE_MAPS_KEY - Google Maps API key

## Recent Changes (Dec 2025)
- Implemented complete route optimization with database persistence
- Added ETA calculation and persistence per stop
- Enhanced history with full POD data
- Fixed CORS security (restricted to specific origins)
- Added navigation drawer with route links
- Created RoutesPage, RouteDetailPage, HistoryPage

## Circuit/Spoke Parity Status

### Implemented
- Automatic route optimization
- Manual stop entry
- CSV/text import
- Time windows and priorities
- Proof of delivery
- Route history
- GPS navigation integration
- ETAs

### Pending
- Real-time traffic integration
- Customer SMS notifications
- Driver tracking
- Multi-driver dispatch
- Android Auto / CarPlay
- Package finder tool enhancement
- Dark/light theme switching
