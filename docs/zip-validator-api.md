# API externa de validación de ZIP

## Endpoint

```text
POST /api/messaging/public/validate-zip
```

La respuesta se basa en las zonas activas almacenadas en la base de datos.
Acepta un ZIP, una ciudad, un nombre de zona o una dirección que contenga un
ZIP de cinco dígitos.

## Acceso

El endpoint no requiere autenticación ni API key. Puede llamarse desde el
backend del otro sitio o directamente desde su navegador si el origen está
incluido en `ZIP_VALIDATOR_ALLOWED_ORIGINS`.

## Solicitud

```bash
curl -X POST https://TU-DOMINIO.com/api/messaging/public/validate-zip \
  -H "Content-Type: application/json" \
  -d '{"zipOrCity":"75201"}'
```

También se aceptan `zip_code`, `city` o `query` como nombre del campo.

## Respuesta con cobertura

```json
{
  "success": true,
  "valid": true,
  "covered": true,
  "type": "zip",
  "value": "75201",
  "originalInput": "75201",
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

## CORS para una web externa

Si la llamada se hará directamente desde el navegador del otro sitio,
configura `ZIP_VALIDATOR_ALLOWED_ORIGINS` con uno o varios orígenes separados
por comas:

```text
https://www.otro-sitio.com,https://checkout.otro-sitio.com
```

Para llamadas entre servidores no se necesita configuración CORS.