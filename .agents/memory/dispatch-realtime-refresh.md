---
name: Dispatch realtime refresh
description: Keeps the dispatcher synchronized with orders created or changed by Respond.io polling.
---

All polling paths that create, update, reactivate, or archive `ValidatedAddress` records must notify the admin socket room with `dispatch:updated`; the dispatcher may use a short fallback poll for missed socket events.

**Why:** The address scanner was updating the database while the dispatcher refreshed only every three minutes and listened only to route events, so new orders could exist in the database but remain invisible in the UI.

**How to apply:** When adding a new polling mutation, emit the dispatch event after the database write. Keep the client resilient to partial API failures so a stats or driver request cannot hide valid orders.

Closed conversations are not automatically valid dispatch orders. Archive a closed, unassigned record unless there is explicit order evidence such as `PedidoConfirmado`, `closing_complete`, a completion timestamp, or a later fulfillment lifecycle; preserve anything already assigned to a route.

**Why:** Respond.io can report a stale `Ordered` lifecycle after a customer closes a conversation without completing an order. Counting every closed lifecycle as active left non-orders on the map.

**How to apply:** Apply this check during full lifecycle reconciliation before syncing the external lifecycle into the dispatcher. Reopening the conversation should make an archived record eligible again.