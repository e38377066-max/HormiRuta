---
name: Post-merge hook
description: The project requires an explicitly configured non-interactive setup script after task merges.
---

The post-merge setup must point to `scripts/post-merge.sh` through the project configuration. The script should fail fast, avoid stdin prompts, install dependencies non-interactively, and rebuild the frontend; application startup remains responsible for database schema synchronization.

**Why:** Task merges fail before workflow reconciliation when the configured hook path is missing, and long-running server commands cannot be used as the setup script.

**How to apply:** If the hook reports `HOOK_NOT_FOUND`, inspect the post-merge configuration, restore the script path, and run the setup once to confirm both setup and workflow reconciliation succeed.