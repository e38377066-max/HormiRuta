# Area 862 System

Sistema de planificacion y optimizacion de rutas de entrega para el area metropolitana de Dallas. Diseñado para conductores y empresas de logistica.

---

## Descripcion

Area 862 System es una plataforma completa de logistica que combina:

- **Despacho de ordenes**: Mapa interactivo para crear rutas, asignar choferes y seguir entregas en tiempo real
- **Planificador de rutas**: App movil para choferes con navegacion GPS, paradas numeradas y evidencia de entrega
- **Chatbot inteligente**: Atencion automatizada de clientes via Respond.io (WhatsApp, Facebook, etc.)
- **Validacion de cobertura**: Verificacion automatica de zonas de servicio por codigo postal, ciudad o direccion
- **Panel de administracion**: Gestion de usuarios, roles, historial de rutas y evidencias

---

## Funcionalidades Principales

### Sistema de Despacho
- Mapa con ordenes codificadas por color segun estado
- Flujo de estados: aprobado > en produccion > produccion terminada > recogido > en camino > entregado
- Creacion de rutas desde el mapa con asignacion a choferes
- Vista de historial con evidencias fotograficas por parada

### Planificador de Rutas (App Movil)
- Navegacion GPS en tiempo real con ETA
- Paradas numeradas con drag-to-reorder
- Confirmacion de entrega con foto obligatoria (firma/comprobante)
- Optimizacion automatica de rutas (nearest-neighbor)
- Solo permite finalizar ruta cuando todas las paradas tienen evidencia

### Chatbot (Respond.io)
- Modo asistido y automatico
- Deteccion de origen Facebook Ads
- Menu de productos con informacion individual
- Asignacion automatica de agentes por producto
- Proteccion de conversaciones (no interfiere si un agente ya respondio)
- Escaneo automatico de direcciones con correccion via Google Maps Geocoding

### Panel de Administracion
- Gestion de usuarios y roles (admin, client, driver)
- Zonas de cobertura configurables
- Configuracion del chatbot y agentes
- Historial de rutas con visor de evidencias
- Estadisticas generales

---

## Tecnologias

### Frontend
| Tecnologia | Uso |
|---|---|
| React 18 | Framework UI |
| Vite 5 | Build tool |
| React Router 6 | Navegacion |
| Axios | Cliente HTTP |
| Google Maps JS API | Mapas y navegacion |
| Capacitor 6 | Compilacion movil (Android/iOS) |

### Backend
| Tecnologia | Uso |
|---|---|
| Node.js | Runtime |
| Express.js | Framework web |
| Sequelize | ORM |
| PostgreSQL | Base de datos |
| express-session | Autenticacion |
| bcryptjs | Hashing de contraseñas |
| multer | Subida de archivos (evidencias) |

---

## Estructura del Proyecto

```
├── src/                       # Backend - Servidor Express
│   ├── config/                # Configuracion de base de datos
│   ├── middleware/             # Middleware de autenticacion y roles
│   ├── models/                # Modelos Sequelize (ORM)
│   ├── routes/                # Rutas API (auth, admin, dispatch, messaging)
│   ├── services/              # Servicios (Respond.io, geocoding, chatbot)
│   └── index.js               # Punto de entrada del servidor
├── client/                    # Frontend - React
│   ├── api.js                 # Configuracion Axios
│   ├── App.jsx                # App principal con rutas
│   ├── contexts/              # Proveedores de contexto React
│   ├── layouts/               # Componentes de layout
│   ├── pages/                 # Paginas (Admin, Planner, Login, etc.)
│   └── main.jsx               # Punto de entrada React
├── public/                    # Archivos estaticos (imagenes, iconos)
├── uploads/                   # Evidencias de entrega (fotos)
├── dist/                      # Frontend compilado (generado por build)
├── android/                   # Proyecto Android (Capacitor)
├── ios/                       # Proyecto iOS (Capacitor)
├── capacitor.config.ts        # Configuracion Capacitor
├── ecosystem.config.cjs       # Configuracion PM2 (produccion)
├── .env.example               # Plantilla de variables de entorno
├── package.json               # Dependencias y scripts
├── vite.config.js             # Configuracion de Vite
├── INSTALL.md                 # Guia de instalacion paso a paso
└── DOCUMENTATION.md           # Documentacion tecnica completa
```

---

## Inicio Rapido

### Requisitos
- Node.js 20+
- PostgreSQL 14+
- API Key de Google Maps (Maps JavaScript API + Geocoding API)

### Instalacion

```bash
# Clonar el proyecto
git clone https://tu-repositorio.git area862
cd area862

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
nano .env    # Editar con tus valores

# Compilar el frontend
npm run build

# Crear directorio de uploads
mkdir -p uploads/evidence

# Iniciar el servidor
npm start
```

El servidor arranca en `http://localhost:5000` sirviendo tanto la API como el frontend.

### Primer uso

1. Abre `http://localhost:5000` en tu navegador
2. Registra una cuenta
3. Promueve tu usuario a admin desde la base de datos:
```sql
UPDATE users SET role = 'admin' WHERE email = 'tu-email@ejemplo.com';
```
4. Inicia sesion y configura zonas de cobertura, productos y agentes

---

## Variables de Entorno

| Variable | Obligatoria | Descripcion |
|---|---|---|
| `DATABASE_URL` | Si | URL de conexion PostgreSQL |
| `SESSION_SECRET` | Si (produccion) | Secreto para firmar sesiones |
| `NODE_ENV` | Si | `development` o `production` |
| `PORT` | No | Puerto del servidor (default: 5000) |
| `SERVER_DOMAIN` | Si | Dominio del servidor (sin https://) |
| `VITE_GOOGLE_MAPS_API_KEY` | Si | API Key de Google Maps (frontend) |
| `GOOGLE_MAPS_API_KEY` | Si | API Key de Google Maps (backend geocoding) |
| `VITE_API_URL` | Solo mobile | URL completa del servidor para apps moviles |
| `DATABASE_SSL` | No | `true` para forzar SSL en la BD |

Ver `.env.example` para la plantilla completa con instrucciones.

---

## Scripts

```bash
npm start              # Iniciar servidor en produccion
npm run dev            # Iniciar con hot-reload (desarrollo)
npm run build          # Compilar frontend a dist/
npm run build:mobile   # Compilar + sincronizar con Capacitor
npm run cap:sync       # Sincronizar assets con proyectos moviles
npm run cap:android    # Abrir proyecto Android en Android Studio
npm run cap:ios        # Abrir proyecto iOS en Xcode
```

---

## API Endpoints

### Autenticacion
| Metodo | Ruta | Descripcion |
|---|---|---|
| POST | `/api/auth/register` | Registrar usuario |
| POST | `/api/auth/login` | Iniciar sesion |
| POST | `/api/auth/logout` | Cerrar sesion |
| GET | `/api/auth/me` | Obtener usuario actual |

### Despacho
| Metodo | Ruta | Descripcion |
|---|---|---|
| GET | `/api/dispatch/orders` | Listar ordenes |
| PUT | `/api/dispatch/orders/:id/status` | Cambiar estado de orden |
| GET | `/api/dispatch/routes` | Listar rutas |
| POST | `/api/dispatch/routes` | Crear ruta |
| GET | `/api/dispatch/drivers` | Listar choferes |
| POST | `/api/dispatch/stops/:id/evidence` | Subir evidencia de parada |
| PUT | `/api/dispatch/routes/:id/complete` | Finalizar ruta |
| GET | `/api/dispatch/routes/history` | Historial de rutas |
| GET | `/api/dispatch/routes/:id/detail` | Detalle de ruta con paradas |

### Administracion
| Metodo | Ruta | Descripcion |
|---|---|---|
| GET | `/api/admin/stats` | Estadisticas |
| GET | `/api/admin/users` | Listar usuarios |
| PUT | `/api/admin/users/:id` | Actualizar usuario |

### Rutas
| Metodo | Ruta | Descripcion |
|---|---|---|
| GET | `/api/routes` | Listar rutas del usuario |
| POST | `/api/routes` | Crear ruta |
| GET | `/api/routes/:id` | Obtener ruta |
| POST | `/api/routes/:id/optimize` | Optimizar orden de paradas |

### Mensajeria (Respond.io)
| Metodo | Ruta | Descripcion |
|---|---|---|
| GET | `/api/messaging/settings` | Configuracion de mensajeria |
| PUT | `/api/messaging/settings` | Actualizar configuracion |
| POST | `/api/messaging/settings/test-connection` | Probar conexion API |
| POST | `/api/messaging/validate-zip` | Validar cobertura |
| GET | `/api/messaging/coverage-zones` | Listar zonas de cobertura |
| GET | `/api/messaging/agents` | Listar agentes |
| POST | `/api/messaging/agents` | Crear agente |

### Salud
| Metodo | Ruta | Descripcion |
|---|---|---|
| GET | `/api/health` | Estado del servidor |

---

## Base de Datos

Las tablas se crean automaticamente al iniciar el servidor (Sequelize sync):

| Tabla | Descripcion |
|---|---|
| `users` | Usuarios con roles (admin, client, driver) |
| `routes` | Rutas de entrega con chofer asignado |
| `stops` | Paradas con evidencia fotografica |
| `validated_addresses` | Ordenes de despacho con estado y monto |
| `messaging_settings` | Configuracion del chatbot |
| `messaging_orders` | Ordenes recibidas por mensajeria |
| `conversation_states` | Estado de conversaciones del bot |
| `coverage_zones` | Zonas de cobertura (ZIP codes) |
| `service_agents` | Agentes asignables por producto |
| `message_logs` | Historial de mensajes |
| `route_histories` | Historial de rutas |

---

## Compilacion Mobile

### Android
1. Configura `VITE_API_URL` en `.env` con la URL del servidor
2. `npm run build`
3. `npx cap sync android`
4. Abre Android Studio: `npx cap open android`
5. Build > Build APK

### iOS (Solo Mac)
1. Configura `VITE_API_URL` en `.env` con la URL del servidor
2. `npm run build`
3. `npx cap sync ios`
4. `cd ios/App && pod install && cd ../..`
5. Abre Xcode: `npx cap open ios`

### Permisos Nativos Configurados
- **Ubicacion**: GPS para navegacion en tiempo real
- **Camara**: Captura nativa de fotos de evidencia de entrega
- **Galeria**: Acceso a fotos almacenadas
- **Vibracion**: Feedback haptico

---

## Despliegue en Produccion

Ver [INSTALL.md](INSTALL.md) para la guia completa paso a paso que incluye:

1. Preparacion del servidor Ubuntu
2. Instalacion de Node.js, PostgreSQL, Nginx
3. Configuracion de variables de entorno
4. Despliegue con PM2
5. HTTPS con Let's Encrypt
6. Firewall
7. Compilacion de apps moviles Android/iOS

---

## Documentacion Tecnica

Ver [DOCUMENTATION.md](DOCUMENTATION.md) para la documentacion detallada que incluye:

- Arquitectura del sistema
- Estructura de codigo detallada
- Modelos de datos completos
- Servicios y su funcionamiento
- Flujo del chatbot
- Referencia completa de API endpoints
