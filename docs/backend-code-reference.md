# Referencia técnica del backend

Referencia basada exclusivamente en el código existente en `src/`. Los nombres de
variables de entorno se mencionan solamente como nombres; no se documentan valores
secretos. El prefijo de las rutas montadas por `src/index.js` es `/api`.

## Mapa de ejecución y reglas transversales

`src/index.js` carga configuración de entorno, crea Express, configura CORS,
JSON (límite 2 MB), sesiones y cabeceras de no-cache, y monta los routers. También
sirve `uploads` (protegido por autenticación y por la regla de no-recepcionista),
el contenido estático del cliente y el fallback SPA. `GET /api/health` devuelve
el estado del proceso. `/dev-login` existe como ruta de desarrollo y crea una
sesión para un usuario encontrado por correo de desarrollo; no es una interfaz
general de autenticación. `startServer()` conecta Sequelize, ejecuta
`sequelize.sync({ alter: true })`, inicia los servicios de aprendizaje/sincronización
que el archivo importa y escucha en la interfaz y puerto configurados. Los errores
de conexión o arranque se registran y se propagan al arranque.

`src/config/database.js` exporta la instancia Sequelize. Lee `DATABASE_URL`,
configura el dialecto PostgreSQL, pool y SSL (forzado por `DATABASE_SSL` o
detectado por el host de la URL), y falla explícitamente cuando falta la
configuración de conexión.

`src/middleware/auth.js`:

* `generateToken(userId)` crea un `UserToken` aleatorio con fecha de creación.
* `getUserIdFromToken(token)` busca el token y devuelve el usuario o `null`.
* `removeToken(token)` elimina el token.
* `requireAuth` acepta sesión o token Bearer, comprueba que el usuario existe y
  está activo, y fija `req.userId` y `req.user`; responde 401 ante credenciales
  ausentes, inválidas o usuario inactivo.
* `requireRole(...roles)` exige autenticación y que `req.user.role` esté en la
  lista; responde 403 en caso contrario.
* `requireAdmin` es `requireRole('admin')`.
* `requireAdminOrReceptionist` permite `admin` o `receptionist`.
* `requireNotReceptionist` bloquea explícitamente al rol `receptionist`.
* `restrictReceptionistApiAccess` deja pasar las rutas de autenticación y las
  rutas públicas permitidas, y bloquea para recepción las operaciones no
  incluidas en `isAllowedReceptionistApi`.

## Modelos y asociaciones (`src/models/`)

Todos usan Sequelize, timestamps y nombres de tabla definidos en cada archivo.
Salvo indicación, no tienen métodos de instancia propios: la validación y
serialización las realizan las rutas o `models/index.js`.

* **User.js — `users`**: `id`, `username`, `email`, `password_hash`, `phone`,
  `document`, `address`, `google_id`, `profile_picture`, `active`,
  `subscription_type`, `subscription_expires`, `role`, `commission_per_stop`.
  `setPassword(password)` genera el hash; `checkPassword(password)` lo compara;
  `toDict()` omite `password_hash`.
* **UserToken.js — `user_tokens`**: `id`, `token`, `user_id`, `created_at_ms`.
  Es el almacenamiento de tokens emitidos por el middleware.
* **Route.js — `routes`**: `id`, `user_id`, `name`, `is_optimized`,
  `total_distance`, `total_duration`, `status`, direcciones/coordenadas de
  inicio y fin, `return_to_start`, `vehicle_type`, `optimization_mode`,
  `scheduled_date`, `started_at`, `completed_at`, `assigned_driver_id`,
  `payment_delivered`, `payment_delivery_method`, `payment_delivered_at`,
  `route_total_collected`, `admin_confirmed`, `admin_amount_received`,
  `admin_payment_records`, y campos de confirmación de recogida.
* **Stop.js — `stops`**: identificadores de ruta/favorito, incorporación por
  conductor, disposición/retorno, dirección, coordenadas, orden, notas,
  contacto, prioridad y ventana horaria, duración/ETA/distancia, información
  del paquete, estados de entrega, tiempos, firma/foto, importes, pago y
  apartamento. `unique_id` se genera automáticamente.
* **RouteHistory.js — `route_histories`**: usuario, nombre, conteos de paradas,
  distancia/duración, tiempos y `route_data` serializado.
* **DeliveryHistory.js — `delivery_histories`**: copia contable de una entrega:
  pedido original, actor de alta, cliente, dirección, conductor, comisión,
  coste/depósito/total, cobro, método/estado de pago, fecha, mes y archivado.
* **ValidatedAddress.js — `validated_addresses`**: usuario/contacto, nombres y
  teléfonos, dirección original/validada, coordenadas, ZIP/ciudad/estado/
  confianza, fuente, `dispatch_status`, `order_status`, estado previo, importes,
  conductor/ruta, entrega, notas, apartamento, correo de recogida y campos de
  devolución. Los índices y restricciones del archivo protegen identificadores
  únicos relevantes.
* **MessagingOrder.js — `messaging_orders`**: contacto/conversación/canal,
  cliente, dirección y geocodificación, ZIP/tipo/notas, estados de validación y
  pedido, asignaciones, agenda, cancelación, ciclo de vida, importe, entrega y
  conductor.
* **MessageLog.js — `message_logs`**: usuario/pedido/contacto, dirección del
  mensaje, tipo, contenido, procesamiento, canal, automatización, error y
  `metadata`.
* **MessagingSettings.js — `messaging_settings`**: configuración por usuario
  para API, activación, validación, textos de cobertura/orden, secreto de
  webhook, canal, modo de atención, horario/zona horaria, agente, textos de
  conversación, catálogo/productos, tags excluidos, modo de prueba, límites
  históricos, seguimiento, IA y precios.
* **ConversationState.js — `conversation_states`**: contacto y estado de flujo,
  espera, información previa, producto/ZIP, reapertura, agente activo, pausa,
  saludos, fechas de interacción, contexto JSON y seguimiento. Tiene índice
  único por usuario y contacto.
* **CoverageZone.js — `coverage_zones`**: ZIP, zona, ciudad, estado, país,
  activo, tarifa, mínimo, tiempo estimado y notas; índice único por usuario/ZIP.
* **ServiceAgent.js — `service_agents`**: agente externo, nombre/correo,
  servicio, productos y banderas por defecto/activo.
* **CustomerProfile.js — `customer_profiles`**: contacto, resumen, preferencias,
  productos, ubicación, notas y contadores/fechas de conversación; índices por
  usuario/contacto.
* **BotMemory.js — `bot_memories`**: lección, contexto, ejemplos, corrección,
  fuente, aprobación/activo, usos y contacto.
* **BotKnowledge.js — `bot_knowledge`**: título, contenido, tipo de conocimiento,
  nombre de archivo y activo.
* **AgentStyleProfile.js — `agent_style_profiles`**: resumen de estilo,
  frases, emojis, cierres, expresiones permitidas/no permitidas, activo,
  mensajes analizados y fecha.
* **FavoriteAddress.js — `favorite_addresses`**: nombre, dirección,
  coordenadas, notas y teléfono.
* **WholesaleClient.js — `wholesale_clients`**: usuario/contacto, cliente,
  dirección validada, coordenadas, ZIP/ciudad/estado, notas, activo y contadores
  de recogida.
* **ZipValidation.js — `zip_validations`**: actor/contacto, fuente, entrada,
  valor, tipo, validez, zona y snapshot, mensaje para operador/copia y metadata.
  `toResponse()` devuelve el formato de validación usado por la API.

`src/models/index.js` importa y exporta todos los modelos, define las asociaciones
de usuario con rutas, rutas históricas, pedidos, logs, zonas, configuración,
conversaciones, agentes, direcciones validadas y clientes; relaciona Route–Stop,
MessagingOrder–Route/Stop y asignaciones de conductor. También define
`Route.prototype.toDict()`: serializa la ruta, carga sus paradas e incluye
contadores de paradas completadas. Las asociaciones usan alias para propietario
y conductor y reglas de borrado declaradas en el archivo.

## Rutas HTTP

En todas las rutas autenticadas `req.userId` es la identidad autorizada; los
handlers verifican propiedad/asignación antes de mutar datos y devuelven JSON de
éxito o un error HTTP con `error`/`message`. Las excepciones de base de datos o
servicios externos se capturan por handler y producen 400/401/403/404/409/500
según el caso.

### `routes/auth.js` (montado en `/api/auth`)

* `POST /register`: recibe nombre, correo y contraseña; normaliza correo, exige
  longitud mínima y unicidad, crea usuario y devuelve su representación.
* `POST /login`: busca correo, comprueba contraseña/activo, establece sesión y
  devuelve usuario; credenciales inválidas producen 401.
* `POST /logout` (auth): destruye sesión y elimina token si corresponde.
* `GET /me` (auth): devuelve usuario actual.
* `DELETE /account`: comprueba credenciales/sesión, elimina la cuenta y limpia
  sesión; rechaza solicitudes no autorizadas.
* `PUT /update` (auth): actualiza campos de perfil permitidos y contraseña si se
  suministra; evita colisiones de correo.

### `routes/routes.js` (en `/api/routes`)

`GET /` lista rutas propias o asignadas; `POST /` crea una ruta y sus opciones;
`GET /:id` devuelve ruta y paradas; `PUT /:id` edita metadatos; `DELETE /:id`
elimina una ruta propia. `POST /:id/stops` añade paradas, `POST /:id/reorder`
persiste el orden, `POST /:id/optimize` llama a `optimizeRouteOrder`,
`POST /:id/start` inicia una ruta y `POST /:id/complete` la finaliza y guarda
historial. `POST /:id/import-text` usa `AddressExtractorService` para convertir
texto en paradas. Los handlers rechazan IDs inexistentes, rutas ajenas y
transiciones inválidas.

### `routes/stops.js` (en `/api/stops`)

`PUT /:id` edita dirección, orden, notas, tiempos, cliente y datos de cobro;
`DELETE /:id` elimina una parada autorizada; `POST /:id/complete` registra
entrega (y evidencia cuando la lógica lo exige); `POST /:id/fail` registra
fallo y motivo. Propiedad de ruta, estado y existencia se validan antes de
escribir.

### `routes/history.js` (en `/api/history`)

`GET /` lista historiales del usuario (con filtro/paginación implementados);
`GET /:id` obtiene un historial y su `route_data`. Devuelve 404 si no pertenece
al usuario.

### `routes/admin.js` (en `/api/admin`, todo `requireAdmin`)

`GET /stats` cuenta usuarios/rutas/pedidos; `GET /users` lista usuarios;
`GET /users/:id` obtiene detalle; `PUT /users/:id` edita perfil permitido;
`PUT /users/:id/role` cambia rol; `PUT /users/:id/toggle-active` activa/desactiva;
`DELETE /users/:id` elimina usuario. `GET /logs` filtra logs y
`DELETE /logs` limpia; `GET /logs/stats` devuelve metadatos; `GET
/logs/download/:type` descarga contenido; `GET /logs/archives` lista archivos;
`GET /logs/archives/:filename` descarga un archivo validado. `DELETE
/dispatch/reset` ejecuta el reinicio de despacho. `GET /dispatch/export-count`
calcula filas y `GET /dispatch/export` genera exportación. Errores de IDs,
archivos inexistentes o intentos de borrar el usuario protegido producen
respuestas explícitas.

### `routes/wholesale.js` (en `/api/wholesale`, todo `requireAdmin`)

`GET /` lista clientes mayoristas; `POST /` crea; `PUT /:id` edita; `DELETE
/:id` desactiva/elimina; `POST /:id/dispatch-now` crea/actualiza la orden de
despacho para el cliente. Valida dirección/contacto y devuelve 404 para cliente
inexistente.

### `routes/email.js` (en `/api/email`)

`GET /verify` (admin) prueba conexión; `POST /send` (admin) envía correo;
`GET /pickup-ready` (auth) lista pedidos detectados; `POST
/pickup-ready/refresh`, `/sync` y `/diagnose` (admin) refrescan, sincronizan o
diagnostican el buzón. Los fallos de credenciales/proveedor se devuelven sin
exponer secretos.

### `routes/aiLearning.js` (en `/api/ai-learning`)

`GET /customers`, `GET /customers/:contactId`, `POST
/:contactId/refresh`, `PUT /customers/:contactId`, `DELETE
/:contactId` gestionan perfiles propios mediante `CustomerProfileService`.
`GET /style`, `POST /style/refresh` y `PUT /style` leen, recalculan o actualizan
`AgentStyleProfile`. La autorización es por `req.userId`; los servicios
externos pueden producir 503/500.

### `routes/botMemory.js` (en `/api/bot-memory`)

`GET /`, `/pending`, `/stats` consultan memorias; `POST /analyze-history`
analiza históricos; `POST /`, `PUT /:id`, `DELETE /:id` crean, editan y borran
memorias propias. `GET /knowledge`, `POST /knowledge`, `POST
/knowledge/upload` (multipart `file`), `PUT /knowledge/:id` y `DELETE
/knowledge/:id` gestionan conocimiento. Los endpoints exigen usuario,
validan contenido/tipo y no permiten acceder a registros de otra cuenta.

### `routes/messaging.js` (en `/api/messaging`)

Configuración: `GET /settings`; `PUT /settings` (admin); `POST
/settings/test-connection`, `/test-openai`, `/reset-test`.
Pedidos: `GET /orders`, `GET /orders/:id`, `POST /orders`, `PUT
/orders/:id`, `POST /orders/:id/confirm`, `/cancel`, `/complete`,
`DELETE /orders/:id`, `POST /orders/revalidate`, `POST
/orders/:id/send-message`.
Cobertura y dirección: `GET/POST /coverage-zones`, `POST
/coverage-zones/bulk`, `PUT/DELETE /coverage-zones/:id`, `POST
/geocode-address`, `POST /validate-zip`, `POST /validate-address`.
El validador público expone `GET /public/validator/options`, `POST
/public/validate-zip` y `GET /public/validator/history` con el rate limiter
local; `runPublicZipValidation`, `normalizePublicContact` y
`persistPublicValidation` normalizan, validan y guardan `ZipValidation`.
`POST /webhook` recibe eventos externos y responde rápidamente.
Consulta/polling: `GET /stats`, `GET/POST /polling/status|start|stop|sync`,
`GET /contacts`, `GET /contacts/:contactId/messages`, `GET
/chatbot/states`, `GET /chatbot/state/:contactId`, y `POST
/chatbot/pause|resume|reset/:contactId`.
Agentes: `GET/POST /agents`, `PUT/DELETE /agents/:id`, `GET
/agents/by-service/:serviceName` y `/by-product/:productName`.
Los handlers delegan en `PollingService`, `ChatbotService`, geocodificación,
validación y `RespondApiService`; exigen pertenencia y reportan errores externos
sin incluir tokens.

### `routes/dispatch.js` (en `/api/dispatch`)

Este archivo contiene el flujo completo de despacho. Endpoints y efecto:

* `GET /orders`, `/stats`, `/orders/delivered`: listados y métricas (los dos
  últimos son admin); `PUT /orders/:id/status`, `/notes`, `/billing` actualiza
  ciclo, notas o cobro.
* `GET /geocode-address` y `PUT /stops/:id/address` geocodifican y corrigen
  paradas.
* `POST /orders`, `PUT /orders/:id/edit`, `POST /orders/:id/refresh`, `DELETE
  /orders/:id` crean, editan, refrescan o borran pedidos validados.
* `GET /accounting`, `/deliveries-report`, `/deliveries-by-route` y `POST
  /deliveries-report/archive-month` generan contabilidad/reportes y archivan el
  mes solicitado.
* `PUT /orders/bulk-status` aplica una transición a varios pedidos.
* `POST /routes`, `DELETE /routes/:id`, `DELETE /routes/:id/stops/:stopId`,
  `POST /routes/:id/orders` crean rutas, quitan rutas/paradas y agregan órdenes.
* `GET/POST /routes/:id/respond-pickup-orders` consulta/asigna órdenes de
  recogida; `POST /routes/:id/return-orders` registra devoluciones.
* `PUT /drivers/global-commission`, `GET /drivers`, `GET /respond-users` y
  `POST /sync-drivers` gestionan comisiones y sincronización de conductores.
* `GET /routes`, `GET /routes/payment-status`, `POST /routes/:id/optimize`,
  `PUT /routes/:id/assign` consultan, optimizan y asignan rutas.
* `POST /stops/:id/evidence` recibe multipart `photo` y guarda evidencia;
  `PUT /stops/:id/skip`, `GET /returns`, `PUT /returns/:id/receive`,
  `/release` y `PUT /stops/:id/restore` gestionan saltos, devoluciones y
  restauración.
* `GET /pickup/pending`, `POST /pickup/:routeId/confirm-stops`, `GET
  /pickup/history`, `POST /pickup/:routeId/admin-confirm` y
  `/driver-confirm` gestionan confirmación de recogida.
* `PUT /routes/:id/complete`, `/deliver-payment`, `/admin-confirm-payment`
  finalizan ruta y liquidación; `GET /routes/:id/detail`,
  `/export-excel`, `/routes/history`, `/my-accounting`,
  `/my-completed-routes` consultan detalle, exportaciones e historial.
* `PUT /orders/:id/delivered` marca entrega; `GET /templates` devuelve plantillas;
  `GET /favorites`, `POST /favorites`, `DELETE /favorites/:id` gestionan
  direcciones favoritas.
* `GET /lifecycle-audit`, `POST /lifecycle-resync` auditan/reconcilian estados;
  `POST /cleanup-duplicates` elimina duplicados conforme a las reglas del
  archivo; `POST /bot/initiate-closing/:contactId` inicia el cierre conversacional.

Los permisos son explícitos: admin para contabilidad, borrados y cambios
globales; admin o recepcionista para operaciones de recepción; auth para
operaciones del conductor/propietario. Los handlers comprueban estados de
recogida, entrega, devolución y pago, impiden transiciones incompatibles,
validan rutas/conductores y devuelven 400/403/404/409 antes de efectos parciales.

Helpers locales de `dispatch.js`: `isCashMethod`, `isCompletedStop`,
`getGlobalMessagingSettings`, `routeHasActivity`, `routeHasDeliveryActivity`,
`stopIsFinanciallyTouched`, `addressStreetNumber`,
`geocodedStreetNumberMatches`, `unwrapRespondContact`, `respondContactId`,
`respondContactName`, `respondContactPhone`, `respondContactEmail`,
`respondCustomFields`, `respondFieldValue`, `respondContactAddress`,
`respondLifecycleName`, `isPickupEligibleContact`, `matchStopOrder`,
`rememberPreDeliveryStatus`, `moveOrderToDelivery`, `restorePreDeliveryStatus`,
`restoreReturnedToOfficeStatus`, `createReceptionRespondContext` y
`assignOrderBackToReception`. También define el almacenamiento Multer,
`VALID_ORDER_STATUSES`, `ADMIN_STATUSES`, `DRIVER_STATUSES`,
`VALID_TRANSITIONS` y `RESTORABLE_ORDER_STATUSES`; juntos normalizan contactos,
validan transiciones, asocian órdenes a paradas y protegen datos financieros.
Los helpers locales de `messaging.js` son `publicZipRateLimit`,
`isAdminUser`, `getSettingsForUser`, `publicZoneFields`,
`runPublicZipValidation`, `normalizePublicContact` y
`persistPublicValidation`; aplican límite público, seleccionan configuración,
normalizan el formulario y persisten el resultado. `admin.js` añade
`buildExportWhere` y sus tablas de etiquetas/columnas para exportación.

## Servicios

* **addressExtractorService.js** (`AddressExtractorService`): constructor;
  `extractGoogleMapsLink`, `isConversationalMessage`, `hasAddressWithCity`,
  `_normalizeUnitPrefix`, `extractAddressFromMessage`,
  `extractAddressFromMessageSlices`, `isSameAddressReference`,
  `extractAddressFromWholesaleMessage`, `extractAddressFromWholesaleConversation`,
  `isBusinessOwnAddress`, `extractAddressFromConversation`, `cleanAddress`,
  `validateAddressFormat`, `extractZipFromAddress`,
  `extractFullAddressComponents`. Son parsers puros/heurísticos que devuelven
  dirección, componentes o `null`.
* **addressValidation.js** (`AddressValidationService(userId)`):
  `extractZipCode`, `extractCityName`, `isZipCodeMessage`, `isCityMessage`,
  `detectAddressType`, `hasApartmentNumber`, `isLikelyAddress` son clasificadores;
  `findZoneByCity`, `checkCoverage`, `validateZipOrCity` y `validateAddress`
  consultan `CoverageZone`/geocodificación y devuelven resultados de cobertura.
* **geocodingService.js** (`GeocodingService`): `hasUsableStreetAddress`
  valida componentes; `geocodeAddress`, `reverseGeocode`,
  `resolveGoogleMapsLink`, `parseAddressComponents`, `buildCleanAddress` y
  `addToCache` normalizan resultados, cachean éxitos/errores y devuelven error
  explícito si falta el servicio.
* **optimization.js**: `haversineDistance`, `getDistanceMatrix`,
  `buildDistanceTable` son auxiliares; `optimizeRouteOrder(stops,startLocation,
  returnToStart)` calcula orden/distancia/duración; `calculateEtas(stops,startTime)`
  agrega ETA acumulado.
* **respondApiService.js** (`RespondApiService`, exporta singleton): `sleep`;
  constructor, `setContext`, `getToken`, `clearTokenCache`, `throttle`,
  `request`, todos los métodos de mensajes/contactos/canales/usuarios/campos/
  plantillas/tags (`sendMessage`, `getMessage`, `listMessages`,
  `sendAttachment`, `sendQuickReply`, `sendCustomPayload`,
  `sendWhatsAppTemplate`, `sendEmail`, `sendRawMessage`, CRUD de contacto,
  `mergeContacts`, canales, tags, asignación, estados, ciclo de vida,
  comentarios, listados y operaciones de campos/tags), `testConnection`,
  `findUserByEmail`, `findUserByName`. Centraliza token por usuario, throttle,
  HTTP y normalización de errores.
* **respondio.js** (`RespondioService`): constructor, `sleep`,
  `throttle`, `isCloudFrontBlock`, `requestWithRetry`, envío de mensajes,
  listados/estado de conversaciones, ciclo de vida, contacto, campos,
  mensajes, usuarios y `testConnection`. Es el cliente legado instanciable.
* **chatbotService.js** (`ChatbotService`): construye menús (`getCardPackages`,
  `buildPackageMenuText`, `buildPackageInfoText`, `generateProductMenu`,
  `getProductInfoMessage`), envía/asigna (`sendMessage`, `sendAttachmentMsg`,
  `assignToAgent`, `addTrackingTag`, `addComment`), horario y exclusiones
  (`getBusinessHoursText`, `getHandoffText`, `isWithinBusinessHours`,
  `hasExcludedTag`), estados (`isConversationAbandoned`, `shouldBotRespond`,
  `isConversationReopened`, `hasAgentAlreadyResponded`, `hasBotAlreadyInteracted`,
  `getOrCreateConversationState`, `updateConversationState`, pausa/reanudación/
  reset, `markAgentActive`, `markAgentInactive`), parsing/fuzzy matching
  (`parseYesNoResponse`, `levenshteinDistance`, `sharedLetterRatio`,
  `isSimilar`, `sanitizeCustomerName`, `parseProductSelection`), detección de
  intención/campañas (`detectMessageIntent`, `extractAdProductHint`,
  `_parseCampaignFromText`, `extractAdInfo`, `getAdCampaignParams`,
  `detectFacebookAdOrigin`, `detectFrustration`) y los handlers
  `handleInitialState`, `handleDirectOrderRequest`, `handleAwaitingPriorInfo`,
  `handleAwaitingProductSelection`, `handleAwaitingDesignInfo`,
  `parseDesignResponse`, `handleAwaitingZip`, `handleZipValidation`,
  `handleAwaitingZipNoInfo`, `handleAwaitingProductNoInfo`,
  `handleAwaitingProductResponse`, `handleImageMessage`,
  `handleAwaitingProduct`, `handleAwaitingContinuation`,
  `handleConversational`, `startClosingFlow`, `isClosingCorrection`,
  `handleClosingApproval`, `handleClosingQuantity`, `handleClosingAddress`,
  `findZelleInHistory`, `handleClosingDepositVerification` y `processMessage`.
  La asignación y pedidos usan `assignToDefaultAgent`, `findAgentForProduct` y
  `createOrUpdateOrder`.
  Sus efectos son mensajes externos, `ConversationState`, `MessageLog`,
  `MessagingOrder` y asignación de agentes; devuelve fallback configurado ante
  errores de IA.
* **aiService.js** (`AIService`): `openaiQuotaState`; carga/invalida memoria y
  conocimiento, transcribe audio, analiza/describe imágenes, lista productos,
  construye prompts (`getSystemPrompt`, `_renderStyleSection`,
  `_renderCustomerSection`), `callOpenAI`, `parseJsonFromResponse` y métodos de
  clasificación/extracción/detección/generación (`classifyYesNo`,
  `extractLocationFromMessage`, `extractAddressFromMessages`,
  `extractAddressFromWholesaleMessages`, `detectFrustration`,
  `extractProductSelection`, `analyzeIntent`, `evaluateAgentIntervention`,
  `generateContextualResponse`, `generateFlowMessage`,
  `analyzeClosingContext`, `generateConversationalReply`, `analyzeAgentStyle`,
  `summarizeCustomer`, `testConnection`). Controla cuota y nunca debe registrar
  claves.
* **pollingService.js** (`PollingService`, singleton): auxiliares
  `contactIsWholesale`, `getGlobalSettings`, `getSystemUserId`; administra
  `startPolling`, `stopPolling`, `getPollingStatus`, `getAnyActivePollingStatus`,
  `stopAllPolling`, y ciclos de mensajes/direcciones/seguimiento mediante
  `pollForNewMessages`, `checkFollowups`, `processContactMessages`,
  `initializeConversationSnapshot`, `processIncomingMessage`,
  `runAddressScanCycle`, `scanAddressesInConversations`, `syncContactNames`,
  `syncClosedConversationLifecycles`. También expone auxiliares de ciclo de vida
  (`detectCloseReopenInMessages`, `statusCanAdvance`, `buildReactivationFields`,
  `lifecycleToOrderStatus`) y mantenimiento (`cleanupDuplicateAddresses`,
  `cleanupDeliveredOrders`, `archiveDeliveredOrders`,
  `archiveUpsShippedOrders`, `archiveExcludedLifecycleOrders`,
  `fetchAllActiveLifecycleContacts`, `reconcileLifecyclesOnStartup`,
  `saveValidatedAddress`, `autoRegisterWholesaleClients`,
  `updateWholesaleClientAddress`, `checkBotReactivationFields`,
  `assignContactToReception`, `markAgentActivity`, `logOutgoingMessage`).
* **gmailReadService.js**: auxiliares OAuth/parsing (`getOAuth2Client`,
  `extractClientNameFromSubject`, `extractClientNameFromBody`,
  `decodeBase64Url`, `extractTextFromPayload`), `GmailScopeError`,
  `getPickupReadyOrders` y `clearPickupCache`; lee correos, extrae pedidos y
  comunica errores de alcance/autorización sin secretos.
* **gmailService.js**: `createTransporter`, `sendEmail`,
  `verifyGmailConnection`; crea transporte y envía/verifica correo.
* **gmailSyncService.js**: normalización y similitud (`normalizeForMatch`,
  `stripPrefixLabel`, `stripGenericSuffixes`, `namesMatch`,
  `isWholesaleName`, `nameSimilarity`, `topCandidatesByName`), acceso IA
  (`getOpenAIKey`, `aiNameMatch`), estados (`ALREADY_PROCESSED_STATUSES`,
  `hasProcessedPickupEmail`, `isPickupEmailStaleForOrder`), sincronización
  (`runPickupReadySync`, `startGmailSyncScheduler`, `stopScheduler`) y
  `GmailScopeError`; auxiliares privados incluyen fonética, tokens, caché y
  disponibilidad de credenciales.
* **customerProfileService.js** (`CustomerProfileService`): carga/crea,
  actualiza y elimina perfiles, resume conversaciones y mantiene contadores.
* **styleLearningService.js** (`StyleLearningService`): analiza mensajes de
  agentes, actualiza `AgentStyleProfile` y programa ejecuciones periódicas.
* **deliveryCompletionService.js**: `findOrderForStop` localiza la orden de una
  parada; `markOrderDelivered` actualiza entrega y fecha, usando la transacción/
  historial implementados.
* **logService.js** (`LogBuffer`): captura consola (`_intercept`, `_capture`),
  escribe/rota (`_writeToFile`, `_isImportant`, `_cleanOldEntries`,
  `_trimFile`, `_dailyArchive`, `_cleanOldArchives`), formatea/detecta fuente,
  consulta (`getLogs`, `getFileStats`, `getArchiveFiles`, `getArchiveContent`),
  descarga (`getDownloadFileName`, `getFileContent`) y `clear`. El efecto es
  archivo local y buffer; errores de archivo se manejan sin ocultar consultas.
* **openaiQuotaAlertService.js**: `isOpenAIQuotaError`, `notifyOpenAIQuotaExhausted`,
  `markOpenAIQuotaRestored` y `escapeHtml` interno. Notifica por correo y evita
  duplicar alertas durante una misma incidencia.
* **socketService.js**: `setIo`, `emitToDriver`, `emitToAdmins`, `emitToAll`;
  guarda la instancia Socket.IO y emite a salas/usuarios, sin efecto si no hay
  instancia configurada.

## Utilidades

* `utils/deliveryHistory.js`: `saveToDeliveryHistory(order)` copia los campos
  contables/cliente/conductor de una orden entregada a `DeliveryHistory`.
* `utils/routeLifecycleProtection.js`:
  `shouldProtectAssignedRoute(order, incomingOrderStatus)` devuelve si una orden
  asignada a ruta debe quedar protegida frente a la transición solicitada.

## Dependencias y efectos por archivo

`index.js` depende de Express, sesión, CORS, Sequelize, routers, middleware y
servicios de inicio. Configuración depende de Sequelize y variables de entorno.
Middleware depende de `User`/`UserToken`. Modelos dependen de la instancia
Sequelize. Rutas dependen de modelos, middleware y servicios indicados arriba.
Servicios de dirección/geocodificación dependen de APIs externas y zonas;
servicios de mensajería dependen de los clientes de mensajería y de modelos;
IA depende del proveedor configurado, memorias/conocimiento/perfiles; polling
coordina casi todo el subsistema de mensajería; Gmail depende de OAuth/SMTP.
Los efectos observables son escrituras PostgreSQL, archivos de evidencia/log/
archivos de correo, mensajes externos, tareas temporizadas y eventos socket.

## Checklist de cobertura por archivo

- [x] `src/index.js`
- [x] `src/config/database.js`
- [x] `src/middleware/auth.js`
- [x] `src/models/AgentStyleProfile.js`, `BotKnowledge.js`, `BotMemory.js`
- [x] `src/models/ConversationState.js`, `CoverageZone.js`, `CustomerProfile.js`
- [x] `src/models/DeliveryHistory.js`, `FavoriteAddress.js`, `MessageLog.js`
- [x] `src/models/MessagingOrder.js`, `MessagingSettings.js`, `RouteHistory.js`
- [x] `src/models/Route.js`, `ServiceAgent.js`, `Stop.js`
- [x] `src/models/User.js`, `UserToken.js`, `ValidatedAddress.js`
- [x] `src/models/WholesaleClient.js`, `ZipValidation.js`, `index.js`
- [x] `src/routes/admin.js`, `aiLearning.js`, `auth.js`, `botMemory.js`
- [x] `src/routes/dispatch.js`, `email.js`, `history.js`, `messaging.js`
- [x] `src/routes/routes.js`, `stops.js`, `wholesale.js`
- [x] `src/services/addressExtractorService.js`, `addressValidation.js`
- [x] `src/services/aiService.js`, `chatbotService.js`
- [x] `src/services/customerProfileService.js`, `deliveryCompletionService.js`
- [x] `src/services/geocodingService.js`, `gmailReadService.js`, `gmailService.js`
- [x] `src/services/gmailSyncService.js`, `logService.js`
- [x] `src/services/openaiQuotaAlertService.js`, `optimization.js`
- [x] `src/services/pollingService.js`, `respondApiService.js`, `respondio.js`
- [x] `src/services/socketService.js`, `styleLearningService.js`
- [x] `src/utils/deliveryHistory.js`, `src/utils/routeLifecycleProtection.js`

## Inventario nominal de helpers y métodos (auditoría ampliada)

Esta sección enumera también callables privados y callbacks con nombre que no
son exportados. Los callbacks anónimos de Express ya están identificados por
su método y endpoint en la sección de rutas; los callbacks `map`/`filter` sin
nombre no constituyen funciones nombradas del código.

### Entrada, autenticación y rutas

* `startServer()` (`index.js`) inicializa base de datos, tablas y escucha HTTP;
  devuelve una promesa de arranque y registra/falla ante errores de conexión.
* `resolveUserId(req)` (`middleware/auth.js`) resuelve sesión o Bearer token;
  devuelve el ID o `null`. `isAllowedReceptionistApi(req)` compara método/ruta
  con la lista permitida y devuelve booleano.
* `buildExportWhere(req)` (`routes/admin.js`) convierte filtros de query en
  cláusulas Sequelize validadas y devuelve `{where, attributes}`.
* En `routes/dispatch.js`, `isCashMethod(m)` devuelve booleano, `isCompletedStop`
  comprueba estado, `getGlobalMessagingSettings()` devuelve configuración
  global, `routeHasActivity(route, stops)` y `routeHasDeliveryActivity` devuelven
  booleanos para proteger rutas, y `stopIsFinanciallyTouched(stop)` identifica
  efectos contables. `addressStreetNumber(address)` extrae número de calle y
  `geocodedStreetNumberMatches(rawAddress, geocodedResult)` compara direcciones.
  `unwrapRespondContact`, `respondContactId`, `respondContactName`,
  `respondContactPhone`, `respondContactEmail`, `respondCustomFields`,
  `respondFieldValue`, `respondContactAddress` y `respondLifecycleName`
  normalizan campos de un contacto externo y devuelven valores o `null`.
  `isPickupEligibleContact(contact)` decide elegibilidad y `matchStopOrder`
  devuelve la primera orden no usada compatible. `rememberPreDeliveryStatus`,
  `moveOrderToDelivery`, `restorePreDeliveryStatus` y
  `restoreReturnedToOfficeStatus` mutan estados previos de una orden.
  `createReceptionRespondContext()` crea contexto vacío y
  `assignOrderBackToReception(order, context)` actualiza asignación externa;
  ambos pueden producir errores de persistencia/API.
* Los callbacks `storage.destination(req,file,cb)` de Multer generan la ruta
  de evidencia, `storage.filename(req,file,cb)` genera el nombre seguro del
  archivo y `fileFilter(req,file,cb)` acepta el tipo configurado; los callbacks
  reciben un error cuando el archivo no es válido.
* `runPublicZipValidation(rawInput)` devuelve resultado de ZIP/ciudad y zona;
  `normalizePublicContact(body)` devuelve contacto sanitizado;
  `persistPublicValidation(result,body,req)` crea `ZipValidation`. En
  `messaging.js`, `publicZoneFields(zone)` selecciona campos públicos y
  `escapeLike(value)` escapa `\`, `%` y `_` para búsquedas LIKE.
* `monthOf(dt)` (`dispatch.js`) devuelve `YYYY-MM` para contabilidad;
  `resolveDriverAssignee(tenantUserId)` resuelve el conductor externo de una
  orden; `statusLabel(s)` transforma estados de parada a etiquetas españolas.

### AI y chatbot

* `AIService.loadActiveMemories(userId)` y `loadKnowledge(userId)` consultan
  memorias/conocimiento activos y devuelven arrays; `invalidateMemoryCache()`
  limpia caché. `transcribeAudio(audioUrl, respondToken)` transcribe audio;
  `analyzeImageForSales(imageUrl)` y `describeImage(imageUrl)` analizan imagen
  y devuelven texto/estructura. Fallos de proveedor devuelven el resultado de
  error del servicio y activan el control de cuota.
* `getProductsList()` obtiene productos de settings; `getSystemPrompt(memories,
  knowledge, extras)` arma prompt; `_renderStyleSection(style)` y
  `_renderCustomerSection(profile)` renderizan contexto. `callOpenAI(messages,
  maxTokens, model)` ejecuta solicitud y devuelve `{success,...}`;
  `parseJsonFromResponse(content)` parsea JSON tolerando envolturas.
  `classifyYesNo`, `extractLocationFromMessage`,
  `extractAddressFromMessages`, `extractAddressFromWholesaleMessages`,
  `detectFrustration`, `extractProductSelection`, `analyzeIntent`,
  `evaluateAgentIntervention`, `generateContextualResponse`,
  `generateFlowMessage`, `analyzeClosingContext`,
  `generateConversationalReply`, `analyzeAgentStyle` y `summarizeCustomer`
  son callables asíncronos de clasificación/generación y devuelven datos
  estructurados o texto; `testConnection()` devuelve estado de disponibilidad.
* En `ChatbotService`, `getCardPackages`, `buildPackageMenuText`,
  `buildPackageInfoText`, `getMessages`, `getBusinessHoursText`,
  `getHandoffText`, `getProductInfoMessage`, `getBusinessTypeKeyword`,
  `getBusinessLabel` y `generateProductMenu` son helpers puros de texto/config.
  `sendMessage`, `sendAttachmentMsg`, `assignToAgent`, `addTrackingTag` y
  `addComment` producen efectos en el proveedor externo y devuelven su
  respuesta; los errores se convierten al fallback del flujo.
  `getAIMsg(intent, params, fallbackMsg)` solicita un texto adaptado a la capa
  de IA y devuelve `fallbackMsg` cuando la generación no está disponible o
  falla, de modo que el flujo conversacional pueda continuar.
  `isWithinBusinessHours`, `hasExcludedTag`, `isConversationAbandoned`,
  `shouldBotRespond`, `isConversationReopened`, `hasAgentAlreadyResponded`,
  `hasBotAlreadyInteracted` y `checkIfExistingCustomer` devuelven decisiones
  booleanas consultando configuración/estado. `getOrCreateConversationState`
  carga o crea `ConversationState`; `updateConversationState` persiste cambios.
  `parseYesNoResponse`, `levenshteinDistance`, `sharedLetterRatio`, `isSimilar`,
  `sanitizeCustomerName`, `parseProductSelection`, `parseDesignResponse`,
  `detectMessageIntent`, `detectFrustration`, `extractAdProductHint`,
  `_parseCampaignFromText`, `extractAdInfo`, `getAdCampaignParams`,
  `detectFacebookAdOrigin` y `isClosingCorrection` normalizan o clasifican
  texto y devuelven valor nullable/booleano.
* `processMessage` despacha el estado conversacional. Sus handlers
  `handleInitialState`, `handleDirectOrderRequest`, `handleAwaitingPriorInfo`,
  `handleAwaitingProductSelection`, `handleAwaitingDesignInfo`,
  `handleAwaitingZip`, `handleZipValidation`, `handleAwaitingZipNoInfo`,
  `handleAwaitingProductNoInfo`, `handleAwaitingProductResponse`,
  `handleImageMessage`, `handleAwaitingProduct`, `handleAwaitingContinuation`,
  `handleConversational`, `handleClosingApproval`, `handleClosingQuantity`,
  `handleClosingAddress` y `handleClosingDepositVerification` actualizan
  estado, envían respuestas y devuelven el resultado del flujo. `assignToDefaultAgent`,
  `findAgentForProduct`, `startClosingFlow`, `findZelleInHistory`,
  `createOrUpdateOrder`, `pauseBot`, `resumeBot`, `resetConversation`,
  `markAgentActive` y `markAgentInactive` asignan, persisten pedidos/estado o
  cambian pausa/agente; devuelven objeto de resultado y errores explícitos.

### Direcciones, geocodificación, optimización y correo

* `AddressExtractorService` incluye `extractGoogleMapsLink`,
  `isConversationalMessage`, `hasAddressWithCity`, `_normalizeUnitPrefix`,
  `extractAddressFromMessage`, `extractAddressFromMessageSlices`,
  `isSameAddressReference`, `extractAddressFromWholesaleMessage`,
  `extractAddressFromWholesaleConversation`, `isBusinessOwnAddress`,
  `extractAddressFromConversation`, `cleanAddress`, `validateAddressFormat`,
  `extractZipFromAddress` y `extractFullAddressComponents`; reciben texto o
  mensajes y devuelven dirección/componentes o `null`, sin efectos externos.
  Sus callbacks locales `tsOf(msg)` extraen timestamp para ordenar mensajes.
* `AddressValidationService` incluye `extractZipCode`, `extractCityName`,
  `isZipCodeMessage`, `isCityMessage`, `detectAddressType`,
  `hasApartmentNumber` e `isLikelyAddress` (valores puros), además de
  `findZoneByCity`, `validateZipOrCity`, `checkCoverage` y `validateAddress`
  (consultas de zona/geocodificación, resultados de validación y errores).
* `hasUsableStreetAddress(result)` (`geocodingService.js`) comprueba componentes
  mínimos. Su helper local `hasType(type)` devuelve si algún componente incluye
  el tipo solicitado. `geocodeAddress(rawAddress)`, `reverseGeocode(lat,lng)` y
  `resolveGoogleMapsLink(url)` llaman al proveedor y devuelven resultado
  normalizado; `parseAddressComponents`, `buildCleanAddress` son transformadores
  puros; `addToCache(key,result,isError)` escribe caché con TTL y marca errores.
* `haversineDistance`, `getDistanceMatrix` y `buildDistanceTable` calculan
  distancia/tabla (la segunda puede llamar mapas); `optimizeRouteOrder` devuelve
  orden optimizado y métricas; `calculateEtas` devuelve paradas con ETA.
* `getOAuth2Client`, `extractClientNameFromSubject`, `extractClientNameFromBody`,
  `decodeBase64Url` y `extractTextFromPayload` (`gmailReadService.js`) crean
  cliente o parsean correo; `getPickupReadyOrders` consulta mensajes y
  `clearPickupCache` limpia caché. `createTransporter`, `sendEmail` y
  `verifyGmailConnection` (`gmailService.js`) crean transporte, envían o
  verifican; devuelven error de proveedor sin credenciales.
* En `gmailSyncService.js`, `normalizeForMatch`, `stripPrefixLabel`,
  `stripGenericSuffixes`, `spanishPhonetic`, `singularizeWord`,
  `singularizeName`, `tokensOf`, `isDistinctiveToken`, `namesMatch`,
  `isWholesaleName`, `nameSimilarity` y `topCandidatesByName` normalizan y
  comparan nombres. `aiCacheKey` crea clave de caché; `getOpenAIKey` lee la
  configuración sin devolverla en respuestas; `aiNameMatch` devuelve
  coincidencia IA. `hasProcessedPickupEmail` e
  `isPickupEmailStaleForOrder` devuelven booleano; `runPickupReadySync` realiza
  sincronización y escritura de pedidos; `gmailCredentialsAvailable` devuelve
  booleano; `runScheduledSync` ejecuta una pasada; `startGmailSyncScheduler`
  instala temporizadores y `stopScheduler` los cancela. `GmailScopeError`
  representa alcance insuficiente.

### Polling, API externa, logs y sockets

* `contactIsWholesale(name)` devuelve booleano; `getGlobalSettings()` y
  `getSystemUserId()` consultan configuración/usuario de sistema.
  `PollingService.assignContactToReception`, `_shouldRunAddressAI`,
  `getRespondioInstance`, `startPolling`, `stopPolling`, `getPollingStatus`,
  `getAnyActivePollingStatus` y `stopAllPolling` gestionan instancias y
  temporizadores; los tres métodos de estado devuelven estado serializable.
  `pollForNewMessages`, `checkFollowups`, `processContactMessages`,
  `initializeConversationSnapshot`, `preloadContactMessages`,
  `detectConversationStateChanges`,
  `markAgentActivity`, `prescanSkippedForZip`, `processIncomingMessage`,
  `extractAndSaveAddressFromMessages`, `logOutgoingMessage`,
  `runAddressScanCycle`, `syncContactNames`, `scanAddressesInConversations`,
  `syncClosedConversationLifecycles`, `archiveUpsShippedOrders`,
  `archiveExcludedLifecycleOrders`, `fetchAllActiveLifecycleContacts`,
  `reconcileLifecyclesOnStartup` y `checkBotReactivationFields` son bucles/
  operaciones asíncronas que consultan APIs y escriben modelos.
  `preloadContactMessages(userId, contactId)` carga anticipadamente el historial
  normalizado de un contacto para reducir lecturas repetidas durante el ciclo.
  `detectCloseReopenInMessages`, `statusCanAdvance`, `buildReactivationFields`
  y `lifecycleToOrderStatus` son transformadores/guardas de ciclo de vida.
  `cleanupDuplicateAddresses`, `cleanupDeliveredOrders`,
  `archiveDeliveredOrders`, `saveValidatedAddress`,
  `autoRegisterWholesaleClients` y `updateWholesaleClientAddress` realizan
  limpieza, archivado y persistencia. `tsOf(m)` en el escaneo devuelve epoch
  para seleccionar el mensaje más reciente. Los errores de polling se registran
  y no exponen tokens.
* `sleep(ms)` en ambos clientes externos devuelve una promesa de espera.
  `RespondApiService` define explícitamente `constructor`, `setContext`,
  `getToken`, `clearTokenCache`, `throttle`, `request`, `sendMessage`,
  `getMessage`, `listMessages`, `sendAttachment`, `sendQuickReply`,
  `sendCustomPayload`, `sendWhatsAppTemplate`, `sendEmail`, `sendRawMessage`,
  `createContact`, `updateContact`, `createOrUpdateContact`, `deleteContact`,
  `getContact`, `listContacts`, `mergeContacts`, `listContactChannels`,
  `addTags`, `removeTags`, `assignConversation`, `unassignConversation`,
  `setConversationStatus`, `openConversation`, `closeConversation`,
  `updateLifecycle`, `addComment`, `listUsers`, `getUser`, `listChannels`,
  `listCustomFields`, `getCustomField`, `createCustomField`,
  `listClosingNotes`, `listMessageTemplates`, `createSpaceTag`,
  `updateSpaceTag`, `deleteSpaceTag`, `testConnection`, `findUserByEmail` y
  `findUserByName`. Reciben identificadores/datos de API, devuelven JSON
  normalizado o `null`, aplican throttle/reintentos y lanzan/propagan errores
  HTTP sin incluir el token.
* `RespondioService` define `constructor`, `throttle`, `isCloudFrontBlock`,
  `requestWithRetry`, `sendMessage`, `listContacts`,
  `listOpenConversations`, `listClosedConversations`, `getConversationStatus`,
  `listContactsByLifecycle`, `listContactsByLifecycleValue`, `getContact`,
  `updateContactCustomFields`, `listMessages`, `getMessage`, `testConnection`
  y `listUsers`. Son equivalentes del cliente legado: devuelven datos de API,
  reintentan errores transitorios y clasifican bloqueos; los errores no se
  silencian.
* `formatDate(date)` (`logService.js`) formatea fecha; `LogBuffer` define
  `constructor`, `_intercept`, `_capture`, `_writeToFile`, `_isImportant`,
  `_cleanOldEntries`, `_trimFile`, `_dailyArchive`, `_cleanOldArchives`,
  `_formatLogFile`, `_detectSource`, `getLogs`, `getDownloadFileName`,
  `getFileContent`, `getFileStats`, `getArchiveFiles`, `getArchiveContent` y
  `clear`. Los privados capturan/rotan/formatean archivos; los públicos
  devuelven logs, estadísticas o contenido y `clear` borra el buffer/archivo.
* `isOpenAIQuotaError`, `escapeHtml`, `notifyOpenAIQuotaExhausted` y
  `markOpenAIQuotaRestored` clasifican cuota, escapan texto, envían alerta y
  restablecen bandera; `setIo`, `emitToDriver`, `emitToAdmins` y `emitToAll`
  configuran/emiten eventos Socket.IO y devuelven el resultado del emisor.

### Callables locales adicionales

El inventario siguiente cubre los arrow helpers nombrados dentro de handlers y
bucles, incluidos los que sólo viven durante una solicitud:

* `applyRegularMatch(value, pattern)` intenta una coincidencia regular y
  devuelve el grupo normalizado; `fmt(value)` formatea una celda de salida.
* `parseBilling(value)` y `parseBillingVal(value)` convierten campos de coste/
  depósito a números seguros; `normalizeFieldName(name)` normaliza nombres de
  campos externos; `stripEmojis(str)` quita emojis y espacios sobrantes.
* `fetchByStatus(status)` consulta órdenes por estado y devuelve filas;
  `processContact(contact)` y `processNewContact(contact)` sincronizan un
  contacto y sus pedidos; `botReactiveScanFn`, `runScanLoop`, `pollFn` y
  `fullReconcileFn` son callbacks de temporizadores del polling: ejecutan una
  pasada, capturan/loguean errores y no devuelven datos de API.
* `isAdminUser(userId)` devuelve booleano de rol; `isFieldNotFound(error)` y
  `isVagueGeoResult(address)` clasifican errores/resultados de geocodificación;
  `normalize(value)` normaliza nombres para la búsqueda de usuarios externos.
* `run()` en `styleLearningService` ejecuta una pasada del scheduler y
  `publicZipRateLimit(req,res,next)` aplica ventana por IP/cliente antes de
  continuar. `requireAuth`, `requireRole`, `requireNotReceptionist` y
  `restrictReceptionistApiAccess` son los callbacks arrow exportados de
  middleware ya descritos: llaman `next()` o responden con 401/403.

### Métodos estáticos de aprendizaje y perfiles

`CustomerProfileService.get(userId, contactId)` devuelve el perfil o `null`;
`CustomerProfileService.refreshFromConversation(userId, contact)` carga hasta
los mensajes recientes, llama a `AIService.summarizeCustomer` y crea/actualiza
`CustomerProfile`. Devuelve el existente cuando aún está dentro del intervalo
de reanálisis y `null` ante configuración ausente o error. `StyleLearningService`
expone `getActive(userId)` (perfil activo o `null`), `refreshStyleProfile(userId)`
 (analiza mensajes de agentes y crea/actualiza `AgentStyleProfile`) y
`startScheduler()` (programa `run`, primera ejecución diferida y ejecuciones
periódicas; captura errores del scheduler).

`findOrderForStop(stop)` (`deliveryCompletionService.js`) busca la orden
relacionada con una parada; `markOrderDelivered(order)` marca pedido/fecha y
ejecuta el historial de entrega, devolviendo la orden actualizada o propagando
error. `saveToDeliveryHistory(order)` (`utils/deliveryHistory.js`) persiste la
copia contable. `shouldProtectAssignedRoute(order,incomingOrderStatus)`
(`utils/routeLifecycleProtection.js`) devuelve booleano para bloquear una
transición terminal de una orden asignada.

### Serializadores de modelos

Además de los métodos indicados junto a cada modelo, el código define
explícitamente estos `toDict()` de instancia. Cada uno convierte la instancia
Sequelize a un objeto JSON sin secretos internos y devuelve sus campos de
dominio; si una relación es necesaria, usa la asociación cargada:
`User.prototype.toDict()` omite `password_hash`;
`Route.prototype.toDict()` incluye paradas y conteos;
`Stop.prototype.toDict()` serializa la parada y sus datos de evidencia/cobro;
`ValidatedAddress.prototype.toDict()` serializa dirección, despacho, entrega y
retorno; `MessageLog.prototype.toDict()` serializa el registro de mensaje;
`MessagingOrder.prototype.toDict()` serializa pedido, estados, asignación y
entrega; `MessagingSettings.prototype.toDict()` serializa configuración apta
para la interfaz sin exponer credenciales; `ConversationState.prototype.toDict()`
serializa estado y contexto; `CoverageZone.prototype.toDict()` serializa zona;
`ServiceAgent.prototype.toDict()` serializa agente/productos;
`RouteHistory.prototype.toDict()` serializa historial y `route_data`;
`FavoriteAddress.prototype.toDict()` serializa favorito; y
`ZipValidation.prototype.toDict()` serializa entrada, resultado, zona y
metadata. `User.prototype.setPassword(password)` actualiza el hash y
`User.prototype.checkPassword(password)` devuelve booleano bcrypt; ambos son
asíncronos y propagan errores de hash.
