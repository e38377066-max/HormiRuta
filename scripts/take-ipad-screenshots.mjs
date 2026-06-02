import puppeteer from 'puppeteer';
import { mkdir } from 'fs/promises';

const TOKEN = '7c288375ff4c5829879553cdf67aaf8234f3a54d373f6350365c7532e659b8c6';
const BASE  = 'http://localhost:5000';
const OUT   = 'screenshots/appstore/ipad';
// 1024×1366 @ 2x = 2048×2732 — iPad 13" requerido por App Store
const W = 1024, H = 1366;

await mkdir(OUT, { recursive: true });

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
});

async function getPage() {
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 2 });
  return page;
}

async function loginAndGo(page, targetPath) {
  await page.goto(`${BASE}/dev-login?token=${TOKEN}&redirect=${targetPath}`, {
    waitUntil: 'networkidle2', timeout: 20000
  });
  await new Promise(r => setTimeout(r, 3000));
  console.log(`  → ${page.url()}`);
}

// ── 1. Login ──────────────────────────────────────────────────────────────────
console.log('1. Login...');
{
  const page = await getPage();
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2', timeout: 15000 });
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: `${OUT}/01-login.png` });
  await page.close();
  console.log('   ✓ 01-login.png');
}

// ── 2. Mensajería ─────────────────────────────────────────────────────────────
console.log('2. Mensajería...');
{
  const page = await getPage();
  await loginAndGo(page, '/messaging');
  await page.screenshot({ path: `${OUT}/02-messaging.png` });
  await page.close();
  console.log('   ✓ 02-messaging.png');
}

// ── 3. Planeador ──────────────────────────────────────────────────────────────
console.log('3. Planeador...');
{
  const page = await getPage();
  await loginAndGo(page, '/planner');
  await page.screenshot({ path: `${OUT}/03-planner.png` });
  await page.close();
  console.log('   ✓ 03-planner.png');
}

// ── 4. Despacho ───────────────────────────────────────────────────────────────
console.log('4. Despacho...');
{
  const page = await getPage();
  await loginAndGo(page, '/dispatch');
  await page.screenshot({ path: `${OUT}/04-dispatch.png` });
  await page.close();
  console.log('   ✓ 04-dispatch.png');
}

await browser.close();
console.log('\n✅ Done! iPad screenshots en', OUT);
