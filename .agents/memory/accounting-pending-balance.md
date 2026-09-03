---
name: Pending cash accounting
description: Meaning of the pending cash amount and its companion count in driver accounting
---

The pending cash count represents the number of completed routes with a positive outstanding cash balance after recorded office receipts. It is not a count of stops or orders.

**Why:** The amount is route-level cash owed to the office, so a stop count can be misleading when a route mixes paid, electronic, skipped, and unpaid stops.

**How to apply:** Keep the displayed count and its label explicitly route-based, and calculate both from the same outstanding-balance rule.

Only stops with status `completed` are financial deliveries. Stops with status `skipped` may allow a route to close, but their amounts and per-stop commissions must be excluded from route payment totals, driver settlement, and administrative confirmation.

**Why:** A skipped stop was not delivered or collected, even if legacy data contains an amount on that stop.

**How to apply:** Any query that calculates route accounting must select the stop status and filter to completed stops before summing money or commissions.