import { sequelize, User, Route, Stop } from '../src/models/index.js';

const EMAIL = 'driver.test@area862.com';
const PASSWORD = 'Test1234!';
const USERNAME = 'Driver Prueba';

async function main() {
  await sequelize.authenticate();

  let driver = await User.findOne({ where: { email: EMAIL } });
  if (!driver) {
    driver = User.build({
      username: USERNAME,
      email: EMAIL,
      role: 'driver',
      active: true,
      commission_per_stop: 2.5,
    });
    await driver.setPassword(PASSWORD);
    await driver.save();
    console.log(`✓ Driver creado id=${driver.id}`);
  } else {
    driver.role = 'driver';
    driver.active = true;
    await driver.setPassword(PASSWORD);
    await driver.save();
    console.log(`✓ Driver actualizado id=${driver.id} (password reseteado)`);
  }

  let admin = await User.findOne({ where: { role: 'admin' } });
  if (!admin) {
    admin = User.build({
      username: 'Admin',
      email: 'admin@area862.com',
      role: 'admin',
      active: true,
    });
    await admin.setPassword('admin123');
    await admin.save();
    console.log(`✓ Admin creado id=${admin.id} (admin@area862.com / admin123)`);
  }

  // Borrar rutas previas de prueba para este driver
  const oldRoutes = await Route.findAll({
    where: { assigned_driver_id: driver.id, name: 'Ruta de Prueba - Tabs' },
  });
  for (const r of oldRoutes) {
    await Stop.destroy({ where: { route_id: r.id } });
    await r.destroy();
  }

  const route = await Route.create({
    user_id: admin.id,
    assigned_driver_id: driver.id,
    name: 'Ruta de Prueba - Tabs',
    status: 'assigned',
    is_optimized: true,
    vehicle_type: 'car',
    optimization_mode: 'fastest',
    total_distance: 12.4,
    total_duration: 45,
    start_address: 'San Juan, PR',
    start_lat: 18.4655,
    start_lng: -66.1057,
  });

  // 5 paradas reales en San Juan / Bayamón / Carolina (PR)
  const stopsData = [
    {
      address: 'Av. Ashford 1056, San Juan, PR 00907',
      lat: 18.4593, lng: -66.0726,
      customer_name: 'María Rodríguez',
      phone: '787-555-0101',
      note: 'Apto 3B - tocar bocina',
      apartment_number: '3B',
      total_to_collect: 45.50,
    },
    {
      address: 'Calle Loíza 2050, San Juan, PR 00911',
      lat: 18.4501, lng: -66.0541,
      customer_name: 'José Martínez',
      phone: '787-555-0102',
      note: 'Casa esquinera azul',
      total_to_collect: 28.00,
    },
    {
      address: 'Av. Roberto H. Todd 405, Santurce, PR 00907',
      lat: 18.4470, lng: -66.0753,
      customer_name: 'Ana Pérez',
      phone: '787-555-0103',
      total_to_collect: 67.25,
    },
    {
      address: 'Calle San Sebastián 100, Viejo San Juan, PR 00901',
      lat: 18.4663, lng: -66.1170,
      customer_name: 'Luis Torres',
      phone: '787-555-0104',
      note: 'Llamar al llegar',
      total_to_collect: 0,
    },
    {
      address: 'Plaza Las Américas, Hato Rey, PR 00918',
      lat: 18.4205, lng: -66.0707,
      customer_name: 'Carmen Díaz',
      phone: '787-555-0105',
      apartment_number: '12A',
      total_to_collect: 33.75,
    },
  ];

  for (let i = 0; i < stopsData.length; i++) {
    const s = stopsData[i];
    await Stop.create({
      route_id: route.id,
      address: s.address,
      lat: s.lat,
      lng: s.lng,
      order: i,
      original_order: i,
      customer_name: s.customer_name,
      phone: s.phone,
      note: s.note || null,
      apartment_number: s.apartment_number || null,
      total_to_collect: s.total_to_collect,
      payment_status: 'pending',
      status: 'pending',
      duration: 5,
    });
  }

  console.log(`✓ Ruta creada id=${route.id} con ${stopsData.length} paradas`);
  console.log('');
  console.log('═══════════════════════════════════════');
  console.log('  CREDENCIALES DE PRUEBA');
  console.log('═══════════════════════════════════════');
  console.log(`  Email:    ${EMAIL}`);
  console.log(`  Password: ${PASSWORD}`);
  console.log(`  Rol:      driver`);
  console.log('───────────────────────────────────────');
  console.log(`  Ruta:     "${route.name}" (${stopsData.length} paradas)`);
  console.log(`  Status:   assigned`);
  console.log('═══════════════════════════════════════');

  await sequelize.close();
}

main().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
