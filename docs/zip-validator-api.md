# API externa completa del validador SMS

Todos los endpoints son públicos y no requieren sesión ni API key. Las
consultas modifican únicamente el historial de validaciones; no pueden
modificar zonas, configuraciones ni conversaciones.

## Opciones para construir el formulario

```text
GET /api/messaging/public/validator/options
```

Devuelve las plataformas/orígenes y los contactos recientes disponibles para
el selector:

```json
{
  "success": true,
  "platforms": [
    { "id": "facebook", "label": "Facebook", "icon": "facebook", "color": "#1877f2" }
  ],
  "contacts": [
    { "id": "123", "name": "Cliente", "phone": "+15551234567", "source": "whatsapp" }
  ],
  "contact_source": "recent local messaging records"
}
```

Para filtrar contactos:

```text
GET /api/messaging/public/validator/options?search=maria&limit=25
```

La lista nunca incluye mensajes, tokens ni credenciales.

## Validar y guardar

```text
POST /api/messaging/public/validate-zip
```

La respuesta se basa en las zonas activas almacenadas en la base de datos.
Acepta un ZIP, una ciudad, un nombre de zona o una dirección.

```bash
curl -X POST https://TU-DOMINIO.com/api/messaging/public/validate-zip \
  -H "Content-Type: application/json" \
  -d '{
    "zipOrCity": "75201",
    "contact_id": "123",
    "contact_name": "Cliente",
    "contact_phone": "+15551234567",
    "source": "whatsapp"
  }'
```

También se aceptan `zip_code`, `city`, `address` o `query`. El contacto puede
enviarse como objeto:

```json
{
  "query": "Dallas, TX",
  "contact": {
    "id": "123",
    "name": "Cliente",
    "phone": "+15551234567"
  },
  "platform": "facebook"
}
```

La validación se guarda automáticamente. Para consultar sin guardar:

```json
{ "zipOrCity": "75201", "save": false }
```

## Respuesta con cobertura

```json
{
  "success": true,
  "valid": true,
  "covered": true,
  "type": "zip",
  "value": "75201",
  "originalInput": "75201",
  "contact": {
    "id": "123",
    "name": "Cliente",
    "phone": "+15551234567"
  },
  "source": "whatsapp",
  "validation_id": 42,
  "saved": true,
  "zone": {
    "id": 1,
    "zip_code": "75201",
    "zone_name": "Centro",
    "city": "Dallas",
    "state": "TX",
    "country": "US",
    "delivery_fee": 10,
    "min_order_amount": null,
    "estimated_delivery_time": 60
  },
  "message": "ZIP 75201 validado - Dallas",
  "timestamp": "2026-08-24T00:00:00.000Z"
}
```

Cuando no existe cobertura, `valid` y `covered` son `false` y `zone` es
`null`. Más de 60 solicitudes por minuto desde la misma IP devuelve `429`.

## Historial persistente

```text
GET /api/messaging/public/validator/history
```

Parámetros opcionales:

- `contact_id`: filtra por contacto.
- `source`: filtra por plataforma/origen.
- `limit`: entre 1 y 100, por defecto 50.
- `offset`: paginación, por defecto 0.

Ejemplo:

```text
GET /api/messaging/public/validator/history?contact_id=123&source=whatsapp&limit=20
```

La respuesta contiene `validations` y `pagination` con `total`, `limit`,
`offset` y `has_more`.

## Integración JavaScript completa

```javascript
const API = 'https://TU-DOMINIO.com/api/messaging/public';

const options = await fetch(`${API}/validator/options?limit=50`).then(r => r.json());

const validation = await fetch(`${API}/validate-zip`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    zipOrCity: '75201',
    contact_id: options.contacts[0]?.id,
    contact_name: options.contacts[0]?.name,
    contact_phone: options.contacts[0]?.phone,
    source: 'whatsapp'
  })
}).then(r => r.json());

const history = await fetch(
  `${API}/validator/history?contact_id=${encodeURIComponent(options.contacts[0]?.id || '')}`
).then(r => r.json());
```

## CORS para una web externa

Si la llamada se hará directamente desde el navegador del otro sitio,
configura `ZIP_VALIDATOR_ALLOWED_ORIGINS` con uno o varios orígenes separados
por comas:

```text
https://www.otro-sitio.com,https://checkout.otro-sitio.com
```

Para llamadas entre servidores no se necesita configuración CORS.