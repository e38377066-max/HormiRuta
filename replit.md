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
- 2026-01-29: Integrated Respond.io API v2 for chatbot messaging (send messages, assign agents, add tags)
- 2026-01-29: Added respondApiService.js with all Respond.io API endpoints
- 2026-01-29: Chatbot now sends real messages via API and assigns contacts to agents
- 2026-01-29: Added tracking tags (BotAtendido, ClienteExistente, ProductoSeleccionado, etc.)
- 2026-01-28: Added chatbot system with conversation flow management
- 2026-01-28: Added business hours verification with out-of-hours auto-response
- 2026-01-28: Added flexible ZIP/city validation for Respond.io integration
- 2026-01-28: Added Capacitor 6 for hybrid mobile app (iOS/Android)
- 2026-01-28: Added route optimization options (vehicle type, avoid tolls/highways, traffic)
- 2026-01-28: Unified design across all dashboard pages with clean white/light theme
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

### Chatbot Control
- GET /api/messaging/chatbot/states - List all conversation states
- GET /api/messaging/chatbot/state/:contactId - Get conversation state for contact
- POST /api/messaging/chatbot/pause/:contactId - Pause bot for contact
- POST /api/messaging/chatbot/resume/:contactId - Resume bot for contact
- POST /api/messaging/chatbot/reset/:contactId - Reset conversation for contact

## Environment Variables
- DATABASE_URL - PostgreSQL connection string
- SESSION_SECRET - Express session secret
- VITE_GOOGLE_MAPS_API_KEY - Google Maps API key

## Development
1. Frontend runs on port 5000 with hot reload
2. Backend runs on port 8000
3. Database tables are auto-created on startup via Sequelize sync

## Mobile App (Capacitor)
### Configuration
- App ID: com.hormiruta.app
- App Name: HormiRuta
- Web Dir: dist

### Native Plugins
- @capacitor/geolocation - GPS location tracking
- @capacitor/haptics - Vibration feedback
- @capacitor/status-bar - Native status bar styling
- @capacitor/splash-screen - Native splash screen

### Build Commands
```bash
cd frontend-react

# Build for mobile
npm run build:mobile

# Add platforms (requires local development)
npm run cap:add:android
npm run cap:add:ios

# Open in IDE
npm run cap:android  # Opens Android Studio
npm run cap:ios      # Opens Xcode
```

### Platform-Specific Setup
The app uses a helper utility (src/utils/capacitor.js) that:
- Detects if running on native or web
- Uses native plugins when available (better GPS, haptics)
- Falls back to web APIs when on browser

## Chatbot System

### Conversation Flow
1. **Business Hours Check** - Verifies if within business hours before responding
2. **Out of Hours Message** - Sends automated message and assigns to default agent
3. **Customer Detection** - Checks if customer exists in database
4. **Prior Info Check** - Asks if customer already received pricing info
5. **ZIP Validation** - Requests and validates ZIP code or city name
6. **Product Selection** - Shows product menu and processes selection
7. **Agent Assignment** - Assigns to default agent (Felipe Delgado)

### Conversation States
- `initial` - New conversation, awaiting first message
- `awaiting_prior_info` - Waiting for yes/no answer about prior info
- `awaiting_zip` - Waiting for ZIP code or city name
- `awaiting_product` - Waiting for product selection
- `assigned` - Conversation assigned to human agent

### Excluded Tags
Contacts with these tags are excluded from chatbot:
- Personal
- IprintPOS
- ClientesArea
- Area862Designers

### Products (configurable)
1. Tarjetas
2. Magneticos
3. Post Cards
4. Playeras

### Chatbot Settings
All settings are configurable in MessagingSettings model:
- Business hours (start, end, days, timezone)
- Welcome messages (existing vs new customers)
- ZIP request/reminder messages
- Product menu
- Excluded tags
- Default agent for assignment

## Respond.io API Integration

### Service: respondApiService.js
Centralized service for all Respond.io API v2 interactions.

### Available Methods

#### Messaging
- `sendMessage(identifier, text, channelId?, messageTag?)` - Send message to contact
- `getMessage(identifier, messageId)` - Get specific message
- `listMessages(identifier, limit?, cursorId?)` - List messages for contact

#### Contacts
- `createContact(identifier, contactData)` - Create new contact
- `updateContact(identifier, contactData)` - Update contact
- `createOrUpdateContact(identifier, contactData)` - Create or update contact
- `deleteContact(identifier)` - Delete contact
- `getContact(identifier)` - Get contact by identifier
- `listContacts(filters)` - List contacts with filters
- `mergeContacts(contactIds, mergedData)` - Merge two contacts
- `listContactChannels(identifier)` - List channels for contact

#### Tags
- `addTags(identifier, tags[])` - Add tags to contact (max 10)
- `removeTags(identifier, tags[])` - Remove tags from contact

#### Conversations
- `assignConversation(identifier, assignee)` - Assign to agent (ID or email)
- `unassignConversation(identifier)` - Unassign contact
- `setConversationStatus(identifier, status, category?, summary?)` - Open/close
- `openConversation(identifier)` - Open conversation
- `closeConversation(identifier, category?, summary?)` - Close with notes

#### Lifecycle
- `updateLifecycle(identifier, name)` - Update lifecycle stage

#### Comments
- `addComment(identifier, text)` - Add internal comment

#### Space (Workspace)
- `listUsers(limit?, cursorId?)` - List agents in workspace
- `getUser(userId)` - Get specific user
- `listChannels()` - List channels
- `listCustomFields()` - List custom fields
- `createCustomField(name, type)` - Create custom field
- `listMessageTemplates()` - List message templates
- `createSpaceTag(name, color?)` - Create workspace tag
- `updateSpaceTag(tagId, name, color?)` - Update tag
- `deleteSpaceTag(tagId)` - Delete tag

### Identifier Format
Contacts can be identified using:
- `id:123` - Contact ID
- `email:user@example.com` - Email
- `phone:+1234567890` - Phone number

### Tracking Tags Added by Bot
- `BotAtendido` - Contact processed by bot
- `ClienteExistente` - Existing customer
- `TieneInfoPrevia` - Customer has prior info
- `ProductoSeleccionado` - Product was selected
- `SinCobertura` - No coverage in ZIP area
