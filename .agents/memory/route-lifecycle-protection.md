---
name: Route lifecycle protection
description: Safe deletion and return rules for dispatch routes
---

Routes with assignment, pickup confirmation, delivery progress, evidence, payment, or completion history are immutable records for deletion purposes. Pending orders are released through an explicit return flow; favorites and handled package states are preserved.

**Why:** Destructive route deletion can erase accounting relationships, delivery evidence, retained packages, and audit history.

**How to apply:** Allow destructive deletion only for untouched drafts, use transactions when detaching orders/stops, and never reset completed or financially touched deliveries to pending.