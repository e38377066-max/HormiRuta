# Area 862 System

## Overview
Area 862 System es una aplicacion de planificacion y optimizacion de rutas de entrega construida con React + Vite y Node.js/Express. Servidor unificado que sirve tanto la API como el frontend desde el mismo puerto. Diseñada para conductores y empresas de logistica en el area metropolitana de Dallas.

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
- 2026-02-16: Sistema de Despacho completo: mapa admin con ordenes por color/estado, creacion de rutas desde mapa, asignacion a choferes, vista chofer para marcar entregado
- 2026-02-16: Nuevos campos en MessagingOrder: order_status (flujo produccion), amount (monto a cobrar), delivered_at, driver_name
- 2026-02-16: API dispatch: /api/dispatch/orders, /api/dispatch/routes, /api/dispatch/drivers, cambio de estados, asignacion masiva
- 2026-02-16: Flujo de estados: approved → on_production (rojo) → production_finished (azul) → order_picked_up (verde) → on_delivery (naranja) → delivered
- 2026-02-12: Fix: Address scanner no se ejecuta sobre contactos con flujo de chatbot activo (estados awaiting_*) para evitar interferencia entre servicios
- 2026-02-12: Fix critico: Bot no interfiere cuando agente humano ya respondio - validacion ZIP/ciudad no se ejecuta en estado 'assigned' ni cuando agent_active=true
- 2026-02-12: Fix: Extraccion automatica de direcciones cuando agente esta activo - si cliente envia direccion y agente ya controla, se guarda Address y Zip Code en Respond.io sin enviar mensajes del bot
- 2026-02-12: Fix: Cache del address scanner se limpia cuando contacto envia nuevo mensaje, permitiendo detectar nuevas direcciones
- 2026-02-12: Fix: hasAgentAlreadyResponded usa timestamp de cierre real como cutoff (no 10 min fijo) para conversaciones reabiertas
- 2026-02-10: Integración Google Maps Geocoding para corregir direcciones con errores antes de guardar en Respond.io
- 2026-02-10: Escaneo automático de direcciones en polling: lee TODOS los chats, extrae direcciones válidas y actualiza custom fields (Address, Zip Code) en Respond.io
- 2026-02-09: Renombrado proyecto completo de HormiRuta a Area 862 System (código, UI, mobile, docs)
- 2026-02-09: Sistema de seguimiento automático: reenvío de mensaje si cliente no responde, configurable en minutos
- 2026-02-07: Detección determinística de conversaciones cerradas via polling (campo conversation_closed_at en BD)
- 2026-02-07: Cliente existente con conversacion abierta: bot no inicia flujo si la conversacion sigue abierta, solo si fue cerrada y reabierta
- 2026-02-05: Bot no interfiere si un agente humano ya respondió en la conversación
- 2026-02-05: Botón "Reiniciar Prueba" para limpiar historial de conversación en modo test
- 2026-02-05: Fix productos guardados correctamente (products_list en toDict)
- 2026-02-04: Sistema de productos con mensajes individuales por producto
- 2026-02-04: Detección automática de origen Facebook Ads (saludo directo + pedir ZIP)
- 2026-02-04: Insistencia de ZIP si usuario pregunta otras cosas antes de dar código
- 2026-02-03: Added multi-agent system for assigning different agents by service/product
- 2026-02-03: ServiceAgent model with CRUD endpoints and UI management
- 2026-02-03: Chatbot automatically assigns agent based on selected product
- 2026-01-30: Created INSTALL.md with complete AWS Ubuntu installation guide
- 2026-01-30: Updated client/api.js for mobile app compatibility with external servers
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
- Intelligent chatbot with automatic/assisted modes

## Chatbot System (Respond.io Integration)

### Modos de Atencion
1. **Modo Asistido**: El bot recopila información y pasa al agente para confirmar
2. **Modo Automatico**: El bot maneja toda la conversación sin intervención humana

### Flujo de Conversacion (Cliente SIN informacion previa)
1. Cliente escribe → Bot saluda y pregunta si tiene información
2. Cliente dice NO → Bot pide código ZIP
3. Si cliente pregunta otra cosa → Bot insiste en pedir ZIP primero
4. Cliente da ZIP → Bot valida cobertura
5. Si hay cobertura → Bot muestra menú de productos numerado
6. Cliente selecciona producto → Bot muestra información del producto
7. Bot asigna al agente correspondiente según el producto

### Flujo Facebook Ads
- Si el contacto viene de Facebook Ad (detected by ad click event)
- Bot salta la pregunta "¿tiene información?" 
- Saluda directamente y pide código ZIP

### Sistema de Productos (products_list)
- Cada producto tiene nombre y mensaje de información
- Almacenado como JSON en base de datos
- Menú se genera automáticamente: "1. Producto A\n2. Producto B..."
- Al seleccionar, se muestra el mensaje específico del producto

### Sistema Multi-Agente
- Agentes configurables por producto/servicio
- Asignación automática según producto seleccionado
- Fallback a agente por defecto si no hay coincidencia

### Proteccion de Conversaciones
- Bot verifica historial de mensajes antes de responder
- Si un agente humano YA respondió → Bot NO interfiere
- Permite que agentes tomen control sin conflictos

### Modo de Prueba
- Activar modo test para probar flujos con un contacto específico
- Buscar contacto por nombre en Respond.io
- Botón "Reiniciar Prueba" limpia el historial de conversación
- Permite probar el flujo completo múltiples veces

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
- POST /api/messaging/settings/test-connection - Test Respond.io API connection
- POST /api/messaging/settings/reset-test - Reset test conversation history
- POST /api/messaging/validate-zip - Validate ZIP/city/address
- GET /api/messaging/coverage-zones - Get coverage zones
- GET /api/messaging/agents - List service agents
- POST /api/messaging/agents - Create service agent
- PUT /api/messaging/agents/:id - Update service agent
- DELETE /api/messaging/agents/:id - Delete service agent

## Environment Variables
- DATABASE_URL - PostgreSQL connection string
- DATABASE_SSL - Set to 'true' to force SSL (auto-detected for cloud providers)
- SESSION_SECRET - Express session secret
- NODE_ENV - Environment (development/production)
- PORT - Server port (default: 5000)
- SERVER_DOMAIN - Server domain for CORS (without https://)
- VITE_GOOGLE_MAPS_API_KEY - Google Maps API key (frontend)
- GOOGLE_MAPS_API_KEY - Google Maps API key (backend geocoding)
- VITE_API_URL - Full server URL for mobile apps (https://tu-dominio.com)

## Production Deployment
- See INSTALL.md for complete Ubuntu server setup guide
- PM2 config: ecosystem.config.cjs
- Nginx reverse proxy + Let's Encrypt SSL
- Mobile compilation: Android Studio / Xcode with Capacitor

## User Preferences
- Comunicacion en español
- El cliente NO debe ver ninguna referencia a Replit en el codigo ni archivos entregables (es secreto de desarrollo)
- La carpeta attached_assets/ nunca debe subirse a Git
- Todos los archivos de configuracion del entorno de desarrollo estan excluidos del repositorio

## Git Exclusions
Development environment files excluded from Git:
- `.replit`, `replit.nix`, `replit.md`
- `.cache/`, `.config/`, `.local/`, `.upm/`
- `attached_assets/`

## Development Notes
1. Server runs on port 5000 serving both API and frontend
2. Database tables are auto-created on startup via Sequelize sync
3. Frontend build output goes to `dist/` folder
4. Mobile apps read from `dist/` via Capacitor sync
