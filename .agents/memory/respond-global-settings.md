---
name: Respond.io global settings
description: Regla para resolver el token de Respond.io en flujos de rutas y despacho.
---

El token de Respond.io pertenece a la configuración global del sistema, aunque el registro técnico conserve un `user_id` propietario.

**Why:** La configuración de Respond.io se administra desde Mensajería como singleton global; una ruta o un chofer puede no tener un registro individual de configuración.

**How to apply:** Para nuevos flujos que consulten Respond.io, buscar una configuración global con token válido y no filtrar exclusivamente por `route.user_id` o por el usuario autenticado.