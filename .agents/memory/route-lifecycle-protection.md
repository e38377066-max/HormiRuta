---
name: Route lifecycle protection
description: Safe deletion and return rules for dispatch routes
---

Routes with assignment, delivery progress, evidence, payment, or completion history are immutable records for deletion purposes. Pending orders are released through an explicit return flow; favorites and handled package states are preserved.

**Why:** Destructive route deletion can erase accounting relationships, delivery evidence, retained packages, and audit history.

**How to apply:** Allow destructive deletion only for untouched drafts, use transactions when detaching orders/stops, and never reset completed or financially touched deliveries to pending.

Pending-order cleanup during a partial return must exclude every order matched to a retained Stop, not only orders already released; skipped, held, and returned Stops can still have pending order status.

**Why:** A second orphan-order pass otherwise mistakes a deliberately retained pending delivery for a missing Stop and silently detaches it from the route.

**How to apply:** Track matched order IDs during the Stop pass and only release pending orders that were never matched to any Stop.

Packages skipped as `pending_return` remain linked to the responsible driver until office reception confirms them; assigning that driver's next route must automatically reload them, while office-received packages must not reload.

**Why:** A package still outside the office has to follow the driver into the next route; clearing the driver link too early strands it in the return queue.

**How to apply:** Preserve `held_by_driver_id` for both `held_by_driver` and `pending_return`, include both dispositions in automatic route reloads, and clear the link only at office reception.

Driver skip disposition is not an order-state transition: both “keep package” and “deliver to office” remain `on_delivery` and assigned to the driver. Only office reception clears the driver custody and moves the package to `pickup_ready`, then reassigns the Respond.io conversation to reception.

**Why:** The package remains physically with the driver after either choice; changing lifecycle at skip time makes it appear available before the office actually receives it. Once the office confirms receipt, `Pickup Ready` is the correct state even when `previous_order_status` is missing or says `Ordered`.

**How to apply:** Keep the order assigned to the driver with `route_id = null` while retained, reload it into that driver's next assigned route, and perform the `pickup_ready` transition plus reception assignment only after the package returns to the office.

Delivery completion is based on the completed stop, not merely route membership or origin. Driver-added and dispatcher-added orders both become `delivered` and `Delivered` in Respond.io only when their matching Stop is completed.

**Why:** A route can contain skipped/retained stops alongside delivered stops; marking every order on route completion would incorrectly close packages that are still with the driver or awaiting reception.

**How to apply:** Resolve each completed Stop to its order before finalizing delivery; leave skipped or unmatched orders in their existing lifecycle.

Assigned routes are visible to the driver immediately and do not require office or driver pickup confirmation.

**Why:** The route-reception workflow was intentionally removed; assignment itself is now the handoff that makes a route actionable.

**How to apply:** Do not gate route visibility, navigation, evidence, stop updates, or completion on pickup confirmation fields. Keep the separate returned-package office-reception workflow unchanged.

Lifecycle polling must revalidate a terminal order before treating an active snapshot as a new cycle.

**Why:** Respond.io list results can be stale while a delivery is being closed; processing that snapshot after the close can reopen a delivered order as `On Delivery` and put it back on the map.

**How to apply:** Re-fetch the contact before terminal-to-active reactivation in both the frequent scan and full reconciliation, and ignore the stale snapshot when the live lifecycle differs.

An active nonterminal route assignment is authoritative over Respond.io lifecycle snapshots. External `Pickup Ready`, `Pending`, `Approved`, `Ordered`, UPS, excluded, unknown, or deleted-contact states must not alter status, archive, or clear route/driver fields; `Delivered` may advance the route.

**Why:** Respond.io polling can return stale or regressive snapshots while assignment is still updating contacts. Treating those snapshots as reception release removed active orders from routes seconds after assignment.

**How to apply:** Guard every individual and bulk lifecycle reconciliation path and make writes conditional on the observed `route_id`. Clear assignment only through explicit dispatch/office-return flows or when reactivating a terminal delivered/UPS order for a verified new cycle.
