---
name: Dispatch realtime refresh
description: Keeps the dispatcher synchronized with orders created or changed by Respond.io polling.
---

All polling paths that create, update, reactivate, or archive `ValidatedAddress` records must notify the admin socket room with `dispatch:updated`; the dispatcher may use a short fallback poll for missed socket events.

**Why:** The address scanner was updating the database while the dispatcher refreshed only every three minutes and listened only to route events, so new orders could exist in the database but remain invisible in the UI.

**How to apply:** When adding a new polling mutation, emit the dispatch event after the database write. Keep the client resilient to partial API failures so a stats or driver request cannot hide valid orders.