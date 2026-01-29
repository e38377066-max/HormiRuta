# HormiRuta - Compilacion Android

## Requisitos Previos

1. **Android Studio** (Arctic Fox o superior)
   - Descargar: https://developer.android.com/studio

2. **JDK 17** (incluido con Android Studio)

3. **Android SDK** (API Level 34 recomendado)
   - En Android Studio: Tools > SDK Manager
   - Instalar: Android 14 (API 34)

## Pasos para Compilar

### 1. Preparar el Proyecto

Desde la carpeta `frontend-react`:

```bash
# Instalar dependencias
npm install

# Compilar la app web
npm run build

# Sincronizar con Android
npx cap sync android
```

### 2. Configurar Google Maps API Key

**IMPORTANTE**: Antes de compilar, debes agregar tu API Key de Google Maps.

1. Obtener API Key en: https://console.cloud.google.com/apis/credentials
2. Habilitar "Maps SDK for Android" en tu proyecto de Google Cloud
3. Editar `android/app/src/main/res/values/strings.xml`:

```xml
<string name="google_maps_api_key">TU_API_KEY_AQUI</string>
```

### 3. Abrir en Android Studio

```bash
npx cap open android
```

O manualmente:
1. Abrir Android Studio
2. File > Open
3. Seleccionar la carpeta `frontend-react/android`

### 4. Configurar Firma (para Release)

Para publicar en Play Store, necesitas un keystore:

1. Build > Generate Signed Bundle / APK
2. Crear nuevo keystore o usar existente
3. Completar los datos del certificado

### 5. Compilar APK Debug

1. En Android Studio: Build > Build Bundle(s) / APK(s) > Build APK(s)
2. El APK se genera en: `android/app/build/outputs/apk/debug/`

### 6. Compilar Release (Play Store)

1. Build > Generate Signed Bundle / APK
2. Seleccionar "Android App Bundle" para Play Store
3. Seleccionar tu keystore
4. Elegir "release" como build variant

## Estructura del Proyecto Android

```
android/
├── app/
│   ├── src/main/
│   │   ├── AndroidManifest.xml    # Permisos y configuracion
│   │   ├── assets/public/         # App web compilada
│   │   ├── java/.../MainActivity.java
│   │   └── res/
│   │       ├── values/
│   │       │   ├── strings.xml    # Nombre app y API keys
│   │       │   ├── colors.xml     # Colores del tema
│   │       │   └── styles.xml     # Estilos
│   │       └── drawable/
│   │           └── splash.xml     # Splash screen
│   └── build.gradle               # Dependencias app
├── build.gradle                   # Configuracion proyecto
└── capacitor.build.gradle         # Plugins Capacitor
```

## Permisos Configurados

- **INTERNET** - Conexion a internet
- **ACCESS_NETWORK_STATE** - Estado de la red
- **ACCESS_FINE_LOCATION** - GPS de alta precision
- **ACCESS_COARSE_LOCATION** - Ubicacion aproximada
- **VIBRATE** - Vibracion (haptics)

## Plugins Capacitor Instalados

- `@capacitor/geolocation` - GPS nativo
- `@capacitor/haptics` - Vibracion nativa
- `@capacitor/splash-screen` - Pantalla de inicio
- `@capacitor/status-bar` - Barra de estado nativa

## Configuracion de la App

- **App ID**: `com.hormiruta.app`
- **App Name**: HormiRuta
- **Min SDK**: 22 (Android 5.1)
- **Target SDK**: 34 (Android 14)
- **Version**: 1.0

## Solucion de Problemas

### Error: "Google Maps API key not configured"
- Verifica que agregaste tu API key en `strings.xml`
- Asegurate de habilitar "Maps SDK for Android" en Google Cloud Console

### Error: "Could not resolve..."
En Android Studio: File > Sync Project with Gradle Files

### La app no abre
- Verifica que ejecutaste `npx cap sync android` despues de `npm run build`
- En Android Studio: Build > Clean Project, luego Build > Rebuild Project

## Comandos Utiles

```bash
# Compilar y sincronizar
npm run build:mobile

# Solo sincronizar
npx cap sync android

# Abrir en Android Studio
npx cap open android

# Ver dispositivos conectados
adb devices

# Instalar APK en dispositivo
adb install app-debug.apk
```
