---
name: Autorización y Socket.IO
description: Reglas de auth descubiertas en la auditoría completa del sistema (agosto 2026)
---

**Reglas:**
- Socket.IO se autentica en el evento `join` con `{ token }` (mismo token Bearer de la API); el servidor resuelve rol/salas con `getUserIdFromToken` + `User.findByPk`. Nunca aceptar `role`/`userId` del cliente. El cliente auto-emite join en `connect` desde `client/socket.js`.
- `requireAuth` y `requireRole` verifican `user.active !== false`; desactivar un usuario revoca su acceso de inmediato.
- Toda ruta nueva bajo `/api/admin` debe llevar `requireAdmin` explícito — hubo 5 endpoints de logs expuestos públicamente por olvidarlo.

**Why:** auditoría E2E encontró logs públicos, escalación de rol vía socket y tokens de usuarios desactivados válidos por un año.

**How to apply:** al añadir endpoints o eventos socket, verificar middleware de auth y que las salas se deriven solo de la identidad del servidor.
