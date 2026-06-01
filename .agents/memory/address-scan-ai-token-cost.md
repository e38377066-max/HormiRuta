---
name: Address-scan AI token runaway
description: Why the address scanner burned huge OpenAI token volume and the per-contact gating that fixes it.
---

# Address-scan AI token runaway

The address scanner's loop (`runScanLoop` in pollingService) is NOT periodic — it runs continuously with only a ~3s pause between cycles. Contacts WITHOUT a validated address bypass the `addressScannedContacts` skip cache (the scan filter returns true for any `needsAddressSet` member), so they are re-scanned every cycle. When regex finds no address, an AI fallback (`extractAddressFromMessages` / `extractAddressFromWholesaleMessages`) fired — on the SAME unchanged messages — every ~3s, per address-less contact, indefinitely. A lead who never sends an address generated thousands of identical, useless OpenAI calls/day. This was the main driver behind a report of ~57M tokens in 9 days.

**Rule:** any AI call placed inside a high-frequency scan/poll loop must be gated so it does NOT re-run on inputs that haven't changed.

**Fix used:** `_shouldRunAddressAI(contactId, texts)` keeps a per-contact `Map` of `{sig, ts}` where `sig = JSON.stringify(texts)`. It returns true (and records) only when the incoming texts changed OR a cooldown (30 min) elapsed since the last attempt on identical texts; otherwise false. All four scan-loop AI fallback sites are gated with `&& this._shouldRunAddressAI(contact.id, <texts>)`.

**Why the cooldown (not a plain "skip if identical"):** recording the signature unconditionally before the AI call means a transient OpenAI failure would block that contact forever (same texts → always skipped). The cooldown lets identical-text contacts retry at most once per 30 min, preserving self-healing while still removing the per-3s runaway. The Map is pruned (entries older than 2× cooldown) once it exceeds 5000 keys to bound memory.

**How to apply:** when adding/moving any OpenAI (or other paid) call near the scanner or poller, confirm it can't fire repeatedly on unchanged input. Reuse `_shouldRunAddressAI` (or the same sig+cooldown pattern). The separate `extractAndSaveAddressFromMessages` path (in `pollForNewMessages`) is already bounded because it only runs on newly-processed messages, but note it AI-verifies EVERY regex hit — a candidate for further trimming if cost is still high.
