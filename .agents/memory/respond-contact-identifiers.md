---
name: Respond.io contact identifiers
description: Formato requerido para consultar contactos individuales desde Respond.io.
---

Respond.io puede devolver un ID numérico en `contact/list`, pero los endpoints individuales de contacto requieren el identificador explícito `id:<contactId>`. La normalización debe aplicarse también cuando el ID llega como cadena numérica, porque el polling suele convertirlo a texto antes de consultar.

**Why:** Usar el número crudo provoca `Identifier ... is invalid` al consultar `/contact/:identifier`.

**How to apply:** Normalizar siempre el identificador antes de llamar endpoints individuales como obtener contacto, actualizar lifecycle o asignar conversación; conservar el ID crudo solo para persistencia y comparación.