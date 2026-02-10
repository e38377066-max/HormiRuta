# Guia de Instalacion - Area 862 System

Guia completa para instalar Area 862 System en un servidor Ubuntu (VPS) y compilar las apps moviles Android/iOS.

---

## PARTE 1: SERVIDOR DE PRODUCCION (Ubuntu)

---

### Requisitos del Servidor

- Ubuntu Server 22.04 LTS o superior
- Minimo 1GB RAM (recomendado 2GB)
- 10GB de disco minimo
- IP publica o dominio
- Puertos 80, 443 y 22 abiertos

---

### Paso 1: Preparar el Servidor

```bash
# Conectar al servidor por SSH
ssh tu-usuario@tu-ip-del-servidor

# Actualizar el sistema
sudo apt update && sudo apt upgrade -y

# Instalar dependencias del sistema
sudo apt install -y curl git build-essential nginx certbot python3-certbot-nginx
```

---

### Paso 2: Instalar Node.js 20

```bash
# Instalar Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verificar
node --version   # v20.x.x
npm --version    # 10.x.x

# Instalar PM2 (administrador de procesos)
sudo npm install -g pm2
```

---

### Paso 3: Instalar PostgreSQL

```bash
# Instalar PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Iniciar y habilitar
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Crear usuario y base de datos
sudo -u postgres psql <<EOF
CREATE USER area862 WITH PASSWORD 'tu_password_seguro_aqui';
CREATE DATABASE area862 OWNER area862;
GRANT ALL PRIVILEGES ON DATABASE area862 TO area862;
\q
EOF
```

> Cambia `tu_password_seguro_aqui` por una contraseña segura. La usaras en el archivo .env.

---

### Paso 4: Clonar el Proyecto

```bash
# Crear directorio
sudo mkdir -p /var/www
cd /var/www

# Clonar repositorio (reemplaza con tu URL de Git)
sudo git clone https://tu-repositorio.git area862
cd area862

# Dar permisos
sudo chown -R $USER:$USER /var/www/area862
```

---

### Paso 5: Configurar Variables de Entorno

```bash
# Copiar plantilla
cp .env.example .env

# Editar
nano .env
```

Configura estos valores:

```bash
# Base de datos local
DATABASE_URL=postgresql://area862:tu_password_seguro_aqui@localhost:5432/area862

# Genera el secreto con este comando y pega el resultado:
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
SESSION_SECRET=pega_aqui_el_secreto_generado

# Entorno
NODE_ENV=production
PORT=5000

# Tu dominio (sin https://)
SERVER_DOMAIN=tu-dominio.com

# Google Maps - misma key para ambos
VITE_GOOGLE_MAPS_API_KEY=AIzaSy...tu-key
GOOGLE_MAPS_API_KEY=AIzaSy...tu-key

# URL para apps moviles
VITE_API_URL=https://tu-dominio.com
```

Guardar: `Ctrl+O`, `Enter`, `Ctrl+X`

---

### Paso 6: Instalar Dependencias y Compilar

```bash
# Instalar dependencias
npm install

# Compilar el frontend
npm run build

# Crear directorio de logs
sudo mkdir -p /var/log/area862
sudo chown $USER:$USER /var/log/area862
```

---

### Paso 7: Iniciar con PM2

```bash
# Iniciar la aplicacion
pm2 start ecosystem.config.cjs

# Verificar que esta corriendo
pm2 status

# Ver los logs
pm2 logs area862

# Probar que responde
curl http://localhost:5000/api/health
# Debe responder: {"status":"ok","message":"Area 862 System API funcionando (Node.js)"}

# Configurar inicio automatico con el sistema
pm2 startup systemd
# PM2 te mostrara un comando sudo - copialo y ejecutalo
pm2 save
```

---

### Paso 8: Configurar Nginx (Proxy + HTTPS)

```bash
# Crear configuracion
sudo nano /etc/nginx/sites-available/area862
```

Pega este contenido (cambia `tu-dominio.com` por tu dominio real):

```nginx
server {
    listen 80;
    server_name tu-dominio.com www.tu-dominio.com;

    client_max_body_size 10M;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}
```

```bash
# Activar el sitio
sudo ln -s /etc/nginx/sites-available/area862 /etc/nginx/sites-enabled/

# Eliminar sitio por defecto
sudo rm -f /etc/nginx/sites-enabled/default

# Verificar configuracion
sudo nginx -t

# Reiniciar Nginx
sudo systemctl restart nginx
```

---

### Paso 9: Activar HTTPS con Let's Encrypt

> Tu dominio debe apuntar a la IP del servidor antes de este paso.

```bash
# Obtener certificado SSL
sudo certbot --nginx -d tu-dominio.com -d www.tu-dominio.com

# Seguir las instrucciones (pide un email)
# Seleccionar opcion 2: Redirect HTTP to HTTPS

# Los certificados se renuevan automaticamente
# Para verificar la renovacion:
sudo certbot renew --dry-run
```

---

### Paso 10: Firewall

```bash
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

---

### Paso 11: Crear Usuario Administrador

1. Abre tu navegador en `https://tu-dominio.com`
2. Registrate con tu email y contraseña
3. Luego en el servidor, promueve tu usuario a admin:

```bash
sudo -u postgres psql area862 -c "UPDATE users SET role = 'admin' WHERE email = 'tu-email@ejemplo.com';"
```

---

### Verificacion Final del Servidor

```bash
# Estado de la app
pm2 status

# Logs en tiempo real
pm2 logs area862

# Estado de Nginx
sudo systemctl status nginx

# Estado de PostgreSQL
sudo systemctl status postgresql

# Probar desde fuera
# En tu navegador: https://tu-dominio.com
# Debe cargar la pagina de login de Area 862
```

---

### Comandos Utiles

```bash
# Reiniciar la app
pm2 restart area862

# Ver logs
pm2 logs area862 --lines 100

# Detener
pm2 stop area862

# Ver uso de memoria/CPU
pm2 monit

# Reiniciar Nginx
sudo systemctl restart nginx

# Ver logs de Nginx
sudo tail -f /var/log/nginx/error.log
```

---

### Actualizar la App

Cuando haya cambios nuevos:

```bash
cd /var/www/area862
git pull
npm install
npm run build
pm2 restart area862
```

---

## PARTE 2: COMPILAR APP ANDROID

---

### Requisitos (en tu computadora local, no en el servidor)

- Node.js 20 instalado
- Android Studio instalado (descargar de https://developer.android.com/studio)
- Java JDK 17 (viene con Android Studio)
- El codigo fuente del proyecto

---

### Paso 1: Preparar el Proyecto

```bash
# Clonar el proyecto en tu computadora
git clone https://tu-repositorio.git area862
cd area862

# Instalar dependencias
npm install
```

---

### Paso 2: Configurar la URL del Servidor

Edita el archivo `.env` en tu computadora local:

```bash
# URL de tu servidor de produccion
VITE_API_URL=https://tu-dominio.com
```

> Esta es la URL de tu servidor Ubuntu. La app movil se conectara a esta direccion.

---

### Paso 3: Compilar y Sincronizar

```bash
# Compilar el frontend apuntando al servidor
npm run build

# Sincronizar con Android
npx cap sync android
```

---

### Paso 4: Abrir en Android Studio

```bash
# Abrir el proyecto Android
npx cap open android
```

Esto abre Android Studio con el proyecto.

---

### Paso 5: Compilar el APK

En Android Studio:

1. Espera a que termine de sincronizar Gradle (puede tardar unos minutos la primera vez)
2. Menu: **Build > Build Bundle(s) / APK(s) > Build APK(s)**
3. El APK se genera en: `android/app/build/outputs/apk/debug/app-debug.apk`

Para APK de produccion (firmado):

1. Menu: **Build > Generate Signed Bundle / APK**
2. Selecciona **APK**
3. Crea o selecciona un Keystore (guardalo seguro, lo necesitaras para updates)
4. Selecciona **release**
5. El APK firmado se genera en: `android/app/build/outputs/apk/release/`

---

### Paso 6: Instalar en un Telefono

**Opcion A - Por cable USB:**
1. Activa "Opciones de desarrollador" en tu telefono Android
2. Activa "Depuracion USB"
3. Conecta el telefono al computador
4. En Android Studio haz click en "Run" (triangulo verde)

**Opcion B - Enviar el APK:**
1. Busca el archivo APK generado
2. Envialo por email, WhatsApp, Google Drive, etc.
3. En el telefono, abre el APK e instala
4. Si pide permiso de "fuentes desconocidas", activalo

---

## PARTE 3: COMPILAR APP iOS (Solo Mac)

---

### Requisitos

- Mac con macOS 13 o superior
- Xcode 15+ (descargar del App Store)
- Cuenta de Apple Developer ($99/año - solo para publicar en App Store)
- CocoaPods: `sudo gem install cocoapods`

---

### Paso 1: Preparar (igual que Android)

```bash
cd area862
npm install

# Configurar .env con la URL del servidor
# VITE_API_URL=https://tu-dominio.com

# Compilar
npm run build

# Sincronizar con iOS
npx cap sync ios
```

---

### Paso 2: Instalar Dependencias iOS

```bash
cd ios/App
pod install
cd ../..
```

---

### Paso 3: Abrir en Xcode

```bash
npx cap open ios
```

---

### Paso 4: Configurar en Xcode

1. Selecciona el proyecto "App" en el panel izquierdo
2. En "Signing & Capabilities":
   - Selecciona tu Team (tu cuenta de Apple Developer)
   - Cambia el Bundle Identifier si es necesario
3. Selecciona tu dispositivo o simulador
4. Click en "Run" (triangulo)

---

### Paso 5: Compilar para App Store

1. Menu: **Product > Archive**
2. Espera a que termine
3. En el Organizer, click en **Distribute App**
4. Sigue los pasos para subir a App Store Connect

---

## PARTE 4: CAMBIAR LA URL DEL SERVIDOR EN LAS APPS

Si cambias de servidor o dominio, necesitas recompilar las apps:

### Opcion A: Recompilar (recomendado)

```bash
# 1. Editar .env con la nueva URL
nano .env
# Cambiar: VITE_API_URL=https://nuevo-dominio.com

# 2. Recompilar
npm run build

# 3. Sincronizar
npx cap sync android   # Para Android
npx cap sync ios       # Para iOS

# 4. Generar nuevo APK/IPA en Android Studio o Xcode
```

### Opcion B: Editar capacitor.config.ts

Si quieres que la app cargue directamente desde el servidor (sin archivos locales):

```typescript
// En capacitor.config.ts, agregar la URL del servidor:
server: {
  url: 'https://tu-dominio.com',
  cleartext: true
}
```

Luego recompilar con `npx cap sync`.

> Con esta opcion la app siempre carga desde el servidor, asi que no necesitas recompilar para cambios del frontend. Pero requiere internet para funcionar.

---

## ESTRUCTURA DE LA BASE DE DATOS

Las tablas se crean automaticamente al iniciar el servidor:

| Tabla | Descripcion |
|---|---|
| users | Usuarios del sistema |
| routes | Rutas de entrega |
| stops | Paradas de cada ruta |
| route_histories | Historial de rutas |
| messaging_settings | Configuracion de mensajeria/chatbot |
| messaging_orders | Ordenes recibidas por mensajeria |
| message_logs | Historial de mensajes |
| conversation_states | Estado de cada conversacion del bot |
| coverage_zones | Zonas de cobertura (ZIP codes) |
| service_agents | Agentes asignables por producto |

---

## SOLUCION DE PROBLEMAS

### El servidor no inicia
```bash
pm2 logs area862 --lines 50
# Busca el error en los logs
```

### "Cannot connect to database"
- Verifica que PostgreSQL esta corriendo: `sudo systemctl status postgresql`
- Verifica el DATABASE_URL en .env
- Verifica el password del usuario de BD

### "Session secret required"
- Asegurate de tener SESSION_SECRET en .env

### El frontend no carga
- Verifica que ejecutaste `npm run build`
- Verifica que la carpeta `dist/` existe y tiene archivos

### La app movil no conecta al servidor
- Verifica que VITE_API_URL tiene `https://` al inicio
- Verifica que el servidor tiene HTTPS activo (certificado SSL)
- Verifica que el dominio esta bien escrito
- Prueba la URL en el navegador del telefono primero

### Error de CORS en la app movil
- Verifica que SERVER_DOMAIN en .env es correcto
- El servidor ya acepta peticiones de `capacitor://localhost`

### Google Maps no funciona
- Verifica que la API key es correcta
- En Google Cloud Console, habilita: Maps JavaScript API + Geocoding API
- Si usas restriccion de key, agrega tu dominio y la IP del servidor

### El chatbot no responde
- Verifica que el token de Respond.io esta configurado en la interfaz web
- Verifica que el polling esta activado
- Revisa logs: `pm2 logs area862 | grep Bot`
