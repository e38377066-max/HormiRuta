/**
 * @fileoverview Utilidades para el manejo del historial de entregas.
 * Proporciona funciones para guardar instantáneas de órdenes completadas.
 */

import DeliveryHistory from '../models/DeliveryHistory.js';
import User from '../models/User.js';

/**
 * @description Guarda un snapshot único de una orden en DeliveryHistory.
 * Evita duplicados basados en (original_order_id, delivered_at).
 * Permite múltiples snapshots si la misma orden se reactiva y se entrega de nuevo.
 * @param {Object} order - El objeto de la orden a guardar.
 * @returns {Promise<void>}
 */
export async function saveToDeliveryHistory(order) {
  try {
    const deliveredAt = order.delivered_at || new Date();
    const existing = await DeliveryHistory.findOne({
      where: { original_order_id: order.id, delivered_at: deliveredAt }
    });
    if (existing) return;

    const driver = order.assigned_driver_id ? await User.findByPk(order.assigned_driver_id) : null;
    const monthYear = `${deliveredAt.getFullYear()}-${String(deliveredAt.getMonth() + 1).padStart(2, '0')}`;

    await DeliveryHistory.create({
      original_order_id: order.id,
      customer_name: order.customer_name,
      customer_phone: order.customer_phone,
      address: order.validated_address,
      city: order.city,
      state: order.state,
      driver_id: order.assigned_driver_id,
      driver_name: driver?.username || order.driver_name || null,
      commission_per_stop: driver?.commission_per_stop || 0,
      order_cost: order.order_cost || 0,
      deposit_amount: order.deposit_amount || 0,
      total_to_collect: order.total_to_collect || 0,
      amount_collected: order.amount_collected || 0,
      payment_method: order.payment_method,
      payment_status: order.payment_status,
      delivered_at: deliveredAt,
      month_year: monthYear,
      archived: false
    });
  } catch (err) {
    console.error('[DeliveryHistory] Error guardando snapshot:', err.message);
  }
}
