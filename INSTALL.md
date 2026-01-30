# Guia de Instalacion - HormiRuta en AWS Ubuntu

Esta guia explica como instalar HormiRuta en un servidor AWS con Ubuntu Server.

## Requisitos del Servidor

- Ubuntu Server 22.04 LTS o superior
- Minimo 1GB RAM (recomendado 2GB)
- Node.js 20.x LTS
- PostgreSQL 14+ (puede ser RDS de AWS o local)
- Puerto 5000 abierto (o el que configures)

---

## Paso 1: Preparar el Servidor Ubuntu

```bash
# Actualizar el sistema
sudo apt update && sudo apt upgrade -y

# Instalar dependencias del sistema
sudo apt install -y curl git build-essential
```

---

## Paso 2: Instalar Node.js 20.x

```bash
# Instalar Node.js 20.x usando NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verificar instalacion
node --version   # Debe mostrar v20.x.x
npm --version    # Debe mostrar 10.x.x
```

---

## Paso 3: Instalar PostgreSQL (Opcional - si no usas RDS)

Si vas a usar una base de datos local en lugar de AWS RDS:

```bash
# Instalar PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Iniciar y habilitar PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Crear usuario y base de datos
sudo -u postgres psql -c "CREATE USER hormiruta WITH PASSWORD 'tu_password_seguro';"
sudo -u postgres psql -c "CREATE DATABASE hormiruta OWNER hormiruta;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE hormiruta TO hormiruta;"
```

---

## Paso 4: Clonar el Repositorio

```bash
# Crear directorio para la aplicacion
sudo mkdir -p /var/www
cd /var/www

# Clonar el repositorio (reemplaza con tu URL de Git)
sudo git clone https://tu-repositorio.git hormiruta
cd hormiruta

# Dar permisos al usuario actual
sudo chown -R $USER:$USER /var/www/hormiruta
```

---

## Paso 5: Configurar Variables de Entorno

```bash
# Crear archivo de variables de entorno
nano .env
```

Contenido del archivo `.env`:

```bash
# Base de datos PostgreSQL
# Para RDS de AWS:
DATABASE_URL=postgresql://usuario:password@tu-rds-endpoint.amazonaws.com:5432/hormiruta

# Para PostgreSQL local:
# DATABASE_URL=postgresql://hormiruta:tu_password_seguro@localhost:5432/hormiruta

# Seguridad (genera un secreto aleatorio de 32+ caracteres)
SESSION_SECRET=tu-secreto-muy-seguro-de-minimo-32-caracteres-aleatorios

# Entorno
NODE_ENV=production
PORT=5000

# Dominio del servidor (sin https://)
SERVER_DOMAIN=tu-dominio.com

# Google Maps API Key
VITE_GOOGLE_MAPS_API_KEY=tu-api-key-de-google-maps

# URL del API para apps moviles
VITE_API_URL=https://tu-dominio.com
```

Guardar con `Ctrl+O`, `Enter`, `Ctrl+X`.

---

## Paso 6: Instalar Dependencias

```bash
# Instalar todas las dependencias
npm install

# Esto instala automaticamente:
# - Backend: express, sequelize, pg, bcryptjs, cors, express-session
# - Frontend: react, react-dom, react-router-dom, axios, vite
# - Movil: capacitor y plugins
```

---

## Paso 7: Compilar el Frontend

```bash
# Compilar React para produccion
npm run build
```

Esto genera la carpeta `dist/` con el frontend optimizado.

---

## Paso 8: Iniciar la Aplicacion

### Opcion A: Ejecucion directa (para pruebas)

```bash
npm start
```

### Opcion B: Usar PM2 (recomendado para produccion)

```bash
# Instalar PM2 globalmente
sudo npm install -g pm2

# Iniciar la aplicacion con PM2
pm2 start src/index.js --name hormiruta

# Configurar PM2 para iniciar con el sistema
pm2 startup systemd
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp /home/$USER
pm2 save

# Comandos utiles de PM2
pm2 status          # Ver estado
pm2 logs hormiruta  # Ver logs
pm2 restart hormiruta # Reiniciar
pm2 stop hormiruta  # Detener
```

---

## Paso 9: Configurar Nginx como Proxy Inverso (Recomendado)

```bash
# Instalar Nginx
sudo apt install -y nginx

# Crear configuracion del sitio
sudo nano /etc/nginx/sites-available/hormiruta
```

Contenido:

```nginx
server {
    listen 80;
    server_name tu-dominio.com www.tu-dominio.com;

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
    }
}
```

```bash
# Activar el sitio
sudo ln -s /etc/nginx/sites-available/hormiruta /etc/nginx/sites-enabled/

# Verificar configuracion
sudo nginx -t

# Reiniciar Nginx
sudo systemctl restart nginx
```

---

## Paso 10: Configurar SSL con Let's Encrypt (HTTPS)

```bash
# Instalar Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtener certificado SSL
sudo certbot --nginx -d tu-dominio.com -d www.tu-dominio.com

# Certbot configurara automaticamente Nginx para HTTPS
# Los certificados se renuevan automaticamente
```

---

## Paso 11: Configurar Firewall

```bash
# Permitir SSH, HTTP y HTTPS
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

---

## Verificacion Final

1. **Verificar que el servidor esta corriendo:**
   ```bash
   pm2 status
   curl http://localhost:5000/api/health
   ```

2. **Verificar acceso externo:**
   Abre en tu navegador: `https://tu-dominio.com`

3. **Verificar logs si hay errores:**
   ```bash
   pm2 logs hormiruta --lines 100
   ```

---

## Estructura de la Base de Datos

Las tablas se crean automaticamente al iniciar el servidor:

- `users` - Usuarios del sistema
- `routes` - Rutas de entrega
- `stops` - Paradas de cada ruta
- `route_histories` - Historial de rutas
- `messaging_orders` - Ordenes de mensajeria
- `coverage_zones` - Zonas de cobertura (ZIPs)
- `message_logs` - Logs de mensajes
- `messaging_settings` - Configuracion de mensajeria
- `conversation_states` - Estados de conversacion

---

## Crear Usuario Administrador

Despues de iniciar el servidor, registra un usuario normalmente y luego:

```bash
# Conectar a la base de datos
psql $DATABASE_URL

# Cambiar rol a admin
UPDATE users SET role = 'admin' WHERE email = 'tu-email@ejemplo.com';

# Salir
\q
```

---

## Actualizaciones

Para actualizar la aplicacion:

```bash
cd /var/www/hormiruta

# Obtener cambios
git pull

# Instalar nuevas dependencias
npm install

# Recompilar frontend
npm run build

# Reiniciar servidor
pm2 restart hormiruta
```

---

## Solucion de Problemas

### Error: "Cannot connect to database"
- Verifica que DATABASE_URL sea correcta
- Verifica que PostgreSQL este corriendo
- Verifica permisos del usuario de BD

### Error: "Session secret required"
- Asegurate de tener SESSION_SECRET en .env
- Asegurate de tener NODE_ENV=production

### El frontend no carga
- Verifica que ejecutaste `npm run build`
- Verifica que la carpeta `dist/` existe

### Error de CORS
- Verifica que SERVER_DOMAIN este configurado correctamente
- No incluyas el protocolo (https://) en SERVER_DOMAIN

---

## Contacto

Para soporte tecnico, contactar al equipo de desarrollo.
