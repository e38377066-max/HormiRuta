#!/bin/bash
cd /home/runner/workspace
git config user.email "area862@system.com"
git config user.name "Area 862"
git remote remove github 2>/dev/null || true
git remote add github https://e38377066-max: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@github.com/e38377066-max/HormiRuta.git
BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "Subiendo rama: $BRANCH"
git push github $BRANCH --force
echo "Listo!"
