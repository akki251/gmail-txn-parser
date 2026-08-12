#!/bin/bash
# Daily db.json snapshot, keeps 14 days locally. See OPERATIONS.md #2
# for the cron entry and off-box copy recommendation.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p backups
cp db.json "backups/db-$(date +%Y%m%d-%H%M%S).json"
find backups -name 'db-*.json' -mtime +14 -delete
