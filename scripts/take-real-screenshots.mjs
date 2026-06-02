import puppeteer from 'puppeteer';
import { mkdir } from 'fs/promises';

const TOKEN = '7c288375ff4c5829879553cdf67aaf8234f3a54d373f6350365c7532e659b8c6';
const BASE  = 'http://localhost:5000';
const OUT   = 'screenshots/appstore';
const W = 390, H = 844;

await mkdir(OUT, { recursive: true });

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
});

async function getPage() {
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 3 });
  return page;
}

async function loginAndGo(page, targetPath) {
  // Step 1: go to dev-login — sets localStorage and redirects
  await page.goto(`${BASE}/dev-login?token=${TOKEN}&redirect=${targetPath}`, {
    waitUntil: 'networkidle2', timeout: 20000
  });
  // Step 2: wait for React to mount and route to render
  await new Promise(r => setTimeout(r, 3000));
  // Step 3: verify we are NOT on /login anymore
  const url = page.url();
  console.log(`  → landed on: ${url}`);
}

// ── 1. Login screen ───────────────────────────────────────────────────────────
console.log('1. Login...');
{
  const page = await getPage();
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2', timeout: 15000 });
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: `${OUT}/01-login.png` });
  await page.close();
  console.log('   ✓ 01-login.png');
}

// ── 2. Messaging ──────────────────────────────────────────────────────────────
console.log('2. Mensajería...');
{
  const page = await getPage();
  await loginAndGo(page, '/messaging');
  await page.screenshot({ path: `${OUT}/02-messaging.png` });
  await page.close();
  console.log('   ✓ 02-messaging.png');
}

// ── 3. Route Planner ──────────────────────────────────────────────────────────
console.log('3. Planeador...');
{
  const page = await getPage();
  await loginAndGo(page, '/planner');
  await page.screenshot({ path: `${OUT}/03-planner.png` });
  await page.close();
  console.log('   ✓ 03-planner.png');
}

// ── 4. Dispatch ───────────────────────────────────────────────────────────────
console.log('4. Despacho...');
{
  const page = await getPage();
  await loginAndGo(page, '/dispatch');
  await page.screenshot({ path: `${OUT}/04-dispatch.png` });
  await page.close();
  console.log('   ✓ 04-dispatch.png');
}

await browser.close();
console.log('\n✅ Done! Screenshots en', OUT);
