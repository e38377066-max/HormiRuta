# Guia de Instalacion - Area 862 System

Guia paso a paso para instalar Area 862 System en una PC con Ubuntu. Solo copia y pega cada comando.

---

## PARTE 1: SERVIDOR DE PRODUCCION

---

### Requisitos

- PC o servidor con Ubuntu 22.04 LTS o superior
- Minimo 1GB RAM (recomendado 2GB)
- 10GB de disco minimo
- Conexion a internet
- Si vas a usar dominio: puertos 80, 443 y 22 abiertos

---

### Paso 1: Actualizar el Sistema

Abre la terminal y ejecuta:

```bash
sudo apt update && sudo apt upgrade -y
```

Instalar las herramientas necesarias:

```bash
sudo apt install -y curl git build-essential
```

---

### Paso 2: Instalar Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

Verificar que se instalo correctamente:

```bash
node --version
npm --version
```

Instalar PM2 (mantiene la app corriendo aunque cierres la terminal):

```bash
sudo npm install -g pm2
```

---

### Paso 3: Instalar PostgreSQL

```bash
sudo apt install -y postgresql postgresql-contrib
```

Iniciar PostgreSQL y que arranque automaticamente con el sistema:

```bash
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

Crear la base de datos y el usuario. **IMPORTANTE: cambia `Area862Pass2024!` por tu propia contraseña segura** y anotala porque la necesitaras despues:

```bash
sudo -u postgres psql -c "CREATE USER area862 WITH PASSWORD 'Area862Pass2024!';"
sudo -u postgres psql -c "CREATE DATABASE area862 OWNER area862;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE area862 TO area862;"
```

Verificar que funciona la conexion:

```bash
PGPASSWORD='Area862Pass2024!' psql -U area862 -d area862 -h localhost -c "SELECT 'Conexion exitosa' AS resultado;"
```

Si ves `Conexion exitosa`, la base de datos esta lista.

---

### Paso 4: Descargar el Proyecto

```bash
sudo mkdir -p /var/www
cd /var/www
sudo git clone https://gitlab.com/AdminArea862/area-routes.git area862
cd area862
sudo chown -R $USER:$USER /var/www/area862

# IMPORTANTE: El dominio oficial del proyecto es area862system.com
```

---

### Paso 5: Configurar Variables de Entorno

Crear el archivo de configuracion a partir de la plantilla:

```bash
cp .env.example .env
```

Generar un secreto de sesion aleatorio (copia el resultado que aparece):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Ahora editar el archivo .env con todos los valores:

```bash
nano .env
```

Dentro del archivo, configura estos valores (los que dicen CAMBIAR debes reemplazarlos con tus datos reales):

```
DATABASE_URL=postgresql://area862:Area862Pass2024!@localhost:5432/area862
SESSION_SECRET=PEGA_AQUI_EL_SECRETO_QUE_GENERASTE_ARRIBA
NODE_ENV=production
PORT=5000
SERVER_DOMAIN=area862system.com
VITE_GOOGLE_MAPS_API_KEY=CAMBIAR_POR_TU_API_KEY_DE_GOOGLE_MAPS
GOOGLE_MAPS_API_KEY=CAMBIAR_POR_TU_API_KEY_DE_GOOGLE_MAPS
VITE_API_URL=https://area862system.com
```

Para guardar en nano: presiona `Ctrl+O`, luego `Enter`, luego `Ctrl+X`.

> **Nota sobre Google Maps**: Necesitas una API Key de Google Cloud. Ve a https://console.cloud.google.com/apis/credentials y crea una. Habilita estas dos APIs: **Maps JavaScript API** y **Geocoding API**. Puedes usar la misma key para VITE_GOOGLE_MAPS_API_KEY y GOOGLE_MAPS_API_KEY.

> **Si no tienes dominio**: pon la IP de tu PC en SERVER_DOMAIN (ejemplo: `192.168.1.100`) y en VITE_API_URL pon `http://TU_IP:5000`.

---

### Paso 6: Instalar Dependencias y Compilar

```bash
cd /var/www/area862
npm install
```

Compilar el frontend:

```bash
npm run build
```

Crear las carpetas necesarias:

```bash
sudo mkdir -p /var/log/area862
sudo chown $USER:$USER /var/log/area862
mkdir -p uploads/evidence
```

---

### Paso 7: Probar que Funciona

Primero prueba que arranca correctamente:

```bash
node src/index.js
```

Debes ver algo como:

```
===========================================
Area 862 System - Iniciando servidor...
===========================================
Database connection established successfully.
Database tables synchronized.
Area 862 System API running on port 5000
```

Si lo ves, funciona. Detén el servidor con `Ctrl+C`.

Si da error de base de datos, revisa que el password en DATABASE_URL sea el mismo que usaste al crear el usuario PostgreSQL.

---

### Paso 8: Iniciar con PM2

PM2 mantiene la app corriendo en segundo plano y la reinicia si se cae:

```bash
cd /var/www/area862
pm2 start ecosystem.config.cjs
```

Verificar que esta corriendo:

```bash
pm2 status
```

Debe mostrar `area862` con status `online`.

Probar que responde:

```bash
curl http://localhost:5000/api/health
```

Debe responder: `{"status":"ok","message":"Area 862 System API funcionando (Node.js)"}`

Configurar que arranque automaticamente cuando se reinicie la PC:

```bash
pm2 startup systemd
```

PM2 te va a mostrar un comando que empieza con `sudo`. Copia ese comando completo y ejecutalo. Despues:

```bash
pm2 save
```

---

### Paso 9: Configurar Nginx (para acceder desde otros dispositivos)

Si quieres acceder desde otros dispositivos en la red o desde internet, necesitas Nginx:

```bash
sudo apt install -y nginx
```

Crear la configuracion. **Cambia `tu-dominio.com` por tu dominio real, o borralo si solo usas IP**:

```bash
sudo tee /etc/nginx/sites-available/area862 > /dev/null << 'NGINX'
server {
    listen 80;
    server_name _;

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
NGINX
```

Activar el sitio:

```bash
sudo ln -sf /etc/nginx/sites-available/area862 /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx
```

Ahora puedes acceder desde cualquier dispositivo en la misma red usando la IP de tu PC: `http://TU_IP`

---

### Paso 10: HTTPS con Dominio (Opcional - solo si tienes dominio)

Si tienes un dominio apuntando a tu IP publica:

Primero edita la config de Nginx para poner tu dominio:

```bash
sudo sed -i 's/server_name _;/server_name area862system.com www.area862system.com;/' /etc/nginx/sites-available/area862
sudo nginx -t
sudo systemctl restart nginx
```

Instalar certificado SSL:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d area862system.com -d www.area862system.com
```

Sigue las instrucciones (te pide un email). Selecciona la opcion de redirigir HTTP a HTTPS.

Verificar que la renovacion automatica funciona:

```bash
sudo certbot renew --dry-run
```

---

### Paso 11: Firewall (Recomendado)

```bash
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw --force enable
```

---

### Paso 12: Crear el Primer Usuario Administrador

1. Abre tu navegador y ve a `http://TU_IP` (o `https://tu-dominio.com` si configuraste HTTPS)
2. Haz click en "Registrarse"
3. Crea tu cuenta con tu email y contraseña
4. Regresa a la terminal y promueve tu usuario a administrador:

```bash
sudo -u postgres psql area862 -c "UPDATE users SET role = 'admin' WHERE email = 'TU_EMAIL_AQUI';"
```

Cambia `TU_EMAIL_AQUI` por el email con el que te registraste. Despues cierra sesion y vuelve a entrar para ver el panel de administracion.

---

### Verificacion Final

Ejecuta estos comandos para verificar que todo esta funcionando:

```bash
echo "=== Estado de la App ==="
pm2 status

echo "=== Estado de PostgreSQL ==="
sudo systemctl status postgresql --no-pager -l

echo "=== Estado de Nginx ==="
sudo systemctl status nginx --no-pager -l

echo "=== Prueba de API ==="
curl -s http://localhost:5000/api/health

echo ""
echo "=== Todo listo ==="
```

---

## COMANDOS DEL DIA A DIA

### Ver logs de la app

```bash
pm2 logs area862
```

Ver ultimas 100 lineas:

```bash
pm2 logs area862 --lines 100
```

### Reiniciar la app

```bash
pm2 restart area862
```

### Detener la app

```bash
pm2 stop area862
```

### Ver uso de memoria y CPU

```bash
pm2 monit
```

### Actualizar cuando haya cambios nuevos

```bash
cd /var/www/area862
git pull origin main
npm install
npm run build
pm2 restart area862
```

### Reiniciar todo (PostgreSQL + Nginx + App)

```bash
sudo systemctl restart postgresql
sudo systemctl restart nginx
pm2 restart area862
```

### Ver logs de Nginx (errores de conexion)

```bash
sudo tail -f /var/log/nginx/error.log
```

### Backup de la base de datos

```bash
PGPASSWORD='Area862Pass2024!' pg_dump -U area862 -h localhost area862 > /var/www/area862/backup_$(date +%Y%m%d).sql
```

### Restaurar un backup

```bash
PGPASSWORD='Area862Pass2024!' psql -U area862 -h localhost area862 < backup_FECHA.sql
```

---

## PARTE 2: COMPILAR APP ANDROID

Esto se hace en tu computadora personal, no en el servidor.

### Requisitos

- Node.js 20 instalado en tu computadora
- Android Studio instalado (descargar de https://developer.android.com/studio)
- Java JDK 17 (viene incluido con Android Studio)

### Pasos

```bash
git clone https://gitlab.com/AdminArea862/area-routes.git area862
cd area862
npm install
```

Crear archivo .env con la URL del servidor:

```bash
echo "VITE_API_URL=https://area862system.com" > .env
```

Compilar y sincronizar:

```bash
npm run build
npx cap sync android
```

Abrir en Android Studio:

```bash
npx cap open android
```

En Android Studio:
1. Espera a que Gradle sincronice (puede tardar unos minutos la primera vez)
2. Menu: **Build > Build Bundle(s) / APK(s) > Build APK(s)**
3. El APK se genera en: `android/app/build/outputs/apk/debug/app-debug.apk`

Para APK firmado (tienda):
1. Menu: **Build > Generate Signed Bundle / APK**
2. Selecciona **APK**
3. Crea un Keystore nuevo (guardalo seguro)
4. Selecciona **release**
5. El APK firmado queda en: `android/app/build/outputs/apk/release/`

### Instalar en telefono

**Por cable USB:**
1. Activa "Opciones de desarrollador" en el telefono (toca 7 veces "Numero de compilacion" en Ajustes > Acerca del telefono)
2. Activa "Depuracion USB"
3. Conecta el telefono al computador
4. En Android Studio click en Run (triangulo verde)

**Enviar el APK:**
1. Busca el archivo APK generado
2. Envialo por WhatsApp, email, Google Drive, etc.
3. Abre el APK en el telefono e instala
4. Si pide permiso de "fuentes desconocidas", activalo

---

## PARTE 3: COMPILAR APP iOS (Solo en Mac)

### Requisitos

- Mac con macOS 13 o superior
- Xcode 15+ (descargar del App Store)
- CocoaPods instalado
- Cuenta de Apple Developer ($99/año para publicar en App Store)

### Pasos

```bash
sudo gem install cocoapods
git clone https://gitlab.com/AdminArea862/area-routes.git area862
cd area862
npm install
echo "VITE_API_URL=https://area862system.com" > .env
npm run build
npx cap sync ios
cd ios/App && pod install && cd ../..
npx cap open ios
```

En Xcode:
1. Selecciona el proyecto "App" en el panel izquierdo
2. En "Signing & Capabilities" selecciona tu Team (cuenta Apple Developer)
3. Selecciona tu dispositivo o simulador
4. Click en Run (triangulo)

Para publicar en App Store:
1. Menu: **Product > Archive**
2. En el Organizer click en **Distribute App**
3. Sigue los pasos para subir a App Store Connect

---

## PARTE 4: CAMBIAR SERVIDOR O DOMINIO

Si cambias de servidor o dominio, necesitas recompilar las apps moviles:

```bash
cd area862
nano .env
# Cambiar VITE_API_URL=https://area862system.com
npm run build
npx cap sync android
npx cap sync ios
```

Luego genera un nuevo APK/IPA desde Android Studio o Xcode.

---

## BASE DE DATOS

Las tablas se crean automaticamente al iniciar el servidor por primera vez. No necesitas crear nada manualmente:

| Tabla | Que guarda |
|---|---|
| users | Usuarios del sistema (admin, chofer, cliente) |
| routes | Rutas de entrega con chofer asignado |
| stops | Paradas de cada ruta con foto de evidencia |
| validated_addresses | Ordenes de despacho con estado y monto |
| messaging_settings | Configuracion del chatbot |
| messaging_orders | Ordenes recibidas por mensajeria |
| conversation_states | Estado de conversaciones del bot |
| coverage_zones | Zonas de cobertura (codigos ZIP) |
| service_agents | Agentes asignables por producto |
| message_logs | Historial de mensajes |
| route_histories | Historial de rutas |

---

## SOLUCION DE PROBLEMAS

### El servidor no arranca

```bash
pm2 logs area862 --lines 50
```

Busca el error en los logs. Los mas comunes:

### "ERROR: DATABASE_URL no esta configurada"
- Verifica que el archivo `.env` existe en `/var/www/area862/`
- Verifica que DATABASE_URL tiene la URL correcta

### "Cannot connect to database" o "ECONNREFUSED"
- Verifica que PostgreSQL esta corriendo:
```bash
sudo systemctl status postgresql
```
- Si no esta corriendo:
```bash
sudo systemctl start postgresql
```
- Verifica que el password es correcto probando la conexion:
```bash
PGPASSWORD='Area862Pass2024!' psql -U area862 -d area862 -h localhost -c "SELECT 1;"
```

### "SESSION_SECRET is required in production"
- Verifica que SESSION_SECRET esta en el archivo .env
- Genera uno nuevo si es necesario:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### La pagina web no carga
- Verifica que ejecutaste `npm run build`
- Verifica que la carpeta `dist/` existe:
```bash
ls /var/www/area862/dist/
```
- Si no existe, compilar de nuevo:
```bash
cd /var/www/area862 && npm run build
```

### La app movil no conecta al servidor
- Verifica que VITE_API_URL en .env tiene `https://` al inicio
- Verifica que el servidor tiene HTTPS (certificado SSL)
- Prueba la URL en el navegador del telefono primero

### Google Maps no aparece
- Verifica que la API key es correcta
- En Google Cloud Console habilita: **Maps JavaScript API** y **Geocoding API**
- Si usas restriccion de key, agrega tu dominio

### El chatbot no responde
- El token de Respond.io se configura desde la interfaz web (Panel Admin > Mensajeria > Configuracion)
- Verifica que el polling esta activado en la misma pantalla
- Revisa logs:
```bash
pm2 logs area862 | grep -i bot
```

### Quiero empezar la base de datos desde cero

```bash
sudo -u postgres psql -c "DROP DATABASE area862;"
sudo -u postgres psql -c "CREATE DATABASE area862 OWNER area862;"
pm2 restart area862
```

Las tablas se recrean automaticamente al reiniciar.
