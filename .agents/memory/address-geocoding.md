---
name: Geocoding street number validation
description: Google Maps geocoding can silently change house numbers; always validate before accepting result.
---

When geocoding addresses like "4235 Scarsdale In Dallas TX 75227", Google Maps may return a completely different street number (e.g., "235 Scarsdale Ln, Dallas, TX 75227"). The word "In" is misinterpreted as a preposition, causing the geocoder to find the nearest match which may have a different house number.

**Why:** Accepting the geocoded result silently corrupts the delivery address in the Respond.io contact field.

**How to apply:** Before accepting geocoded address, compare the first digit sequence of the original address vs geocoded.streetNumber. If they differ, keep the original address and only accept the geocoded zip. Fixed in `extractAndSaveAddressFromMessages` in src/services/pollingService.js.

Also: when geocoding fails, extract zip from the raw address text as fallback using `/\b(\d{5})\b/`.
