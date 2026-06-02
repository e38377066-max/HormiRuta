import puppeteer from 'puppeteer';
import { mkdir } from 'fs/promises';

const TOKEN = '7c288375ff4c5829879553cdf67aaf8234f3a54d373f6350365c7532e659b8c6';
const BASE  = 'http://localhost:5000';
const OUT   = 'screenshots/appstore';
const W = 390, H = 844; // iPhone 14 Pro viewport

await mkdir(OUT, { recursive: true });

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
});

async function getPage() {
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 3 });
  return page;
}

async function loginAndGo(page, path) {
  await page.goto(`${BASE}/dev-login?token=${TOKEN}&redirect=${path}`, { waitUntil: 'networkidle2', timeout: 15000 });
  await new Promise(r => setTimeout(r, 2000));
}

// ── 1. Login screen ──────────────────────────────────────────────────────────
console.log('Capturando login...');
{
  const page = await getPage();
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2', timeout: 15000 });
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: `${OUT}/01-login.png`, fullPage: false });
  await page.close();
  console.log('✓ 01-login.png');
}

// ── 2. Messaging / Dashboard ─────────────────────────────────────────────────
console.log('Capturando mensajería...');
{
  const page = await getPage();
  await loginAndGo(page, '/messaging');
  await page.screenshot({ path: `${OUT}/02-messaging.png`, fullPage: false });
  await page.close();
  console.log('✓ 02-messaging.png');
}

// ── 3. Route Planner ─────────────────────────────────────────────────────────
console.log('Capturando planeador...');
{
  const page = await getPage();
  await loginAndGo(page, '/planner');
  await page.screenshot({ path: `${OUT}/03-planner.png`, fullPage: false });
  await page.close();
  console.log('✓ 03-planner.png');
}

// ── 4. Dispatch Map ──────────────────────────────────────────────────────────
console.log('Capturando despacho...');
{
  const page = await getPage();
  await loginAndGo(page, '/dispatch');
  await page.screenshot({ path: `${OUT}/04-dispatch.png`, fullPage: false });
  await page.close();
  console.log('✓ 04-dispatch.png');
}

await browser.close();
console.log('\nDone! Screenshots en', OUT);
