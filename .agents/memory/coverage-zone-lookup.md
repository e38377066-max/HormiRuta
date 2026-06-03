---
name: Coverage zone lookup user_id fallback
description: CoverageZone queries in addressValidation.js must retry without user_id if no zone found.
---

The `validateZipOrCity`, `findZoneByCity`, and `checkCoverage` methods in `AddressValidationService` filter by `user_id`. In production this can cause valid zones to not be found if the user_id used by the chatbot (from MessagingSettings.user_id via getSystemUserId) differs from the user_id used when creating the coverage zones.

**Why:** Area 862 is single-tenant but the coverage zones were potentially created under a different admin session than the MessagingSettings record. The user_id filter silently blocks valid zones.

**How to apply:** Always add a fallback query without user_id when the first (user_id-filtered) query returns null. Pattern:
```js
let zone = await CoverageZone.findOne({ where: { ...where, user_id: this.userId } });
if (!zone && this.userId) {
  zone = await CoverageZone.findOne({ where: { ...baseWhere } });
}
```
This was applied to all three methods in src/services/addressValidation.js.
