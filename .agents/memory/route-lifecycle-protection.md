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

Packages skipped as `pending_return` remain linked to the responsible driver until office reception confirms them; assigning that driver's next route must automatically reload them, while office-received packages must not reload.

**Why:** A package still outside the office has to follow the driver into the next route; clearing the driver link too early strands it in the return queue.

**How to apply:** Preserve `held_by_driver_id` for both `held_by_driver` and `pending_return`, include both dispositions in automatic route reloads, and clear the link only at office reception.

Driver skip disposition is not an order-state transition: both “keep package” and “deliver to office” remain `on_delivery` and assigned to the driver. Only office reception restores the exact `previous_order_status` and reassigns the Respond.io conversation to reception.

**Why:** The package remains physically with the driver after either choice; restoring `Ordered` or `Pickup Ready` at skip time makes it appear available before the office actually receives it.

**How to apply:** Keep the order assigned to the driver with `route_id = null` while retained, reload it into that driver's next assigned route, and perform status restoration plus reception assignment only in the receive endpoint.