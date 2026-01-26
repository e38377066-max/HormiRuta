# HormiRuta

## Overview
HormiRuta es una aplicación de planificación y optimización de rutas de entrega construida con Quasar Framework (Vue.js) y Flask como backend API. Diseñada para conductores y empresas de logística.

## Project Structure
```
├── src/                    # Frontend Quasar/Vue.js
│   ├── boot/               # Boot files (axios config)
│   ├── components/         # Vue components
│   ├── layouts/            # Layout components
│   ├── pages/              # Page components
│   │   ├── Auth/           # Login, Register, Splash
│   │   ├── Routes/         # Routes management
│   │   └── Settings/       # Settings pages
│   ├── router/             # Vue Router configuration
│   └── stores/             # Pinia stores (auth, routes, theme)
├── backend/                # Backend Flask API
│   ├── app.py              # Main Flask application
│   ├── models.py           # SQLAlchemy models
│   ├── google_auth.py      # Google OAuth integration
│   └── optimization.py     # Route optimization algorithms
├── android/                # Capacitor Android project
├── quasar.config.js        # Quasar configuration
└── package.json            # NPM dependencies
```

## Recent Changes
- 2026-01-26: Full migration completed
- Frontend Quasar running on port 5000
- Backend Flask API running on port 8000
- PostgreSQL database initialized with all tables

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
- **Framework**: Flask
- **Database**: PostgreSQL with SQLAlchemy ORM
- **Authentication**: Flask-Login + Google OAuth
- **API**: RESTful JSON API
- **WSGI Server**: Gunicorn

## Workflows
1. **Start application** - Frontend Quasar dev server (port 5000)
2. **Backend API** - Flask API server (port 8000)

## Key Features
- User authentication (email/password + Google OAuth)
- Route planning with multiple stops
- Route optimization algorithm
- Stop management (add, edit, delete, reorder)
- Navigation mode with step-by-step guidance
- Route history
- CSV/text import for bulk addresses
- Voice input support

## API Endpoints
- `GET /api/health` - Health check
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/routes` - Get user routes
- `POST /api/routes` - Create new route
- `POST /api/routes/:id/optimize` - Optimize route order
- `POST /api/routes/:id/stops` - Add stop to route

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Flask session secret
- `GOOGLE_OAUTH_CLIENT_ID` - Google OAuth client ID (optional)
- `GOOGLE_OAUTH_CLIENT_SECRET` - Google OAuth secret (optional)

## Development
1. Frontend runs on port 5000 with hot reload
2. Backend runs on port 8000 with auto-reload
3. Database tables are auto-created on startup
