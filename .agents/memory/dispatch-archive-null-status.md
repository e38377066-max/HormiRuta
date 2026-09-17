---
name: Archived dispatch status
description: Tratamiento de dispatch_status NULL durante la limpieza de órdenes.
---

Los registros históricos con `dispatch_status = NULL` se consideran activos por la API del despacho y deben incluirse junto con los estados distintos de `archived` al archivarlos.

**Why:** En PostgreSQL, `dispatch_status <> 'archived'` no coincide con NULL; las órdenes cerradas quedaban visibles aunque la reconciliación intentara archivarlas.

**How to apply:** Toda limpieza automática debe usar una condición equivalente a `dispatch_status <> 'archived' OR dispatch_status IS NULL`, manteniendo aparte las protecciones por `route_id` y confirmación explícita.