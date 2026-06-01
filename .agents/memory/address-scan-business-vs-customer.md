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
