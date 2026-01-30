# HormiRuta - Documentacion Tecnica

## Indice

1. [Vision General](#vision-general)
2. [Arquitectura del Sistema](#arquitectura-del-sistema)
3. [Estructura del Proyecto](#estructura-del-proyecto)
4. [Backend (Node.js/Express)](#backend-nodejsexpress)
5. [Frontend (React/Vite)](#frontend-reactvite)
6. [Base de Datos](#base-de-datos)
7. [Integraciones Externas](#integraciones-externas)
8. [Compilacion Movil (Capacitor)](#compilacion-movil-capacitor)
9. [Configuracion y Despliegue](#configuracion-y-despliegue)
10. [API Reference](#api-reference)

---

## Vision General

HormiRuta es un sistema de gestion de logistica de entregas disenado para el area metropolitana de Dallas. Permite a conductores y empresas planificar rutas optimizadas, gestionar ordenes de entrega y validar zonas de cobertura.

### Caracteristicas Principales

- Autenticacion de usuarios (email/password)
- Control de acceso basado en roles (admin, client, driver)
- Planificacion de rutas con multiples paradas
- Algoritmo de optimizacion de rutas (nearest-neighbor)
- Integracion con Google Maps para navegacion
- Integracion con Respond.io para ordenes por mensajeria
- Gestion de zonas de cobertura (codigos postales)
- Panel de administracion
- Validacion multi-criterio (ZIP, ciudad, direccion, nombre de zona)

---

## Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────────┐
│                        Cliente                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  Web App    │  │  Android    │  │    iOS      │              │
│  │  (React)    │  │  (Capacitor)│  │ (Capacitor) │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Servidor Express                             │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Puerto 5000 - Servidor Unificado                           ││
│  │  ┌─────────────┐  ┌─────────────────────────────────────┐   ││
│  │  │  API REST   │  │  Archivos Estaticos (dist/)         │   ││
│  │  │  /api/*     │  │  Frontend React compilado           │   ││
│  │  └─────────────┘  └─────────────────────────────────────┘   ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      PostgreSQL                                  │
│  Tablas: users, routes, stops, messaging_orders, coverage_zones │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Servicios Externos                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ Google Maps │  │ Respond.io  │  │   Otros     │              │
│  │    API      │  │   API v2    │  │   APIs      │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Estructura del Proyecto

```
hormiruta/
├── src/                          # Backend - Servidor Express
│   ├── config/
│   │   └── database.js           # Configuracion de Sequelize/PostgreSQL
│   ├── middleware/
│   │   └── auth.js               # Middleware de autenticacion y roles
│   ├── models/
│   │   ├── index.js              # Exportacion y relaciones de modelos
│   │   ├── User.js               # Modelo de usuario
│   │   ├── Route.js              # Modelo de ruta
│   │   ├── Stop.js               # Modelo de parada
│   │   ├── RouteHistory.js       # Historial de rutas
│   │   ├── MessagingOrder.js     # Ordenes de mensajeria
│   │   ├── CoverageZone.js       # Zonas de cobertura
│   │   ├── MessageLog.js         # Log de mensajes
│   │   ├── MessagingSettings.js  # Configuracion de mensajeria
│   │   └── ConversationState.js  # Estado de conversaciones
│   ├── routes/
│   │   ├── auth.js               # Rutas de autenticacion
│   │   ├── admin.js              # Rutas de administracion
│   │   ├── routes.js             # CRUD de rutas
│   │   ├── stops.js              # CRUD de paradas
│   │   ├── history.js            # Historial
│   │   └── messaging.js          # Integracion Respond.io
│   ├── services/
│   │   ├── respondio.js          # Cliente Respond.io API
│   │   ├── respondApiService.js  # Servicio de API Respond.io
│   │   ├── addressValidation.js  # Validacion de direcciones
│   │   ├── chatbotService.js     # Logica del chatbot
│   │   └── pollingService.js     # Polling de mensajes
│   └── index.js                  # Entry point del servidor
│
├── client/                       # Frontend - React
│   ├── api.js                    # Cliente Axios configurado
│   ├── App.jsx                   # Componente principal con rutas
│   ├── main.jsx                  # Entry point React
│   ├── index.css                 # Estilos globales
│   ├── contexts/
│   │   ├── AuthContext.jsx       # Context de autenticacion
│   │   └── MessagingContext.jsx  # Context de mensajeria
│   ├── layouts/
│   │   ├── DashboardLayout.jsx   # Layout principal
│   │   └── PlannerLayout.jsx     # Layout del planificador
│   ├── pages/
│   │   ├── Auth/
│   │   │   ├── LoginPage.jsx     # Pagina de login
│   │   │   └── RegisterPage.jsx  # Pagina de registro
│   │   ├── Admin/
│   │   │   ├── AdminDashboard.jsx # Panel de admin
│   │   │   └── AdminUsers.jsx    # Gestion de usuarios
│   │   ├── Dashboard/
│   │   │   └── DashboardPage.jsx # Dashboard principal
│   │   ├── Messaging/
│   │   │   ├── OrdersPage.jsx    # Centro de mensajeria
│   │   │   ├── CoveragePage.jsx  # Zonas de cobertura
│   │   │   └── SettingsPage.jsx  # Configuracion
│   │   └── Planner/
│   │       └── TripPlannerPage.jsx # Planificador de rutas
│   └── utils/
│       └── capacitor.js          # Utilidades de Capacitor
│
├── public/                       # Archivos estaticos
│   ├── logo.png
│   └── hormiruta-icon.svg
│
├── dist/                         # Frontend compilado (generado)
│
├── android/                      # Proyecto Android (Capacitor)
│   ├── app/
│   │   ├── src/main/
│   │   │   ├── java/            # Codigo Java nativo
│   │   │   ├── res/             # Recursos Android
│   │   │   └── AndroidManifest.xml
│   │   └── build.gradle
│   └── build.gradle
│
├── ios/                          # Proyecto iOS (Capacitor)
│   └── App/
│       ├── App/                  # Codigo Swift nativo
│       └── App.xcworkspace
│
├── capacitor.config.ts           # Configuracion de Capacitor
├── vite.config.js                # Configuracion de Vite
├── package.json                  # Dependencias y scripts
└── index.html                    # HTML entry point
```

---

## Backend (Node.js/Express)

### Archivo Principal: `src/index.js`

El servidor Express unificado que sirve tanto la API como el frontend.

```javascript
// Configuracion principal
const PORT = process.env.PORT || 5000;

// Middleware
- cors (con origenes permitidos)
- express.json()
- express-session (autenticacion basada en sesiones)

// Rutas API
app.use('/api/auth', authRoutes);      // Autenticacion
app.use('/api/routes', routesRoutes);  // Rutas de entrega
app.use('/api/stops', stopsRoutes);    // Paradas
app.use('/api/history', historyRoutes);// Historial
app.use('/api/messaging', messagingRoutes); // Mensajeria
app.use('/api/admin', adminRoutes);    // Administracion

// Archivos estaticos
app.use(express.static('dist'));
```

### Modelos de Datos

#### User (`src/models/User.js`)
```javascript
{
  id: INTEGER (PK, autoincrement),
  username: STRING (required),
  email: STRING (required, unique),
  password_hash: STRING,
  phone: STRING,
  document: STRING,
  address: STRING,
  role: ENUM('admin', 'client', 'driver'),
  active: BOOLEAN (default: true),
  created_at: DATE,
  updated_at: DATE
}

// Metodos
- setPassword(password): Hashea y guarda la contrasena
- checkPassword(password): Verifica la contrasena
- toDict(): Retorna objeto sin datos sensibles
```

#### Route (`src/models/Route.js`)
```javascript
{
  id: INTEGER (PK),
  user_id: INTEGER (FK -> users),
  name: STRING,
  status: ENUM('draft', 'active', 'completed', 'cancelled'),
  is_optimized: BOOLEAN,
  total_distance: FLOAT,
  total_duration: INTEGER,
  start_address: STRING,
  start_lat: FLOAT,
  start_lng: FLOAT,
  end_address: STRING,
  end_lat: FLOAT,
  end_lng: FLOAT,
  return_to_start: BOOLEAN,
  vehicle_type: ENUM('car', 'motorcycle', 'bicycle', 'walk'),
  optimization_mode: ENUM('distance', 'time'),
  scheduled_date: DATE,
  started_at: DATE,
  completed_at: DATE
}
```

#### Stop (`src/models/Stop.js`)
```javascript
{
  id: INTEGER (PK),
  route_id: INTEGER (FK -> routes),
  address: STRING (required),
  lat: FLOAT,
  lng: FLOAT,
  order: INTEGER,
  status: ENUM('pending', 'completed', 'skipped'),
  customer_name: STRING,
  customer_phone: STRING,
  notes: STRING,
  estimated_arrival: DATE,
  actual_arrival: DATE,
  signature: TEXT
}
```

#### CoverageZone (`src/models/CoverageZone.js`)
```javascript
{
  id: INTEGER (PK),
  user_id: INTEGER (FK -> users),
  zip_code: STRING (required),
  zone_name: STRING,
  city: STRING,
  state: STRING,
  delivery_fee: DECIMAL,
  estimated_delivery_time: INTEGER,
  is_active: BOOLEAN,
  notes: TEXT
}
```

#### MessagingOrder (`src/models/MessagingOrder.js`)
```javascript
{
  id: INTEGER (PK),
  user_id: INTEGER (FK),
  contact_id: STRING,
  contact_name: STRING,
  address: STRING,
  zip_code: STRING,
  channel_type: STRING,
  status: ENUM('pending', 'confirmed', 'in_transit', 'completed', 'cancelled'),
  validation_status: STRING,
  route_id: INTEGER (FK),
  stop_id: INTEGER (FK),
  assigned_driver_id: INTEGER (FK)
}
```

#### MessagingSettings (`src/models/MessagingSettings.js`)
```javascript
{
  id: INTEGER (PK),
  user_id: INTEGER (FK, unique),
  respond_api_token: STRING,
  is_active: BOOLEAN,
  auto_validate_addresses: BOOLEAN,
  auto_respond_coverage: BOOLEAN,
  auto_respond_no_coverage: BOOLEAN,
  coverage_message: TEXT,
  no_coverage_message: TEXT,
  order_confirmed_message: TEXT,
  business_hours_enabled: BOOLEAN,
  business_hours_start: TIME,
  business_hours_end: TIME,
  business_days: ARRAY,
  timezone: STRING
}
```

### Middleware de Autenticacion

`src/middleware/auth.js`

```javascript
// requireAuth - Verifica sesion activa
export const requireAuth = async (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  next();
};

// requireRole - Verifica rol especifico
export const requireRole = (...roles) => async (req, res, next) => {
  const user = await User.findByPk(req.session.userId);
  if (!roles.includes(user.role)) {
    return res.status(403).json({ error: 'No autorizado' });
  }
  next();
};
```

### Servicios

#### AddressValidationService (`src/services/addressValidation.js`)

Valida direcciones contra las zonas de cobertura configuradas.

```javascript
class AddressValidationService {
  // Valida ZIP code, ciudad, direccion o nombre de zona
  async validate(input, userId) {
    // Busca en zonas de cobertura por:
    // 1. Codigo postal exacto
    // 2. Nombre de ciudad
    // 3. Direccion que contenga el input
    // 4. Nombre de zona
    
    return {
      valid: boolean,
      zone: CoverageZone | null,
      message: string,
      copyMessage: string // Mensaje listo para copiar al cliente
    };
  }
}
```

#### RespondioService (`src/services/respondio.js`)

Cliente para la API de Respond.io v2.

```javascript
class RespondioService {
  constructor(apiToken) {
    this.apiToken = apiToken;
    this.baseUrl = 'https://api.respond.io/v2';
  }

  // Prueba la conexion con la API
  async testConnection() { ... }
  
  // Obtiene conversaciones
  async getConversations(params) { ... }
  
  // Envia mensaje a un contacto
  async sendMessage(contactId, message) { ... }
  
  // Obtiene mensajes de una conversacion
  async getMessages(contactId, params) { ... }
}
```

#### ChatbotService (`src/services/chatbotService.js`)

Logica del chatbot para procesar mensajes entrantes.

```javascript
class ChatbotService {
  // Procesa mensaje entrante
  async processMessage(message, settings) {
    // Detecta intencion del mensaje
    // Valida ZIP si corresponde
    // Genera respuesta apropiada
  }
  
  // Detecta si el mensaje contiene un codigo postal
  extractZipCode(text) { ... }
  
  // Genera mensaje de respuesta
  generateResponse(context, settings) { ... }
}
```

---

## Frontend (React/Vite)

### Configuracion de Vite

`vite.config.js`
```javascript
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5000,
    proxy: {
      '/api': 'http://localhost:5000'
    }
  },
  build: {
    outDir: 'dist'
  }
});
```

### Cliente API

`client/api.js`
```javascript
import axios from 'axios';
import { Capacitor } from '@capacitor/core';

// Detecta si esta en app movil o web
const getBaseURL = () => {
  if (Capacitor.isNativePlatform()) {
    return process.env.SERVER_URL || 'https://api.hormiruta.com';
  }
  return '';  // Usa el mismo origen en web
};

const api = axios.create({
  baseURL: getBaseURL(),
  withCredentials: true
});

export default api;
```

### Contexts

#### AuthContext (`client/contexts/AuthContext.jsx`)

Maneja el estado de autenticacion global.

```javascript
const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Funciones expuestas:
  // - login(email, password)
  // - register(data)
  // - logout()
  // - checkAuth()
  
  return (
    <AuthContext.Provider value={{ user, loading, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  );
}
```

#### MessagingContext (`client/contexts/MessagingContext.jsx`)

Maneja el estado de mensajeria y ordenes.

```javascript
const MessagingContext = createContext();

export function MessagingProvider({ children }) {
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({});
  const [settings, setSettings] = useState(null);
  const [coverageZones, setCoverageZones] = useState([]);

  // Funciones expuestas:
  // - fetchOrders(status)
  // - fetchStats()
  // - fetchSettings()
  // - updateSettings(data)
  // - confirmOrder(id)
  // - cancelOrder(id)
  // - completeOrder(id)
  // - fetchCoverageZones()
  // - createCoverageZone(data)
  // - createCoverageZonesBulk(data)
  // - updateCoverageZone(id, data)
  // - deleteCoverageZone(id)
  
  return (
    <MessagingContext.Provider value={{ ... }}>
      {children}
    </MessagingContext.Provider>
  );
}
```

### Paginas Principales

#### LoginPage (`client/pages/Auth/LoginPage.jsx`)
- Formulario de inicio de sesion
- Validacion de campos
- Redireccion post-login

#### DashboardPage (`client/pages/Dashboard/DashboardPage.jsx`)
- Vista principal del usuario
- Estadisticas rapidas
- Accesos directos a funciones

#### OrdersPage (`client/pages/Messaging/OrdersPage.jsx`)
- Centro de mensajeria
- Lista de ordenes con filtros
- Validador de ZIP codes
- Historial de validaciones

#### CoveragePage (`client/pages/Messaging/CoveragePage.jsx`)
- Tabla de zonas de cobertura
- CRUD de zonas
- Importacion masiva de ZIP codes

#### TripPlannerPage (`client/pages/Planner/TripPlannerPage.jsx`)
- Planificador de rutas
- Integracion con Google Maps
- Optimizacion de rutas

#### AdminDashboard (`client/pages/Admin/AdminDashboard.jsx`)
- Estadisticas del sistema
- Navegacion a modulos de administracion

#### AdminUsers (`client/pages/Admin/AdminUsers.jsx`)
- Gestion de usuarios
- Cambio de roles
- Activar/desactivar cuentas

---

## Base de Datos

### Configuracion

`src/config/database.js`
```javascript
import { Sequelize } from 'sequelize';

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

export default sequelize;
```

### Relaciones entre Modelos

```
User (1) ----< (N) Route
User (1) ----< (N) MessagingOrder
User (1) ----< (N) CoverageZone
User (1) ----< (N) MessageLog
User (1) ----> (1) MessagingSettings
User (1) ----< (N) ConversationState
User (1) ----< (N) RouteHistory

Route (1) ----< (N) Stop
Route (1) ----< (N) MessagingOrder

MessagingOrder (1) ----< (N) MessageLog
```

### Migraciones

Las tablas se crean automaticamente al iniciar el servidor usando `sequelize.sync()`.

---

## Integraciones Externas

### Google Maps API

Usado para:
- Geocodificacion de direcciones
- Calcular distancias y tiempos
- Mostrar mapas interactivos
- Navegacion turn-by-turn

**Configuracion:**
```javascript
// Variable de entorno requerida
VITE_GOOGLE_MAPS_API_KEY=tu_api_key
```

### Respond.io API v2

Integracion para recibir y procesar ordenes desde mensajeria.

**Endpoints utilizados:**
- `GET /conversations` - Obtener conversaciones
- `GET /conversations/:id/messages` - Obtener mensajes
- `POST /conversations/:id/messages` - Enviar mensaje

**Configuracion:**
```javascript
// En la UI: Messaging > Settings > API Token
// El token se guarda en MessagingSettings.respond_api_token
```

---

## Compilacion Movil (Capacitor)

### Configuracion

`capacitor.config.ts`
```typescript
const config: CapacitorConfig = {
  appId: 'com.hormiruta.app',
  appName: 'HormiRuta',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    url: process.env.SERVER_URL || 'https://api.hormiruta.com'
  },
  plugins: {
    SplashScreen: { ... },
    StatusBar: { ... },
    Keyboard: { ... }
  }
};
```

### Plugins Instalados

- `@capacitor/geolocation` - Acceso a GPS
- `@capacitor/haptics` - Vibracion/feedback tactil
- `@capacitor/splash-screen` - Pantalla de carga
- `@capacitor/status-bar` - Control de barra de estado

### Comandos de Compilacion

```bash
# Compilar frontend
npm run build

# Sincronizar con proyectos moviles
npm run cap:sync

# Solo Android
npx cap sync android

# Solo iOS
npx cap sync ios

# Abrir en Android Studio
npx cap open android

# Abrir en Xcode (solo Mac)
npx cap open ios
```

### Requisitos de Compilacion

**Android:**
- Android Studio
- SDK Android 29+ (Android 10)
- Java 17+

**iOS:**
- macOS
- Xcode 15+
- CocoaPods (`gem install cocoapods`)
- Cuenta de desarrollador Apple (para dispositivos fisicos)

---

## Configuracion y Despliegue

### Variables de Entorno

| Variable | Descripcion | Requerida |
|----------|-------------|-----------|
| `DATABASE_URL` | URL de conexion PostgreSQL | Si |
| `SESSION_SECRET` | Secreto para sesiones Express | Si (produccion) |
| `PORT` | Puerto del servidor | No (default: 5000) |
| `NODE_ENV` | Entorno (development/production) | No |
| `SERVER_DOMAIN` | Dominio del servidor | No |
| `SERVER_URL` | URL completa del servidor | No |
| `VITE_GOOGLE_MAPS_API_KEY` | API key de Google Maps | Si |

### Scripts Disponibles

```bash
# Desarrollo
npm run dev          # Servidor con hot-reload

# Produccion
npm start            # Servidor de produccion
npm run build        # Compilar frontend

# Movil
npm run build:mobile # Build + sync Capacitor
npm run cap:sync     # Sincronizar assets
npm run cap:android  # Abrir Android Studio
npm run cap:ios      # Abrir Xcode
```

### Despliegue en Produccion

1. Configurar variables de entorno
2. Ejecutar `npm run build` para compilar frontend
3. Ejecutar `npm start` para iniciar servidor
4. Configurar proxy inverso (nginx) si es necesario
5. Configurar SSL/TLS

---

## API Reference

### Autenticacion

#### POST /api/auth/register
Registra un nuevo usuario.

**Body:**
```json
{
  "email": "usuario@email.com",
  "password": "password123",
  "username": "Nombre Usuario",
  "phone": "1234567890"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Usuario registrado exitosamente",
  "user": { ... }
}
```

#### POST /api/auth/login
Inicia sesion.

**Body:**
```json
{
  "email": "usuario@email.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Inicio de sesion exitoso",
  "user": { ... }
}
```

#### POST /api/auth/logout
Cierra sesion.

#### GET /api/auth/me
Obtiene usuario actual.

### Rutas

#### GET /api/routes
Lista rutas del usuario.

#### POST /api/routes
Crea nueva ruta.

#### GET /api/routes/:id
Obtiene ruta por ID.

#### PUT /api/routes/:id
Actualiza ruta.

#### DELETE /api/routes/:id
Elimina ruta.

#### POST /api/routes/:id/optimize
Optimiza el orden de paradas.

### Paradas

#### GET /api/stops/:routeId
Lista paradas de una ruta.

#### POST /api/stops
Crea nueva parada.

#### PUT /api/stops/:id
Actualiza parada.

#### DELETE /api/stops/:id
Elimina parada.

### Mensajeria

#### GET /api/messaging/settings
Obtiene configuracion de mensajeria.

#### PUT /api/messaging/settings
Actualiza configuracion.

#### POST /api/messaging/validate-zip
Valida codigo postal.

**Body:**
```json
{
  "zipOrCity": "75001"
}
```

**Response:**
```json
{
  "valid": true,
  "zone": {
    "zip_code": "75001",
    "zone_name": "Dallas Metro",
    "city": "Dallas",
    "state": "TX"
  },
  "message": "Cobertura disponible",
  "copyMessage": "Excelente! Tenemos cobertura en Dallas..."
}
```

#### GET /api/messaging/coverage-zones
Lista zonas de cobertura.

#### POST /api/messaging/coverage-zones
Crea zona de cobertura.

#### POST /api/messaging/coverage-zones/bulk
Crea multiples zonas.

#### PUT /api/messaging/coverage-zones/:id
Actualiza zona.

#### DELETE /api/messaging/coverage-zones/:id
Elimina zona.

#### GET /api/messaging/orders
Lista ordenes.

#### PUT /api/messaging/orders/:id/confirm
Confirma orden.

#### PUT /api/messaging/orders/:id/cancel
Cancela orden.

#### PUT /api/messaging/orders/:id/complete
Completa orden.

### Administracion

#### GET /api/admin/stats
Obtiene estadisticas del sistema.

#### GET /api/admin/users
Lista todos los usuarios.

#### PUT /api/admin/users/:id
Actualiza usuario (rol, estado).

---

## Convencion de Codigo

### Nombres de Archivos
- Componentes React: PascalCase (`LoginPage.jsx`)
- Utilidades/servicios: camelCase (`authService.js`)
- Estilos: Mismo nombre que componente (`LoginPage.css`)

### Estructura de Componentes
```jsx
import { useState, useEffect } from 'react';
import api from '../api';
import './ComponentName.css';

export default function ComponentName() {
  const [state, setState] = useState(null);

  useEffect(() => {
    // Efecto inicial
  }, []);

  const handleAction = async () => {
    // Logica
  };

  return (
    <div className="component-name">
      {/* JSX */}
    </div>
  );
}
```

### Manejo de Errores
```javascript
try {
  const response = await api.get('/api/endpoint');
  // Procesar respuesta
} catch (error) {
  console.error('Error:', error);
  // Mostrar mensaje al usuario
}
```

---

## Contacto y Soporte

Para preguntas tecnicas o soporte, contactar al equipo de desarrollo.

---

*Documentacion generada para HormiRuta v1.0.0*
