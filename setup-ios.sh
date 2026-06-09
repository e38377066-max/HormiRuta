#!/bin/bash
set -e

echo "=== Area 862 iOS Setup ==="
echo ""

echo "[1/2] Instalando dependencias npm..."
npm install

echo ""
echo "[2/2] Instalando CocoaPods..."
cd ios/App
pod install
cd ../..

echo ""
echo "====================================================="
echo " Listo! Abre Xcode con este archivo:"
echo " ios/App/App.xcworkspace"
echo " (doble click o: open ios/App/App.xcworkspace)"
echo "====================================================="
open ios/App/App.xcworkspace 2>/dev/null || true
