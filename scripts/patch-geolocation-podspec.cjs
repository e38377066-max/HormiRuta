#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const podspecPath = path.join(
  __dirname,
  '..',
  'node_modules',
  '@capacitor',
  'geolocation',
  'CapacitorGeolocation.podspec'
);

if (!fs.existsSync(podspecPath)) {
  process.exit(0);
}

const original = fs.readFileSync(podspecPath, 'utf8');
const TARGET = "s.dependency 'IONGeolocationLib', '2.1.0'";
const REPLACEMENT = "s.dependency 'IONGeolocationLib', '2.1.1'";

if (original.includes(REPLACEMENT)) {
  process.exit(0);
}

if (!original.includes(TARGET)) {
  console.warn('[patch-geolocation-podspec] Linea esperada no encontrada, saltando.');
  process.exit(0);
}

const patched = original.replace(TARGET, REPLACEMENT);
fs.writeFileSync(podspecPath, patched, 'utf8');
console.log('[patch-geolocation-podspec] CapacitorGeolocation.podspec actualizado a IONGeolocationLib 2.1.1');
