# HormiRuta

## Overview
HormiRuta es una aplicación de planificación de rutas construida con Quasar Framework (Vue.js) con soporte para Capacitor (Android/iOS).

## Project Structure
```
├── src/
│   ├── boot/           # Boot files (axios config)
│   ├── components/     # Vue components
│   ├── layouts/        # Layout components (Main, Planner, Settings)
│   ├── pages/          # Page components
│   │   ├── Auth/       # Login, Register, Splash
│   │   ├── Routes/     # Routes management
│   │   └── Settings/   # Settings pages
│   ├── router/         # Vue Router configuration
│   ├── stores/         # Pinia stores
│   └── css/            # Stylesheets
├── backend/            # Backend Python API
├── android/            # Capacitor Android project
├── public/             # Static assets
├── quasar.config.js    # Quasar configuration
└── package.json        # NPM dependencies
```

## Recent Changes
- 2026-01-26: Migration from Replit Agent to Replit environment completed
- Configured Quasar dev server on port 5000
- Installed npm dependencies with --legacy-peer-deps

## Technology Stack
- **Frontend**: Quasar Framework 2.x (Vue.js 3)
- **State Management**: Pinia
- **Routing**: Vue Router
- **Mobile**: Capacitor for Android/iOS
- **HTTP Client**: Axios
- **Icons**: FontAwesome, Material Icons

## Development
- Run workflow "Start application" to start the dev server
- Server runs on port 5000
- Access the app at /app route

## Key Routes
- `/` - Splash screen
- `/app` - Main application
- `/planner` - Trip planner
- `/saved-routes` - Saved routes (requires auth)
- `/settings` - Settings
- `/auth/login` - Login
- `/auth/register` - Register

## Deployment
To be configured for production deployment.
