---
name: Archived dispatch status
description: Tratamiento de dispatch_status NULL durante la limpieza de órdenes.
---

Los registros históricos con `dispatch_status = NULL` se consideran activos por la API del despacho y deben incluirse junto con los estados distintos de `archived` al archivarlos. Una conversación confirmada como cerrada en Respond.io se archiva del dispatcher, sin conservarla por lifecycle, confirmación histórica o ruta.

**Why:** En PostgreSQL, `dispatch_status <> 'archived'` no coincide con NULL; además, la evidencia histórica de pedido no representa una conversación activa cuando Respond.io confirma que está cerrada.

**How to apply:** Toda limpieza automática debe usar una condición equivalente a `dispatch_status <> 'archived' OR dispatch_status IS NULL`. Archivar la visibilidad del dispatcher no requiere borrar route_id ni el historial de la orden.