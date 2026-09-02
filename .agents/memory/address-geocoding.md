---
name: Geocoding street number validation
description: Google Maps geocoding can silently change house numbers; always validate before accepting result.
---

When geocoding addresses like "4235 Scarsdale In Dallas TX 75227", Google Maps may return a completely different street number (e.g., "235 Scarsdale Ln, Dallas, TX 75227"). The word "In" is misinterpreted as a preposition, causing the geocoder to find the nearest match which may have a different house number.

**Why:** Accepting the geocoded result silently corrupts the delivery address in the Respond.io contact field.

**How to apply:** Before accepting geocoded address, compare the first digit sequence of the original address vs geocoded.streetNumber. If they differ, keep the original address and only accept the geocoded zip. Fixed in `extractAndSaveAddressFromMessages` in src/services/pollingService.js.

Also: when geocoding fails, extract zip from the raw address text as fallback using `/\b(\d{5})\b/`.

For driver-requested destination changes, preserve the order's original address
as historical input and update only the validated/current destination fields.

**Why:** A nearby customer location may change during delivery, but the original
address remains useful for audit and should not be erased.

**How to apply:** Sync the stop's address/coordinates with the order's
validated address/coordinates in one transaction; leave original_address intact.
