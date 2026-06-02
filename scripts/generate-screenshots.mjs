import { createCanvas, loadImage, registerFont } from 'canvas';
import fs from 'fs';
import path from 'path';

const W = 1320;
const H = 2868;
const OUT = 'screenshots/appstore';
fs.mkdirSync(OUT, { recursive: true });

// ── palette ──────────────────────────────────────────────
const C = {
  bg:      '#0f172a',
  bgCard:  '#1e293b',
  bgCard2: '#334155',
  blue:    '#3b82f6',
  blueD:   '#1d4ed8',
  cyan:    '#06b6d4',
  green:   '#22c55e',
  orange:  '#f97316',
  amber:   '#f59e0b',
  purple:  '#8b5cf6',
  navy:    '#0d47a1',
  text:    '#f1f5f9',
  textSub: '#94a3b8',
  textMid: '#cbd5e1',
  border:  '#334155',
  red:     '#ef4444',
};

function hex(ctx, color, alpha = 1) {
  if (alpha < 1) {
    const r = parseInt(color.slice(1,3),16);
    const g = parseInt(color.slice(3,5),16);
    const b = parseInt(color.slice(5,7),16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return color;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function statusBar(ctx) {
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, 120);
  // time
  ctx.fillStyle = C.text;
  ctx.font = 'bold 52px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('9:41', 80, 85);
  // battery + signal
  ctx.font = '44px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('⬛⬛⬛  🔋', W - 80, 85);
  ctx.textAlign = 'left';
}

function navBar(ctx, title, showBack = false) {
  ctx.fillStyle = C.bgCard;
  ctx.fillRect(0, 120, W, 120);
  ctx.fillStyle = C.text;
  ctx.font = 'bold 56px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, W/2, 200);
  ctx.textAlign = 'left';
  if (showBack) {
    ctx.fillStyle = C.blue;
    ctx.font = '48px sans-serif';
    ctx.fillText('‹ Atrás', 60, 200);
  }
}

function badge(ctx, x, y, text, color, w = 200, h = 52) {
  roundRect(ctx, x, y, w, h, 26);
  ctx.fillStyle = hex(ctx, color, 0.2);
  ctx.fill();
  roundRect(ctx, x, y, w, h, 26);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = 'bold 30px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(text, x + w/2, y + h/2 + 10);
  ctx.textAlign = 'left';
}

function card(ctx, x, y, w, h, r = 24) {
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = C.bgCard;
  ctx.fill();
  roundRect(ctx, x, y, w, h, r);
  ctx.strokeStyle = C.border;
  ctx.lineWidth = 2;
  ctx.stroke();
}

function dot(ctx, x, y, r, color) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

// ─────────────────────────────────────────────────────────
// SCREEN 1 — LOGIN
// ─────────────────────────────────────────────────────────
async function screen1() {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // gradient bg
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#0f172a');
  grad.addColorStop(0.5, '#1a2744');
  grad.addColorStop(1, '#0f172a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // big glow circles
  for (const [cx, cy, cr, col] of [
    [200, 900, 500, hex(null, C.blue, 0.08)],
    [1100, 2000, 600, hex(null, C.cyan, 0.06)],
  ]) {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, cr);
    g.addColorStop(0, col);
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  statusBar(ctx);

  // logo circle
  ctx.beginPath();
  ctx.arc(W/2, 780, 140, 0, Math.PI*2);
  ctx.fillStyle = hex(null, C.blue, 0.15);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(W/2, 780, 120, 0, Math.PI*2);
  ctx.strokeStyle = C.blue;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = C.blue;
  ctx.font = 'bold 96px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('862', W/2, 800 + 32);

  // title
  ctx.fillStyle = C.text;
  ctx.font = 'bold 80px sans-serif';
  ctx.fillText('Area 862', W/2, 1060);
  ctx.fillStyle = C.textSub;
  ctx.font = '44px sans-serif';
  ctx.fillText('Accede a tu cuenta para continuar', W/2, 1130);

  // card
  const cx = 80, cy = 1220, cw = W - 160, ch = 900;
  roundRect(ctx, cx, cy, cw, ch, 40);
  ctx.fillStyle = hex(null, '#ffffff', 0.05);
  ctx.fill();
  roundRect(ctx, cx, cy, cw, ch, 40);
  ctx.strokeStyle = hex(null, '#ffffff', 0.1);
  ctx.lineWidth = 2;
  ctx.stroke();

  // email field
  roundRect(ctx, 140, 1300, cw - 120, 130, 20);
  ctx.fillStyle = hex(null, '#ffffff', 0.08);
  ctx.fill();
  ctx.fillStyle = C.textSub;
  ctx.font = '44px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('  ✉  Correo electrónico', 180, 1375);

  // password field
  roundRect(ctx, 140, 1470, cw - 120, 130, 20);
  ctx.fillStyle = hex(null, '#ffffff', 0.08);
  ctx.fill();
  ctx.fillStyle = C.textSub;
  ctx.font = '44px sans-serif';
  ctx.fillText('  🔒  Contraseña', 180, 1545);

  // login button
  const grad2 = ctx.createLinearGradient(140, 1660, 140 + cw - 120, 1660);
  grad2.addColorStop(0, C.blue);
  grad2.addColorStop(1, C.blueD);
  roundRect(ctx, 140, 1660, cw - 120, 130, 20);
  ctx.fillStyle = grad2;
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 52px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Iniciar sesión', W/2, 1740);

  ctx.fillStyle = C.textSub;
  ctx.font = '40px sans-serif';
  ctx.fillText('— O continúa con —', W/2, 1870);

  // google btn
  roundRect(ctx, 140, 1900, cw - 120, 130, 20);
  ctx.fillStyle = hex(null, '#ffffff', 0.08);
  ctx.fill();
  roundRect(ctx, 140, 1900, cw - 120, 130, 20);
  ctx.strokeStyle = hex(null, '#ffffff', 0.15);
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = C.text;
  ctx.font = 'bold 48px sans-serif';
  ctx.fillText('G  Continuar con Google', W/2, 1978);

  ctx.textAlign = 'left';

  // bottom tagline
  ctx.fillStyle = C.textSub;
  ctx.font = '40px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Plataforma de Logística y Despacho', W/2, 2500);
  ctx.fillText('Área Metropolitana de Dallas, TX', W/2, 2560);

  // home indicator
  roundRect(ctx, W/2 - 200, H - 80, 400, 10, 5);
  ctx.fillStyle = hex(null, '#ffffff', 0.4);
  ctx.fill();

  const buf = canvas.toBuffer('image/png');
  fs.writeFileSync(`${OUT}/01-login.png`, buf);
  console.log('✓ 01-login.png');
}

// ─────────────────────────────────────────────────────────
// SCREEN 2 — DISPATCH MAP
// ─────────────────────────────────────────────────────────
async function screen2() {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // bg
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);

  statusBar(ctx);

  // top nav
  ctx.fillStyle = C.bgCard;
  ctx.fillRect(0, 120, W, 130);
  ctx.fillStyle = C.text;
  ctx.font = 'bold 54px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('🚚  Despacho', 60, 205);

  // stats row
  const stats = [
    { val: '13', lbl: 'APROBADAS', color: C.amber },
    { val: '51', lbl: 'ORDENADAS', color: C.blue },
    { val: '15', lbl: 'LISTO\nRECOGER', color: C.navy },
    { val: '13', lbl: 'EN\nENTREGA', color: C.cyan },
    { val: '11', lbl: 'ENTRE-\nGADAS', color: C.green },
  ];
  const sw = W / stats.length;
  stats.forEach((s, i) => {
    const sx = i * sw;
    ctx.fillStyle = hex(null, s.color, 0.15);
    ctx.fillRect(sx, 250, sw, 130);
    ctx.fillStyle = s.color;
    ctx.font = 'bold 60px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(s.val, sx + sw/2, 310);
    ctx.fillStyle = C.textSub;
    ctx.font = '24px sans-serif';
    ctx.fillText(s.lbl.split('\n')[0], sx + sw/2, 345);
    if (s.lbl.includes('\n')) ctx.fillText(s.lbl.split('\n')[1], sx + sw/2, 372);
  });

  // MAP area (dark green-grey like Google Maps night mode)
  ctx.fillStyle = '#1a2333';
  ctx.fillRect(0, 380, W, 960);

  // map grid lines (roads)
  ctx.strokeStyle = hex(null, '#334155', 0.8);
  ctx.lineWidth = 3;
  for (let x = 0; x < W; x += 140) { ctx.beginPath(); ctx.moveTo(x, 380); ctx.lineTo(x, 1340); ctx.stroke(); }
  for (let y = 380; y < 1340; y += 140) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  // main roads
  ctx.strokeStyle = hex(null, '#475569', 0.9);
  ctx.lineWidth = 8;
  [[0, 780, W, 860], [500, 380, 560, 1340], [0, 950, W, 920], [300, 380, 260, 1340]].forEach(([x1,y1,x2,y2]) => {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  });

  // order dots on map
  const mapDots = [
    [200, 520, C.amber], [380, 600, C.blue], [650, 450, C.blue], [900, 500, C.blue],
    [1100, 580, C.blue], [750, 700, C.navy], [450, 820, C.navy], [1050, 720, C.cyan],
    [300, 950, C.cyan], [800, 880, C.cyan], [600, 1050, C.green], [1150, 900, C.green],
    [200, 1100, C.blue], [900, 1150, C.navy], [1050, 1050, C.blue], [480, 1200, C.amber],
  ];
  mapDots.forEach(([x, y, c]) => {
    ctx.beginPath(); ctx.arc(x, y, 22, 0, Math.PI*2);
    ctx.fillStyle = hex(null, '#000000', 0.4); ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, 18, 0, Math.PI*2);
    ctx.fillStyle = c; ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, 18, 0, Math.PI*2);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.stroke();
  });

  // GPS marker
  ctx.beginPath(); ctx.arc(640, 860, 28, 0, Math.PI*2);
  ctx.fillStyle = hex(null, C.blue, 0.3); ctx.fill();
  ctx.beginPath(); ctx.arc(640, 860, 18, 0, Math.PI*2);
  ctx.fillStyle = '#ffffff'; ctx.fill();
  ctx.beginPath(); ctx.arc(640, 860, 10, 0, Math.PI*2);
  ctx.fillStyle = C.blue; ctx.fill();

  // legend
  const legendItems = [
    { c: C.amber, l: 'Aprobada' }, { c: C.blue, l: 'Ordenada' },
    { c: C.navy, l: 'Listo p/Recoger' }, { c: C.cyan, l: 'En Entrega' }, { c: C.green, l: 'Entregada' }
  ];
  roundRect(ctx, 30, 1260, 440, 70 + legendItems.length * 52, 16);
  ctx.fillStyle = hex(null, C.bg, 0.9); ctx.fill();
  legendItems.forEach((it, i) => {
    dot(ctx, 62, 1305 + i*52, 14, it.c);
    ctx.fillStyle = C.textMid;
    ctx.font = '34px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(it.l, 88, 1316 + i*52);
  });

  // search + filter bar
  roundRect(ctx, 40, 1360, W - 80, 110, 20);
  ctx.fillStyle = C.bgCard; ctx.fill();
  ctx.fillStyle = C.textSub;
  ctx.font = '44px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('  🔍  Buscar por nombre...', 80, 1430);

  // order cards
  const orders = [
    { name: 'AJ Premium Auto Detailing', addr: '3734 Clubway Ln, Dallas TX 75244', status: 'Listo p/Recoger', statusColor: C.navy, amount: '$70.00', phone: '+1 (972) 589-4282' },
    { name: 'Abdiel Lawncare', addr: '708 Carver St, Mesquite TX 75149', status: 'Ordenada', statusColor: C.blue, amount: '$80.00', phone: '+1 (214) 416-1442' },
    { name: 'Aida Cleaning', addr: '2025 E Union Bower Rd, Irving TX 75061', status: 'Listo p/Recoger', statusColor: C.navy, amount: '$60.00', phone: '+1 (214) 355-8025' },
    { name: 'Bella\'s Boutique', addr: '4511 Live Oak St, Dallas TX 75204', status: 'En Entrega', statusColor: C.cyan, amount: '$45.00', phone: '+1 (469) 223-0981' },
  ];

  let oy = 1500;
  orders.forEach((o) => {
    const oh = 260;
    card(ctx, 40, oy, W - 80, oh, 20);

    // left color bar
    ctx.fillStyle = o.statusColor;
    ctx.fillRect(40, oy, 8, oh);

    ctx.fillStyle = C.text;
    ctx.font = 'bold 46px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(o.name, 80, oy + 65);

    ctx.fillStyle = C.textSub;
    ctx.font = '36px sans-serif';
    ctx.fillText(o.addr, 80, oy + 115);
    ctx.fillText(o.phone, 80, oy + 160);

    // status badge
    badge(ctx, 80, oy + 185, o.status, o.statusColor, 280, 52);

    // amount
    ctx.fillStyle = C.green;
    ctx.font = 'bold 46px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(o.amount, W - 80, oy + 65);

    oy += oh + 20;
  });

  // home indicator
  roundRect(ctx, W/2 - 200, H - 80, 400, 10, 5);
  ctx.fillStyle = hex(null, '#ffffff', 0.4); ctx.fill();

  fs.writeFileSync(`${OUT}/02-dispatch-map.png`, canvas.toBuffer('image/png'));
  console.log('✓ 02-dispatch-map.png');
}

// ─────────────────────────────────────────────────────────
// SCREEN 3 — ROUTE PLANNER
// ─────────────────────────────────────────────────────────
async function screen3() {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);
  statusBar(ctx);
  navBar(ctx, '🗺  Planificador de Rutas');

  // Map section
  ctx.fillStyle = '#1a2333';
  ctx.fillRect(0, 240, W, 860);

  // roads
  ctx.strokeStyle = hex(null, '#475569', 0.7);
  ctx.lineWidth = 6;
  const roads = [[0,560,W,520],[0,700,W,740],[380,240,420,1100],[700,240,660,1100],[0,840,W,800]];
  roads.forEach(([x1,y1,x2,y2])=>{ ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke(); });

  // route line
  ctx.strokeStyle = C.blue;
  ctx.lineWidth = 12;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(200, 950); ctx.lineTo(310, 830); ctx.lineTo(490, 690);
  ctx.lineTo(650, 580); ctx.lineTo(810, 500); ctx.lineTo(960, 420);
  ctx.lineTo(1080, 560); ctx.stroke();

  // stop numbers on map
  const stops = [[200,950],[310,830],[490,690],[650,580],[810,500],[960,420],[1080,560]];
  stops.forEach(([x,y],i)=>{
    ctx.beginPath(); ctx.arc(x,y,30,0,Math.PI*2);
    ctx.fillStyle = i===0 ? C.green : (i===stops.length-1 ? C.red : C.blue);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(i===0?'▶':String(i), x, y+11);
  });
  ctx.textAlign = 'left';

  // GPS indicator
  ctx.fillStyle = C.green;
  ctx.font = 'bold 38px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('📍 Ubicación actual activa', 60, 1060);

  // route stats bar
  card(ctx, 40, 1100, W-80, 120, 20);
  const rStats = [['7','Paradas'],['38.4 mi','Distancia'],['1h 22m','Tiempo'],['$420','Cobrar']];
  const rsw = (W-80)/4;
  rStats.forEach(([v,l],i)=>{
    ctx.fillStyle = C.blue;
    ctx.font = 'bold 52px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(v, 40 + rsw*i + rsw/2, 1175);
    ctx.fillStyle = C.textSub;
    ctx.font = '32px sans-serif';
    ctx.fillText(l, 40 + rsw*i + rsw/2, 1208);
  });
  ctx.textAlign = 'left';

  // optimize + navigate buttons
  const btnY = 1240;
  roundRect(ctx, 40, btnY, (W-100)/2, 110, 20);
  const bg1 = ctx.createLinearGradient(40, btnY, 40+(W-100)/2, btnY);
  bg1.addColorStop(0,'#7c3aed'); bg1.addColorStop(1,'#4f46e5');
  ctx.fillStyle = bg1; ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 46px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('⚡ Optimizar Ruta', 40+(W-100)/4, btnY+68);

  const bx2 = 40+(W-100)/2+20;
  roundRect(ctx, bx2, btnY, (W-100)/2, 110, 20);
  const bg2 = ctx.createLinearGradient(bx2, btnY, bx2+(W-100)/2, btnY);
  bg2.addColorStop(0, C.green); bg2.addColorStop(1,'#16a34a');
  ctx.fillStyle = bg2; ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillText('▶ Iniciar Navegación', bx2+(W-100)/4, btnY+68);
  ctx.textAlign = 'left';

  // stop list
  const stopData = [
    { n:'AJ Premium Auto Detailing', a:'3734 Clubway Ln, Dallas TX', d:'4.2 mi', cash:'$70.00', done:false },
    { n:'Abdiel Lawncare', a:'708 Carver St, Mesquite TX', d:'6.8 mi', cash:'$80.00', done:false },
    { n:'Aida Cleaning', a:'2025 E Union Bower Rd, Irving TX', d:'8.1 mi', cash:'$60.00', done:false },
    { n:'Bella\'s Boutique', a:'4511 Live Oak St, Dallas TX', d:'3.5 mi', cash:'$45.00', done:true },
    { n:'Carlos Auto Repair', a:'1892 Singleton Blvd, Dallas TX', d:'5.9 mi', cash:'$90.00', done:false },
  ];

  let sy = 1380;
  ctx.fillStyle = C.textSub;
  ctx.font = 'bold 38px sans-serif';
  ctx.fillText('PARADAS DE LA RUTA', 60, sy);
  sy += 20;

  stopData.forEach((s, i) => {
    card(ctx, 40, sy, W-80, 220, 16);
    if (s.done) { ctx.fillStyle = hex(null, C.green, 0.05); roundRect(ctx, 40, sy, W-80, 220, 16); ctx.fill(); }

    // number circle
    ctx.beginPath(); ctx.arc(110, sy+110, 44, 0, Math.PI*2);
    ctx.fillStyle = s.done ? C.green : C.blue; ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 44px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(i+1), 110, sy+126);
    ctx.textAlign = 'left';

    ctx.fillStyle = s.done ? C.textSub : C.text;
    ctx.font = `${s.done?'':'bold '}46px sans-serif`;
    ctx.fillText(s.n, 180, sy+75);
    ctx.fillStyle = C.textSub;
    ctx.font = '36px sans-serif';
    ctx.fillText(s.a, 180, sy+125);

    // distance
    ctx.fillStyle = C.textSub;
    ctx.font = '34px sans-serif';
    ctx.fillText(`📍 ${s.d}`, 180, sy+175);

    // cash
    ctx.fillStyle = C.green;
    ctx.font = 'bold 48px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(s.cash, W-80, sy+75);

    if (s.done) {
      badge(ctx, W-300, sy+130, '✓ Entregada', C.green, 220, 52);
    } else {
      ctx.fillStyle = C.blue;
      ctx.font = '48px sans-serif';
      ctx.fillText('›', W-90, sy+185);
    }
    ctx.textAlign = 'left';
    sy += 240;
  });

  roundRect(ctx, W/2-200, H-80, 400, 10, 5);
  ctx.fillStyle = hex(null,'#ffffff',0.4); ctx.fill();

  fs.writeFileSync(`${OUT}/03-route-planner.png`, canvas.toBuffer('image/png'));
  console.log('✓ 03-route-planner.png');
}

// ─────────────────────────────────────────────────────────
// SCREEN 4 — DELIVERY EVIDENCE / ORDER DETAIL
// ─────────────────────────────────────────────────────────
async function screen4() {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);
  statusBar(ctx);
  navBar(ctx, 'Detalle de Entrega', true);

  let y = 280;

  // order header card
  card(ctx, 40, y, W-80, 280, 24);
  ctx.fillStyle = C.green;
  ctx.fillRect(40, y, 10, 280);

  ctx.fillStyle = C.text;
  ctx.font = 'bold 54px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Aida Cleaning Services', 80, y+75);

  ctx.fillStyle = C.textSub;
  ctx.font = '40px sans-serif';
  ctx.fillText('📍  2025 E Union Bower Rd, Irving TX 75061', 80, y+135);
  ctx.fillText('📞  +1 (214) 355-8025', 80, y+185);

  badge(ctx, 80, y+215, '✓ Entregada', C.green, 240, 58);
  ctx.fillStyle = C.green;
  ctx.font = 'bold 58px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('$60.00', W-80, y+80);
  ctx.fillStyle = C.textSub;
  ctx.font = '36px sans-serif';
  ctx.fillText('Efectivo', W-80, y+130);
  ctx.textAlign = 'left';

  y += 310;

  // evidence photos section
  ctx.fillStyle = C.textSub;
  ctx.font = 'bold 40px sans-serif';
  ctx.fillText('EVIDENCIA DE ENTREGA', 60, y+40);
  y += 60;

  // photo grid
  const photoW = (W - 120) / 2;
  const photos = [
    { label: 'Foto de producto', emoji: '📦' },
    { label: 'Comprobante de pago', emoji: '🧾' },
  ];
  photos.forEach((p, i) => {
    const px = 40 + i * (photoW + 40);
    roundRect(ctx, px, y, photoW, photoW * 0.75, 16);
    ctx.fillStyle = C.bgCard2; ctx.fill();
    roundRect(ctx, px, y, photoW, photoW * 0.75, 16);
    ctx.strokeStyle = C.border; ctx.lineWidth = 2; ctx.stroke();

    // fake photo content
    const grad = ctx.createLinearGradient(px, y, px+photoW, y+photoW*0.75);
    grad.addColorStop(0, '#1e293b');
    grad.addColorStop(1, '#334155');
    roundRect(ctx, px, y, photoW, photoW * 0.75, 16);
    ctx.fillStyle = grad; ctx.fill();

    ctx.font = '80px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(p.emoji, px + photoW/2, y + photoW*0.4);
    ctx.fillStyle = C.textSub;
    ctx.font = '34px sans-serif';
    ctx.fillText(p.label, px + photoW/2, y + photoW*0.68);
  });
  y += photoW * 0.75 + 20;

  // add photo button
  roundRect(ctx, 40, y, W-80, 120, 20);
  ctx.fillStyle = hex(null, C.blue, 0.15); ctx.fill();
  roundRect(ctx, 40, y, W-80, 120, 20);
  ctx.strokeStyle = C.blue; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = C.blue;
  ctx.font = 'bold 48px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('📷  Agregar foto de evidencia', W/2, y+72);
  ctx.textAlign = 'left';
  y += 150;

  // delivery info card
  card(ctx, 40, y, W-80, 340, 24);
  ctx.fillStyle = C.textSub;
  ctx.font = 'bold 38px sans-serif';
  ctx.fillText('INFORMACIÓN DE ENTREGA', 80, y+55);

  const infoRows = [
    ['Hora de entrega', '2:34 PM'],
    ['Método de pago', 'Efectivo'],
    ['Cobrado', '$60.00'],
    ['Chofer', 'Juan Pérez'],
    ['Ruta #', '14-B Dallas Norte'],
  ];
  infoRows.forEach(([k, v], i) => {
    const ry = y + 100 + i * 50;
    ctx.fillStyle = C.textMid;
    ctx.font = '36px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(k, 80, ry);
    ctx.fillStyle = C.text;
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(v, W-80, ry);
  });
  ctx.textAlign = 'left';
  y += 370;

  // navigation button
  const grad3 = ctx.createLinearGradient(40, y, W-40, y);
  grad3.addColorStop(0, C.blue); grad3.addColorStop(1, C.blueD);
  roundRect(ctx, 40, y, W-80, 130, 24);
  ctx.fillStyle = grad3; ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 52px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🧭  Abrir Navegación', W/2, y+82);
  ctx.textAlign = 'left';

  roundRect(ctx, W/2-200, H-80, 400, 10, 5);
  ctx.fillStyle = hex(null,'#ffffff',0.4); ctx.fill();

  fs.writeFileSync(`${OUT}/04-delivery-detail.png`, canvas.toBuffer('image/png'));
  console.log('✓ 04-delivery-detail.png');
}

// run all
(async () => {
  await screen1();
  await screen2();
  await screen3();
  await screen4();
  console.log(`\nDone! All screenshots at ${W}x${H}px → ${OUT}/`);
})();
