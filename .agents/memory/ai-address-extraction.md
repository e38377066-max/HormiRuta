---
name: AI address extraction street number validation
description: AI (OpenAI) may change street numbers when extracting addresses from ambiguous messages.
---

The `extractAddressFromMessages` AI call in pollingService can return a different street number than what the customer typed. For example, "4235 Scarsdale In Dallas Tx 75227" → AI returns streetNumber "235" because it interprets "4235" as "4" (quantity/floor?) + "235" (street number).

**Why:** The word "In" in the address confuses the AI about sentence structure. Even with the prompt saying "NO inventes otro número", the AI can misparse 4-digit street numbers before directional words.

**How to apply:** After AI extraction, verify that `aiAddr.streetNumber` appears verbatim as a whole word in at least one of the input texts. If not, reject the AI result and keep the regex-extracted address. Fixed in `extractAndSaveAddressFromMessages` in src/services/pollingService.js.
