---
name: OpenAI quota alert
description: Credit exhaustion alerts use the configured Gmail sender and are deduplicated per outage cycle.
---

When OpenAI reports exhausted credits, notify the first active administrator
through the configured Gmail sender. Do not send one email per retry; retry
failed delivery only after a cooldown, and rearm the alert after a successful
OpenAI response.

**Why:** A quota outage can trigger many concurrent bot and email-sync requests,
so unbounded notifications create noise and can amplify a provider outage.

**How to apply:** Centralize quota classification and notification state for
all OpenAI callers, while keeping normal transient 429 rate limits excluded.