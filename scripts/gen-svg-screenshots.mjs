import sharp from 'sharp';
import fs from 'fs';
fs.mkdirSync('screenshots/appstore', { recursive: true });

const W = 1320, H = 2868;

const C = {
  bg:'#0f172a', card:'#1e293b', card2:'#334155',
  blue:'#3b82f6', blueD:'#1d4ed8', cyan:'#06b6d4',
  green:'#22c55e', orange:'#f97316', amber:'#f59e0b',
  purple:'#8b5cf6', navy:'#1565c0', text:'#f1f5f9',
  sub:'#94a3b8', mid:'#cbd5e1', border:'#334155',
  red:'#ef4444'
};

function rr(x,y,w,h,r,fill,stroke='none',sw=0){
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ry="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
}
function txt(x,y,t,fill,size,weight='normal',anchor='start'){
  return `<text x="${x}" y="${y}" fill="${fill}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" font-family="system-ui,sans-serif">${t}</text>`;
}
function circle(cx,cy,r,fill,stroke='none',sw=0){
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
}
function badge(x,y,w,h,label,color){
  return `${rr(x,y,w,h,h/2,color+'33',color,2)}${txt(x+w/2,y+h/2+11,label,color,30,'bold','middle')}`;
}
function statusBar(){
  return `${rr(0,0,W,110,0,C.bg)}
    ${txt(70,82,'9:41',C.text,50,'bold')}
    ${txt(W-70,82,'●●● ▮',C.text,40,'normal','end')}`;
}
function btn(x,y,w,h,label,c1,c2,textColor='#fff',fs=46){
  return `<defs><linearGradient id="bg${x}${y}" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/>
  </linearGradient></defs>
  ${rr(x,y,w,h,20,`url(#bg${x}${y})`)}
  ${txt(x+w/2,y+h/2+fs*0.35,label,textColor,fs,'bold','middle')}`;
}
function dot(cx,cy,r,fill){return circle(cx,cy,r,fill,'#fff',3);}

// ── SCREEN 1: LOGIN ──────────────────────────────────────
const s1 = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
<defs>
  <linearGradient id="bggrad" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#0f172a"/>
    <stop offset="50%" stop-color="#1a2744"/>
    <stop offset="100%" stop-color="#0f172a"/>
  </linearGradient>
  <radialGradient id="glow1" cx="0.15" cy="0.32">
    <stop offset="0%" stop-color="${C.blue}" stop-opacity="0.12"/>
    <stop offset="100%" stop-color="${C.blue}" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="glow2" cx="0.85" cy="0.72">
    <stop offset="0%" stop-color="${C.cyan}" stop-opacity="0.1"/>
    <stop offset="100%" stop-color="${C.cyan}" stop-opacity="0"/>
  </radialGradient>
</defs>
${rr(0,0,W,H,0,'url(#bggrad)')}
${rr(0,0,W,H,0,'url(#glow1)')}
${rr(0,0,W,H,0,'url(#glow2)')}
${statusBar()}

${circle(W/2,800,160,C.blue+'22')}
${circle(W/2,800,130,C.bg)}
${circle(W/2,800,130,'none',C.blue,4)}
${txt(W/2,840,'862',C.blue,100,'bold','middle')}

${txt(W/2,1090,'Area 862',C.text,82,'bold','middle')}
${txt(W/2,1155,'Accede a tu cuenta para continuar',C.sub,44,'normal','middle')}

${rr(80,1240,W-160,880,40,'#ffffff11','#ffffff1a',2)}

${rr(130,1320,W-260,128,20,'#ffffff0d')}
${txt(190,1400,'✉  Correo electrónico',C.sub,44)}

${rr(130,1490,W-260,128,20,'#ffffff0d')}
${txt(190,1570,'🔒  Contraseña',C.sub,44)}

${btn(130,1670,W-260,128,'Iniciar sesión',C.blue,C.blueD,'#fff',52)}

${txt(W/2,1870,'— O continúa con —',C.sub,40,'normal','middle')}

${rr(130,1900,W-260,128,20,'#ffffff0d','#ffffff22',2)}
${txt(W/2,1976,'G  Continuar con Google',C.text,48,'bold','middle')}

${txt(W/2,2480,'Plataforma de Logística y Despacho',C.sub,40,'normal','middle')}
${txt(W/2,2540,'Área Metropolitana de Dallas, TX',C.sub,38,'normal','middle')}

${rr(W/2-200,H-80,400,10,5,'#ffffff66')}
</svg>`;

// ── SCREEN 2: DISPATCH MAP ───────────────────────────────
function orderCard(y,name,addr,phone,status,statusColor,amount){
  return `${rr(40,y,W-80,250,20,C.card,C.border,2)}
  ${rr(40,y,8,250,4,statusColor)}
  ${txt(80,y+68,name,C.text,46,'bold')}
  ${txt(80,y+120,addr,C.sub,36)}
  ${txt(80,y+168,phone,C.sub,36)}
  ${badge(80,y+192,280,52,status,statusColor)}
  ${txt(W-80,y+72,amount,C.green,48,'bold','end')}`;
}

const s2 = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
${rr(0,0,W,H,0,C.bg)}
${statusBar()}
${rr(0,120,W,130,0,C.card)}
${txt(60,208,'🚚  Despacho',C.text,54,'bold')}

${[
  {v:'13',l:'APROBADAS',c:C.amber},{v:'51',l:'ORDENADAS',c:C.blue},
  {v:'15',l:'LISTO/RECOGER',c:C.navy},{v:'13',l:'EN ENTREGA',c:C.cyan},{v:'11',l:'ENTREGADAS',c:C.green}
].map(({v,l,c},i)=>`
  ${rr(i*(W/5),250,W/5,130,0,c+'26')}
  ${txt(i*(W/5)+W/10,305,v,c,60,'bold','middle')}
  ${txt(i*(W/5)+W/10,348,l.split('/')[0],C.sub,22,'normal','middle')}
  ${l.includes('/')? txt(i*(W/5)+W/10,372,l.split('/')[1],C.sub,22,'normal','middle'):''}
`).join('')}

${rr(0,380,W,960,0,'#1a2333')}
${[0,140,280,420,560,700,840,980,1120].map(x=>`<line x1="${x}" y1="380" x2="${x}" y2="1340" stroke="#33415540" stroke-width="2"/>`).join('')}
${[380,520,660,800,940,1080,1220].map(y=>`<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#33415540" stroke-width="2"/>`).join('')}

<line x1="0" y1="760" x2="${W}" y2="800" stroke="#475569" stroke-width="8"/>
<line x1="0" y1="940" x2="${W}" y2="900" stroke="#475569" stroke-width="8"/>
<line x1="480" y1="380" x2="520" y2="1340" stroke="#475569" stroke-width="8"/>
<line x1="800" y1="380" x2="760" y2="1340" stroke="#475569" stroke-width="8"/>

${[[200,520,C.amber],[380,600,C.blue],[650,450,C.blue],[920,510,C.blue],
   [1100,580,C.blue],[740,700,C.navy],[450,820,C.navy],[1060,720,C.cyan],
   [300,950,C.cyan],[810,880,C.cyan],[600,1050,C.green],[1150,900,C.green],
   [190,1100,C.blue],[890,1150,C.navy],[1050,1060,C.blue],[480,1220,C.amber]
].map(([x,y,c])=>`${circle(x,y,22,'#00000066')}${dot(x,y,18,c)}`).join('')}

${circle(640,860,28,C.blue+'55')}${circle(640,860,18,'#ffffff')}${circle(640,860,10,C.blue)}

${rr(30,1252,450,316,16,C.bg+'ee')}
${[{c:C.amber,l:'Aprobada'},{c:C.blue,l:'Ordenada'},{c:C.navy,l:'Listo p/Recoger'},
   {c:C.cyan,l:'En Entrega'},{c:C.green,l:'Entregada'}
].map(({c,l},i)=>`${circle(62,1302+i*52,14,c)}${txt(88,1314+i*52,l,C.mid,34)}`).join('')}

${rr(40,1358,W-80,110,20,C.card)}
${txt(80,1430,'🔍  Buscar por nombre...',C.sub,44)}

${orderCard(1500,'AJ Premium Auto Detailing','3734 Clubway Ln, Dallas TX 75244','+1 (972) 589-4282','Listo p/Recoger',C.navy,'$70.00')}
${orderCard(1770,'Abdiel Lawncare','708 Carver St, Mesquite TX 75149','+1 (214) 416-1442','Ordenada',C.blue,'$80.00')}
${orderCard(2040,'Aida Cleaning','2025 E Union Bower Rd, Irving TX 75061','+1 (214) 355-8025','Listo p/Recoger',C.navy,'$60.00')}
${orderCard(2310,'Bella\'s Boutique','4511 Live Oak St, Dallas TX 75204','+1 (469) 223-0981','En Entrega',C.cyan,'$45.00')}

${rr(W/2-200,H-80,400,10,5,'#ffffff66')}
</svg>`;

// ── SCREEN 3: ROUTE PLANNER ──────────────────────────────
function stopCard(y,num,name,addr,dist,amount,done=false){
  return `${rr(40,y,W-80,218,16,C.card,C.border,2)}
  ${done?rr(40,y,W-80,218,16,C.green+'0d'):''}
  ${circle(110,y+109,44,done?C.green:C.blue)}
  ${txt(110,y+126,done?'✓':String(num),'#fff',44,'bold','middle')}
  ${txt(180,y+72,name,done?C.sub:C.text,46,'bold')}
  ${txt(180,y+120,addr,C.sub,34)}
  ${txt(180,y+168,'📍 '+dist,C.sub,34)}
  ${txt(W-80,y+72,amount,C.green,48,'bold','end')}
  ${done?badge(W-310,y+128,'✓ Entregada',C.green,228,52):''}`;
}

const s3 = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
${rr(0,0,W,H,0,C.bg)}
${statusBar()}
${rr(0,120,W,120,0,C.card)}
${txt(W/2,204,'🗺  Planificador de Rutas',C.text,54,'bold','middle')}

${rr(0,240,W,860,0,'#1a2333')}
${[0,140,280,420,560,700,840,980,1120].map(x=>`<line x1="${x}" y1="240" x2="${x}" y2="1100" stroke="#33415530" stroke-width="2"/>`).join('')}
${[340,480,620,760,900,1040].map(y=>`<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#33415530" stroke-width="2"/>`).join('')}
<line x1="0" y1="550" x2="${W}" y2="510" stroke="#47556990" stroke-width="6"/>
<line x1="0" y1="700" x2="${W}" y2="720" stroke="#47556990" stroke-width="6"/>
<line x1="480" y1="240" x2="510" y2="1100" stroke="#47556990" stroke-width="6"/>

<polyline points="200,960 310,840 490,700 650,590 810,510 960,430 1080,560"
  fill="none" stroke="${C.blue}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>

${[[200,960,C.green,'▶'],[310,840,C.blue,'1'],[490,700,C.blue,'2'],[650,590,C.blue,'3'],
   [810,510,C.blue,'4'],[960,430,C.blue,'5'],[1080,560,C.red,'■']
].map(([x,y,c,lbl])=>`${circle(x,y,30,c)}${txt(x,y+12,lbl,'#fff',30,'bold','middle')}`).join('')}

${txt(60,1060,'📍 Ubicación actual activa',C.green,38,'bold')}

${rr(40,1102,W-80,120,20,C.card,C.border,2)}
${[['7','Paradas'],['38.4 mi','Distancia'],['1h 22m','Tiempo'],['$420','Cobrar']].map(([v,l],i)=>`
  ${txt(40+(W-80)/4*i+(W-80)/8,1168,v,C.blue,52,'bold','middle')}
  ${txt(40+(W-80)/4*i+(W-80)/8,1204,l,C.sub,30,'normal','middle')}
`).join('')}

${btn(40,1244,(W-100)/2,110,'⚡ Optimizar Ruta','#7c3aed','#4f46e5','#fff',46)}
${btn(40+(W-100)/2+20,1244,(W-100)/2,110,'▶ Iniciar Navegación',C.green,'#16a34a','#fff',46)}

${txt(60,1408,'PARADAS DE LA RUTA',C.sub,38,'bold')}

${stopCard(1428,1,'AJ Premium Auto Detailing','3734 Clubway Ln, Dallas TX','4.2 mi','$70.00')}
${stopCard(1656,2,'Abdiel Lawncare','708 Carver St, Mesquite TX','6.8 mi','$80.00')}
${stopCard(1884,3,'Aida Cleaning','2025 E Union Bower Rd, Irving TX','8.1 mi','$60.00',true)}
${stopCard(2112,4,"Bella's Boutique",'4511 Live Oak St, Dallas TX','3.5 mi','$45.00')}
${stopCard(2340,5,'Carlos Auto Repair','1892 Singleton Blvd, Dallas TX','5.9 mi','$90.00')}

${rr(W/2-200,H-80,400,10,5,'#ffffff66')}
</svg>`;

// ── SCREEN 4: DELIVERY DETAIL ────────────────────────────
const s4 = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
${rr(0,0,W,H,0,C.bg)}
${statusBar()}
${rr(0,120,W,120,0,C.card)}
${txt(60,204,'‹  Atrás',C.blue,46,'normal')}
${txt(W/2,204,'Detalle de Entrega',C.text,54,'bold','middle')}

${rr(40,270,W-80,280,24,C.card,C.border,2)}
${rr(40,270,10,280,4,C.green)}
${txt(80,340,'Aida Cleaning Services',C.text,54,'bold')}
${txt(80,400,'📍  2025 E Union Bower Rd, Irving TX 75061',C.sub,38)}
${txt(80,450,'📞  +1 (214) 355-8025',C.sub,38)}
${badge(80,468,240,58,'✓ Entregada',C.green)}
${txt(W-80,344,'$60.00',C.green,60,'bold','end')}
${txt(W-80,400,'Efectivo',C.sub,36,'normal','end')}

${txt(60,610,'EVIDENCIA DE ENTREGA',C.sub,40,'bold')}

${rr(40,648,(W-120)/2,420,16,C.card2,C.border,2)}
<defs><linearGradient id="ph1" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0%" stop-color="#1e293b"/><stop offset="100%" stop-color="#334155"/>
</linearGradient></defs>
${rr(40,648,(W-120)/2,420,16,'url(#ph1)')}
${txt(40+(W-120)/4,858,'📦',C.text,100,'normal','middle')}
${txt(40+(W-120)/4,1008,'Foto de producto',C.sub,34,'normal','middle')}

${rr(40+(W-120)/2+40,648,(W-120)/2,420,16,C.card2,C.border,2)}
<defs><linearGradient id="ph2" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0%" stop-color="#1e293b"/><stop offset="100%" stop-color="#334155"/>
</linearGradient></defs>
${rr(40+(W-120)/2+40,648,(W-120)/2,420,16,'url(#ph2)')}
${txt(40+(W-120)/2+40+(W-120)/4,858,'🧾',C.text,100,'normal','middle')}
${txt(40+(W-120)/2+40+(W-120)/4,1008,'Comprobante de pago',C.sub,34,'normal','middle')}

${rr(40,1090,W-80,120,20,C.blue+'22',C.blue,2)}
${txt(W/2,1162,'📷  Agregar foto de evidencia',C.blue,48,'bold','middle')}

${rr(40,1232,W-80,380,24,C.card,C.border,2)}
${txt(80,1290,'INFORMACIÓN DE ENTREGA',C.sub,38,'bold')}
${[['Hora de entrega','2:34 PM'],['Método de pago','Efectivo'],
   ['Cobrado','$60.00'],['Chofer','Juan Pérez'],['Ruta #','14-B Dallas Norte']
].map(([k,v],i)=>`
  ${txt(80,1360+i*50,k,C.mid,36)}
  ${txt(W-80,1360+i*50,v,C.text,36,'bold','end')}
`).join('')}

${rr(40,1634,W-80,360,24,C.card,C.border,2)}
${txt(80,1694,'HISTORIAL DE ESTADOS',C.sub,38,'bold')}
${[
  {t:'Entregada','h':'2:34 PM',c:C.green},
  {t:'En Entrega','h':'1:15 PM',c:C.cyan},
  {t:'Listo p/Recoger','h':'10:30 AM',c:C.navy},
  {t:'Ordenada','h':'9:00 AM',c:C.blue},
].map(({t,h,c},i)=>`
  ${circle(82,1750+i*52,14,c)}
  ${txt(108,1762+i*52,t,C.mid,34)}
  ${txt(W-80,1762+i*52,h,C.sub,32,'normal','end')}
`).join('')}

${rr(40,2016,W-80,220,24,C.card,C.border,2)}
${txt(80,2070,'NAVEGACIÓN',C.sub,38,'bold')}
${[['Google Maps','#4285f4'],['Waze','#33ccff'],['Apple Maps','#1da1f2']].map(([l,c],i)=>`
  ${rr(80+i*360,2094,320,100,16,c+'22',c,2)}
  ${txt(80+i*360+160,2158,l,c,34,'bold','middle')}
`).join('')}

${btn(40,2258,W-80,128,'🧭  Abrir Navegación',C.blue,C.blueD,'#fff',52)}

${rr(W/2-200,H-80,400,10,5,'#ffffff66')}
</svg>`;

async function saveSvgAsPng(svgStr, outPath){
  const buf = Buffer.from(svgStr);
  await sharp(buf, { density: 72 })
    .resize(W, H, { fit: 'fill' })
    .png({ compressionLevel: 9 })
    .toFile(outPath);
  console.log('✓', outPath);
}

await saveSvgAsPng(s1, 'screenshots/appstore/01-login.png');
await saveSvgAsPng(s2, 'screenshots/appstore/02-dispatch-map.png');
await saveSvgAsPng(s3, 'screenshots/appstore/03-route-planner.png');
await saveSvgAsPng(s4, 'screenshots/appstore/04-delivery-detail.png');

console.log(`\nDone! All 4 screenshots at ${W}×${H}px`);
