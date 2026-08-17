/**
 * Script de semilla: crea usuario admin y 5 órdenes de prueba en el dispatcher.
 * Uso: node scripts/seed-admin-and-orders.js
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { sequelize, User, ValidatedAddress } from '../src/models/index.js';

async function seed() {
  await sequelize.authenticate();
  console.log('DB conectada.');

  // ── 1. Admin ──────────────────────────────────────────────
  const email = 'admin@area862.com';
  const plainPassword = 'Admin862!';

  let admin = await User.findOne({ where: { email } });
  if (admin) {
    console.log(`Usuario admin ya existe (id=${admin.id}). Actualizando contraseña y rol...`);
    admin.role = 'admin';
    admin.active = true;
    await admin.setPassword(plainPassword);
    await admin.save();
  } else {
    admin = await User.create({
      username: 'Admin',
      email,
      role: 'admin',
      active: true,
    });
    await admin.setPassword(plainPassword);
    await admin.save();
    console.log(`Admin creado con id=${admin.id}`);
  }
  console.log(`✅ Admin listo — email: ${email}  contraseña: ${plainPassword}`);

  // ── 2. Órdenes de prueba en el dispatcher ─────────────────
  const testOrders = [
    {
      customer_name: 'Carlos Mendoza',
      customer_phone: '4697001234',
      original_address: '1234 Elm St, Dallas, TX 75201',
      validated_address: '1234 Elm St, Dallas, TX 75201, USA',
      address_lat: 32.7767,
      address_lng: -96.7970,
      zip_code: '75201',
      city: 'Dallas',
      state: 'TX',
      amount: 185.50,
      order_cost: 185.50,
      total_to_collect: 185.50,
      payment_method: 'cash',
      payment_status: 'pending',
      order_status: 'approved',
      dispatch_status: 'available',
      notes: 'Llamar antes de llegar',
    },
    {
      customer_name: 'María López',
      customer_phone: '9727654321',
      original_address: '5678 Oak Ave, Garland, TX 75040',
      validated_address: '5678 Oak Ave, Garland, TX 75040, USA',
      address_lat: 32.9126,
      address_lng: -96.6389,
      zip_code: '75040',
      city: 'Garland',
      state: 'TX',
      amount: 320.00,
      order_cost: 320.00,
      total_to_collect: 320.00,
      payment_method: 'card',
      payment_status: 'pending',
      order_status: 'approved',
      dispatch_status: 'available',
      notes: 'Dejar en la puerta trasera',
    },
    {
      customer_name: 'José Ramírez',
      customer_phone: '2143339876',
      original_address: '910 Maple Dr, Irving, TX 75060',
      validated_address: '910 Maple Dr, Irving, TX 75060, USA',
      address_lat: 32.8140,
      address_lng: -96.9489,
      zip_code: '75060',
      city: 'Irving',
      state: 'TX',
      amount: 98.75,
      order_cost: 98.75,
      total_to_collect: 98.75,
      payment_method: 'cash',
      payment_status: 'pending',
      order_status: 'pickup_ready',
      dispatch_status: 'available',
      notes: 'Fragil - manejar con cuidado',
    },
    {
      customer_name: 'Ana Torres',
      customer_phone: '4695551234',
      original_address: '2345 Pine St, Plano, TX 75024',
      validated_address: '2345 Pine St, Plano, TX 75024, USA',
      address_lat: 33.0198,
      address_lng: -96.6989,
      zip_code: '75024',
      city: 'Plano',
      state: 'TX',
      amount: 540.00,
      order_cost: 540.00,
      total_to_collect: 270.00,
      deposit_amount: 270.00,
      payment_method: 'cash',
      payment_status: 'pending',
      order_status: 'approved',
      dispatch_status: 'available',
      notes: 'Depósito pagado. Cobrar el resto',
    },
    {
      customer_name: 'Roberto Flores',
      customer_phone: '9724445678',
      original_address: '7890 Cedar Blvd, Mesquite, TX 75150',
      validated_address: '7890 Cedar Blvd, Mesquite, TX 75150, USA',
      address_lat: 32.7668,
      address_lng: -96.5992,
      zip_code: '75150',
      city: 'Mesquite',
      state: 'TX',
      amount: 215.25,
      order_cost: 215.25,
      total_to_collect: 215.25,
      payment_method: 'card',
      payment_status: 'pending',
      order_status: 'ordered',
      dispatch_status: 'available',
      notes: 'Pago con tarjeta al entregar',
    },
  ];

  let created = 0;
  for (const order of testOrders) {
    await ValidatedAddress.create({ ...order, user_id: admin.id });
    created++;
    console.log(`  ✅ Orden creada: ${order.customer_name} — $${order.amount}`);
  }

  console.log(`\n🎉 Listo: admin creado y ${created} órdenes de prueba en el dispatcher.`);
  await sequelize.close();
}

seed().catch(e => { console.error(e); process.exit(1); });
