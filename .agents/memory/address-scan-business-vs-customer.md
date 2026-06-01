---
name: Address scan — business vs customer address
description: Why the address scanner can save the company's OWN location as the customer delivery address, and how to prevent it.
---

# Address scan: don't capture our own business address

The AddressScan / polling extractor scans BOTH incoming (customer) and outgoing (agent) messages for delivery addresses. Agents routinely send the company's own location to customers (e.g. "La direccion de nuestro Negocio es: <addr>. Atendemos de 8am a 1pm"). Such outgoing messages also match generic "confirmation" patterns (e.g. "La direccion"), so without a guard the scanner saves the LOCAL's address as the customer's delivery address.

## Rule
Any code path that extracts an address from OUTGOING agent messages must first skip messages that describe the business's own location, using the single shared helper `AddressExtractorService.isBusinessOwnAddress(text)`. Never re-inline the business-address regex — duplicated copies drift (some lacked `atendemos de` / `nuestras instalaciones`) and reintroduce this bug.

**Why:** Real incident — the company's Cedar Hill address was saved as a Duncanville customer's delivery address because the agent's outgoing "nuestro Negocio" message was scanned without the guard, and a weaker duplicated regex elsewhere missed it.

**How to apply:** When touching address extraction, route every outgoing-message business-address check through `isBusinessOwnAddress`. Guard applies to outgoing only — never suppress incoming/customer text. Incoming customer extraction stays prioritized; agent messages confirming the CUSTOMER's address still pass (they don't match the business pattern).

## Auto-correcting already-contaminated records
The scanner also self-heals records saved BEFORE the guard existed (business address stored as the customer's, including pushed to Respond.io's Address custom field).

**Constraint:** contacts whose Respond.io Address field already has a value early-return in the scan BEFORE messages are read (an intentional API-cost optimization). So you cannot detect contamination just by reading messages — fully-settled contaminated contacts never reach the message-scan path.

**Design:** a process-level cache of normalized business-address strings (`businessAddressNorms`) is warmed from outgoing `isBusinessOwnAddress` messages whenever any contact's messages ARE read. A guard placed BEFORE the early-returns clears both the ValidatedAddress fields and the Respond.io Address field when the stored/CF value matches the cache. For cold-cache determinism, settled contacts get a ONE-TIME `listMessages` probe (tracked by `businessCheckedContacts`) so each inspects its own messages once. Both caches reset hourly so a business-address change self-heals and stale norms don't cause false positives.

**Why:** without the pre-early-return guard + per-contact probe, contaminated records where Address field == stored == business address stay stuck forever. **How to apply:** never move business-contamination cleanup AFTER the `contactFieldAddress` early-returns; keep the cache reset so it can't accumulate a former business address and wrongly wipe a real customer at that location.
