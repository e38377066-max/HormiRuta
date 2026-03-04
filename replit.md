# Area 862 System

## Overview
Area 862 System is a route planning and optimization application for delivery services, built with React + Vite and Node.js/Express. It features a unified server serving both the API and frontend from the same port. The system is designed for drivers and logistics companies in the Dallas metropolitan area, aiming to streamline delivery operations.

**Business Vision**: To become the leading route optimization platform for last-mile delivery services, enhancing efficiency and reducing operational costs for businesses.
**Market Potential**: Significant demand in urban logistics for tools that improve delivery speed and accuracy.
**Project Ambitions**: Expand service areas, integrate with more third-party logistics tools, and incorporate advanced AI for predictive route adjustments.

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
- **Dispatch Order Sorting**: Orders in the dispatch view are sorted alphabetically by customer name (A-Z), then by creation date (newest first) as tiebreaker.
- **Automatic Follow-up System**: Configurable message re-sending if a customer does not respond.
- **System Logs Viewer**: In-memory LogBuffer (500 entries) intercepts console output; admin-only page at `/admin/logs` with auto-refresh, level filters, and search. Persistent file storage: 24h important logs and 3-day full logs, downloadable from the admin panel. Daily auto-archive to `logs/archive/` with date-named files (e.g., `26.02.2026.txt` for 24h, `24_26.02.2026.txt` for 3-day). Archives auto-clean after 7 days.
- **Coverage Zones**: Admin users see ALL coverage zones globally (no user_id filter); non-admins see only their own.
- **Dispatch Lifecycle Sync**: Order statuses aligned with Respond.io lifecycle stages: `approved` → `ordered` → `on_delivery` → `ups_shipped` → `delivered`. Address scanner auto-syncs order_status from contact lifecycle. Dispatch status changes (single, bulk, route completion) also sync back to Respond.io lifecycle.
- **Delivery History (Entregadas tab)**: Separate tab in dispatch showing completed deliveries with evidence photos. Evidence modal shows full-size photo, recipient name, and completion date.
- **Bulk Zone Address Search**: Address geocoding search available in both single-add and bulk-add zone modals.
- **Client Info in Dispatch/Driver Views**: Full client info (name, phone, address, notes) visible in both dispatcher order cards and driver mobile planner. Evidence modal shows complete client details with clickable phone link.
- **Flexible Stop Completion**: Drivers can complete any stop in any order (no sequential enforcement). Footer shows "Toca una parada para completarla" instead of forcing next stop.
- **Turn-by-Turn Navigation**: In-app navigation with step-by-step driving instructions extracted from Google Maps DirectionsService. Nav bar shows current maneuver icon (turn left/right/straight/u-turn/merge/fork/roundabout), instruction text, and distance. Step index auto-updates based on GPS proximity to step endpoints. Fallback to straight polyline when DirectionsService returns no results. Includes voice guidance (Spanish, toggleable), speed indicator (km/h from GPS), and keep-screen-awake during navigation. All features designed toward CarPlay/Android Auto readiness.
- **Billing/Collection System (Cobranza)**: Orders have `order_cost`, `deposit_amount`, `total_to_collect` fields. `total_to_collect` auto-calculates as `order_cost - deposit_amount`. Admin/dispatcher can edit billing via inline editor in dispatch order cards. Billing data copies to stops when routes are created. Drivers see billing info in stop rows and evidence modal. Billing fields auto-sync from Respond.io contact custom fields (`Cost` → `order_cost`, `Deposit` → `deposit_amount`, `Balance` → `total_to_collect`).
- **Payment Tracking**: On delivery completion, drivers select payment method (cash/zelle/card/other) and enter amount collected. Payment status auto-calculates: `paid` (collected >= total), `partial` (collected > 0), `pending`. Payment data syncs back to the order (ValidatedAddress).
- **Zelle Evidence Photos**: Photos are specifically for Zelle payment evidence (constancia). When payment method = Zelle, camera capture is shown. For other payment methods, no photo is required. Backend and frontend both accept empty evidence.
- **Notes Field**: Orders use a notes field (replacing amount/$) for internal notes. Editable by admins in dispatch, visible to drivers.

## External Dependencies

- **Google Maps Platform**:
    - Google Maps JavaScript API (frontend)
    - Google Maps Geocoding API (backend for address validation and search)
- **Respond.io API v2**: For chatbot messaging and integration with customer conversations.
- **PostgreSQL**: Relational database for storing application data.
- **Capacitor 6**: For building native iOS and Android mobile applications.
- **Axios**: HTTP client for API requests.
- **bcryptjs**: For password hashing.
- **multer**: Node.js middleware for handling `multipart/form-data`, primarily for file uploads.