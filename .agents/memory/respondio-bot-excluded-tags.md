---
name: Respond.io bot excluded tags
description: Why the chatbot can keep replying to contacts that "should" be excluded by tag, and how exclusion must be enforced.
---

# Respond.io bot tag exclusion

`ChatbotService.hasExcludedTag(contact)` decides whether the auto-responder skips a contact based on Respond.io tags (e.g. "Personales" = personal contacts that must never get bot replies).

## Rule
The exclusion check must UNION a hardcoded baseline set with the stored `MessagingSettings.excluded_tags`, and compare with case + accent-insensitive normalization. Never rely solely on the stored config or on a `|| [defaults]` fallback.

**Why:** Two failure modes bit us:
1. **Stale/partial config wins over fallback.** The chatbot fallback `settings.excluded_tags || [...]` only applies when the stored value is empty. In production a row already existed, so the fallback never ran and protected tags missing from the stored list leaked through.
2. **Singular vs plural.** The model/config default historically used `"Personal"` (singular) but the real Respond.io tag is `"Personales"` (plural), so exact-match exclusion silently failed.

**How to apply:** When touching bot exclusion, keep `BASELINE_EXCLUDED` (Personal, Personales, IprintPOS, ClientesArea, Area862Designers) always-on, union with configured tags, normalize both sides (lowercase + strip diacritics + trim). Tags ARE present on the `/contact/list` contact objects (same field used for `rec`/`iprintpos-chats` dispatch filtering), so no separate contact fetch is needed for the tag check.
