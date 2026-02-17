# Area 862 System - Documentacion Tecnica Completa

Documentacion detallada de la arquitectura, estructura de codigo y funcionamiento de Area 862 System.

---

## Tabla de Contenidos

1. [Descripcion General](#descripcion-general)
2. [Arquitectura del Sistema](#arquitectura-del-sistema)
3. [Estructura de Archivos](#estructura-de-archivos)
4. [Backend - Servidor Express](#backend---servidor-express)
   - [Punto de Entrada (index.js)](#punto-de-entrada-indexjs)
   - [Configuracion de Base de Datos](#configuracion-de-base-de-datos)
   - [Middleware de Autenticacion](#middleware-de-autenticacion)
   - [Modelos de Datos (ORM)](#modelos-de-datos-orm)
   - [Rutas API](#rutas-api)
   - [Servicios](#servicios)
5. [Frontend - Aplicacion React](#frontend---aplicacion-react)
   - [Configuracion de API](#configuracion-de-api)
   - [Contextos (Estado Global)](#contextos-estado-global)
   - [Paginas y Componentes](#paginas-y-componentes)
   - [Layouts](#layouts)
6. [Sistema de Despacho](#sistema-de-despacho)
   - [Flujo de Estados de Ordenes](#flujo-de-estados-de-ordenes)
   - [Mapa de Despacho (Admin)](#mapa-de-despacho-admin)
   - [Creacion de Rutas desde Despacho](#creacion-de-rutas-desde-despacho)
   - [Asignacion a Choferes](#asignacion-a-choferes)
   - [Sincronizacion de Choferes desde Respond.io](#sincronizacion-de-choferes-desde-respondio)
7. [Sistema de Evidencia por Parada](#sistema-de-evidencia-por-parada)
   - [Captura de Foto (Capacitor Camera)](#captura-de-foto-capacitor-camera)
   - [Subida de Evidencia](#subida-de-evidencia)
   - [Validacion de Finalizacion](#validacion-de-finalizacion)
8. [Sistema de Chatbot](#sistema-de-chatbot)
   - [Flujo de Conversacion](#flujo-de-conversacion)
   - [Polling de Mensajes](#polling-de-mensajes)
   - [Proteccion de Conversaciones](#proteccion-de-conversaciones)
   - [Escaneo de Direcciones](#escaneo-de-direcciones)
   - [Geocodificacion](#geocodificacion)
   - [Seguimiento Automatico](#seguimiento-automatico)
9. [Planificador de Rutas (Chofer)](#planificador-de-rutas-chofer)
   - [Optimizacion de Rutas](#optimizacion-de-rutas)
   - [Navegacion GPS](#navegacion-gps)
   - [Calculo de ETAs](#calculo-de-etas)
10. [Historial de Rutas (Admin)](#historial-de-rutas-admin)
11. [Compilacion Mobile](#compilacion-mobile)
    - [Capacitor Camera Plugin](#capacitor-camera-plugin)
    - [Permisos Nativos](#permisos-nativos)
12. [Variables de Entorno](#variables-de-entorno)
13. [Base de Datos](#base-de-datos)
14. [API Endpoints - Referencia Completa](#api-endpoints---referencia-completa)

---

## Descripcion General

Area 862 System es una plataforma de logistica de entregas para el area metropolitana de Dallas que combina:

- **Sistema de despacho**: Gestion completa de ordenes desde produccion hasta entrega, con mapa interactivo, colores por estado y creacion de rutas
- **Evidencia por parada**: Los choferes deben tomar foto de cada entrega (firma/comprobante) antes de poder finalizar la ruta
- **Planificacion de rutas**: Crear y optimizar rutas de entrega con multiples paradas, drag-to-reorder, navegacion GPS
- **Chatbot inteligente**: Atencion automatizada de clientes via Respond.io (WhatsApp, Facebook, etc.)
- **Validacion de cobertura**: Verificacion automatica de zonas de servicio por codigo postal
- **Historial de rutas**: Panel admin para revisar rutas completadas con evidencias fotograficas
- **Panel de administracion**: Gestion de usuarios, roles, estadisticas y configuracion
- **App mobile**: Compilacion nativa para Android/iOS via Capacitor con camara nativa

El sistema es una aplicacion full-stack con un solo servidor que maneja tanto la API REST como el frontend compilado.

---

## Arquitectura del Sistema

```
┌──────────────────────────────────────────────────┐
│                   CLIENTES                        │
│  ┌──────────┐  ┌──────────┐  ┌────────────────┐ │
│  │ Navegador │  │ App iOS  │  │ App Android    │ │
│  │   Web     │  │(Capacitor)│ │  (Capacitor)   │ │
│  └─────┬─────┘  └─────┬─────┘ └───────┬────────┘ │
└────────┼──────────────┼───────────────┼──────────┘
         │              │               │
         ▼              ▼               ▼
┌──────────────────────────────────────────────────┐
│              SERVIDOR NODE.JS                     │
│  ┌────────────────────────────────────────────┐  │
│  │           Express.js (Puerto 5000)          │  │
│  │  ┌──────────────┐  ┌───────────────────┐   │  │
│  │  │ API REST     │  │ Frontend Estatico │   │  │
│  │  │ /api/*       │  │ /dist/*           │   │  │
│  │  └──────┬───────┘  └───────────────────┘   │  │
│  │         │                                   │  │
│  │  ┌──────▼───────┐  ┌───────────────────┐   │  │
│  │  │  Sequelize   │  │ Polling Service   │   │  │
│  │  │  ORM         │  │ (cada 30 seg)     │   │  │
│  │  └──────┬───────┘  └────────┬──────────┘   │  │
│  │         │                   │               │  │
│  │  ┌──────▼───────┐  ┌───────▼──────────┐   │  │
│  │  │  Multer      │  │   APIs Externas   │   │  │
│  │  │  (uploads)   │  │  - Respond.io v2  │   │  │
│  │  │  evidencias  │  │  - Google Maps    │   │  │
│  │  └──────────────┘  └──────────────────┘   │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ┌─────────────────┐  ┌──────────────────────┐  │
│  │  PostgreSQL     │  │  uploads/evidence/   │  │
│  │  Base de Datos  │  │  Fotos de entregas   │  │
│  └─────────────────┘  └──────────────────────┘  │
└──────────────────────────────────────────────────┘
```

### Flujo de datos

1. El **cliente** (web o mobile) envia peticiones HTTP al servidor
2. El **servidor Express** procesa las peticiones a traves de rutas API
3. **Sequelize ORM** maneja la comunicacion con PostgreSQL
4. El **servicio de polling** consulta Respond.io cada 30 segundos buscando nuevos mensajes
5. El **chatbot** procesa mensajes entrantes y responde automaticamente
6. El **geocodificador** corrige direcciones usando Google Maps API
7. **Multer** maneja la subida de fotos de evidencia al directorio `uploads/evidence/`
8. Las **fotos de evidencia** se sirven como archivos estaticos desde `/uploads/evidence/`

---

## Estructura de Archivos

```
area862/
├── src/                           # Backend (servidor)
│   ├── index.js                   # Punto de entrada del servidor Express
│   ├── config/
│   │   └── database.js            # Conexion a PostgreSQL (Sequelize)
│   ├── middleware/
│   │   └── auth.js                # Autenticacion y control de roles
│   ├── models/                    # Modelos de base de datos
│   │   ├── index.js               # Registro de modelos, relaciones y Route.toDict()
│   │   ├── User.js                # Usuarios del sistema
│   │   ├── Route.js               # Rutas de entrega (con assigned_driver_id)
│   │   ├── Stop.js                # Paradas de cada ruta (con photo_url para evidencia)
│   │   ├── ValidatedAddress.js    # Ordenes de despacho (con order_status, amount, driver)
│   │   ├── RouteHistory.js        # Historial de rutas completadas
│   │   ├── MessagingSettings.js   # Configuracion del chatbot
│   │   ├── MessagingOrder.js      # Ordenes recibidas por chat
│   │   ├── MessageLog.js          # Registro de mensajes
│   │   ├── ConversationState.js   # Estado de conversaciones del bot
│   │   ├── CoverageZone.js        # Zonas de cobertura (ZIP codes)
│   │   └── ServiceAgent.js        # Agentes asignables por producto
│   ├── routes/                    # Endpoints de la API
│   │   ├── auth.js                # Registro, login, logout
│   │   ├── admin.js               # Panel de administracion
│   │   ├── routes.js              # CRUD de rutas de entrega
│   │   ├── stops.js               # CRUD de paradas
│   │   ├── history.js             # Historial de rutas
│   │   ├── messaging.js           # Mensajeria, zonas, agentes, ordenes
│   │   └── dispatch.js            # Sistema de despacho, evidencia, rutas de despacho
│   └── services/                  # Logica de negocio
│       ├── chatbotService.js      # Motor del chatbot inteligente
│       ├── pollingService.js      # Polling de Respond.io
│       ├── respondio.js           # Cliente API de Respond.io (basico)
│       ├── respondApiService.js   # Cliente API de Respond.io (completo)
│       ├── addressValidation.js   # Validacion de direcciones y ZIP
│       ├── addressExtractorService.js  # Extraccion de direcciones de texto
│       ├── geocodingService.js    # Google Maps Geocoding API
│       └── optimization.js        # Algoritmo de optimizacion de rutas
├── client/                        # Frontend (React)
│   ├── main.jsx                   # Punto de entrada React
│   ├── App.jsx                    # Rutas de la aplicacion
│   ├── api.js                     # Cliente HTTP (Axios)
│   ├── index.css                  # Estilos globales
│   ├── contexts/                  # Estado global (Context API)
│   │   ├── AuthContext.jsx        # Autenticacion
│   │   └── MessagingContext.jsx   # Estado de mensajeria
│   ├── layouts/                   # Layouts de pagina
│   │   ├── DashboardLayout.jsx    # Layout principal con menu lateral
│   │   ├── DashboardLayout.css
│   │   ├── PlannerLayout.jsx      # Layout del planificador de rutas
│   │   └── PlannerLayout.css
│   ├── pages/                     # Paginas
│   │   ├── Auth/                  # Login y registro
│   │   │   ├── LoginPage.jsx
│   │   │   └── RegisterPage.jsx
│   │   ├── Dashboard/             # Dashboard principal
│   │   ├── Messaging/             # Ordenes, cobertura, configuracion
│   │   │   ├── OrdersPage.jsx
│   │   │   ├── CoveragePage.jsx
│   │   │   └── SettingsPage.jsx
│   │   ├── Planner/               # Planificador de rutas con mapa GPS
│   │   │   ├── TripPlannerPage.jsx    # Mapa, paradas numeradas, evidencia, drag-to-reorder
│   │   │   └── TripPlannerPage.css
│   │   ├── Dispatch/              # Sistema de despacho
│   │   │   ├── DispatchMap.jsx    # Mapa admin con ordenes por color/estado
│   │   │   └── DispatchMap.css
│   │   └── Admin/                 # Panel de administracion
│   │       ├── AdminDashboard.jsx
│   │       ├── AdminUsers.jsx
│   │       ├── AdminPages.css
│   │       └── RouteHistory.jsx   # Historial de rutas con evidencias
│   ├── utils/
│   │   └── capacitor.js           # Utilidades mobile: GPS, camara, haptics, status bar
│   └── assets/                    # Imagenes y recursos
├── uploads/                       # Archivos subidos
│   └── evidence/                  # Fotos de evidencia de entrega
├── public/                        # Archivos estaticos publicos
├── dist/                          # Frontend compilado (generado por npm run build)
├── android/                       # Proyecto Android (Capacitor)
├── ios/                           # Proyecto iOS (Capacitor)
├── package.json                   # Dependencias y scripts
├── vite.config.js                 # Configuracion de Vite (bundler)
├── capacitor.config.ts            # Configuracion de apps mobile
├── ecosystem.config.cjs           # Configuracion de PM2 (produccion)
├── .env.example                   # Plantilla de variables de entorno
├── INSTALL.md                     # Guia de instalacion en servidor
└── DOCUMENTATION.md               # Este archivo
```

---

## Backend - Servidor Express

### Punto de Entrada (index.js)

**Archivo**: `src/index.js`

El servidor Express es el corazon de la aplicacion. Maneja:

- **Carga de variables de entorno** via `dotenv`
- **Configuracion CORS**: Usa `origin: true` (acepta cualquier origen) con `credentials: true` para cookies. Permite compatibilidad con apps mobile (Capacitor) y multiples entornos
- **Sesiones**: Usa `express-session` con cookies HTTP-only y duracion de 7 dias
- **Rutas API**: Todas bajo el prefijo `/api/`
- **Archivos estaticos**: Sirve `uploads/` para fotos de evidencia y `dist/` para el frontend
- **SPA fallback**: Todas las rutas no-API redirigen a `index.html` para React Router
- **Cache-Control**: Headers `no-cache` para evitar problemas con proxies

```javascript
// Seguridad: En produccion, SESSION_SECRET es obligatorio
if (!sessionSecret && process.env.NODE_ENV === 'production') {
  throw new Error('SESSION_SECRET is required in production');
}
```

**Inicio del servidor**:
1. Conecta a PostgreSQL via Sequelize
2. Sincroniza las tablas automaticamente (`sequelize.sync({ alter: true })`)
3. Escucha en puerto 5000 en todas las interfaces (`0.0.0.0`)

### Configuracion de Base de Datos

**Archivo**: `src/config/database.js`

- Usa `DATABASE_URL` como cadena de conexion
- **Deteccion automatica de SSL**: Si la URL contiene `neon.tech`, `rds.amazonaws.com` o `supabase`, activa SSL automaticamente
- **SSL manual**: Se puede forzar con `DATABASE_SSL=true`
- **Pool de conexiones**: Maximo 5, minimo 0, timeout de 30 segundos

```javascript
const useSSL = process.env.DATABASE_SSL === 'true' || 
  (databaseUrl.includes('neon.tech') || databaseUrl.includes('rds.amazonaws.com') || databaseUrl.includes('supabase'));
```

Para PostgreSQL instalado localmente en Ubuntu, no se necesita SSL.

### Middleware de Autenticacion

**Archivo**: `src/middleware/auth.js`

Tres middlewares principales:

1. **`requireAuth`**: Verifica que el usuario tiene una sesion activa. Establece `req.userId` para uso en las rutas. Retorna 401 si no esta autenticado.

2. **`requireRole(...roles)`**: Verifica que el usuario tiene un rol especifico. Acepta multiples roles como argumento.

3. **`requireAdmin`**: Atajo para `requireRole('admin')`.

```javascript
// Ejemplo de uso en rutas:
router.get('/stats', requireAdmin, async (req, res) => { ... });
router.get('/routes', requireAuth, async (req, res) => { ... });

// IMPORTANTE: Siempre usar req.userId (establecido por requireAuth)
// NUNCA usar req.session.userId directamente en las rutas
```

### Modelos de Datos (ORM)

Todos los modelos usan **Sequelize ORM** con PostgreSQL.

#### User (Usuarios)

**Archivo**: `src/models/User.js` | **Tabla**: `users`

| Campo | Tipo | Descripcion |
|---|---|---|
| id | INTEGER (PK, auto) | ID unico |
| username | STRING(80) | Nombre del usuario |
| email | STRING(120) | Email (unico) |
| password_hash | STRING(256) | Hash bcrypt de la contraseña |
| phone | STRING(20) | Telefono (opcional) |
| document | STRING(50) | Documento de identidad (opcional) |
| address | STRING(200) | Direccion (opcional) |
| google_id | STRING(100) | ID de Google OAuth (opcional) |
| profile_picture | STRING(500) | URL de foto de perfil |
| active | BOOLEAN | Si la cuenta esta activa (default: true) |
| subscription_type | STRING(20) | Tipo de suscripcion (default: 'free') |
| subscription_expires | DATE | Fecha de expiracion |
| role | ENUM | 'admin', 'client' o 'driver' (default: 'client') |
| created_at | TIMESTAMP | Fecha de creacion |
| updated_at | TIMESTAMP | Ultima actualizacion |

**Metodos**:
- `setPassword(password)`: Genera hash bcrypt con factor 10
- `checkPassword(password)`: Verifica contraseña contra el hash
- `toDict()`: Retorna datos del usuario sin el password_hash

#### Route (Rutas de Entrega)

**Archivo**: `src/models/Route.js` | **Tabla**: `routes`

| Campo | Tipo | Descripcion |
|---|---|---|
| id | INTEGER (PK, auto) | ID unico |
| user_id | INTEGER (FK → users) | Propietario de la ruta |
| name | STRING(100) | Nombre de la ruta |
| is_optimized | BOOLEAN | Si fue optimizada (default: false) |
| total_distance | FLOAT | Distancia total en km |
| total_duration | INTEGER | Duracion total en minutos |
| status | STRING(20) | 'draft', 'assigned', 'in_progress', 'completed' |
| start_address | STRING(300) | Direccion de inicio |
| start_lat / start_lng | FLOAT | Coordenadas de inicio |
| end_address | STRING(300) | Direccion de fin |
| end_lat / end_lng | FLOAT | Coordenadas de fin |
| return_to_start | BOOLEAN | Si debe volver al punto de inicio |
| vehicle_type | STRING(20) | Tipo de vehiculo (default: 'car') |
| optimization_mode | STRING(20) | Modo de optimizacion (default: 'fastest') |
| scheduled_date | DATEONLY | Fecha programada |
| started_at | DATE | Fecha/hora de inicio real |
| completed_at | DATE | Fecha/hora de finalizacion |
| assigned_driver_id | INTEGER (FK → users) | **Chofer asignado** (nuevo campo para despacho) |

**Metodo `toDict()`** (definido en `src/models/index.js`):
- Carga automaticamente todas las paradas de la ruta (`stops`)
- Incluye `stops_count` y `completed_stops` para tracking de progreso

#### Stop (Paradas)

**Archivo**: `src/models/Stop.js` | **Tabla**: `stops`

| Campo | Tipo | Descripcion |
|---|---|---|
| id | INTEGER (PK, auto) | ID unico |
| unique_id | STRING(36) | UUID generado automaticamente |
| route_id | INTEGER (FK → routes) | Ruta a la que pertenece |
| address | STRING(300) | Direccion de la parada |
| lat / lng | FLOAT | Coordenadas GPS |
| order | INTEGER | Posicion en la ruta |
| original_order | INTEGER | Posicion original (pre-optimizacion) |
| note | TEXT | Notas de entrega |
| phone | STRING(20) | Telefono del destinatario |
| customer_name | STRING(100) | Nombre del cliente |
| priority | INTEGER | Prioridad (0 = normal, mayor = mas importante) |
| time_window_start / end | TIME | Ventana de tiempo para entrega |
| duration | INTEGER | Tiempo estimado en la parada (minutos, default: 5) |
| status | STRING(20) | 'pending', 'completed', 'failed' |
| eta | DATE | Hora estimada de llegada |
| distance_from_prev | FLOAT | Distancia desde la parada anterior (km) |
| duration_from_prev | INTEGER | Tiempo desde la parada anterior (min) |
| package_location | STRING(100) | Ubicacion del paquete (ej: "Puerta") |
| package_count | INTEGER | Cantidad de paquetes |
| delivery_notes | TEXT | Notas especiales de entrega |
| recipient_name | STRING(100) | Nombre de quien recibe |
| failed_reason | STRING(200) | Razon de fallo en la entrega |
| arrived_at | DATE | Hora real de llegada |
| completed_at | DATE | Hora de completar la entrega |
| signature_url | STRING(500) | URL de firma digital |
| **photo_url** | **STRING(500)** | **URL de foto de evidencia de entrega** |

#### ValidatedAddress (Ordenes de Despacho)

**Archivo**: `src/models/ValidatedAddress.js` | **Tabla**: `validated_addresses`

Este modelo almacena las ordenes del sistema de despacho. Se alimenta automaticamente del escaneo de direcciones del chatbot o se crea manualmente.

| Campo | Tipo | Descripcion |
|---|---|---|
| id | INTEGER (PK, auto) | ID unico |
| user_id | INTEGER (FK → users) | Usuario propietario |
| respond_contact_id | STRING(100) | ID del contacto en Respond.io |
| customer_name | STRING(200) | Nombre del cliente |
| customer_phone | STRING(50) | Telefono del cliente |
| original_address | STRING(500) | Direccion original (con posibles errores) |
| validated_address | STRING(500) | Direccion corregida por Google Maps |
| address_lat / address_lng | FLOAT | Coordenadas GPS |
| zip_code | STRING(20) | Codigo postal |
| city | STRING(100) | Ciudad |
| state | STRING(50) | Estado |
| confidence | STRING(20) | Nivel de confianza de la geocodificacion |
| source | STRING(30) | Origen: 'scanner', 'manual' (default: 'scanner') |
| **dispatch_status** | **STRING(30)** | **'available', 'assigned'** (si esta en una ruta) |
| **order_status** | **STRING(30)** | **Estado del flujo: 'approved', 'on_production', 'production_finished', 'order_picked_up', 'on_delivery', 'delivered'** |
| **amount** | **FLOAT** | **Monto a cobrar por la orden** (default: 0) |
| **assigned_driver_id** | **INTEGER (FK → users)** | **Chofer asignado** |
| **driver_name** | **STRING(100)** | **Nombre del chofer asignado** |
| **route_id** | **INTEGER** | **ID de la ruta asignada** |
| **delivered_at** | **DATE** | **Fecha/hora de entrega** |
| notes | TEXT | Notas adicionales |

#### MessagingSettings (Configuracion del Chatbot)

**Archivo**: `src/models/MessagingSettings.js` | **Tabla**: `messaging_settings`

Este es el modelo mas extenso del sistema. Almacena TODA la configuracion del chatbot por usuario.

**Campos principales**:

| Seccion | Campos | Descripcion |
|---|---|---|
| API | respond_api_token, is_active | Token de Respond.io y estado on/off |
| Modo | attention_mode | 'assisted' (humano confirma) o 'automatic' (bot completo) |
| Horario | business_hours_enabled, business_hours_start, business_hours_end, business_days, timezone | Control de horario de atencion |
| Mensajes | welcome_new_customer, welcome_existing_customer, welcome_from_ads, has_info_response, request_zip_message, remind_zip_message, product_menu_message, etc. | Todos los mensajes del flujo |
| Productos | products (JSON), products_list (JSON) | Lista de productos con mensajes individuales |
| Agente | default_agent_id, default_agent_name | Agente por defecto para asignacion |
| Filtros | excluded_tags (JSON) | Tags de Respond.io que el bot debe ignorar |
| Prueba | test_mode, test_contact_id | Modo de prueba con contacto especifico |
| Seguimiento | followup_enabled, followup_timeout_minutes, followup_message, followup_message_2 | Reenvio automatico si no hay respuesta |

**Campos de mensajes personalizables**: Cada mensaje que el bot envia se puede configurar desde la interfaz web. Los textos por defecto estan en español con emojis.

#### ConversationState (Estado de Conversacion)

**Archivo**: `src/models/ConversationState.js` | **Tabla**: `conversation_states`

Rastrea el estado de cada conversacion del bot con cada contacto. Indice unico: `(user_id, contact_id)`.

| Campo | Tipo | Descripcion |
|---|---|---|
| state | STRING(50) | Estado actual: 'initial', 'awaiting_zip', 'awaiting_product', 'assigned', 'closed_no_coverage' |
| awaiting_response | STRING(50) | Que espera el bot del cliente |
| has_prior_info | BOOLEAN | Si el cliente ya tenia informacion previa |
| selected_product | STRING(100) | Producto seleccionado |
| validated_zip | STRING(10) | ZIP validado |
| is_existing_customer | BOOLEAN | Si es cliente recurrente |
| is_reopened | BOOLEAN | Si la conversacion fue reabierta |
| out_of_hours_notified | BOOLEAN | Si ya se envio mensaje fuera de horario |
| assigned_agent_id | STRING(100) | ID del agente asignado |
| bot_paused | BOOLEAN | Si el bot esta pausado para este contacto |
| agent_active | BOOLEAN | **CRITICO**: Si un agente humano esta respondiendo |
| greeting_sent | BOOLEAN | Si ya se envio el saludo inicial |
| conversation_closed_at | DATE | Cuando se cerro la conversacion |
| last_bot_message_at | DATE | Ultimo mensaje del bot |
| last_agent_message_at | DATE | Ultimo mensaje de un agente |
| last_customer_message_at | DATE | Ultimo mensaje del cliente |
| followup_count | INTEGER | Cuantos seguimientos se han enviado (max 2) |

#### CoverageZone (Zonas de Cobertura)

**Archivo**: `src/models/CoverageZone.js` | **Tabla**: `coverage_zones`

| Campo | Tipo | Descripcion |
|---|---|---|
| zip_code | STRING(20) | Codigo postal |
| zone_name | STRING(100) | Nombre de la zona |
| city | STRING(100) | Ciudad |
| state | STRING(50) | Estado |
| country | STRING(50) | Pais (default: 'US') |
| is_active | BOOLEAN | Si la zona esta activa |
| delivery_fee | FLOAT | Costo de envio |
| min_order_amount | FLOAT | Monto minimo de pedido |
| estimated_delivery_time | INTEGER | Tiempo estimado de entrega |
| notes | TEXT | Notas adicionales |

Indice unico: `(user_id, zip_code)` - No se puede duplicar un ZIP por usuario.

#### ServiceAgent (Agentes de Servicio)

**Archivo**: `src/models/ServiceAgent.js` | **Tabla**: `service_agents`

| Campo | Tipo | Descripcion |
|---|---|---|
| agent_id | STRING(100) | ID del agente en Respond.io |
| agent_name | STRING(100) | Nombre del agente |
| agent_email | STRING(255) | Email del agente |
| service_name | STRING(100) | Nombre del servicio que atiende |
| products | JSON | Lista de productos que maneja |
| is_default | BOOLEAN | Si es el agente por defecto |
| is_active | BOOLEAN | Si esta activo |

#### MessagingOrder (Ordenes de Mensajeria)

**Archivo**: `src/models/MessagingOrder.js` | **Tabla**: `messaging_orders`

Registra cada orden recibida a traves del chatbot.

| Campo | Tipo | Descripcion |
|---|---|---|
| respond_contact_id | STRING(100) | ID del contacto en Respond.io |
| respond_conversation_id | STRING(100) | ID de la conversacion |
| channel_id / channel_type | STRING | Canal de comunicacion |
| customer_name, phone, email | STRING | Datos del cliente |
| address | STRING(500) | Direccion de entrega |
| address_lat / address_lng | FLOAT | Coordenadas |
| zip_code | STRING(20) | Codigo postal |
| status | STRING(30) | 'pending', 'confirmed', 'in_transit', 'completed', 'cancelled' |
| validation_status | STRING(30) | 'pending', 'valid', 'no_coverage' |
| assigned_driver_id | INTEGER (FK → users) | Conductor asignado |
| assigned_agent_id | INTEGER | Agente asignado |
| lifecycle | STRING(50) | Etapa del ciclo de vida en Respond.io |

#### MessageLog (Registro de Mensajes)

**Archivo**: `src/models/MessageLog.js` | **Tabla**: `message_logs`

Registro de todos los mensajes enviados y recibidos.

#### RouteHistory (Historial de Rutas)

**Archivo**: `src/models/RouteHistory.js` | **Tabla**: `route_histories`

Guarda una copia de cada ruta completada con todos sus datos.

### Relaciones entre Modelos

**Archivo**: `src/models/index.js`

```
User ──1:N──> Route ──1:N──> Stop
User ──1:N──> RouteHistory
User ──1:N──> MessagingOrder ──1:N──> MessageLog
User ──1:N──> CoverageZone
User ──1:1──> MessagingSettings
User ──1:N──> ConversationState
User ──1:N──> ServiceAgent
User ──1:N──> ValidatedAddress
User (as driver) ──1:N──> Route (via assigned_driver_id)
User (as driver) ──1:N──> ValidatedAddress (via assigned_driver_id)
MessagingOrder ──N:1──> Route
MessagingOrder ──N:1──> Stop
MessagingOrder ──N:1──> User (via assigned_driver_id)
```

Todas las relaciones usan `onDelete: 'CASCADE'` excepto MessageLog → MessagingOrder que usa `SET NULL`.

---

### Rutas API

#### Autenticacion (`src/routes/auth.js`)

| Metodo | Ruta | Descripcion | Autenticacion |
|---|---|---|---|
| POST | `/api/auth/register` | Registrar nuevo usuario | No |
| POST | `/api/auth/login` | Iniciar sesion | No |
| POST | `/api/auth/logout` | Cerrar sesion | Si |
| GET | `/api/auth/me` | Obtener usuario actual | Si |
| PUT | `/api/auth/update` | Actualizar perfil | Si |

**Registro**: Valida email unico, contraseña minimo 6 caracteres, normaliza email a minusculas.

**Login**: Busca por email, verifica hash bcrypt, crea sesion con cookie.

#### Administracion (`src/routes/admin.js`)

Todas las rutas requieren rol `admin`.

| Metodo | Ruta | Descripcion |
|---|---|---|
| GET | `/api/admin/stats` | Estadisticas generales (conteos) |
| GET | `/api/admin/users` | Listar usuarios (con busqueda y filtro por rol) |
| GET | `/api/admin/users/:id` | Obtener un usuario |
| PUT | `/api/admin/users/:id` | Actualizar datos de usuario |
| PUT | `/api/admin/users/:id/role` | Cambiar rol |
| PUT | `/api/admin/users/:id/toggle-active` | Activar/desactivar cuenta |
| DELETE | `/api/admin/users/:id` | Eliminar usuario (no puede eliminarse a si mismo) |

#### Rutas de Entrega (`src/routes/routes.js`)

Todas requieren autenticacion. Solo acceden a sus propias rutas.

| Metodo | Ruta | Descripcion |
|---|---|---|
| GET | `/api/routes` | Listar rutas del usuario |
| POST | `/api/routes` | Crear nueva ruta (con o sin paradas) |
| GET | `/api/routes/:id` | Obtener ruta con paradas |
| PUT | `/api/routes/:id` | Actualizar nombre/estado |
| DELETE | `/api/routes/:id` | Eliminar ruta y sus paradas |
| POST | `/api/routes/:id/stops` | Agregar parada a la ruta |
| POST | `/api/routes/:id/reorder` | Reordenar paradas manualmente |
| POST | `/api/routes/:id/optimize` | **Optimizar ruta** (algoritmo nearest-neighbor) |
| POST | `/api/routes/:id/start` | Marcar ruta como "en progreso" |
| POST | `/api/routes/:id/complete` | Marcar ruta como "completada" (guarda en historial) |
| POST | `/api/routes/:id/import-text` | Importar direcciones desde texto (una por linea) |

#### Despacho (`src/routes/dispatch.js`)

Archivo de rutas para el sistema de despacho completo. Maneja ordenes, rutas de despacho, asignacion de choferes y evidencia.

**Ordenes de Despacho**:

| Metodo | Ruta | Autenticacion | Descripcion |
|---|---|---|---|
| GET | `/api/dispatch/orders` | Auth | Listar ordenes (admin: todas, driver: solo asignadas) |
| PUT | `/api/dispatch/orders/:id/status` | Auth | Cambiar estado de orden (con validacion de transiciones) |
| PUT | `/api/dispatch/orders/:id/amount` | Admin | Actualizar monto de una orden |
| PUT | `/api/dispatch/orders/:id/delivered` | Auth | Marcar orden como entregada |
| PUT | `/api/dispatch/orders/bulk-status` | Admin | Cambiar estado de multiples ordenes a la vez |
| GET | `/api/dispatch/stats` | Admin | Estadisticas de ordenes por estado |

**Rutas de Despacho**:

| Metodo | Ruta | Autenticacion | Descripcion |
|---|---|---|---|
| POST | `/api/dispatch/routes` | Admin | Crear ruta desde ordenes seleccionadas |
| GET | `/api/dispatch/routes` | Auth | Listar rutas (admin: todas, driver: asignadas) |
| POST | `/api/dispatch/routes/:id/optimize` | Admin | Optimizar orden de paradas |
| PUT | `/api/dispatch/routes/:id/assign` | Admin | Asignar ruta a un chofer |
| PUT | `/api/dispatch/routes/:id/complete` | Auth | Finalizar ruta (requiere evidencia en todas las paradas) |
| GET | `/api/dispatch/routes/:id/detail` | Auth | Detalle de ruta con ordenes y monto total |
| GET | `/api/dispatch/routes/history` | Admin | Historial de rutas completadas/asignadas |

**Evidencia**:

| Metodo | Ruta | Autenticacion | Descripcion |
|---|---|---|---|
| POST | `/api/dispatch/stops/:id/evidence` | Auth | Subir foto de evidencia (multipart/form-data) |

**Choferes**:

| Metodo | Ruta | Autenticacion | Descripcion |
|---|---|---|---|
| GET | `/api/dispatch/drivers` | Admin | Listar choferes activos |
| GET | `/api/dispatch/respond-users` | Admin | Listar miembros del workspace de Respond.io |
| POST | `/api/dispatch/sync-drivers` | Admin | Crear choferes desde miembros de Respond.io |

#### Mensajeria (`src/routes/messaging.js`)

El archivo mas extenso de rutas (~1200 lineas). Maneja todo lo relacionado con el chatbot, ordenes, zonas y agentes.

**Configuracion del Chatbot**:

| Metodo | Ruta | Descripcion |
|---|---|---|
| GET | `/api/messaging/settings` | Obtener configuracion (crea una por defecto si no existe) |
| PUT | `/api/messaging/settings` | Actualizar configuracion |
| POST | `/api/messaging/settings/test-connection` | Probar conexion con Respond.io |
| POST | `/api/messaging/settings/reset-test` | Reiniciar datos de contacto de prueba |

**Ordenes**:

| Metodo | Ruta | Descripcion |
|---|---|---|
| GET | `/api/messaging/orders` | Listar ordenes (filtrable por status) |
| GET | `/api/messaging/orders/:id` | Obtener orden con historial de mensajes |
| POST | `/api/messaging/orders` | Crear orden manualmente |
| PUT | `/api/messaging/orders/:id` | Actualizar orden |
| POST | `/api/messaging/orders/:id/confirm` | Confirmar orden (envia mensaje al cliente) |
| POST | `/api/messaging/orders/:id/cancel` | Cancelar orden |
| POST | `/api/messaging/orders/:id/complete` | Marcar como entregada (envia mensaje) |
| DELETE | `/api/messaging/orders/:id` | Eliminar orden |
| POST | `/api/messaging/orders/:id/send-message` | Enviar mensaje libre al contacto |

**Zonas de Cobertura**:

| Metodo | Ruta | Descripcion |
|---|---|---|
| GET | `/api/messaging/coverage-zones` | Listar zonas |
| POST | `/api/messaging/coverage-zones` | Crear zona |
| POST | `/api/messaging/coverage-zones/bulk` | Crear multiples zonas de una vez |
| PUT | `/api/messaging/coverage-zones/:id` | Actualizar zona |
| DELETE | `/api/messaging/coverage-zones/:id` | Eliminar zona |
| POST | `/api/messaging/validate-zip` | Validar ZIP/ciudad/direccion contra zonas |

**Agentes**:

| Metodo | Ruta | Descripcion |
|---|---|---|
| GET | `/api/messaging/agents` | Listar agentes |
| POST | `/api/messaging/agents` | Crear agente |
| PUT | `/api/messaging/agents/:id` | Actualizar agente |
| DELETE | `/api/messaging/agents/:id` | Eliminar agente |

**Polling**:

| Metodo | Ruta | Descripcion |
|---|---|---|
| POST | `/api/messaging/polling/start` | Iniciar polling de mensajes |
| POST | `/api/messaging/polling/stop` | Detener polling |
| GET | `/api/messaging/polling/status` | Estado del polling |

---

### Servicios

#### ChatbotService (`src/services/chatbotService.js`)

El motor principal del chatbot. Clase que se instancia con el userId y la configuracion del usuario.

**Componentes principales**:

1. **Envio de mensajes**: `sendMessage()`, `assignToAgent()`, `addTrackingTag()`, `addComment()`

2. **Verificaciones de seguridad**:
   - `isWithinBusinessHours()`: Verifica horario de atencion usando timezone configurable
   - `hasExcludedTag()`: Ignora contactos con tags excluidos (ej: "Personal", "ClientesArea")
   - `shouldBotRespond()`: **CRITICO** - Verifica si el bot debe responder o no
   - `hasAgentAlreadyResponded()`: Revisa historial de mensajes para detectar agentes humanos
   - `isConversationReopened()`: Detecta si una conversacion cerrada fue reabierta

3. **Parsers inteligentes**:
   - `parseYesNoResponse()`: Detecta respuestas afirmativas/negativas en español e ingles
   - `parseProductSelection()`: Reconoce productos por numero, nombre o variantes con errores ortograficos (usa distancia de Levenshtein)
   - `detectFrustration()`: Detecta clientes frustrados (mayusculas excesivas, palabras clave)

4. **Procesamiento de mensajes**: `processMessage()` es el metodo principal que ejecuta el flujo completo de la conversacion.

#### PollingService (`src/services/pollingService.js`)

Servicio singleton que gestiona el polling de Respond.io.

**Requisitos para que el polling funcione**:
- `MessagingSettings.is_active` debe ser `true` (chatbot activado)
- `MessagingSettings.respond_api_token` debe tener un token valido de Respond.io
- El polling debe iniciarse desde el frontend (boton "Activar" en la pagina de configuracion) o via API `POST /api/messaging/polling/start`

**Flujo del polling** (cada 30 segundos):

1. Obtiene TODAS las conversaciones abiertas de Respond.io (paginadas)
2. Filtra por lifecycle: solo "New Lead" y "Pending"
3. En **modo prueba**: busca solo el contacto especifico
4. Detecta cambios de estado (aperturas/cierres de conversaciones)
5. Para cada contacto:
   - Lee sus mensajes recientes
   - Detecta si un agente humano ya respondio → **NO interfiere**
   - Filtra mensajes nuevos no procesados
   - Procesa solo el mensaje mas reciente (evita spam)
6. Ejecuta verificacion de seguimientos pendientes
7. Escanea direcciones en todas las conversaciones

**Modo Prueba**: Permite probar el chatbot con un solo contacto sin afectar otras conversaciones.

**Sincronizacion inicial** (`initializeConversationSnapshot()`): Al iniciar el polling, escanea TODAS las conversaciones abiertas y cerradas para establecer el estado base.

**Proteccion contra interferencia con chatbot**: El escaneo de direcciones NO se ejecuta sobre contactos con flujo de chatbot activo (estados `awaiting_*`) para evitar que el scanner envie mensajes que interfieran con el flujo del bot.

#### RespondioService (`src/services/respondio.js`)

Cliente HTTP basico para la API v2 de Respond.io. Usa Axios con autenticacion Bearer.

**Metodos**:
- `sendMessage()`: Envia mensaje de texto
- `listContacts()`: Lista contactos con filtros
- `listOpenConversations()`: Conversaciones con status "open"
- `listClosedConversations()`: Conversaciones con status "closed"
- `getContact()`: Obtener un contacto por ID
- `updateContactCustomFields()`: Actualizar campos personalizados
- `listMessages()`: Listar mensajes de un contacto
- `listUsers()`: Listar miembros del workspace de Respond.io
- `testConnection()`: Probar la conexion a la API

#### RespondApiService (`src/services/respondApiService.js`)

Cliente API completo y centralizado para Respond.io. Soporta multi-tenant (multiples usuarios con diferentes tokens).

**Caracteristicas**:
- Cache de tokens por usuario (TTL: 5 minutos)
- Soporte completo de la API v2: mensajes, contactos, tags, conversaciones, lifecycle, comentarios, campos personalizados, templates de WhatsApp, etc.
- Patron singleton con contexto por usuario

#### AddressValidationService (`src/services/addressValidation.js`)

Valida direcciones contra las zonas de cobertura configuradas.

**Metodos principales**:
- `extractZipCode()`: Extrae ZIP de texto (soporta formatos: "75208", "ZIP: 75208", "codigo postal 75208")
- `validateZipOrCity()`: Valida por ZIP, ciudad o nombre de zona
- `isLikelyAddress()`: Detecta si un texto parece una direccion
- `detectAddressType()`: Clasifica como 'house' o 'apartment'
- `checkCoverage()`: Verifica cobertura por ZIP code
- `knownCities`: Lista de ~50 ciudades del area metropolitana de Dallas

#### AddressExtractorService (`src/services/addressExtractorService.js`)

Extrae direcciones fisicas de los mensajes de chat.

**Logica de deteccion**:
1. Busca patron de numero + calle (ej: "1234 Main St")
2. Verifica sufijos de calle (st, ave, rd, dr, ln, blvd, etc.)
3. Filtra falsos positivos (saludos, preguntas, URLs, etc.)
4. Reconoce ciudades del area de Dallas
5. Extrae componentes: numero, calle, ciudad, estado, ZIP

**Cache de escaneo**: Se limpia cuando un contacto envia un nuevo mensaje, permitiendo detectar nuevas direcciones en la misma conversacion.

#### GeocodingService (`src/services/geocodingService.js`)

Usa Google Maps Geocoding API para corregir y validar direcciones.

**Caracteristicas**:
- **Cache**: 500 entradas, TTL de 1 hora (5 minutos para errores)
- **Rate limiting**: Si Google responde OVER_QUERY_LIMIT, pausa por 60 segundos
- **Request denied**: Pausa por 5 minutos (API key invalida o Geocoding API no habilitada)
- **Resultado**: Direccion corregida, coordenadas, nivel de confianza (ROOFTOP = alta, otros = baja)
- **Filtro por pais**: Solo busca en Estados Unidos (`components: country:US`)

**Flujo**: Direccion con errores → Google Maps API → Direccion corregida con coordenadas y ZIP

#### OptimizationService (`src/services/optimization.js`)

Algoritmo de optimizacion de rutas usando **nearest-neighbor** (vecino mas cercano).

**Proceso**:
1. Paradas con **prioridad alta** se visitan primero (ordenadas por prioridad descendente)
2. El resto se ordena por distancia al punto actual (vecino mas cercano)
3. Calcula distancia usando **formula de Haversine** (distancia en esfera terrestre)
4. Estima duracion: distancia / velocidad promedio (30 km/h en ciudad)
5. Opcion de retorno al punto de inicio

**Calculo de ETAs**: Basado en la hora de inicio + tiempos acumulados de viaje + tiempo en cada parada.

---

## Frontend - Aplicacion React

### Configuracion de API

**Archivo**: `client/api.js`

Cliente HTTP centralizado usando Axios.

- **En navegador web**: No usa baseURL (peticiones relativas al mismo servidor)
- **En app mobile** (Capacitor): Usa `VITE_API_URL` para apuntar al servidor de produccion
- **Interceptor 401**: Si el servidor responde con 401 (no autorizado), limpia la sesion local

```javascript
const getBaseURL = () => {
  if (Capacitor.isNativePlatform()) {
    return import.meta.env.VITE_API_URL || ''
  }
  return ''
}
```

### Contextos (Estado Global)

**AuthContext** (`client/contexts/AuthContext.jsx`):
- Maneja estado de autenticacion (login, logout, registro)
- Verifica sesion al cargar la app (`/api/auth/me`)
- Provee: `user`, `isAuthenticated`, `isAdmin`, `login()`, `register()`, `logout()`

**MessagingContext** (`client/contexts/MessagingContext.jsx`):
- Maneja estado del modulo de mensajeria
- Carga configuracion, ordenes y zonas de cobertura
- Controla el polling (iniciar/detener)

### Paginas y Componentes

| Pagina | Archivo | Descripcion |
|---|---|---|
| Login | `client/pages/Auth/LoginPage.jsx` | Formulario de inicio de sesion |
| Registro | `client/pages/Auth/RegisterPage.jsx` | Formulario de registro |
| Ordenes | `client/pages/Messaging/OrdersPage.jsx` | Lista de ordenes de mensajeria |
| Cobertura | `client/pages/Messaging/CoveragePage.jsx` | Gestion de zonas de cobertura |
| Configuracion | `client/pages/Messaging/SettingsPage.jsx` | Configuracion del chatbot |
| **Mapa Despacho** | **`client/pages/Dispatch/DispatchMap.jsx`** | **Mapa admin con ordenes por color/estado, creacion de rutas, asignacion a choferes** |
| Planificador | `client/pages/Planner/TripPlannerPage.jsx` | Planificador GPS con paradas numeradas, drag-to-reorder, evidencia por parada |
| Admin Dashboard | `client/pages/Admin/AdminDashboard.jsx` | Estadisticas de administrador |
| Admin Usuarios | `client/pages/Admin/AdminUsers.jsx` | Gestion de usuarios |
| **Historial Rutas** | **`client/pages/Admin/RouteHistory.jsx`** | **Historial de rutas completadas/en curso con evidencias** |

### Layouts

**DashboardLayout** (`client/layouts/DashboardLayout.jsx`):
- Menu lateral con navegacion principal (colores azules: #4285F4, #5b8def)
- Muestra el nombre del usuario
- Opciones: Mensajeria, Cobertura, Configuracion, Despacho, Planificador, Admin (si es admin), Historial de Rutas, Cerrar sesion

**PlannerLayout** (`client/layouts/PlannerLayout.jsx`):
- Layout de pantalla completa para el planificador de rutas
- Integra Google Maps

### Rutas de la Aplicacion

**Archivo**: `client/App.jsx`

```
/login                  → Pagina de login (publica)
/register               → Pagina de registro (publica)
/                       → Redirige a /messaging
/messaging              → Lista de ordenes
/messaging/coverage     → Zonas de cobertura
/messaging/settings     → Configuracion del chatbot
/admin                  → Dashboard admin (solo admin)
/admin/users            → Gestion de usuarios (solo admin)
/admin/routes           → Historial de rutas (solo admin)
/dispatch               → Mapa de despacho (admin y driver)
/planner                → Planificador de rutas
*                       → Redirige a /messaging
```

Componentes de proteccion:
- `ProtectedRoute`: Redirige a `/login` si no esta autenticado
- `PublicRoute`: Redirige a `/dashboard` si ya esta autenticado
- `allowedRoles`: Restringe acceso a roles especificos (ej: dispatch para admin y driver)

---

## Sistema de Despacho

El sistema de despacho es el modulo central para la gestion de ordenes de entrega. Solo accesible para admin y driver.

### Flujo de Estados de Ordenes

Las ordenes siguen un flujo lineal estricto con validacion de transiciones:

```
approved (aprobada) ──→ on_production (en produccion, ROJO)
         │
         ▼
on_production ──→ production_finished (produccion terminada, AZUL)
         │
         ▼
production_finished ──→ order_picked_up (recogida, VERDE)
         │
         ▼
order_picked_up ──→ on_delivery (en camino, NARANJA)
         │
         ▼
on_delivery ──→ delivered (entregada)
```

**Permisos de cambio de estado**:
- **Admin**: Puede cambiar a `on_production`, `production_finished`, `order_picked_up`
- **Driver**: Solo puede marcar como `delivered` (y solo sus ordenes asignadas)

**Colores en el mapa**:
- Rojo: `on_production`
- Azul: `production_finished`
- Verde: `order_picked_up`
- Naranja: `on_delivery`

### Mapa de Despacho (Admin)

**Archivo**: `client/pages/Dispatch/DispatchMap.jsx`

Pagina principal del despacho con mapa interactivo de Google Maps:

- Muestra todas las ordenes como marcadores coloreados segun su estado
- Panel lateral con lista de ordenes filtrable por estado
- Edicion de monto por orden
- Cambio de estado individual y masivo (bulk)
- Seleccion de ordenes para crear rutas
- Boton para crear ruta con las ordenes seleccionadas
- Panel de rutas creadas con opcion de optimizar y asignar chofer
- Sincronizacion de choferes desde Respond.io

### Creacion de Rutas desde Despacho

Cuando el admin selecciona ordenes y crea una ruta:

1. Se crea un registro `Route` con estado 'draft'
2. Se crean `Stop` (paradas) automaticamente a partir de las ordenes seleccionadas
3. Las ordenes (`ValidatedAddress`) se vinculan a la ruta via `route_id`
4. El admin puede optimizar el orden de las paradas
5. El admin asigna la ruta a un chofer disponible

### Asignacion a Choferes

Cuando se asigna una ruta a un chofer:

1. La ruta cambia a estado `assigned`
2. El campo `assigned_driver_id` se establece en la ruta
3. Todas las ordenes de la ruta se actualizan:
   - `assigned_driver_id` = ID del chofer
   - `driver_name` = nombre del chofer
   - `order_status` = 'on_delivery'

El chofer ve la ruta en su planificador y puede navegar a cada parada.

### Sincronizacion de Choferes desde Respond.io

El admin puede importar miembros del workspace de Respond.io como choferes:

1. `GET /api/dispatch/respond-users`: Lee los miembros del workspace
2. Muestra los que NO tienen cuenta en el sistema
3. `POST /api/dispatch/sync-drivers`: Crea usuarios con rol 'driver' y contraseña temporal
4. Los choferes pueden luego iniciar sesion y cambiar su contraseña

---

## Sistema de Evidencia por Parada

### Captura de Foto (Capacitor Camera)

**Archivo**: `client/utils/capacitor.js`

El sistema usa el plugin `@capacitor/camera` para captura de fotos:

**En app mobile (Capacitor nativo)**:
- `takePhoto()`: Abre la camara nativa del dispositivo
- Calidad: 80%, resolucion maxima: 1280x1280
- Opciones: tomar foto o elegir de galeria
- Devuelve `DataUrl` (base64)
- `dataUrlToFile()`: Convierte DataUrl a objeto File para subir al servidor
- Si la foto sale mal, el chofer puede retomar la foto antes de confirmar

**En navegador web (fallback)**:
- Usa `<input type="file" accept="image/*" capture="environment">`
- Permite seleccionar foto de galeria o tomar con webcam

**Permisos requeridos**:

Android (`android/app/src/main/AndroidManifest.xml`):
```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
```

iOS (`ios/App/App/Info.plist`):
```xml
<key>NSCameraUsageDescription</key>
<string>Area 862 necesita acceso a la camara para tomar fotos de evidencia de entrega</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>Area 862 necesita acceso a tus fotos para seleccionar evidencia de entrega</string>
<key>NSPhotoLibraryAddUsageDescription</key>
<string>Area 862 necesita guardar fotos de evidencia de entrega</string>
```

### Subida de Evidencia

**Backend**: `POST /api/dispatch/stops/:id/evidence`

- Usa **multer** para procesar la subida de archivos
- Solo acepta imagenes (filtro por mimetype)
- Limite: 10MB por foto
- Almacenamiento: `uploads/evidence/stop_{id}_{timestamp}.{ext}`
- Al subir, marca la parada como `completed` con timestamp
- Guarda la URL relativa en `Stop.photo_url`

**Frontend** (TripPlannerPage.jsx):
1. Chofer presiona "Confirmar parada" en cada parada
2. Se abre la camara (nativa en mobile, file input en web)
3. Si la foto sale bien, se sube al servidor
4. La parada se marca como completada con icono de verificacion
5. El boton "Finalizar ruta" solo aparece cuando TODAS las paradas tienen evidencia

### Validacion de Finalizacion

**Backend**: `PUT /api/dispatch/routes/:id/complete`

Antes de permitir finalizar una ruta, el backend valida:
1. Todas las paradas deben tener `status = 'completed'`
2. Todas las paradas deben tener `photo_url` (foto de evidencia)
3. Si alguna parada no cumple, retorna error 400

Al finalizar:
- La ruta cambia a `status = 'completed'`
- Se registra `completed_at`
- Todas las ordenes vinculadas cambian a `order_status = 'delivered'`

---

## Sistema de Chatbot

### Flujo de Conversacion

```
Mensaje entrante del cliente
        │
        ▼
  ¿Tiene tag excluido? ──SI──> IGNORAR
        │ NO
        ▼
  ¿Agente humano activo? ──SI──> NO INTERFERIR
        │ NO                     (pero si envia direccion y
        ▼                        agent_active=true, guarda
  ¿Dentro de horario? ──NO──>    Address y Zip en Respond.io
        │ SI              Enviar mensaje fuera de horario
        ▼                 (solo una vez)
  ¿Es cliente existente con
   conversacion abierta? ──SI──> ¿Fue reabierta? ──NO──> NO INTERFERIR
        │ NO                          │ SI
        ▼                            ▼
  ¿Viene de Facebook Ad? ──SI──> Saludo + Pedir ZIP
        │ NO
        ▼
  Saludo + "¿Ya tiene info?"
        │
        ▼
  ¿Tiene info? ──SI──> Enviar catalogo + Pedir ZIP
        │ NO
        ▼
  Pedir ZIP code
        │
        ▼
  ¿ZIP con cobertura? ──NO──> Mensaje sin cobertura + CERRAR
        │ SI
        ▼
  Mostrar menu de productos
        │
        ▼
  Cliente selecciona producto
        │
        ▼
  Asignar agente segun producto
        │
        ▼
  FIN (agente humano toma control)
```

### Polling de Mensajes

El sistema NO usa webhooks. En su lugar, usa **polling activo** cada 30 segundos:

1. **Inicio**: Al activar el chatbot, se ejecuta `initializeConversationSnapshot()` que escanea TODAS las conversaciones para establecer estado base
2. **Cada ciclo**: Lee conversaciones abiertas, filtra por lifecycle, procesa mensajes nuevos
3. **Deteccion de cambios**: Compara conversaciones abiertas actuales vs estado anterior para detectar cierres y reaperturas
4. **Deduplicacion**: Cada mensaje procesado se registra por `messageId` para evitar doble procesamiento

### Proteccion de Conversaciones

**REGLA CRITICA**: El bot NUNCA debe interferir cuando un agente humano esta respondiendo.

**Niveles de proteccion (en orden de verificacion)**:

1. **`bot_paused` flag** (`ConversationState.bot_paused`): Si es `true`, el bot esta completamente deshabilitado para ese contacto. Se activa despues de 2 seguimientos sin respuesta o manualmente.

2. **`agent_active` flag** (`ConversationState.agent_active`): Si es `true`, el bot no responde bajo ninguna circunstancia. Se activa cuando se detecta un mensaje saliente de un agente humano. **Sin embargo**, si el cliente envia una direccion mientras `agent_active=true`, el escaneo de direcciones la guarda en Respond.io sin enviar mensajes del bot.

3. **Tags excluidos** (`MessagingSettings.excluded_tags`): Si el contacto tiene alguno de los tags configurados (ej: "Personal", "ClientesArea"), el bot lo ignora completamente.

4. **Deteccion de agentes en polling** (`pollingService.js`): Antes de procesar mensajes de un contacto, revisa los mensajes salientes recientes. Si encuentra un mensaje con `sender.source === 'user'` (agente humano, no bot), marca `agent_active = true` en `ConversationState` y no procesa ningun mensaje.

5. **Verificacion de historial** (`chatbotService.hasAgentAlreadyResponded()`): Antes de enviar cualquier respuesta, revisa los ultimos 50 mensajes del contacto en Respond.io. Si detecta mensajes salientes de tipo 'user' (agente humano), marca `agent_active = true` y aborta. Usa el timestamp de cierre real de la conversacion como cutoff (no 10 min fijo) para conversaciones reabierta.

6. **Cliente existente con conversacion abierta**: Si un contacto ya tiene una `MessagingOrder` en la base de datos y la conversacion sigue abierta (no fue cerrada y reabierta), el bot NO interfiere. Solo actua si la conversacion fue cerrada (`conversation_closed_at` tiene fecha) y luego reabierta por el cliente.

7. **Proteccion del scanner**: El escaneo de direcciones NO se ejecuta sobre contactos con estados `awaiting_*` (flujo del chatbot activo) ni en estado `assigned` para evitar interferencia entre servicios.

8. **Timestamps de control** (`ConversationState`):
   - `last_agent_message_at`: Timestamp del ultimo mensaje de un agente humano
   - `last_bot_message_at`: Timestamp del ultimo mensaje del bot
   - `last_customer_message_at`: Timestamp del ultimo mensaje del cliente
   - Estos timestamps se usan para calcular seguimientos y detectar inactividad

**Flujo de decision en cada ciclo de polling**:
```
¿bot_paused? ──SI──> IGNORAR
     │ NO
¿agent_active? ──SI──> IGNORAR (pero scanner puede guardar direccion)
     │ NO
¿Tiene tag excluido? ──SI──> IGNORAR
     │ NO
¿Hay mensajes salientes de agente? ──SI──> Marcar agent_active, IGNORAR
     │ NO
¿Es cliente existente sin reabrir? ──SI──> IGNORAR
     │ NO
     ▼
PROCESAR MENSAJE
```

### Escaneo de Direcciones

El polling incluye un escaneo automatico de direcciones en TODAS las conversaciones:

1. Lee mensajes de cada contacto
2. `AddressExtractorService` busca patrones de direccion (numero + calle + sufijo)
3. Si encuentra una direccion, la envia a `GeocodingService` para correccion
4. La direccion corregida y el ZIP se guardan como campos personalizados en Respond.io (Address, Zip Code)
5. Se crea un registro `ValidatedAddress` con los datos corregidos
6. La cache del scanner se limpia cuando un contacto envia un nuevo mensaje

**Proteccion**: No se ejecuta sobre contactos con flujo de chatbot activo (`awaiting_*`) ni cuando `agent_active=true` con estado `assigned`.

### Geocodificacion

Cuando se detecta una direccion en un chat:

```
"1234 Mian St Dallas TX" (con error)
        │
        ▼
  Google Maps Geocoding API
        │
        ▼
  "1234 Main St, Dallas, TX 75208" (corregida)
        │
        ▼
  Actualizar campos en Respond.io:
  - Address: "1234 Main St, Dallas, TX 75208"
  - Zip Code: "75208"
        │
        ▼
  Crear ValidatedAddress en BD
  (disponible para despacho)
```

### Seguimiento Automatico

Si el bot envia un mensaje y el cliente no responde en X minutos (configurable):

1. **Primer seguimiento**: Envia `followup_message` (ej: "¿Sigues ahi?")
2. **Segundo seguimiento**: Envia `followup_message_2` (ej: "Pausaremos la conversacion")
3. **Despues del 2do**: Pausa el bot para ese contacto y agrega tag "SinRespuesta"

Condiciones:
- No se envia si el bot esta pausado
- No se envia si un agente esta activo
- No se envia si el estado es 'assigned', 'closed_no_coverage' o 'initial'
- Maximo 2 seguimientos por conversacion

---

## Planificador de Rutas (Chofer)

**Archivo**: `client/pages/Planner/TripPlannerPage.jsx`

El planificador es la vista principal del chofer para ejecutar entregas:

### Funcionalidades

1. **Mapa interactivo**: Google Maps con marcadores numerados por cada parada
2. **Lista de paradas**: Panel lateral con todas las paradas ordenadas
3. **Drag-to-reorder**: El chofer puede arrastrar paradas para cambiar el orden manualmente
4. **Navegacion GPS**: Boton para abrir la navegacion a cada parada (Google Maps nativo en mobile, link en web)
5. **Linea de navegacion**: Linea azul (#4285F4) conectando las paradas en orden
6. **Confirmar parada**: Boton por parada que activa la camara para tomar foto de evidencia
7. **Retomar foto**: Si la foto no sale bien, puede tomarla de nuevo
8. **Indicador de progreso**: Muestra cuantas paradas estan completadas
9. **Finalizar ruta**: Solo aparece cuando TODAS las paradas tienen evidencia fotografica

### Optimizacion de Rutas

**Archivo**: `src/services/optimization.js`

Algoritmo: **Nearest Neighbor** (vecino mas cercano)

1. Procesa primero las paradas con prioridad alta (ordenadas por prioridad descendente)
2. Desde el punto actual, busca la parada no visitada mas cercana
3. Repite hasta visitar todas las paradas
4. Opcionalmente calcula la distancia de retorno al inicio

**Calculo de distancia**: Formula de Haversine (distancia en linea recta sobre la superficie terrestre)

**Velocidad estimada**: 30 km/h (promedio urbano)

### Navegacion GPS

Utilidades en `client/utils/capacitor.js`:
- `getCurrentPosition()`: Obtiene ubicacion actual con GPS de alta precision
- `watchPosition()`: Rastreo continuo de ubicacion para actualizar posicion en el mapa
- `requestLocationPermission()`: Solicita permiso de GPS en dispositivos nativos

### Calculo de ETAs

Basado en hora de inicio configurable:

```
ETA_parada_n = hora_inicio + Σ(tiempo_viaje_i + tiempo_en_parada_i) para i = 1..n
```

Donde:
- `tiempo_viaje_i` = distancia / velocidad_promedio
- `tiempo_en_parada_i` = duracion configurada (default: 5 minutos)

---

## Historial de Rutas (Admin)

**Archivo**: `client/pages/Admin/RouteHistory.jsx`

Pagina de administracion para revisar rutas completadas y en curso:

1. Lista de rutas con estado (completada/en curso), chofer asignado, fecha, monto total
2. Al hacer clic en una ruta, muestra detalle con:
   - Informacion general de la ruta
   - Lista de paradas con estado
   - Fotos de evidencia subidas por el chofer en cada parada
   - Visor de fotos ampliadas
3. **API**: `GET /api/dispatch/routes/history` + `GET /api/dispatch/routes/:id/detail`

---

## Compilacion Mobile

### Tecnologia

**Capacitor 6** permite compilar la app web como app nativa de Android e iOS.

### Configuracion

**Archivo**: `capacitor.config.ts`

- **appId**: `com.area862.app`
- **appName**: `Area 862`
- **webDir**: `dist` (carpeta de build del frontend)
- **server.url**: Si `VITE_API_URL` esta configurado, la app carga desde el servidor remoto
- **android.allowMixedContent**: Permite HTTP y HTTPS
- **SplashScreen**: 2 segundos, fondo oscuro (#0d1b2a)

### Capacitor Camera Plugin

**Paquete**: `@capacitor/camera` v6.1.3

Integrado para captura de fotos de evidencia en entregas:

```javascript
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'

const photo = await Camera.getPhoto({
  resultType: CameraResultType.DataUrl,
  source: CameraSource.Camera,
  quality: 80,
  width: 1280,
  height: 1280,
  correctOrientation: true,
  promptLabelHeader: 'Evidencia de entrega',
  promptLabelPhoto: 'Elegir de galería',
  promptLabelPicture: 'Tomar foto'
})
```

### Permisos Nativos

**Android** (`AndroidManifest.xml`):
- `CAMERA`: Acceso a la camara
- `READ_EXTERNAL_STORAGE`: Leer galeria (Android < 13)
- `WRITE_EXTERNAL_STORAGE`: Escribir galeria (Android < 13)
- `READ_MEDIA_IMAGES`: Leer imagenes (Android 13+)
- `ACCESS_FINE_LOCATION`: GPS de alta precision
- `ACCESS_COARSE_LOCATION`: GPS aproximado

**iOS** (`Info.plist`):
- `NSCameraUsageDescription`: Permiso de camara
- `NSPhotoLibraryUsageDescription`: Permiso de galeria (lectura)
- `NSPhotoLibraryAddUsageDescription`: Permiso de galeria (escritura)
- `NSLocationWhenInUseUsageDescription`: Permiso de GPS

### Otros Plugins de Capacitor

| Plugin | Version | Uso |
|---|---|---|
| `@capacitor/core` | ^6.2.1 | Framework base |
| `@capacitor/android` | ^6.2.1 | Plataforma Android |
| `@capacitor/ios` | ^6.2.1 | Plataforma iOS |
| `@capacitor/camera` | ^6.1.3 | Captura de fotos de evidencia |
| `@capacitor/geolocation` | ^6.1.1 | GPS y rastreo de ubicacion |
| `@capacitor/haptics` | ^6.0.3 | Vibracion tactil |
| `@capacitor/status-bar` | ^6.0.3 | Control de barra de estado |
| `@capacitor/splash-screen` | ^6.0.4 | Pantalla de carga |

### Proceso de Compilacion

```bash
# 1. Configurar URL del servidor en .env
VITE_API_URL=https://tu-dominio.com

# 2. Compilar frontend
npm run build

# 3. Sincronizar con plataformas
npx cap sync android   # Android
npx cap sync ios       # iOS

# 4. Abrir en IDE
npx cap open android   # Android Studio
npx cap open ios       # Xcode
```

Ver `INSTALL.md` para instrucciones detalladas paso a paso.

---

## Variables de Entorno

| Variable | Requerida | Descripcion |
|---|---|---|
| `DATABASE_URL` | Si | URL de conexion a PostgreSQL |
| `DATABASE_SSL` | No | Forzar SSL: 'true' (auto-detectado para proveedores cloud) |
| `SESSION_SECRET` | Si (prod) | Secreto para firmar cookies de sesion (generar con crypto) |
| `NODE_ENV` | No | 'development' o 'production' |
| `PORT` | No | Puerto del servidor (default: 5000) |
| `SERVER_DOMAIN` | No | Dominio del servidor para CORS (sin https://) |
| `VITE_GOOGLE_MAPS_API_KEY` | No | API key de Google Maps para el frontend |
| `GOOGLE_MAPS_API_KEY` | No | API key de Google Maps para geocodificacion backend |
| `VITE_API_URL` | No | URL completa del servidor para apps mobile |

### Generar SESSION_SECRET

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Base de Datos

### Tablas

Las tablas se crean **automaticamente** al iniciar el servidor gracias a `sequelize.sync({ alter: true })`.

| Tabla | Modelo | Descripcion |
|---|---|---|
| `users` | User | Usuarios del sistema (admin, client, driver) |
| `routes` | Route | Rutas de entrega con chofer asignado |
| `stops` | Stop | Paradas de cada ruta con foto de evidencia |
| `validated_addresses` | ValidatedAddress | Ordenes de despacho con estado, monto, chofer |
| `route_histories` | RouteHistory | Historial de rutas completadas |
| `messaging_settings` | MessagingSettings | Configuracion del chatbot (1 por usuario) |
| `messaging_orders` | MessagingOrder | Ordenes recibidas por mensajeria |
| `message_logs` | MessageLog | Historial de todos los mensajes |
| `conversation_states` | ConversationState | Estado de cada conversacion del bot |
| `coverage_zones` | CoverageZone | Zonas de cobertura por ZIP code |
| `service_agents` | ServiceAgent | Agentes asignables por producto/servicio |

### Migraciones

El sistema usa `sequelize.sync({ alter: true })` que automaticamente:
- Crea tablas nuevas si no existen
- Agrega columnas nuevas
- No elimina columnas existentes

Para cambios destructivos (renombrar/eliminar columnas), se debe modificar directamente en PostgreSQL.

---

## API Endpoints - Referencia Completa

### Endpoint de Salud

```
GET /api/health
Respuesta: { "status": "ok", "message": "Area 862 System API funcionando (Node.js)" }
```

### Autenticacion

```
POST /api/auth/register
Body: { email, password, username, phone? }
Respuesta: { success, message, user }

POST /api/auth/login
Body: { email, password }
Respuesta: { success, message, user }

POST /api/auth/logout
Respuesta: { success, message }

GET /api/auth/me
Respuesta: { user }

PUT /api/auth/update
Body: { username?, phone?, document?, address? }
Respuesta: { success, message, user }
```

### Administracion (requiere rol admin)

```
GET /api/admin/stats
Respuesta: { users: { total, active, admins, drivers, clients }, routes, orders }

GET /api/admin/users?role=&search=&limit=50&offset=0
Respuesta: { users, total }

PUT /api/admin/users/:id
Body: { username?, email?, phone?, role?, active?, subscription_type? }

PUT /api/admin/users/:id/role
Body: { role: 'admin'|'client'|'driver' }

PUT /api/admin/users/:id/toggle-active

DELETE /api/admin/users/:id
```

### Rutas de Entrega

```
GET /api/routes
POST /api/routes
Body: { name?, stops?: [{ address, lat, lng, note?, phone?, customer_name?, priority?, duration? }] }

GET /api/routes/:id
PUT /api/routes/:id
Body: { name?, status? }

DELETE /api/routes/:id

POST /api/routes/:id/stops
Body: { address, lat, lng, note?, phone?, customer_name?, priority? }

POST /api/routes/:id/reorder
Body: { stop_order: [id1, id2, id3, ...] }

POST /api/routes/:id/optimize
Body: { start_lat?, start_lng?, start_address?, return_to_start?, start_time?, mode? }
Respuesta: { success, route, total_distance_km, total_duration_min }

POST /api/routes/:id/start
POST /api/routes/:id/complete
POST /api/routes/:id/import-text
Body: { text: "direccion 1\ndireccion 2\ndireccion 3" }
```

### Despacho

```
GET /api/dispatch/orders
Query: { status?, available? }
Respuesta: { orders }

GET /api/dispatch/stats
Respuesta: { total, on_production, production_finished, order_picked_up, on_delivery, delivered }

PUT /api/dispatch/orders/:id/status
Body: { order_status: 'on_production'|'production_finished'|'order_picked_up'|'on_delivery'|'delivered' }
Respuesta: { success, order }

PUT /api/dispatch/orders/:id/amount
Body: { amount: 25.50 }
Respuesta: { success, order }

PUT /api/dispatch/orders/:id/delivered
Respuesta: { success, order }

PUT /api/dispatch/orders/bulk-status
Body: { order_ids: [1, 2, 3], order_status: 'on_production' }
Respuesta: { success, updated }

POST /api/dispatch/routes
Body: { name?, order_ids: [1, 2, 3], pre_optimized? }
Respuesta: { success, route }

GET /api/dispatch/routes
Respuesta: { routes }

POST /api/dispatch/routes/:id/optimize
Respuesta: { success, route, total_distance, total_duration }

PUT /api/dispatch/routes/:id/assign
Body: { driver_id: 5 }
Respuesta: { success, route, message }

PUT /api/dispatch/routes/:id/complete
Respuesta: { success, route }

GET /api/dispatch/routes/:id/detail
Respuesta: { route (con orders y total_amount) }

GET /api/dispatch/routes/history
Respuesta: { routes }

POST /api/dispatch/stops/:id/evidence
Body: multipart/form-data con campo 'photo' (imagen)
Respuesta: { success, stop }

GET /api/dispatch/drivers
Respuesta: { drivers }

GET /api/dispatch/respond-users
Respuesta: { users }

POST /api/dispatch/sync-drivers
Body: { users: [{ name, email }] }
Respuesta: { success, created, skipped, message }
```

### Mensajeria - Configuracion

```
GET /api/messaging/settings
PUT /api/messaging/settings
Body: { respond_api_token?, is_active?, attention_mode?, business_hours_enabled?, ... }

POST /api/messaging/settings/test-connection
POST /api/messaging/settings/reset-test
```

### Mensajeria - Ordenes

```
GET /api/messaging/orders?status=&limit=50&offset=0
GET /api/messaging/orders/:id
POST /api/messaging/orders
PUT /api/messaging/orders/:id
POST /api/messaging/orders/:id/confirm
POST /api/messaging/orders/:id/cancel
Body: { reason? }
POST /api/messaging/orders/:id/complete
DELETE /api/messaging/orders/:id
POST /api/messaging/orders/:id/send-message
Body: { message: "texto del mensaje" }
```

### Mensajeria - Zonas de Cobertura

```
GET /api/messaging/coverage-zones
POST /api/messaging/coverage-zones
Body: { zip_code, zone_name?, city?, state?, country?, is_active?, delivery_fee?, min_order_amount?, estimated_delivery_time?, notes? }

POST /api/messaging/coverage-zones/bulk
Body: { zip_codes: ["75201", "75202", ...], zone_name?, city?, state? }

PUT /api/messaging/coverage-zones/:id
DELETE /api/messaging/coverage-zones/:id

POST /api/messaging/validate-zip
Body: { zipOrCity: "75208" | "Dallas" | "1234 Main St" }
```

### Mensajeria - Agentes

```
GET /api/messaging/agents
POST /api/messaging/agents
Body: { agent_name, service_name, agent_email?, agent_id?, products?: [...], is_default? }

PUT /api/messaging/agents/:id
DELETE /api/messaging/agents/:id
```

### Polling

```
POST /api/messaging/polling/start
POST /api/messaging/polling/stop
GET /api/messaging/polling/status
Respuesta: { active, lastPoll?, intervalMs?, processedCount? }
```

---

## Dependencias del Proyecto

### Produccion

| Paquete | Version | Uso |
|---|---|---|
| express | ^4.22 | Framework web |
| sequelize | ^6.37 | ORM para PostgreSQL |
| pg / pg-hstore | ^8.18 | Driver de PostgreSQL |
| bcryptjs | ^2.4 | Hash de contraseñas |
| express-session | ^1.19 | Manejo de sesiones |
| cors | ^2.8 | Control de origenes cruzados |
| dotenv | ^17.3 | Variables de entorno |
| axios | ^1.13 | Cliente HTTP (Respond.io, Google Maps) |
| uuid | ^9.0 | Generacion de IDs unicos |
| **multer** | **^2.0** | **Subida de archivos (fotos de evidencia)** |
| react | ^18.3 | Framework de UI |
| react-dom | ^18.3 | Renderizado de React |
| react-router-dom | ^6.30 | Enrutamiento del frontend |
| @googlemaps/js-api-loader | ^1.16 | Carga de Google Maps en frontend |
| @capacitor/core | ^6.2 | Framework mobile |
| @capacitor/android | ^6.2 | Plataforma Android |
| @capacitor/ios | ^6.2 | Plataforma iOS |
| **@capacitor/camera** | **^6.1** | **Captura de fotos nativa** |
| @capacitor/geolocation | ^6.1 | GPS y ubicacion |
| @capacitor/haptics | ^6.0 | Vibracion tactil |
| @capacitor/status-bar | ^6.0 | Control de barra de estado |
| @capacitor/splash-screen | ^6.0 | Pantalla de carga |

### Desarrollo

| Paquete | Version | Uso |
|---|---|---|
| vite | ^5.4 | Bundler y dev server |
| @vitejs/plugin-react | ^4.7 | Plugin de React para Vite |
| @capacitor/cli | ^6.2 | CLI de Capacitor |

---

## Scripts Disponibles

```bash
npm start              # Iniciar servidor de produccion (node src/index.js)
npm run dev            # Iniciar con auto-reload (node --watch src/index.js)
npm run build          # Compilar frontend a /dist
npm run build:mobile   # Compilar + sincronizar con plataformas mobile
npm run cap:sync       # Sincronizar assets con Android/iOS
npm run cap:android    # Abrir Android Studio
npm run cap:ios        # Abrir Xcode (solo Mac)
```

---

## Seguridad

1. **Contraseñas**: Hash bcrypt con factor 10, nunca se almacena texto plano
2. **Sesiones**: Cookies HTTP-only, secure en produccion, SameSite configurado
3. **CORS**: Actualmente usa `origin: true` (acepta cualquier origen) para compatibilidad con Capacitor y multiples entornos. En produccion, se recomienda restringir a origenes especificos editando la configuracion en `src/index.js`
4. **Roles**: Middleware que verifica rol antes de acceder a rutas administrativas. Despacho restringido a admin y driver.
5. **Validacion de entrada**: Email normalizado, contraseña minimo 6 caracteres
6. **API tokens**: El token de Respond.io se almacena en BD y nunca se expone al frontend (se muestra solo `has_api_token: true/false`)
7. **SESSION_SECRET**: Obligatorio en produccion, genera error si no esta configurado
8. **Inyeccion SQL**: Prevenida por Sequelize ORM (consultas parametrizadas)
9. **Subida de archivos**: Multer valida tipo MIME (solo imagenes) y limita tamaño a 10MB
10. **Permisos de evidencia**: Solo el chofer asignado o un admin puede subir evidencia a una parada
11. **Transiciones de estado**: Validacion estricta de que cada cambio de estado sigue el flujo permitido
