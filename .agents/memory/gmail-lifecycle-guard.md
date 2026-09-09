---
name: Gmail lifecycle guard
description: Regla para que correos Pickup Ready antiguos no sobrescriban cambios manuales de lifecycle.
---

El campo `pickup_email_id` representa el correo Pickup Ready ya procesado dentro del ciclo actual de una orden. Si existe, Gmail no debe volver a cambiar el lifecycle aunque la orden haya sido movida manualmente a Pending, Approved u Ordered.

Las órdenes históricas que todavía no tienen `pickup_email_id` requieren además comparar la fecha del correo con `updated_at`; un correo anterior a la última actualización de una orden manual no debe promoverla.

**Why:** Gmail conserva correos Pickup Ready durante varios días y puede devolver varios mensajes del mismo cliente; sin esta protección, cada cambio manual a un estado anterior se revertía automáticamente a Pickup Ready.

**How to apply:** Limpiar `pickup_email_id` únicamente al iniciar un nuevo ciclo después de una orden terminal; no limpiarlo cuando recepción o despacho cambien manualmente el lifecycle durante el mismo ciclo.