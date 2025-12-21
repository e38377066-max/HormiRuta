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

### TripPlannerPage Rewrite (Dec 21, 2025)
- Complete UI rewrite with Spoke/Circuit-inspired bottom-sheet design
- Added PlannerLayout.vue for clean navigation
- Stop priority enforcement (first/auto/last) during optimization
- Savings banner showing distance/time saved after optimization
- Navigation mode with stop completion tracking and undo
- Voice search using Web Speech API
- Map point selection for adding stops with confirmation dialog
- Drag-and-drop stop reordering with vuedraggable
- Route sharing via Web Share API with clipboard fallback
- Round trip toggle with return leg calculations

### Visual Design Update (Dec 21, 2025)
- Glassmorphism panel with blur and gradient background
- Metric chips (time, stops, km) with icons
- Purple/indigo accent color palette matching Spoke/Circuit
- Stop cards with left color bar and shadow
- Gradient badges for stop numbers
- Improved typography and spacing
- Larger action buttons with rounded corners
- Internal navigation mode (no Google Maps redirect)
- Next stop card with prominent styling in navigation mode
- Complete/skip buttons for stop progression

### Main Map Panel Redesign (Dec 21, 2025)
- Exact replication of Spoke/Circuit main screen layout
- Floating hamburger menu button (circular, dark) on map top-left
- Map controls (layers, GPS) on right side with dark background
- Hidden app header for full map immersion
- Hybrid satellite map by default
- Bottom panel with:
  - Search bar: "Pulsa para añadir" placeholder
  - Action icons: import, microphone, menu (3 dots)
  - "PARADAS (0)" counter
  - Empty state: dashed circle + icon with explanatory text
  - Blue "+ Añadir paradas" button (full width, rounded)
  - "Copiar paradas de una ruta anterior" link

### Settings & Menu Pages (Dec 21, 2025)
- SettingsPage: Complete settings matching Spoke
  - Navigation app, stop side, stop duration, vehicle type
  - Avoid tolls toggle, stop ID format, navigation bubble
  - Theme selection (auto/light/dark)
  - Licenses, Terms, Privacy Policy, App version
- HelpPage: FAQ, tutorial, support contact, feedback
- SavedRoutesPage: Cloud-synced routes management
- LocalRoutesPage: Offline routes with sync capability
- Menu drawer with user avatar, plan card, recent routes list

## App Mode: Cliente Normal (Planificador de Rutas)

### Funcionalidades Principales
- **TripPlannerPage**: Pagina simplificada para planificar rutas
  - Punto de partida opcional (con GPS)
  - Agregar paradas con autocompletado Google Places
  - Optimizacion automatica de rutas
  - Mapa integrado con visualizacion de ruta
  - Compartir/copiar ruta
  - Navegacion a Google Maps

### Caracteristicas Disponibles
- Autocompletado de direcciones (Google Places)
- Optimizacion de ruta (Google Directions API)
- Visualizacion en mapa
- Calculo de distancia y tiempo
- Navegacion GPS integrada
- Tema oscuro/claro
- Compartir ruta por WhatsApp/email

### Interfaz Simplificada
- Sin funciones de repartidor (POD, paquetes)
- Sin gestion empresarial (flotillas, suscripciones)
- Enfocado en usuario final que planifica viajes
