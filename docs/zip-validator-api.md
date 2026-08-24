# API externa completa del validador SMS

Todos los endpoints son públicos y no requieren sesión ni API key. Las
consultas modifican únicamente el historial de validaciones; no pueden
modificar zonas, configuraciones ni conversaciones.

## Datos base y URL

Usa como prefijo la URL pública de esta aplicación:

```text
https://TU-DOMINIO.com/api/messaging/public
```

El otro sitio no necesita copiar la base de datos ni las zonas. Cada consulta
se resuelve contra las zonas activas de esta aplicación. La tabla
`zip_validations` se crea/sincroniza automáticamente al iniciar el servidor.

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

### Plataformas disponibles

Actualmente los valores válidos que muestra el selector son:

| `id` | Nombre |
|---|---|
| `facebook` | Facebook |
| `instagram` | Instagram |
| `whatsapp` | WhatsApp |
| `respond` | Respond.io |
| `sms` | SMS |
| `email` | Email |
| `phone` | Teléfono |

El sitio externo debe guardar el `id`, no el texto visual de `label`.

### Contactos

Los contactos se construyen a partir de registros recientes locales de
órdenes y logs de mensajería. Cada elemento contiene solamente:

```json
{
  "id": "ID del contacto, si existe",
  "name": "Nombre",
  "phone": "Teléfono",
  "source": "whatsapp"
}
```

El selector debe permitir también una opción manual o vacía, porque una
validación no requiere obligatoriamente un contacto.

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

### Campos enviados

| Campo | Obligatorio | Descripción |
|---|---:|---|
| `zipOrCity`, `zip_code`, `city`, `address` o `query` | Sí | Texto que se quiere validar. Solo se usa el primero disponible. |
| `contact_id` | No | Identificador del contacto seleccionado. |
| `contact_name` | No | Nombre mostrado del contacto. |
| `contact_phone` | No | Teléfono del contacto. |
| `contact` | No | Alternativa agrupada con `id`, `name` y `phone`. |
| `source` | No | `id` de la plataforma/origen. |
| `platform` | No | Alias de `source`. |
| `channel_type` | No | Alias adicional de `source`. |
| `save` | No | Por defecto `true`; usa `false` para no crear historial. |

### Reglas de búsqueda

1. Si el texto contiene un ZIP de cinco dígitos, se busca primero por ZIP.
2. Después se busca por ciudad exacta, ciudad parcial y nombre de zona.
3. Solo se consideran zonas con `is_active = true`.
4. Una respuesta sin cobertura no es un error: devuelve HTTP `200`, con
   `valid: false`, `covered: false` y `zone: null`.
5. El texto original se conserva en `originalInput`; `value` contiene el
   valor reconocido por el sistema.

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

Cada elemento del historial incluye el contacto, el origen, la entrada,
resultado, zona guardada como instantánea, mensajes y fechas. La zona se
guarda como instantánea para que el historial conserve lo que se respondió
aunque después se edite una zona.

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

## Flujo recomendado para el nuevo sitio

1. Al cargar el formulario, llamar a `GET /validator/options`.
2. Mostrar `platforms` en un selector de origen.
3. Mostrar `contacts` en un selector de contacto; guardar su `id`, `name` y
   `phone`.
4. Permitir que el usuario escriba un ZIP, ciudad o dirección.
5. Enviar todo a `POST /validate-zip`.
6. Mostrar `valid`/`covered`, `message`, `copyMessage` y los datos de `zone`.
7. Guardar `validation_id` para relacionar la validación con la interfaz.
8. Para una pantalla de historial, llamar a `GET /validator/history` y usar
   `pagination.has_more` para cargar más páginas.

## Errores HTTP

| HTTP | Causa | Respuesta |
|---:|---|---|
| `200` | Validación correcta, haya o no cobertura | Objeto de resultado |
| `400` | Falta el texto o no es string | `{ "success": false, "error": "..." }` |
| `429` | Más de 60 solicitudes por IP en un minuto | `{ "success": false, "error": "..." }` |
| `500` | Error inesperado de servidor o base de datos | `{ "success": false, "error": "..." }` |

## Ejemplo de formulario en React

```jsx
const API = 'https://TU-DOMINIO.com/api/messaging/public';

function ValidatorForm() {
  const [options, setOptions] = React.useState({ platforms: [], contacts: [] });
  const [form, setForm] = React.useState({ query: '', source: 'whatsapp', contact: null });
  const [result, setResult] = React.useState(null);

  React.useEffect(() => {
    fetch(`${API}/validator/options?limit=100`)
      .then(response => response.json())
      .then(setOptions);
  }, []);

  async function submit(event) {
    event.preventDefault();
    const response = await fetch(`${API}/validate-zip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: form.query,
        source: form.source,
        contact: form.contact
      })
    });
    setResult(await response.json());
  }

  return (
    <form onSubmit={submit}>
      <select value={form.source}
        onChange={event => setForm({ ...form, source: event.target.value })}>
        {options.platforms.map(platform =>
          <option key={platform.id} value={platform.id}>{platform.label}</option>
        )}
      </select>
      <select onChange={event => setForm({
        ...form,
        contact: options.contacts.find(contact => contact.id === event.target.value) || null
      })}>
        <option value="">Sin contacto</option>
        {options.contacts.map(contact =>
          <option key={contact.id || contact.phone} value={contact.id}>
            {contact.name || contact.phone || contact.id}
          </option>
        )}
      </select>
      <input value={form.query}
        onChange={event => setForm({ ...form, query: event.target.value })}
        placeholder="ZIP, ciudad o dirección" />
      <button type="submit">Validar</button>
      {result && <p>{result.message}</p>}
    </form>
  );
}
```

## CORS para una web externa

Si la llamada se hará directamente desde el navegador del otro sitio,
configura `ZIP_VALIDATOR_ALLOWED_ORIGINS` con uno o varios orígenes separados
por comas:

```text
https://www.otro-sitio.com,https://checkout.otro-sitio.com
```

Para llamadas entre servidores no se necesita configuración CORS.