---
name: Respond.io contact identifiers
description: Formato requerido para consultar contactos individuales desde Respond.io.
---

Respond.io puede devolver un ID numérico en `contact/list`, pero los endpoints individuales de contacto requieren el identificador explícito `id:<contactId>`. Además, el detalle individual puede no incluir lifecycle aunque la consulta sea exitosa; para confirmar estados, consultar también `contact/list` y aceptar solo la coincidencia exacta por ID.

**Why:** Usar el número crudo provoca `Identifier ... is invalid` al consultar `/contact/:identifier`.

**How to apply:** Normalizar siempre el identificador antes de llamar endpoints individuales como obtener contacto, actualizar lifecycle o asignar conversación; conservar el ID crudo solo para persistencia y comparación. Si falta lifecycle en el detalle, usar una búsqueda/listado exacto por ID; si ambas lecturas fallan, no reactivar ni sobrescribir una orden terminal.