# Area 862 System

## Overview
Area 862 System is a route planning and optimization application for delivery services, built with React + Vite and Node.js/Express. It features a unified server serving both the API and frontend from the same port. The system is designed for drivers and logistics companies in the Dallas metropolitan area, aiming to streamline delivery operations.

**Business Vision**: To become the leading route optimization platform for last-mile delivery services, enhancing efficiency and reducing operational costs for businesses.
**Market Potential**: Significant demand in urban logistics for tools that improve delivery speed and accuracy.
**Project Ambitions**: Expand service areas, integrate with more third-party logistics tools, and incorporate advanced AI for predictive route adjustments.

## Cerebro IA (OpenAI Integration)
- **Archivo principal**: `src/services/aiService.js` — servicio completo de IA con OpenAI gpt-4o-mini
- **Campos en DB**: `messaging_settings.ai_enabled` (boolean), `messaging_settings.openai_api_key` (varchar 200)
- **Integración**: `chatbotService.js` importa `AIService` y lo usa como cerebro principal con fallback a regex
- **Funciones IA activas**:
  - `parseYesNoResponse()` — IA entiende "simon", "nel", "ta bien", etc.
  - `detectFrustration()` — IA detecta frustración en casos ambiguos
  - `parseProductSelection()` — IA identifica producto por contexto natural
  - `evaluateAgentIntervention()` — IA decide si puede responder FAQs cuando agente está activo
- **UI**: Tab "Cerebro IA" en la página de configuración de mensajería
- **Endpoint de prueba**: `POST /api/messaging/settings/test-openai`
- **Seguridad**: Si no hay API key o `ai_enabled=false`, todos los parsers caen a lógica regex original

## User Preferences
- Comunicacion en español
- El cliente NO debe ver ninguna referencia a Replit en el codigo ni archivos entregables (es secreto de desarrollo)
- La carpeta attached_assets/ nunca debe subirse a Git
- Todos los archivos de configuracion del entorno de desarrollo estan excluidos del repositorio

## System Architecture

### UI/UX Decisions
- **Color Scheme**: Uses a blue palette (`#4285F4` for lines, `#5b8def` for UI) for a clean and professional appearance.
- **Templates**: Standardized layouts for consistent user experience across different modules.

### Technical Implementations
- **Frontend**: Developed with React 18 and Vite 5, utilizing React Context API for state management and React Router 6 for navigation. Google Maps JavaScript API is integrated for mapping functionalities.
- **Backend**: Built on Node.js with Express.js, using Sequelize as an ORM for PostgreSQL. Authentication is session-based with `express-session` and `bcryptjs` for password hashing.
- **Mobile Development**: Uses Capacitor 6 to compile the web application into native iOS and Android apps, ensuring a consistent experience across platforms.
- **Unified Server**: A single Node.js/Express server handles both API requests and serves the React frontend, simplifying deployment and development.
- **Route Planning and Optimization**: Implements a nearest-neighbor algorithm for optimizing delivery routes.
- **Image Uploads**: Utilizes Multer for handling photo uploads, specifically for delivery evidence.
- **Logging**: A `LogBuffer` service intercepts console output, storing recent logs in memory for admin viewing.

### Feature Specifications
- **User Management**: Authentication, role-based access control (admin, client, driver).
- **Dispatch System**: Admin map view for orders with color-coded statuses, route creation, driver assignment. Driver view for marking deliveries.
- **Delivery Evidence**: Drivers must capture photos (signature/proof) for each stop before completing a route.
- **Coverage Zone Management**: Admins can define and manage delivery zones using ZIP codes, with address search (geocoding) integration.
- **Chatbot System**:
    - **Modes**: Assisted (bot gathers info, agent confirms) and Automatic (bot handles full conversation).
    - **Conversation Flow**: Guided interaction for new clients, asking for ZIP code, validating coverage, displaying product menus, and assigning agents.
    - **Facebook Ads Integration**: Streamlined flow for leads from Facebook Ads, directly asking for ZIP.
    - **Product Management**: Configurable products with individual messages, stored as JSON.
    - **Multi-Agent System**: Agents assigned based on selected product, with fallback options.
    - **Conversation Protection**: Bot avoids interference if a human agent has already responded.
    - **Test Mode**: Allows testing chatbot flows with a specific contact, including a "Reset Test" button.
- **Automatic Address Scanning**: Scans chat messages to extract and validate addresses using Google Maps Geocoding, updating custom fields in Respond.io. Supports Google Maps links (maps.app.goo.gl, etc.) and WhatsApp location messages via reverse geocoding. Filters out conversational messages that incidentally mention street names. Also detects addresses in agent (outgoing) messages when they contain confirmation patterns (e.g., "esta es tu dirección", "confirma tu dirección"). Only scans contacts with lifecycle `Approved` or later — excludes `New Lead`, `Pending`, `Impropos`, and `UPS Shipped`. **Prioritizes corrected addresses from Respond.io contact custom fields** (`address`/`direccion`) over chat-extracted addresses — if an agent corrects the address in the contact profile, that takes precedence. Uses `source` field strategy: when custom field differs from DB, saves with `source='contact_corrected'`; subsequent scans skip chat messages for that contact, preventing overwrite. Only re-checks the custom field for further agent corrections. Contacts with tag `rec` are excluded from scanning and any existing records for them are auto-removed. Duplicate records per contact are auto-cleaned (keeps most recent, skips records linked to routes). Lifecycle sync runs for ALL open conversations (including excluded lifecycles) to keep order_status accurate.
- **Dispatch Order Sorting**: Orders in the dispatch view are sorted alphabetically by customer name (A-Z), then by creation date (newest first) as tiebreaker. Search bar allows filtering by customer name, address, or phone.
- **Automatic Follow-up System**: Configurable message re-sending if a customer does not respond.
- **System Logs Viewer**: In-memory LogBuffer (500 entries) intercepts console output; admin-only page at `/admin/logs` with auto-refresh, level filters, and search. Persistent file storage: 24h important logs and 3-day full logs, downloadable from the admin panel. Daily auto-archive to `logs/archive/` with date-named files (e.g., `26.02.2026.txt` for 24h, `24_26.02.2026.txt` for 3-day). Archives auto-clean after 7 days.
- **Coverage Zones**: Admin users see ALL coverage zones globally (no user_id filter); non-admins see only their own.
- **Dispatch Lifecycle Sync**: Order statuses aligned with Respond.io lifecycle stages: `approved` → `ordered` → `on_delivery` → `ups_shipped` → `delivered`. Address scanner auto-syncs order_status from contact lifecycle. Dispatch status changes (single, bulk, route completion) also sync back to Respond.io lifecycle.
- **Delivery History (Entregadas tab)**: Separate tab in dispatch showing completed deliveries with evidence photos. Evidence modal shows full-size photo, recipient name, and completion date.
- **Bulk Zone Address Search**: Address geocoding search available in both single-add and bulk-add zone modals.
- **Client Info in Dispatch/Driver Views**: Full client info (name, phone, address, notes) visible in both dispatcher order cards and driver mobile planner. Evidence modal shows complete client details with clickable phone link.
- **Flexible Stop Completion**: Drivers can complete any stop in any order (no sequential enforcement). Footer shows "Toca una parada para completarla" instead of forcing next stop.
- **Manual Order Entry**: Admin can add orders manually from dispatch (button "+" next to filter) via modal with name, phone, address (geocoded), cost, deposit, notes. Skips Respond.io.
- **Order Editing**: Admin can edit any dispatch order (name, phone, address with re-geocoding, cost, deposit) via pencil icon on each order card.
- **Auto-delete Delivered Orders**: Orders with status `delivered` are automatically deleted after 48 hours. Before deletion, a ZIP archive is created in `uploads/archives/` containing order data (JSON) and evidence photos. Archives auto-clean after 30 files. Runs on server start and each scan cycle.
- **Driver Commission per Stop**: User model has `commission_per_stop` (FLOAT) field. Each driver has an individual commission value, editable per-driver in the dispatch drivers tab and in Admin Users edit modal. Displays only for role=driver. Commission total per route (stops × commission_per_stop) shown in route cards and driver mobile planner.
- **Accounting Panel** (`/admin/accounting`): Per-driver report with Costo orden | Depósito | Cobrado | Comisión/parada | Total comisión | Saldo. Filterable by driver and date range. Exportable as CSV. Detail expandable per driver. Linked from Admin Dashboard and sidebar.
- **Turn-by-Turn Navigation**: In-app navigation with step-by-step driving instructions extracted from Google Maps DirectionsService. Nav bar shows current maneuver icon (turn left/right/straight/u-turn/merge/fork/roundabout), instruction text, and distance. Step index auto-updates based on GPS proximity to step endpoints. Fallback to straight polyline when DirectionsService returns no results. Includes voice guidance (Spanish, toggleable), speed indicator (km/h from GPS), and keep-screen-awake during navigation. All features designed toward CarPlay/Android Auto readiness.
- **Native Maps Navigation**: When starting a route, automatically opens the phone's native map app (Google Maps on Android, Apple Maps on iOS) with all stops as waypoints. Uses `maps://` protocol for iOS and Google Maps directions URL for Android. Drivers can re-open native maps anytime during navigation via the "Navegar" button. Works in Capacitor-compiled apps for a seamless mobile driving experience like Uber Eats.
- **Billing/Collection System (Cobranza)**: Orders have `order_cost`, `deposit_amount`, `total_to_collect` fields. `total_to_collect` auto-calculates as `order_cost - deposit_amount`. Admin/dispatcher can edit billing via inline editor in dispatch order cards. Billing data copies to stops when routes are created. Drivers see billing info in stop rows and evidence modal. Billing fields auto-sync from Respond.io contact custom fields (`Cost` → `order_cost`, `Deposit` → `deposit_amount`); `total_to_collect` is always calculated automatically as `cost - deposit` (Balance field from Respond.io is NOT read).
- **Payment Tracking**: On delivery completion, drivers select payment method (cash/zelle/card/other) and enter amount collected. Payment status auto-calculates: `paid` (collected >= total), `partial` (collected > 0), `pending`. Payment data syncs back to the order (ValidatedAddress).
- **Zelle Evidence Photos**: Photos are specifically for Zelle payment evidence (constancia). When payment method = Zelle, camera capture is shown. For other payment methods, no photo is required. Backend and frontend both accept empty evidence.
- **Notes Field**: Orders use a notes field (replacing amount/$) for internal notes. Editable by admins in dispatch, visible to drivers.
- **Apartment/Unit Number**: Separate `apartment_number` field on orders and stops. Editable in both manual order creation and edit modals. Displayed in blue next to the address in dispatch cards and driver planner. Does not affect geocoding — the address stays clean for map routing while apartment info is visible.
- **Pickup Ready Badge (Orden Lista)**: The dispatch reads Gmail (area862system@gmail.com) for "Pickup Ready" emails from 4over. Email subject format: "Pickup Ready: 4over order XXXXXXX, bc [Customer Name] - Shipment X - Set X". Customer name is also extracted from `Project/PO:` field in email body. A navy blue "Orden Lista" badge (`#0d2a6e`) appears next to the lifecycle button on order cards when a fuzzy name match is found. Matching uses word-level comparison allowing minor variations (e.g. "Andrews" vs "Andrew"). Gmail is polled on dispatch load and every 5 minutes. Cache TTL is 5 minutes. Service: `src/services/gmailReadService.js`. Endpoint: `GET /api/email/pickup-ready`.

## Gmail Integration

- **Method**: OAuth2 manual (Google Cloud Console + OAuth Playground) — NOT via Replit integration system
- **Library**: `nodemailer` with OAuth2 transport
- **Service file**: `src/services/gmailService.js` — exports `sendEmail()` and `verifyGmailConnection()`
- **API routes**: `src/routes/email.js` → `/api/email/verify` (GET, admin) and `/api/email/send` (POST, admin)
- **Required secrets**: `GMAIL_USER`, `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`
- **Note**: Refresh token expires if unused. If email stops working, regenerate token at OAuth Playground with same credentials.

## External Dependencies

- **Google Maps Platform**:
    - Google Maps JavaScript API (frontend)
    - Google Maps Geocoding API (backend for address validation and search)
- **Respond.io API v2**: For chatbot messaging and integration with customer conversations.
- **PostgreSQL**: Relational database for storing application data.
- **Capacitor 8**: For building native iOS and Android mobile applications (requires Node 22+, iOS 16.0+).
- **Axios**: HTTP client for API requests.
- **bcryptjs**: For password hashing.
- **multer**: Node.js middleware for handling `multipart/form-data`, primarily for file uploads.