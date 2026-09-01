---
name: Route lifecycle protection
description: Safe deletion and return rules for dispatch routes
---

Routes with assignment, pickup confirmation, delivery progress, evidence, payment, or completion history are immutable records for deletion purposes. Pending orders are released through an explicit return flow; favorites and handled package states are preserved.

**Why:** Destructive route deletion can erase accounting relationships, delivery evidence, retained packages, and audit history.

**How to apply:** Allow destructive deletion only for untouched drafts, use transactions when detaching orders/stops, and never reset completed or financially touched deliveries to pending.

Pending-order cleanup during a partial return must exclude every order matched to a retained Stop, not only orders already released; skipped, held, and returned Stops can still have pending order status.

**Why:** A second orphan-order pass otherwise mistakes a deliberately retained pending delivery for a missing Stop and silently detaches it from the route.

**How to apply:** Track matched order IDs during the Stop pass and only release pending orders that were never matched to any Stop.