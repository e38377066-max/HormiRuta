# Referencia técnica: pruebas, scripts y configuración

## Alcance y reglas de lectura

Este documento cubre el código mantenido por el proyecto que está fuera de
`src/` y `client/`: pruebas, automatizaciones de `scripts/`, scripts de
`package.json`, configuración de Vite, Capacitor y PM2, la entrada HTML,
la plantilla de entorno, el pegamento nativo de Android/iOS y la utilidad
documental de la API del validador ZIP. No cubre dependencias instaladas,
`dist/`/`build/`, cachés, registros, capturas, archivos adjuntos ni binarios.

Los valores secretos o credenciales presentes en automatizaciones se omiten
intencionalmente. Son fixtures de desarrollo inseguros y nunca deben usarse en
producción. Sustituirlos por credenciales temporales almacenadas fuera del
repositorio.

## Precondiciones comunes y convenciones

* Node.js 20+ y `npm install` son necesarios para los comandos JavaScript.
  El proyecto usa ESM (`"type": "module"`); la excepción es el parche CommonJS
  de Podspec.
* Las pruebas unitarias de contrato reemplazan métodos de modelos y no
  necesitan una base real. Las suites cuyo nombre termina en
  `.postgres.test.js` son opt-in: requieren `DATABASE_URL_TEST` (preferido) o
  `DATABASE_URL`, una base PostgreSQL aislada y `NODE_ENV` distinto de
  `production`. Nunca apuntarlas a producción.
* Los scripts de datos llaman a modelos de `src/`, autentican contra la base,
  escriben datos y pueden sobrescribir contraseñas o eliminar rutas de prueba.
  Confirmar `DATABASE_URL` antes de ejecutarlos.
* Los scripts de capturas requieren servidor accesible, Chromium/Puppeteer o
  `canvas`/`sharp` según el script. Escribirán bajo `screenshots/`, que es
  salida generada y no una entrada de la aplicación.

## `package.json`: scripts públicos

| Comando | Operación, efectos y salida esperada | Requisitos y uso seguro |
|---|---|---|
| `npm start` | Ejecuta `node src/index.js`; conecta/sincroniza la base, levanta el servidor y sirve API y frontend. | `.env`, `DATABASE_URL` y, en producción, `SESSION_SECRET`; detener con señal normal. |
| `npm run dev` | Ejecuta Node con `--watch`; reinicia al cambiar archivos del servidor. | Desarrollo solamente; no usar como supervisor de producción. |
| `npm run dev:frontend` | Ejecuta Vite en modo desarrollo (puerto configurado en Vite). | Requiere API separada si se navegan rutas que hacen solicitudes. |
| `npm run dev:all` | Inicia en segundo plano el servidor con `PORT=3000` y luego Vite. | Shell compatible con asignación inline; puede dejar un proceso huérfano, por lo que debe detenerse manualmente. |
| `npm run postinstall` | Ejecuta el parche idempotente de geolocalización para iOS. | Se dispara durante `npm install`; no modifica código propio, solo un Podspec instalado si existe. |
| `npm run build` | `vite build`; vacía `dist/` y genera los chunks de producción. | Requiere variables Vite y dependencias instaladas; no editar manualmente `dist/`. |
| `npm run build:copy-assets` | Copia PNG/SVG de `public/` a `dist/` mediante un `node -e`. | Ejecutar después de `build` si se necesita copia explícita; sobrescribe archivos con igual nombre. |
| `npm test` | Ejecuta únicamente `tests/public-zip-validator.test.js` con `node --test`. | Suite sin base; salida de Node Test Runner y código cero si pasa. |
| `npm run test:integration` | Ejecuta todos los `tests/*.postgres.test.js`. | Solo con PostgreSQL aislado, variables correctas y entorno no productivo; crea, altera y limpia tablas/filas de prueba. |
| `npm run build:mobile` | Incrementa versión, compila y hace `npx cap sync`. | Cambia `version.json`, Gradle y proyecto Xcode; revisar diffs antes de publicar. |
| `npm run build:mobile:sync` | Compila y sincroniza Capacitor sin incrementar versión. | Requiere plataformas nativas presentes y `VITE_API_URL` apuntando al servidor móvil. |
| `npm run cap:sync` | `npx cap sync` copia `dist` y actualiza plugins nativos. | Ejecutar después de cada build web que deba llegar a móvil. |
| `npm run cap:android` / `npm run cap:ios` | Abre Android Studio o Xcode respectivamente. | Requiere el IDE/plataforma instalada; no es un build automatizado. |
| `npm run cap:add:android` / `npm run cap:add:ios` | Añade una plataforma Capacitor ausente. | Solo para inicialización; puede crear muchos archivos nativos, no repetir sobre una plataforma existente sin revisión. |

Las dependencias y `overrides` de `package.json` se excluyen de esta
referencia: su instalación es responsabilidad de npm.

## Scripts de `scripts/`

### `bump-version.js`

`npm run build:mobile` lo invoca. Lee `version.json`, incrementa `versionCode` y
el componente patch de `versionName`, escribe JSON formateado, sustituye
`versionCode`/`versionName` en `android/app/build.gradle` y, si existe, en
`ios/App/App.xcodeproj/project.pbxproj`. Imprime la versión resultante. Requiere
que los archivos y patrones existan; el reemplazo es textual, por lo que se
debe revisar si cambia el formato nativo. Es irreversible sin restaurar el
control de versiones.

### `create-test-driver.js`

`main()` autentica, busca un usuario de conductor por email y lo crea o
actualiza (rol, activo y contraseña fixture), busca un admin y lo crea si falta,
elimina las rutas cuyo nombre sea la ruta de prueba del conductor y crea una
ruta asignada con cinco paradas geocodificadas y cantidades de cobro de prueba.
Imprime IDs y datos de acceso fixture (omitidos aquí) y cierra Sequelize.
Requiere una base de desarrollo accesible y sincronizada. Tiene efectos
destructivos limitados a esas rutas, pero resetea una contraseña: usar solo en
base desechable y no compartir su salida.

### `seed-admin-and-orders.js`

Carga dotenv, autentica, crea o actualiza un admin (incluido el reseteo de su
contraseña fixture) y crea cinco `ValidatedAddress` con direcciones, estados,
coordenadas, importes, métodos de pago y notas de prueba. Imprime cada orden,
cierra la conexión y sale con código 1 ante error. No comprueba duplicados de
órdenes: cada ejecución agrega cinco filas. Usar únicamente en desarrollo y
rotar/eliminar las credenciales fixture.

### `patch-geolocation-podspec.cjs`

Durante `postinstall`, busca el Podspec instalado del plugin de geolocalización.
Si no existe, termina silenciosamente; si ya contiene la dependencia nueva,
también termina; si no encuentra la línea exacta esperada, advierte y no cambia
nada. En otro caso reemplaza la versión de `IONGeolocationLib` y anuncia el
parche. Es idempotente, depende de `node_modules` y modifica una dependencia
instalada, no el código del proyecto.

### `post-merge.sh`

Usa `set -euo pipefail`, instala dependencias sin auditoría/notificaciones ni
actualizaciones automáticas y ejecuta `npm run build`. Un fallo detiene el
script. Requiere npm y red para instalar; puede cambiar `node_modules` y
regenerar `dist/`. No sincroniza base de datos (eso ocurre al arrancar la
aplicación).

### Generadores de capturas

* `generate-screenshots.mjs` usa `canvas`, crea `screenshots/appstore/` y
  genera cuatro PNG de 1320x2868: login, despacho, planificador y detalle de
  entrega. Sus funciones de dibujo (`hex`, `roundRect`, `statusBar`, `navBar`,
  `badge`, `card`, `dot`) son primitivas internas; `screen1`–`screen4` dibujan
  pantallas estáticas con datos ilustrativos y escriben archivos. No consulta
  red ni la aplicación.
* `gen-svg-screenshots.mjs` usa `sharp`, construye las mismas cuatro pantallas
  como SVG mediante `rr`, `txt`, `circle`, `badge`, `btn`, `dot` y las rasteriza
  a PNG 1320x2868. Requiere `sharp`; sobrescribe los cuatro archivos estáticos.
  Los textos y mapas son material de muestra, no datos operativos.
* `take-real-screenshots.mjs` abre Chromium headless en 414x896 con escala 3,
  visita `/login` y, mediante un token fixture omitido, `/messaging`,
  `/planner` y `/dispatch`; espera red/React, toma cuatro PNG y cierra el
  navegador. Requiere el servidor en `http://localhost:5000`, una ruta de
  login de desarrollo funcional y Chromium. El token embebido es inseguro:
  revocarlo y no ejecutar el script en un servidor expuesto.
* `take-ipad-screenshots.mjs` hace el mismo flujo a 1024x1366 con escala 2 y
  escribe en `screenshots/appstore/ipad/`. Tiene las mismas precondiciones,
  token fixture y efectos. Los tiempos de espera (15–20 s de navegación y
  1.5–3 s de render) pueden hacer fallar capturas en servidores lentos.

## Configuración de Vite: `vite.config.js`

`defineConfig` activa el plugin React, usa raíz `.` y `public/` como directorio
público. El servidor escucha `0.0.0.0:5000`, acepta hosts y proxifica `/api` y
`/uploads` a `http://localhost:3000` con `changeOrigin`; esto permite separar
Vite del servidor durante desarrollo. `build.outDir` es `dist`,
`emptyOutDir` borra la salida previa y `chunkSizeWarningLimit` es 1000 kB.
Rollup externaliza `@capacitor/app` y crea chunks manuales de React, Capacitor,
mapas y utilidades.

La sección `define` fija `process.env.NODE_ENV` (por defecto `production`) y
`import.meta.env.VITE_API_URL` (por defecto la URL pública del servidor). La
clave de mapas del frontend está insertada literalmente en este archivo: se
documenta como una credencial de desarrollo insegura, no se reproduce aquí;
rotarla, restringirla por origen/API y migrar a una variable de compilación.
Cualquier valor definido en `define` queda visible en el bundle, nunca es
secreto. La URL de producción constante también se usa como fallback.

## Capacitor: `capacitor.config.ts`

La aplicación tiene `appId` `com.area862.app`, nombre `Area 862` y copia web
desde `dist`. Android usa esquema HTTPS; esto es importante para APIs seguras
en WebView. SplashScreen dura 2000 ms, fondo `#0f172a`, sin spinner, recurso
`splash`, `CENTER_CROP`, pantalla completa e inmersiva. StatusBar usa estilo
claro y el mismo fondo. Keyboard redimensiona el `body` y se redimensiona en
pantalla completa. Camera usa presentación fullscreen.

Android permite contenido mixto, captura de entrada, depuración WebView y
fondo oscuro. El contenido mixto y la depuración reducen seguridad: mantenerlos
solo cuando sean imprescindibles y desactivarlos en una entrega productiva.
iOS usa `contentInset: automatic`, scroll habilitado y fondo oscuro. `webDir`
debe existir antes de `cap sync`; cambiar el backend requiere recompilar con
`VITE_API_URL`.

## PM2: `ecosystem.config.cjs`

Declara una app llamada `area862`, ejecuta `src/index.js`, una instancia, sin
watch, autorestart y reinicio por encima de 500 MB. Define producción y puerto
5001 en el entorno del proceso; esto puede diferir del puerto documentado por
la aplicación y debe coordinarse con proxy/cliente. Escribe error y salida en
`/var/log/area862/error.log` y `output.log`, combina logs, fecha
`YYYY-MM-DD HH:mm:ss`, espera 5 s al reiniciar y concede 5 s para terminar.
Requiere PM2, permisos de escritura en logs y variables secretas disponibles
en el entorno real (no las añade al archivo). Usar `pm2 start`, `restart`,
`status` y `save` conscientemente; autorestart no sustituye monitoreo.

## Entrada raíz: `index.html`

Declara idioma español, UTF-8, viewport móvil sin zoom, color de tema oscuro,
metadatos de aplicación móvil y título `Area 862 System`. Carga los iconos
Material desde dos hojas externas y `/Area862.png` como favicon. El estilo
inline elimina márgenes, fija fondo y hace que `#root` ocupe toda la ventana.
El único módulo es `/client/main.jsx`; Vite lo transforma en producción.
Requiere que ese archivo y el recurso del favicon existan en `public/`.

## Entorno: `.env.example`

Copiar a `.env` y completar sin versionar. `DATABASE_URL` es obligatoria y
contiene credenciales PostgreSQL; `DATABASE_SSL=true` fuerza SSL. `SESSION_SECRET`
es obligatorio en producción y debe ser aleatorio (mínimo 32 caracteres).
`ZIP_VALIDATOR_ALLOWED_ORIGINS` es una lista CORS separada por comas.
`NODE_ENV` admite `development`/`production`; `PORT` tiene 5000 por defecto y
`SERVER_DOMAIN` es el dominio sin esquema para cookies/CORS.

`VITE_GOOGLE_MAPS_API_KEY` se expone al frontend y habilita mapas; debe estar
restringida. `GOOGLE_MAPS_API_KEY` se usa en geocodificación del servidor y no
debe exponerse. `VITE_API_URL` es la URL completa que embeben las aplicaciones
móviles. Las variables `GMAIL_USER`, `GMAIL_CLIENT_ID`,
`GMAIL_CLIENT_SECRET` y `GMAIL_REFRESH_TOKEN` permiten OAuth/Gmail; son
secretos y deben guardarse en el gestor de secretos, no en el archivo.
El token de mensajería se configura desde la interfaz, no en esta plantilla.
Los comentarios del ejemplo mencionan proveedores y URLs de terceros solo como
orientación; validar permisos, cuotas, TLS y restricciones antes de producción.

## Pegamento nativo específico

### Android

`android/settings.gradle` incluye el proyecto Capacitor; `capacitor.settings.gradle`
resuelve plugins. `variables.gradle` fija `minSdkVersion` 23, compile/target
SDK 35 y las versiones de AndroidX, splash, JUnit, Espresso y Cordova.
`gradle.properties` limita el daemon a 1536 MB y activa AndroidX (el modo
paralelo está comentado). `build.gradle` raíz declara repositorios y plugins.
`app/build.gradle` usa namespace/applicationId `com.area862.app`, toma los SDK
de variables, registra `MainActivity`, conserva la versión inicial textual
(el script de versión la reemplaza), ignora archivos de control en assets,
mantiene release sin minificación y añade AndroidX, Capacitor, tests JUnit y
plugins Cordova. Si existe `google-services.json` aplica el plugin de servicios
de Google; si falta solo informa que notificaciones push no funcionarán.
`app/capacitor.build.gradle` incorpora la salida/plugin Capacitor. `gradlew` y
`gradlew.bat` son wrappers para ejecutar Gradle reproduciblemente.
`AndroidManifest.xml` declara backup, iconos, tema, `MainActivity` exportada
con `singleTask`, cambios de configuración soportados, `FileProvider` privado
con concesión URI y permiso INTERNET. No editar el código generado sin
entender que `cap sync` puede regenerarlo; cambios de versión se hacen mediante
`bump-version.js`.

### iOS

`ios/App/Podfile` exige iOS 16, frameworks y los pods de Capacitor para app,
cámara, geolocalización, haptics, preferencias, splash, status bar y keep-awake.
Su `post_install` valida el target de despliegue y suprime advertencias Swift y
GCC.
`setup-ios.sh` instala npm, entra a `ios/App`, ejecuta `pod install`, vuelve al
root y abre `App.xcworkspace` (el `open` final falla de forma tolerada en
entornos no macOS). Requiere macOS, Xcode, Ruby/CocoaPods y una build web
sincronizada. `Info.plist` contiene identidad, versión proveniente de Xcode,
storyboard, arm64 y orientaciones iPhone/iPad. Declara textos de permiso para
cámara, biblioteca de fotos y ubicación en uso/siempre, esquemas de navegación
`maps`, `comgooglemaps` y `waze`, ausencia de cifrado no exento y escenas
únicas. Las descripciones deben mantenerse alineadas con cámara/ubicación.
`AppDelegate.swift` es el delegado de ciclo de vida que inicializa Capacitor;
`BridgeViewController.swift` aloja el bridge WebView. El proyecto Xcode
(`project.pbxproj`) contiene targets, firmas, versiones y fases de recursos;
`bump-version.js` actualiza sus versiones textualmente. `.gitignore` de iOS y
Android evita artefactos locales; no es configuración de runtime.

## Pruebas

Todas usan `node:test` y `node:assert/strict`; las pruebas de rutas construyen
respuestas Express mínimas y buscan handlers por método/ruta, de modo que
verifican contratos sin levantar HTTP real.

### Unitarias/contrato sin PostgreSQL

* `tests/public-zip-validator.test.js`: sustituye consultas de modelos.
Verifica que opciones públicas solo devuelvan contactos seguros (sin mensajes,
tokens ni credenciales); normalización de contacto/origen y guardado por
defecto; `save=false`; filtros/paginación de historial; rechazo 400 de entrada
ausente, vacía o no string sin consultar/guardar; y 429 después de 60
solicitudes por IP.
* `tests/stop-address-update.test.js`: simula usuario, ruta, parada, orden,
transacción y geocoder. Comprueba actualización coordinada de parada/orden;
previsualización sin mutación; 403 para conductor no asignado; 409 para parada
completada incluso para admin; y 422 si el geocoder cambia silenciosamente el
número de calle.
* `tests/route-lifecycle-protection.test.js`: comprueba que asignaciones activas
bloquean regresiones de ciclo externo, pero permiten entrega/reactivación
legítima; archivado masivo solo actualiza órdenes sin `route_id` y no lo
sobrescribe; y polling no regresa una orden asignada a `Pickup Ready`.
* `tests/gmail-sync.test.js`: verifica detección de email Pickup Ready ya
procesado, aceptación de orden nueva sin ID, rechazo de email más antiguo que
una actualización manual y aceptación de email posterior.
* `tests/openai-quota-alert.test.js`: distingue agotamiento de cuota por código
o mensajes de créditos/cuota (incluido 429) de un rate limit temporal normal y
de un error 500.

### Integración PostgreSQL

* `tests/public-zip-validator.postgres.test.js`: crea/sincroniza solo
`ZipValidation`, verifica índices de contacto/origen/fecha, crea tres
validaciones sintéticas, comprueba serialización (`covered`), filtros,
orden/paginación, snapshot de zona y ausencia de tokens. Limpia sus filas por
UUID y cierra Sequelize.
* `tests/route-lifecycle.postgres.test.js`: sincroniza únicamente tablas usadas,
crea datos marcados por UUID y los limpia. Cubre borrado seguro de borradores;
visibilidad inmediata de rutas asignadas; devolución que libera solo pendientes
y conserva entregadas/cobradas/omitidas/devueltas/retenidas/favoritas; restaurar
omitidas impagadas y rechazar evidencia/pago; devolución y reasignación al
agente de recepción incluso con fallo externo; recarga de devoluciones retenidas
en la próxima ruta; flujo de paquetes omitidos hasta recepción; entrega por
rutas añadidas por conductor o despacho; contactos Pickup Ready/Dispatching y
adición a ruta; separación entre pago del conductor y confirmación administrativa;
y exclusión de omitidas de totales/pago. Es una suite con efectos de escritura:
usar una base aislada y permitir `after` para limpiar.

### Inventario explícito de helpers de pruebas

Estos helpers son código propio de los tests (no funciones de la biblioteca de
aserciones) y forman parte del contrato de mantenimiento:

* `response()` en `public-zip-validator.test.js`,
  `public-zip-validator.postgres.test.js`, `route-lifecycle.postgres.test.js`
  y `stop-address-update.test.js` devuelve un stub de respuesta Express con
  `{statusCode: 200, body: undefined, finished: false}`. Su método
  `status(code)` guarda el HTTP status y devuelve el mismo stub; `json(body)`
  guarda el body, marca `finished=true` y devuelve el stub; la variante de
  lifecycle también tiene `send(body)` con el mismo efecto. No hace I/O ni
  cleanup: el caller inspecciona el objeto en memoria.
* `callRoute(method, path, options={})` en
  `public-zip-validator.test.js` localiza en `router.stack` el método/ruta,
  construye request con `body`, `query`, `ip`, socket y origen, ejecuta cada
  handler en orden y devuelve una Promise del stub `response()`. `options`
  acepta `body`, `query`, `ip` y `origin`; el efecto es solo llamar handlers
  mockeados (que pueden guardar en `savedRecords`). Interrumpe al terminar la
  respuesta; no abre ni cierra base.
* `callHistory(query)` en `public-zip-validator.postgres.test.js` busca
  `GET /public/validator/history`, usa un IP derivado del contacto, ejecuta
  middleware/handler y devuelve la respuesta Promise. Recibe el objeto query
  (filtros, límite y offset), no crea datos ni limpia; la suite `after` elimina
  filas del contacto UUID.
* `findRoute(routerToSearch, method, path)` en
  `route-lifecycle.postgres.test.js` busca una ruta Express por objeto router,
  verbo y path, devuelve el array ordenado de handlers y falla la aserción si
  falta. No modifica router ni tiene cleanup.
* `callRoute(routerToSearch, method, path, options={})` (la variante de
  lifecycle) recibe router, verbo, path y `userId`, `params`, `body`, `query`
  opcionales; usa `findRoute`, crea request con `session.userId`, ejecuta
  handlers con `next(error)`, y devuelve el stub `response()`. Puede mutar
  PostgreSQL porque los handlers son reales; no hace rollback/cleanup propio,
  que corresponde a `after`.
* `callUpdateAddress(options={})` en `stop-address-update.test.js` encuentra
  `PUT /stops/:id/address`, usa `userId` y `body` (por defecto una dirección
  nueva), crea `params.id=30` y `session`, ejecuta handlers y devuelve la
  respuesta. La geocodificación, transacción y modelos están mockeados:
  registra una llamada al geocoder y muta objetos en memoria; no persiste ni
  limpia una base.
  En estos callers, el callback inline `finish()` resuelve la Promise una sola
  vez cuando termina un handler; en la variante PostgreSQL de lifecycle,
  `next(error)` rechaza ante error y el `next` normal continúa al siguiente
  handler. Son callbacks locales, no APIs públicas.
* `makeStop(overrides={})` produce una parada sintética id 30, ruta 12,
  dirección/coordenadas/estado iniciales, `toDict()` (snapshot de campos),
  `save()` async que devuelve el objeto y luego aplica overrides. Es factory
  en memoria, sin retorno de base ni cleanup. `makeOrder(overrides={})`
  produce análogamente una orden id 99 con dirección geocodificada, ZIP,
  ciudad/estado/confianza y `save()` async; overrides reemplaza campos.
* `createRoute(attributes={})` en la suite PostgreSQL crea una ruta con
  `user_id=admin.id` y nombre único basado en `marker`, combina attributes,
  registra el ID en `created.routeIds` y devuelve la instancia Sequelize.
  `createStop(routeId, order, attributes={})` crea parada con dirección y
  coordenadas únicas, registra `created.stopIds` y, si recibe una orden,
  sincroniza sus coordenadas/dirección y guarda. `createOrder(routeId,
  attributes={})` crea una orden asignada con defaults de lifecycle/pago,
  registra `created.orderIds` y devuelve la instancia. `createMatchedPair(
  routeId, orderAttributes={}, stopAttributes={})` usa `createOrder` y crea
  una parada con la dirección/coordenadas de la orden; devuelve
  `{order, stop}` y registra la parada. Los tres primeros escriben en la base;
  el cleanup conjunto lo realiza `after`.
  El factory de transacción
  `sequelize.transaction = async () => ({ LOCK, commit, rollback })` en
  `stop-address-update.test.js` devuelve un objeto en memoria: `commit()` y
  `rollback()` son async no-op. Permite probar el flujo transaccional sin
  conexión real y no requiere cleanup.
* Los `before()` de las suites importan routers/modelos, autentican la base
  cuando aplica, sincronizan solo tablas necesarias y preparan mocks; los
  `beforeEach()` restauran estado sintético, métodos de modelo y contadores.
  Los `after()` destruyen IDs registrados (rutas, paradas, órdenes,
  favoritos, historial, agentes, settings y usuarios) y cierran Sequelize.
  Las funciones inline de handlers mock (`findOne`, `findAll`, `create`,
  `findAndCountAll`, `findByPk`, `geocodeAddress`, `transaction`) devuelven
  fixtures o registran llamadas; no son helpers reutilizables con nombre.

### Inventario explícito de helpers de scripts de capturas

* En `generate-screenshots.mjs`, `hex(ctx,color,alpha=1)` convierte hex a
  `rgba` si alpha<1 y devuelve color sin cambio en otro caso; `roundRect(ctx,x,y,w,h,r)`
  construye un path redondeado y solo modifica el contexto; `statusBar(ctx)`
  dibuja barra, hora y estado; `navBar(ctx,title,showBack=false)` dibuja
  navegación y, opcionalmente, retroceso; `badge(ctx,x,y,text,color,w=200,h=52)`
  pinta una etiqueta; `card(ctx,x,y,w,h,r=24)` pinta tarjeta; `dot(ctx,x,y,r,color)`
  pinta círculo. Todos devuelven `undefined`, no escriben archivos y requieren
  un contexto Canvas válido.
* Sus `async screen1()`, `screen2()`, `screen3()` y `screen4()` no reciben
  parámetros ni devuelven valor útil: crean un Canvas W×H, dibujan login,
  despacho, planificador y detalle respectivamente con datos estáticos,
  convierten a PNG y escriben `01-login.png` a `04-delivery-detail.png` en
  `screenshots/appstore/`. Sobrescriben salidas; no tienen cleanup. El IIFE
  final los ejecuta en orden y muestra el destino.
  No existe una función llamada `render` en este generador: el render ocurre
  directamente dentro de cada `screenN`.
* En `gen-svg-screenshots.mjs`, `rr(x,y,w,h,r,fill,stroke='none',sw=0)`,
  `txt(x,y,t,fill,size,weight='normal',anchor='start')` y
  `circle(cx,cy,r,fill,stroke='none',sw=0)` devuelven strings SVG sin I/O.
  `badge(x,y,w,h,label,color)` combina rectángulo/texto; `statusBar()` devuelve
  la barra SVG; `btn(x,y,w,h,label,c1,c2,textColor='#fff',fs=46)` devuelve
  defs de gradiente, rectángulo y texto; `dot(cx,cy,r,fill)` delega en
  `circle` con borde blanco. `orderCard(y,name,addr,phone,status,statusColor,amount)`
  y `stopCard(y,num,name,addr,dist,amount,done=false)` devuelven tarjetas SVG
  parametrizadas, sin efectos. `saveSvgAsPng(svgStr,outPath)` es async, recibe
  SVG y ruta, usa `sharp` para rasterizar W×H, escribe/overwrite el PNG y
  devuelve la Promise de `toFile` (sin retorno de datos); el módulo lo llama
  cuatro veces y no borra archivos antiguos.
* En `take-real-screenshots.mjs` y `take-ipad-screenshots.mjs`,
  `getPage()` es async, crea una página Puppeteer, aplica viewport del script
  (414×896 escala 3 o 1024×1366 escala 2) y devuelve el objeto Page; no cierra
  la página. `loginAndGo(page,targetPath)` navega al login de desarrollo con
  token fixture omitido y redirect, espera red/render, imprime URL y devuelve
  `undefined`; puede crear sesión local en el navegador. Los bloques de
  captura llaman `page.screenshot({path})`, cierran cada page y el flujo final
  cierra browser; si falla antes, puede dejar Chromium abierto.

### Entradas de scripts con función nombrada

`main()` en `create-test-driver.js` no recibe argumentos ni retorna datos:
autentica, crea/actualiza usuarios, borra rutas de prueba, crea ruta/paradas,
imprime resultados, cierra Sequelize y su `catch` imprime error y sale con
código 1. `seed()` en `seed-admin-and-orders.js` tampoco recibe argumentos:
autentica, crea/actualiza admin, inserta cinco órdenes, imprime conteo, cierra
Sequelize; su `catch` imprime error y sale con código 1. `bump-version.js`,
`patch-geolocation-podspec.cjs` y `post-merge.sh` son entradas de nivel módulo
(no tienen función de aplicación nombrada): sus efectos, retornos y errores
son los descritos en sus secciones respectivas.

## Utilidad documental `docs/zip-validator-api.md`

Especifica la API pública bajo `/api/messaging/public`, sin sesión ni API key.
Documenta `GET /validator/options` (plataformas/contactos seguros y filtros),
`POST /validate-zip` (ZIP/ciudad/zona/dirección, aliases, contacto, `save`),
reglas de prioridad ZIP-ciudad-zona, snapshots y resultados con/sin cobertura,
y `GET /validator/history` (filtros, límite 1–100, offset y `has_more`).
Incluye ejemplos curl, JavaScript y React, flujo de integración, CORS por
`ZIP_VALIDATOR_ALLOWED_ORIGINS`, límite de 60 solicitudes por IP y tabla de
errores 200/400/429/500. Los consumidores deben guardar IDs, no etiquetas,
tratar ausencia de cobertura como respuesta 200 y no enviar secretos.

## Checklist de cobertura por archivo

- [x] `package.json` (scripts y efectos; dependencias excluidas).
- [x] `.env.example`, `index.html`, `vite.config.js`, `capacitor.config.ts`,
  `ecosystem.config.cjs`, `version.json`.
- [x] `scripts/bump-version.js`, `create-test-driver.js`,
  `seed-admin-and-orders.js`, `patch-geolocation-podspec.cjs`,
  `post-merge.sh`, generadores/tomadores de capturas.
- [x] `tests/gmail-sync.test.js`, `openai-quota-alert.test.js`,
  `public-zip-validator.test.js`, `stop-address-update.test.js`,
  `route-lifecycle-protection.test.js` y ambas suites PostgreSQL.
- [x] `docs/zip-validator-api.md`.
- [x] Pegamento Android: Gradle raíz/app, variables, propiedades, wrappers,
  configuración Capacitor y manifest.
- [x] Pegamento iOS: Podfile, script de instalación, plist, delegado, bridge,
  proyecto Xcode e ignores.
- [ ] Artefactos deliberadamente excluidos: `node_modules/`, `dist/`, `build/`,
  cachés, `logs/`, capturas/assets binarios, `package-lock.json` y documentos
  generales de instalación/arquitectura; no son código de configuración
  específico solicitado.