---
name: Respond dispatch safety
description: Reglas para evitar que el polling de Respond.io borre o archive órdenes válidas.
---

El estado abierto/cerrado de una conversación y la ausencia temporal de un contacto en un crawl de Respond.io no son evidencia suficiente para archivar o eliminar una orden del dispatcher. La limpieza de duplicados también es destructiva y debe requerir una acción administrativa explícita, no ejecutarse dentro del polling.

**Why:** Respond.io puede devolver páginas parciales, omitir contactos temporalmente o cerrar chats sin que el pedido haya terminado; usar esas señales para borrar órdenes produjo desapariciones masivas del dispatcher.

**How to apply:** Sincronizar estados solo para contactos encontrados con un lifecycle reconocido. Archivar únicamente por una señal explícita y validada (por ejemplo, UPS o tags/lifecycles excluidos), y conservar los registros no encontrados hasta una revisión segura.