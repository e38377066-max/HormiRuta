#!/usr/bin/env bash
set -euo pipefail

# Keep the merge hook deterministic and non-interactive. Database schema
# synchronization is performed by the application during its normal startup.
npm install --no-audit --no-fund --no-update-notifier
npm run build