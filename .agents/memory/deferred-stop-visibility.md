---
name: Deferred stop visibility
description: Temporary skipped stops stay outside the active route until the driver explicitly opens them after normal deliveries are complete.
---

Temporary skips are persisted so a driver can resume the route, but persistence
must not make them active again after an app reload. During the route, the
driver can explicitly toggle their visibility at any time.

**Why:** A deferred stop is intentionally postponed, not restored; showing it
again in the active map or route can send the driver to it too early.

**How to apply:** Keep deferred stops in local route state, exclude them from
active markers, route calculations, and normal list counts by default, and let a
visible toggle include or exclude them from the map, route, and pending list.