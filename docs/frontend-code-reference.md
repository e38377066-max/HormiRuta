# Referencia técnica del frontend

## Alcance y método

Esta referencia describe el código que existe actualmente bajo `client/`. Las
descripciones se basan en imports, estado, efectos, callbacks y JSX presentes
en esos archivos; no se infieren contratos que no estén implementados. El
frontend es React con React Router, Axios, Socket.IO, i18next, Google Maps y
plugins de Capacitor. Las respuestas de red y los mensajes de error se
presentan tal como los interpreta el código (frecuentemente mediante `alert`).

## Arranque, proveedores y rutas

### `client/main.jsx`

El archivo importa los estilos globales y las traducciones, instala una
envoltura que filtra únicamente advertencias deprecadas de Google Maps, y
renderiza `React.StrictMode > ErrorBoundary > BrowserRouter > AuthProvider >
MessagingProvider > App` en `#root`. En plataforma nativa, el callback
asíncrono `initNative` importa el plugin de pantalla inicial, intenta ocultarlo
y llama a `initStatusBar`; en web también intenta ocultar esa pantalla de
forma dinámica. Los fallos de esas operaciones son absorbidos para no impedir
el renderizado.

### `client/App.jsx`

- `LoadingScreen` muestra el indicador giratorio y
  `common.loading` mientras se inicializa la autenticación.
- `getDefaultRoute(user)` devuelve `/login` sin usuario, `/messaging` para
  `admin`, `/dispatch` para `receptionist` y `/planner` para los demás roles.
- `ProtectedRoute` espera a `initializing`, exige sesión, y opcionalmente
  comprueba `allowedRoles` y `adminOnly`; las comprobaciones fallidas usan
  `Navigate` hacia login o la ruta predeterminada.
- `PublicRoute` redirige a la ruta predeterminada cuando ya hay sesión.
- `ReceptionistBlockedPublicRoute` aplica la misma protección pública y además
  devuelve al recepcionista a `/dispatch`.
- `App` declara todas las rutas y coloca `OpenAIQuotaBanner` dentro del
  árbol. Rutas públicas: `/login`, `/register`, `/privacy`, `/terms`,
  `/support`. Rutas autenticadas y layouts: `/dashboard` usa
  `DashboardLayout`; `/planner`, `/planner/accounting` y `/planner/route/:id`
  usan `PlannerLayout`; `/dispatch` y `/messaging` usan el layout de
  dashboard. Las rutas administrativas incluyen `/admin`,
  `/admin/users`, `/admin/routes`, `/admin/logs`, `/admin/accounting`,
  `/admin/returns`, `/admin/wholesale`, `/admin/bot-memory` y `/admin/export`,
  protegidas por `adminOnly`. También enlaza `/messaging/orders`,
  `/messaging/coverage`, `/messaging/settings`, `/account` y un comodín que
  redirige mediante `getDefaultRoute`.

## Cliente HTTP, socket y almacenamiento

### `client/api.js`

`resolveBaseURL` elige la base según entorno/configuración nativa. La instancia
Axios usa esa base, JSON y timeout de 20 segundos. El interceptor de petición
lee `StorageKeys.AUTH_TOKEN` y añade `Authorization: Bearer ...`. El
interceptor de respuesta marca `isTimeout` para `ECONNABORTED` o mensajes de
timeout y agrega `friendlyMessage` cuando no hay respuesta, diferenciando
cliente nativo de navegador; siempre vuelve a rechazar el error.

### `client/socket.js`

`getSocket` mantiene un singleton de `socket.io-client`, con transportes
`websocket` y `polling` y conexión automática. En `connect` lee el token y
emite `join` con él si existe. `disconnectSocket` desconecta, libera el
singleton y permite una conexión posterior. No se registran listeners de
negocio aquí; las páginas los gestionan y limpian.

### `client/utils/storage.js`

`StorageKeys` centraliza las claves de autenticación y usuario. `storageGet`,
`storageSet` y `storageRemove` envuelven `localStorage` en `try/catch`: leer
devuelve `null` si el almacenamiento no está disponible y escribir/eliminar no
lanza excepciones. El uso es síncrono y no cifra el contenido.

## Contextos y componentes transversales

### `client/contexts/AuthContext.jsx`

`AuthProvider` mantiene `user`, `loading`, `initializing`, y expone
`isAuthenticated` e `isAdmin`. `tryParse` convierte JSON almacenado en objeto
sin propagar un JSON inválido. `setup` consulta la sesión al montar/reintenta
según el flujo implementado, hidrata el usuario almacenado y finaliza la
inicialización. `login(email,password)` llama al endpoint de login, guarda
token/usuario y actualiza estado; `register(userData)` hace lo mismo para
registro. `logout` llama al servidor y limpia credenciales aunque la petición
falle. `deleteAccount` solicita el borrado, limpia sesión y estado. Los
efectos de montaje ejecutan `setup` y mantienen sincronizados los valores de
sesión. `useAuth` consume el contexto y falla explícitamente si se usa fuera
de `AuthProvider`.

### `client/contexts/MessagingContext.jsx`

`MessagingProvider` centraliza `settings`, `orders`, `coverageZones`, `stats`,
`agents`, `loading` y errores. Cada callback actualiza su colección después de
la respuesta y rechaza errores para que las páginas decidan cómo mostrarlos:

- `fetchSettings`, `updateSettings`, `testConnection`, `testOpenAI` y
  `resetTest` gestionan configuración y pruebas del chatbot.
- `fetchOrders(status)`, `fetchOrder(id)`, `createOrder`, `updateOrder`,
  `confirmOrder`, `cancelOrder(id,reason)` y `completeOrder` cubren el ciclo
  CRUD/estado de órdenes.
- `fetchCoverageZones`, `createCoverageZone`, `createCoverageZonesBulk`,
  `updateCoverageZone` y `deleteCoverageZone` gestionan zonas.
- `fetchStats`, `getPollingStatus`, `startPolling(interval)`,
  `stopPolling` y `syncContacts` reflejan y controlan polling/sincronización.
- `validateZip(zipOrCity)` consulta validación; `fetchAgents`,
  `createAgent`, `updateAgent` y `deleteAgent` administran agentes.

Los efectos de montaje/cambio de autenticación cargan los datos aplicables;
las acciones ajustan `loading` y conservan mensajes de error de API. `useMessaging`
valida el proveedor antes de devolver el contexto.

### Componentes auxiliares

- `client/components/ErrorBoundary.jsx`: clase de límite de error que captura
  excepciones de renderizado, conserva el error en estado y muestra fallback
  con opción de recarga. `constructor(props)` inicializa `hasError` y `error`;
  `getDerivedStateFromError(error)` prepara el fallback y
  `componentDidCatch(error, errorInfo)` registra el diagnóstico.
- `OpenAIQuotaBanner.jsx`: consulta en un efecto el estado de cuota mediante
  callback `check`; si el servidor informa cuota agotada muestra un banner y
  ofrece el enlace/acción previsto. El fallo de consulta no bloquea la página.

## Layouts

### `client/layouts/DashboardLayout.jsx` y `DashboardLayout.css`

`NavItem` encapsula enlace, icono, color y callback de cierre; `SectionLabel`
renderiza separadores del menú. `DashboardLayout` obtiene usuario,
`handleLogout` llama a `logout` y navega a login, y `close` cierra el drawer
móvil. Renderiza navegación distinta por rol, menú responsive, cabecera,
contenido `Outlet` y banner de cuota. El CSS define sidebar, drawer,
overlay, cabecera, navegación, estados activos, tipografía, espaciado y
breakpoints móviles.

### `client/layouts/PlannerLayout.jsx` y `PlannerLayout.css`

Exporta `usePlanner`, el contexto local del planificador. El layout expone
`handleLogout`, `toggleDrawer`, `closeDrawer` y `handleSupport`; proporciona
barra lateral para conductor, navegación a planificador/contabilidad, enlace
de soporte, salida y `Outlet`. El CSS define shell de pantalla completa,
sidebar, controles móviles, área de mapa/contenido y adaptaciones por ancho.

## Páginas de autenticación, cuenta y legales

### `pages/Auth/LoginPage.jsx`, `RegisterPage.jsx`, `AuthPages.css`

`LoginPage` mantiene email, contraseña, error y envío; `handleSubmit` evita el
submit nativo, llama `login`, y navega según usuario, mostrando error de API
o mensaje amigable. `RegisterPage` mantiene los campos, `handleChange`
actualiza cada campo y `handleSubmit` valida contraseñas/aceptación, llama
`register` y navega o muestra error. Ambos permiten alternar sus pantallas y
usan traducciones. `AuthPages.css` contiene fondo, tarjeta, formularios,
botones, validación, enlaces y responsive.

### `pages/Account/AccountPage.jsx` y `AccountPage.css`

Muestra perfil de `useAuth`; `handleDelete` confirma y llama
`deleteAccount`, y `handleLanguageChange` cambia idioma persistido mediante
i18n. Los estados de confirmación/error se reflejan en la vista. El CSS
define tarjeta de cuenta, formulario, selector de idioma, peligro y móvil.

### `pages/Legal/PrivacyPage.jsx`, `TermsPage.jsx` y `LegalPage.css`

Son páginas estáticas con contenido legal actual, navegación de regreso y
enlaces internos. No hacen peticiones ni mantienen estado de negocio. El CSS
común controla ancho de lectura, títulos, párrafos, listas, enlaces y
responsive.

### `pages/Support/SupportPage.jsx` y `SupportPage.css`

Página estática de ayuda/contacto. El callback inline del botón ejecuta
`navigate(-1)`. No carga datos ni tiene efectos. El CSS define tarjetas,
contactos, iconografía y botón de retorno.

## Dashboard y mensajería

### `pages/Dashboard/DashboardPage.jsx` y `DashboardPage.css`

Consulta estadísticas y estado del polling con el contexto. `handleTogglePolling`
elige `startPolling`/`stopPolling`; `handleSync` ejecuta `syncContacts`.
Los efectos iniciales hacen las cargas, con indicadores de carga y mensajes de
error. Renderiza métricas, estado del bot y acciones. El CSS organiza grid de
tarjetas, indicadores, botones y responsive.

### `pages/Messaging/OrdersPage.jsx` y `MessagingPages.css`

Carga órdenes por filtro con `fetchOrders`; callbacks de fila llaman
`fetchOrder`, `updateOrder`, `confirmOrder`, `cancelOrder` y `completeOrder`,
abriendo modales para edición/cancelación. Los formularios controlados validan
datos, muestran loading y alertas ante errores; el efecto de montaje recarga
la lista. `MessagingPages.css` también sirve a esta página y a cobertura y
configuración: tablas, badges de estado, tabs, modales, formularios, toolbar,
paneles y media queries.
Los helpers `getPlatformInfo`, `getStatusColor`, `getStatusIcon`,
`getStatusLabel` y `formatDate` preparan plataforma, color/icono/etiqueta y
fecha. `handleValidateZip`, `handleRevalidate`, `handleCopyMessage`,
`handleCloseValidation` y `clearHistory` implementan validación, revalidación,
copia al portapapeles, cierre del resultado y limpieza del historial local.

### `pages/Messaging/CoveragePage.jsx`

Usa zonas y callbacks del contexto. Carga con `fetchCoverageZones`, permite
crear individualmente o en bloque, editar y eliminar con
`createCoverageZone`, `createCoverageZonesBulk`, `updateCoverageZone` y
`deleteCoverageZone`. Los handlers inline de inputs y selección de archivos
construyen el formulario; confirmaciones y errores se muestran en alertas.
`geocodeAddress`, `handleAddressSearch`, `applyAddressResult`,
`handleBulkAddressSearch`, `removeBulkAddressResult`, `fetchZipInfo`,
`handleZipChange`, `loadZones`, `toggleSort`, `resetForm`, `editZone`,
`saveZone`, `handleDelete` y `addBulkZones` implementan búsqueda de dirección,
aplicación de resultados, consulta masiva, eliminación de resultados,
información del ZIP, edición del campo, carga/ordenamiento, reseteo, edición
y persistencia de zona. `SortIcon` muestra el indicador visual de orden.

### `pages/Messaging/SettingsPage.jsx`

Es el formulario extenso de configuración: carga settings/agentes/estado,
mantiene campos de mensajes, productos, horario, modo, seguimiento y
asignación. Sus callbacks de guardado llaman `updateSettings`; las pruebas
llaman `testConnection`, `testOpenAI` y `resetTest`; los controles de polling
llaman sus equivalentes del contexto. El efecto de montaje obtiene la
configuración. Cada sección deshabilita controles mientras guarda y muestra
errores de respuesta.
`parseProducts` normaliza el JSON de productos. `loadAgents`, `handleSaveAgent`,
`handleEditAgent` y `handleDeleteAgent` administran agentes; `loadSettings` y
`loadPollingStatus` hidratan la pantalla. `handleTestConnection`,
`handleSave`, `handleTestOpenAI`, `handleStartPolling`, `handleStopPolling` y
`handleSyncNow` son las acciones visibles. `handleInputChange`, `toggleDay` y
`isDaySelected` controlan campos y días; `handleValidateZip` consulta
cobertura. `handleCopyMessage`, `handleDeletePrice`,
`handleExportPricesCSV` y `handleImportPricesCSV` copian mensajes y
administran precios (incluido el parser local `splitLine`).

## Operación de despacho

### `pages/Dispatch/DispatchMap.jsx` y `DispatchMap.css`

Funciones de presentación: `selectionKey` identifica una orden/stop;
`getDriverColor` selecciona color estable; `createNumberedIcon`,
`createCompletedIcon`, `createSkippedIcon`, `createTriangleIcon` y
`createStarIcon` generan iconos SVG/HTML para el mapa.

`DispatchMap` mantiene órdenes, rutas, conductores, selección, filtros,
marcadores, modales, favoritos, usuarios y estado de sincronización. Sus
efectos iniciales cargan datos y establecen refresco periódico; el cleanup
detiene intervalos/listeners. `refresh` vuelve a ejecutar `fetchData`.
Las acciones de órdenes son `toggleOrderSelection`,
`moveItemInSelection`, `handleDragStart`, `handleDragOver`,
`handleDrop`, `handleUpdateStatus` y `handleBulkStatus`. Las de rutas son
`handleCreateRoute`, `handleDeleteRoute`, `handleReturnPendingOrders`,
`loadRouteStops`, `handleRemoveStop`, `handleAddOrdersToRoute`,
`handleOptimizeRoute` y `handleAssignDriver`. `handleRefreshOrder` refresca
una orden individual y `handleMarkDelivered` marca entrega.

Mensajería usa `openMessageModal` y `sendTemplate`. Edición usa
`handleSaveNotes`, `openBillingEditor`, `handleBillingChange` y
`handleSaveBilling`. Administración usa `fetchAllUsers`, `handleChangeRole`,
`fetchRespondUsers`, `toggleRespondUser`, `handleSyncDrivers`,
`handleCleanupDuplicates`, `handleLifecycleAudit` y
`handleLifecycleResync`. Las acciones destructivas piden confirmación; las
fallas muestran respuesta del servidor. El mapa dibuja órdenes por estado,
rutas/stop numerados y selección; el CSS de 2576 líneas cubre mapa, paneles,
leyenda, tablas, modales, drag-and-drop, facturación, responsive y estados.

### `pages/Dispatch/RoutePrintView.jsx` y `RoutePrintView.css`

Vista imprimible de una ruta y sus paradas; transforma datos recibidos en
cabecera, conductor, dirección, orden, totales y detalles. No realiza
peticiones ni efectos de negocio. El CSS define formato de impresión,
ocultación de controles, tablas y saltos de página.

### `pages/Dispatch/BulkBillingModal.css`

Hoja exclusiva de modal de facturación masiva: overlay, diálogo, selección de
órdenes, entradas monetarias, totales, botones, estados de error y
responsive. No exporta lógica JavaScript.

## Planificador del conductor

### `pages/Planner/TripPlannerPage.jsx` y `TripPlannerPage.css`

Es la página más grande: mantiene rutas/paradas, mapa Google, posición,
navegación, optimización, evidencia, mensajes, paradas diferidas/omitidas,
modales y facturación. Al montar carga rutas; otros efectos sincronizan ruta
activa/stop seleccionado y `localStorage`, conectan el socket mediante
`getSocket` y registran `route:assigned`, `route:updated` y `stop:updated`;
el cleanup remueve esos listeners. Otros efectos observan geolocalización,
redibujan marcadores/ruta, guardan optimización y mantienen pantalla activa.

Callbacks de carga y ruta: `fetchRoutes`, `loadRoute`,
`fetchPickupOrders`, `addPickupOrder`, `startRoute`, `finishRoute`,
`clearRoute`, `exitNavigation`, `reOptimize`, `optimizeRoute`,
`reoptimizeAfterCompletion`, `calculateRoute`, `recalculateNavRoute`,
`updateMapMarkers`, `showDeferredRoute`, `setDeferredVisibility`,
`toggleDeferredVisibility`, `sortByGpsDistance`. La optimización puede usar
origen GPS, waypoints y Directions; después sincroniza el orden con API.

Navegación/mapa: `initMap`, `initAutocomplete`, `calculateDistance`,
`isOffRoute`, `drawFallbackLine`, `getManeuverIcon`, `findCurrentStep`,
`updateNavLine`, `calculateNavEta`, `updateUserLocationMarker`,
`handleMapClick`, `addSelectedPoint`, `cancelSelectedPoint`,
`reverseGeocode`, `toggleMapType`, `centerOnLocation`, `openNavChooser`,
`launchNavApp`, `formatDuration` y `formatTime`. Los callbacks inline de
mapa/drag previenen eventos, seleccionan una parada y recalculan bounds.

Paradas/evidencia: `addStop`, `removeStop`, `moveStop`,
`toggleStopComplete`, `handleEvidencePhoto`, `captureEvidenceNative`,
`openEvidenceCapture`, `retakeEvidence`, `confirmStopWithEvidence`,
`skipStop`, `restoreDeferredStop`, `restoreSkippedStop`,
`openAddressModal`, `closeAddressModal`, `updateStopAddress` y
`confirmSkipDefinitive`. La evidencia web usa input/file; la nativa usa
`takePhoto` y convierte datos con `dataUrlToFile`; la confirmación sube
`FormData` y solo completa cuando la API acepta. El estado diferido se
persiste por ruta en almacenamiento. `openMessageModal` obtiene plantillas y
`sendTemplate` envía el template seleccionado. Errores de cámara, red,
validación y navegación se muestran mediante alertas/modales. El CSS cubre
mapa, panel de navegación, pasos, tarjetas, evidencia, modales, estados
omitidos/diferidos, controles táctiles y responsive.

### `pages/Planner/DriverAccountingPage.jsx` y `DriverAccountingPage.css`

Carga rutas/pagos del conductor, filtra por fechas/estado, calcula totales y
renderiza entregas, comisiones y pagos. `fetchReport`/callbacks de filtros
recargan; las acciones de confirmar pago y exportar llaman API y refrescan.
Efectos de montaje y cambio de filtros controlan loading/error. El CSS define
tabla contable, resumen, filtros, modal, colores de pago y versión móvil.

## Administración

### `AdminDashboard.jsx`

`fetchStats` obtiene métricas administrativas al montar. `handleResetDispatch`
exige confirmación doble y llama al endpoint de reinicio; éxito/error se
notifica con traducciones. Tarjetas enlazan a las secciones admin.

### `AdminUsers.jsx`

`fetchUsers` aplica búsqueda y filtros. `handleToggleActive` alterna
habilitación; `openEditDialog` prepara el formulario; `handleSaveUser` envía
campos editados; `handleDeleteUser` elimina tras confirmar. Helpers
`getRoleLabel`, `getInitials` y `formatDate` formatean tabla. Loading, modal y
errores se controlan localmente.

### `AdminLogs.jsx`

Carga logs, estadísticas de archivo y archivos archivados mediante
`fetchLogs`, `fetchFileStats` y `fetchArchives`; el intervalo refresca logs y
un callback de scroll mantiene el seguimiento si el usuario está cerca del
final. `handleClearLogs`, `handleDownload` y `handleDownloadArchive` ejecutan
acciones/descargas blob. `getLevelColor`, `getLevelBadgeClass` y
`formatTime` presentan nivel y fecha; errores y estados vacíos son explícitos.

### `AccountingPage.jsx` y `AdminPages.css`

`fmt`, `fmtDate` y `today` formatean importes/fechas. `useColumnResize`
instala `onMove` y `onUp` para anchos persistidos. `fetchDrivers`,
`fetchReport`, `fetchRoutePayments`, `handleArchiveMonth`,
`openConfirmModal` y `handleAdminConfirm` gestionan reporte, archivo y
confirmación de pagos. `currentMonthYear`, `monthLabel`,
`toggleWideMode`, `handleSummaryFilter`, `handleDeliveriesFilter`,
`exportSummaryCSV`, `exportDeliveriesCSV` y `downloadCSV` implementan
periodos, filtros y exportación. `getStatusBadge` y `toggleRoute` son
helpers de filas. La hoja admin común cubre tablas, paneles, modales,
controles, layouts, resize, contabilidad y responsive.

### `RouteHistory.jsx`

`fetchRoutes` carga historial; `downloadExcel` descarga blob; `viewRouteDetail`
abre detalle de ruta. `formatDate` y `getStatusLabel` presentan fechas y
estado. El detalle muestra paradas, evidencia, cobros y totales, con loading
y errores.

### `PackageReturnsPage.jsx` y `PackageReturnsPage.css`

`RetornosSection` carga devoluciones, `pill` traduce disposición,
`receiveAtOffice` registra recepción y `releaseToDispatch` devuelve al
despacho. Los efectos recargan después de cada mutación y deshabilitan
botones ocupados. El CSS cubre panel de retornos, pills, tablas, formularios,
modal y responsive.

### `WholesalePage.jsx`

`ActiveOrdersBadge` calcula/muestra órdenes activas. `fetchClients` carga
clientes mayoristas; `showMsg` controla notificación; `openAdd` y `openEdit`
preparan formulario; `handleSave`, `handleDelete` y `handleDispatchNow`
persisten, eliminan o envían cliente a despacho. Loading y errores se
reflejan en la tabla/modal.

### `BotMemoryPage.jsx`

`ContextBadge` traduce tipo de contexto y asigna color. `loadKnowledge`,
`handleKSave`, `handleKEdit`, `handleKDelete`, `handleKToggle` y
`handleKUpload` administran documentos, incluyendo `FormData` de importación.
`loadData` carga memoria/estadísticas; `handleApprove`, `handleToggleActive`,
`handleDelete`, `handleEdit` y `handleSave` moderan y editan memorias.
`handleAnalyzeHistory` solicita análisis histórico. Tabs, filtros, contador de
caracteres y formularios son estado local; validaciones y errores usan
mensajes traducidos.

### `ExportPage.jsx` y `AdminPages.css`

Las constantes `DISPATCH_STATUSES`, `ORDER_STATUSES`, `COLUMN_GROUPS`,
`DEFAULT_COLS` y `ALL_COLS` describen opciones exportables. `initBool`
inicializa selecciones; `toggleAll` y `toggleGroup` actualizan checks;
`fetchCount` obtiene el conteo; `handleExport` valida estados/columnas,
descarga CSV/blob y reporta errores. `Chip` es el control visual reutilizable.

## Utilidades nativas

### `client/utils/capacitor.js`

`setupStatusBar` y `initStatusBar` configuran barra/área segura según
plataforma. `requestLocationPermission` y `requestCameraPermission` piden
permisos; `getCurrentPosition` obtiene GPS; `watchPosition` crea vigilancia,
ejecutando su callback y devolviendo identificador para cleanup. `takePhoto`
solicita permiso, abre cámara y devuelve foto/base64 o error explícito.
`dataUrlToFile` convierte data URL a `File`. `vibrate` ejecuta haptics;
`keepScreenAwake` y `allowScreenSleep` gestionan el plugin de pantalla.
`openNativeNavigation` compone una URL de navegación con destino,
waypoints y coordenadas del usuario, y la abre en el navegador del sistema.
En web cada función cae a APIs del navegador cuando existen o devuelve un
resultado seguro según el código.

## CSS y recursos adicionales

- `index.css`: reset, variables de color, tipografía, body, botones, inputs,
  tablas, utilidades, animaciones y reglas globales responsive.
- `assets/Hormiruta.png`: recurso de imagen importable; no contiene lógica.
- `i18n/index.js`: inicializa i18next, detecta idioma y registra `en.json` y
  `es.json`; los JSON son catálogos, no componentes.
- `MessagingPages.css`, `AdminPages.css`, `AuthPages.css`,
  `DashboardPage.css`, `AccountPage.css`, `SupportPage.css`,
  `PlannerLayout.css`, `DashboardLayout.css`, `TripPlannerPage.css`,
  `DriverAccountingPage.css`, `DispatchMap.css`, `RoutePrintView.css` y
  `PackageReturnsPage.css` son hojas de responsabilidad específica indicada
  en sus secciones anteriores; no exportan JavaScript.

## Checklist de cobertura por archivo

- [x] `main.jsx`, `App.jsx`, `api.js`, `socket.js`, `index.css`
- [x] `components/ErrorBoundary.jsx`, `components/OpenAIQuotaBanner.jsx`
- [x] `contexts/AuthContext.jsx`, `contexts/MessagingContext.jsx`
- [x] `i18n/index.js`, `i18n/locales/en.json`, `i18n/locales/es.json`
- [x] `layouts/DashboardLayout.jsx`, `layouts/DashboardLayout.css`
- [x] `layouts/PlannerLayout.jsx`, `layouts/PlannerLayout.css`
- [x] Auth: `LoginPage.jsx`, `RegisterPage.jsx`, `AuthPages.css`
- [x] Account: `AccountPage.jsx`, `AccountPage.css`
- [x] Dashboard: `DashboardPage.jsx`, `DashboardPage.css`
- [x] Legal: `PrivacyPage.jsx`, `TermsPage.jsx`, `LegalPage.css`
- [x] Support: `SupportPage.jsx`, `SupportPage.css`
- [x] Messaging: `OrdersPage.jsx`, `CoveragePage.jsx`, `SettingsPage.jsx`,
  `MessagingPages.css`
- [x] Dispatch: `DispatchMap.jsx`, `DispatchMap.css`,
  `BulkBillingModal.css`, `RoutePrintView.jsx`, `RoutePrintView.css`
- [x] Planner: `TripPlannerPage.jsx`, `TripPlannerPage.css`,
  `DriverAccountingPage.jsx`, `DriverAccountingPage.css`
- [x] Admin: `AdminDashboard.jsx`, `AdminUsers.jsx`, `AdminLogs.jsx`,
  `AccountingPage.jsx`, `RouteHistory.jsx`, `PackageReturnsPage.jsx`,
  `PackageReturnsPage.css`, `WholesalePage.jsx`, `BotMemoryPage.jsx`,
  `ExportPage.jsx`, `AdminPages.css`
- [x] `utils/capacitor.js`, `utils/storage.js`
- [x] `assets/Hormiruta.png`

La casilla de cada archivo significa que fue inspeccionado y tiene una
responsabilidad descrita aquí; los catálogos de traducción se cubren como
datos y las hojas CSS como responsabilidades de presentación.

## Inventario nominal complementario de callables

Esta sección enumera los callables locales que se declaran dentro de
componentes grandes (incluidos callbacks que no son exports). Los setters de
React usados directamente en JSX y las funciones propias del lenguaje se
omiten deliberadamente.

### Despacho: callables de datos, mapa y edición

En `DispatchMap.jsx`, `selectionKey(item)` devuelve la clave estable
`type:id`; `getDriverColor(driverIdx)` devuelve un color cíclico; y
`createNumberedIcon(number,color)`, `createCompletedIcon(number)`,
`createSkippedIcon(number)`, `createTriangleIcon(color)` y `createStarIcon()`
devuelven objetos `google.maps.Marker` con SVG. `activeDriversList` (callback
de `useMemo`) deduplica conductores de rutas y calcula índice de color.
`toggleDriverVisibility(driverName)` alterna el conjunto de conductores
visibles.

`fetchData()` obtiene en paralelo órdenes/rutas/usuarios según rol y usa un
contador de petición para descartar respuestas antiguas; `fetchDeliveredOrders`
obtiene entregas ya hechas; `fetchFavorites` obtiene favoritos; y
`fetchPickupReady(forceRefresh)` obtiene nombres listos para recogida,
opcionalmente sincronizándolos antes de actualizar estado. Sus errores dejan
el mensaje/estado de carga indicado por la página. `refresh()` es el listener
de socket que delega en `fetchData`; el intervalo de datos, el intervalo de
recogidas y sus cleanups se crean en el efecto de carga.

Los callbacks de selección son `toggleOrderSelection(orderId)`,
`moveItemInSelection(fromIdx,toIdx)`, `handleDragStart(idx)`,
`handleDragOver(event)` y `handleDrop(targetIdx)`. Las mutaciones son
`handleUpdateStatus(orderId,newStatus)`, `handleBulkStatus(newStatus)`,
`handleCreateRoute()`, `handleDeleteRoute(routeId)`,
`handleReturnPendingOrders(route)`, `handleRefreshOrder(order)`,
`loadRouteStops(routeId)`, `handleRemoveStop(routeId,stopId)`,
`handleAddOrdersToRoute(routeId)`, `toggleFavoriteSelection(favId)`,
`handleOptimizeRoute(routeId)`, `handleAssignDriver(routeId,driverId)` y
`handleMarkDelivered(orderId)`. Cada callback llama al endpoint
correspondiente, actualiza la colección y muestra error de respuesta; las
operaciones destructivas solicitan confirmación.

`openMessageModal(order)` carga plantillas para el cliente y
`sendTemplate(template)` envía la plantilla; `handleSaveNotes(orderId)` y
`handleSaveBilling(orderId)` persisten notas y cobros; `openBillingEditor(order)`
inicializa el editor y `handleBillingChange(field,value)` valida su estado.
`fetchAllUsers()` y `handleChangeRole(userId,newRole)`, junto con
`fetchRespondUsers()` y `toggleRespondUser(email)`, administran usuarios y
selección de agentes. `handleSyncDrivers()`, `handleCleanupDuplicates()`,
`handleLifecycleAudit()` y `handleLifecycleResync()` ejecutan sincronización,
limpieza y auditoría; sus respuestas alimentan banners/modales de resultado.
Los callbacks de geocodificación de orden manual, edición y favorito (inputs
con debounce) mantienen `manualOrderGeo`, `editOrderGeo` y `favGeo`; los
callbacks de guardado envían esas coordenadas y fallan con el error visible.

En las tarjetas de `AccountingPage.jsx`, `getStatusBadge(route)` devuelve
clase/etiqueta de estado y el callback `driverAddedStops(delivery)` cuenta
paradas creadas por conductor. `toggleRoute()` alterna el id en
`expandedRouteIds`. En `useColumnResize(initialWidths)`,
`startResize(colIndex,event)` captura la columna; `onMove(event)` recalcula
ancho mínimo de 40px y `onUp()` quita listeners y estilos de selección.
El listener de panel ancho también usa callbacks locales `onMove(event)` y
`onUp()` con el mismo contrato de cleanup.

### Planificador: socket, pickup, pagos, arrastre y GPS

En `TripPlannerPage.jsx`, `handleRouteAssigned(data)` acepta la ruta recibida
por socket y dispara recarga; `handleRouteUpdated()` delega en
`loadDispatchRoutes()`. `deliverRoutePayment()` envía
`payDeliveryModal.id` y método de pago y cierra el modal o conserva el error.
`loadPickupOrders(searchTerm)` consulta órdenes listas; `openPickupOrdersModal()`
abre y carga el modal; `searchPickupOrders(event)` aplica el término; y
`addPickupOrderToRoute(pickupOrder)` agrega la orden y recarga la ruta.
`loadDispatchRoutes()` carga las rutas del conductor y
`loadDispatchRoute(route)` transforma una ruta en paradas. El helper interno
`mapStop(stop,skippedOnce)` copia coordenadas, ids, estado y datos de entrega.

`handleMouseMove(event)`, `handleMouseUp()`, `handleTouchMove(event)` y
`snapToNearest(height)` controlan el panel inferior arrastrable; el callback
`handlePanelDragStart(event)` instala los listeners y los efectos los retiran.
`initMap()` crea el mapa y listeners; `startLocationTracking()` solicita
permiso, llama a `watchPosition` y actualiza ubicación/ETA. El efecto de
socket emite `join` con rol/id, registra `handleRouteAssigned`,
`handleRouteUpdated` y la actualización de parada, y siempre ejecuta
`off` al desmontar. Los efectos de posición recalculan navegación y
`keepScreenAwake`; sus fallos se convierten en estados de navegación, no en
excepciones de render.

`setUserLocation` y `setSelectedStopIndex` son setters creados por `useState`,
no funciones implementadas aparte. El primero reemplaza o actualiza
funcionalmente la ubicación actual; el segundo selecciona o limpia el índice de
la parada activa. Sus llamadas provocan un nuevo render y activan los efectos
que dependen de esos estados.

Los helpers GPS son `isOffRoute(currentPos)` (distancia contra la polilínea),
`drawFallbackLine(from,to)` (polylinea recta), `getManeuverIcon(maneuver)`
(icono de instrucción), `findCurrentStep(userPos,steps)` (índice de paso),
`updateNavLine(from,to)` (Directions o fallback), `calculateNavEta(from,to)`
(ETA de API), y `updateUserLocationMarker(location,accuracy)` (marker/círculo).
`handleMapClick(event)`, `addSelectedPoint()`, `cancelSelectedPoint()` y
`reverseGeocode(location)` manejan selección y dirección de mapa.

Los callbacks de paradas son `addStop(stopData)`, `removeStop(index)`,
`moveStop(index,direction)`, `toggleStopComplete(index)`,
`handleEvidencePhoto(event)`, `captureEvidenceNative()`,
`openEvidenceCapture()`, `retakeEvidence()`, `confirmStopWithEvidence()`,
`skipStop(index)`, `restoreDeferredStop(index)`,
`restoreSkippedStop(index)`, `openAddressModal(stop,index)`,
`closeAddressModal()`, `updateStopAddress()`,
`confirmSkipDefinitive(disposition)`, `openMessageModal(stop)` y
`sendTemplate(template)`. Todos actualizan la lista local y, cuando la acción
es persistente, llaman API; la confirmación de evidencia construye
`FormData`, mientras cámara/red muestran el error al usuario. Dentro de
`skipStop`, `closeModal()` es el callback local para cancelar el modal.

`finishRoute()` valida pendientes/evidencias antes de cerrar; `sortByGpsDistance`
ordena por distancia; `reoptimizeAfterCompletion(completedStops)` conserva
completadas y optimiza las restantes; `optimizeRoute()` solicita optimización
del servidor y sincroniza orden. `updateMapMarkers(stopsList,includeDeferred)`
recrea markers y ajusta bounds; `recalculateNavRoute(stopsList,force,includeDeferred)`
evita recalcular innecesariamente; y `calculateRoute(stopsList,gpsOrigin,
optimizeWaypoints)` llama Directions y devuelve legs/orden. `startRoute()`,
`exitNavigation()`, `reOptimize()` y `clearRoute()` son transiciones de
navegación/ruta. `toggleMapType()` alterna mapa/satélite;
`centerOnLocation()` centra con GPS; `formatDuration(minutes)` y
`formatTime(date)` son formateadores; `openNavChooser(stop)` abre selector y
`launchNavApp(app)` crea la URL del proveedor elegido. `setDeferredVisibility`,
`toggleDeferredVisibility` y `showDeferredRoute` cambian visibilidad y
recalculan la ruta mostrada.

### Callables restantes por archivo

- `api.js`: `resolveBaseURL()` devuelve la base HTTP de web/nativo. Los
  callbacks de interceptores reciben config/respuesta/error, añaden token o
  marcan timeout y siempre devuelven config/promesa rechazada.
- `OpenAIQuotaBanner.jsx`: `check()` consulta cuota al montar y actualiza
  banner; un error de consulta deja el banner oculto.
- `AuthContext.jsx`: `tryParse(raw)` devuelve JSON o `null`; `setup(attempt)`
  hidrata sesión y reintenta la consulta; `login`, `register`, `logout` y
  `deleteAccount` devuelven la respuesta de API o limpian estado ante error.
- `DashboardLayout.jsx`: `NavItem(props)` y `SectionLabel(props)` son
  componentes presentacionales; `close()` cierra drawer y `handleLogout()`
  llama logout/navega. `PlannerLayout.jsx` tiene
  `handleLogout()`, `toggleDrawer()`, `closeDrawer()` y `handleSupport()`;
  `usePlanner()` devuelve el contexto del planificador.
- `DashboardPage.jsx`: `handleTogglePolling()` alterna el polling y
  `handleSync()` sincroniza contactos; ambos manejan loading/error.
  `AccountPage.jsx`: `handleDelete()` elimina cuenta tras confirmar y
  `handleLanguageChange(lang)` persiste el idioma.
- `AdminDashboard.jsx`: `fetchStats()` carga tarjetas y
  `handleResetDispatch()` ejecuta la confirmación doble. `AdminUsers.jsx`:
  `fetchUsers`, `handleToggleActive`, `openEditDialog`, `handleSaveUser`,
  `handleDeleteUser`, `getRoleLabel`, `getInitials` y `formatDate` cubren
  carga, CRUD y presentación. `AdminLogs.jsx`: `fetchLogs`,
  `fetchFileStats`, `fetchArchives`, `handleClearLogs`, `handleDownload`,
  `handleDownloadArchive`, `getLevelColor`, `getLevelBadgeClass` y
  `formatTime` cubren polling, descargas, colores y fecha.
- `RouteHistory.jsx`: `fetchRoutes`, `downloadExcel`, `viewRouteDetail`,
  `formatDate` y `getStatusLabel` cargan, descargan, abren detalle y
  presentan datos. `PackageReturnsPage.jsx`: `RetornosSection`, `pill`,
  `receiveAtOffice` y `releaseToDispatch` gestionan la máquina de devoluciones.
  `WholesalePage.jsx`: `ActiveOrdersBadge`, `fetchClients`, `showMsg`,
  `openAdd`, `openEdit`, `handleSave`, `handleDelete` y `handleDispatchNow`
  cubren badge, CRUD y despacho.
- `BotMemoryPage.jsx`: `ContextBadge`, `loadKnowledge`, `handleKSave`,
  `handleKEdit`, `handleKDelete`, `handleKToggle`, `handleKUpload`,
  `loadData`, `handleApprove`, `handleToggleActive`, `handleDelete`,
  `handleEdit`, `handleSave` y `handleAnalyzeHistory` cubren documento,
  memoria, importación, moderación y análisis. `ExportPage.jsx`:
  `initBool`, `toggleAll`, `toggleGroup`, `fetchCount`, `handleExport` y
  `Chip` gestionan selección, conteo y descarga.
- `LoginPage.jsx`: `handleSubmit(event)` valida y llama login.
  `RegisterPage.jsx`: `handleChange(event)` actualiza campos y
  `handleSubmit(event)` valida y registra. `SupportPage.jsx` solo tiene el
  callback inline de navegación atrás.
- `capacitor.js`: `startWatch()` es el callback asíncrono interno de
  `watchPosition`; pide permiso nativo, registra `Geolocation.watchPosition`
  y devuelve el id al resolver. `setupStatusBar`, `initStatusBar`,
  `requestLocationPermission`, `getCurrentPosition`,
  `watchPosition(callback,errorCallback,options)`,
  `requestCameraPermission`, `takePhoto`, `dataUrlToFile`,
  `vibrate`, `keepScreenAwake`, `allowScreenSleep` y
  `openNativeNavigation` devuelven promesas/ids/archivos según su sección.
- `storage.js`: `storageGet(key)`, `storageSet(key,value)` y
  `storageRemove(key)` son wrappers síncronos tolerantes a excepciones.
- `socket.js`: `getSocket()` crea/reutiliza conexión y su callback `connect`
  emite `join`; `disconnectSocket()` desconecta y nulifica la instancia.
- `i18n/index.js`: el inicializador de i18next registra recursos, detector y
  fallback; exporta la instancia configurada. Los JSON solo son mapas de
  claves y no contienen callables.
- `main.jsx`: `suppressGoogleMapsDeprecationWarnings()` reemplaza
  temporalmente `console.warn` y descarta solo advertencias deprecadas de
  Google Maps; cualquier otra advertencia conserva el comportamiento original.
- `RoutePrintView.jsx`: `handlePrint()` llama `window.print()` y
  `handleExportCSV()` serializa las paradas a CSV y dispara su descarga; no
  hacen petición de red y sus errores de descarga quedan en el navegador.
- Callables adicionales de `DispatchMap.jsx`: `handleDriverCommission(driverId)`
  guarda la comisión; `addOrderToFavorites(order)` y
  `handleRemoveFavorite(favId)` crean/eliminan favoritos; `isOrderFavorited(order)`
  devuelve booleano; `autoGeocodeFav(address)` obtiene coordenadas con
  debounce; `handleSaveFavorite()` valida y guarda el formulario.
  `getStatusConfig(status)` devuelve configuración de estado;
  `getStopStatusColor(status)` devuelve color de parada; `openManualOrderModal()`
  y `openEditOrderModal(order)` inicializan sus modales; `calcTotal(form)`
  calcula importe total; `handleSaveManualOrder()` y
  `handleSaveEditOrder()` persisten órdenes; `getNextStatus(currentStatus)`
  devuelve la transición administrativa siguiente; `syncPickupReadyFromGmail()`
  fuerza sincronización de recogidas y `diagnosePickupReady()` solicita su
  diagnóstico. `statValue(key)` devuelve la estadística o el indicador de
  carga. El callback JSX `isWholesaleOrder(order)` identifica origen
  mayorista. Todos los callbacks de red actualizan loading y presentan error.
- `DriverAccountingPage.jsx`: `fmtDateTime(date)` formatea fecha y hora;
  `getPmt(method)` devuelve etiqueta/colores del método de pago;
  `EmptyState(text)` es el estado vacío; `CompletedRouteCard(route,onRefresh,
  t,getPmt,lang)`, `MonthCard(month,expanded,onToggle,getPmt,t,lang)` y
  `DeliveryCard(delivery,getPmt,t)` son componentes presentacionales de
  ruta/mes/parada. `paymentStatus()` calcula la etiqueta de pago de la ruta;
  los botones de esos componentes notifican actualización, pago o error sin
  alterar directamente el reporte global.