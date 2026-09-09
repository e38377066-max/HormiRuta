import { MessagingSettings, ValidatedAddress } from '../models/index.js';
import { saveToDeliveryHistory } from '../utils/deliveryHistory.js';
import respondApiService from './respondApiService.js';

/**
 * Finds the order represented by a route stop. Driver-added and dispatcher-
 * added orders use the same route/order relationship, so delivery completion
 * must not depend on where the order originated.
 */
export async function findOrderForStop(stop) {
  if (!stop?.route_id) return null;

  const routeOrders = await ValidatedAddress.findAll({
    where: { route_id: stop.route_id }
  });

  return routeOrders.find(order =>
    Number.isFinite(Number(order.address_lat)) &&
    Number.isFinite(Number(order.address_lng)) &&
    Math.abs(Number(order.address_lat) - Number(stop.lat)) < 0.0001 &&
    Math.abs(Number(order.address_lng) - Number(stop.lng)) < 0.0001
  ) || routeOrders.find(order => order.validated_address === stop.address) || null;
}

/**
 * Moves an order to its final delivered state and synchronizes the external
 * conversation when a Respond.io contact is available.
 */
export async function markOrderDelivered(order) {
  if (!order) return null;

  order.order_status = 'delivered';
  order.delivered_at = order.delivered_at || new Date();
  order.previous_order_status = null;
  await order.save();
  await saveToDeliveryHistory(order);

  if (!order.respond_contact_id && !order.customer_phone) return order;

  try {
    const settings = await MessagingSettings.findOne({
      where: { user_id: order.user_id }
    });
    if (!settings?.respond_api_token) return order;

    respondApiService.setContext(order.user_id, settings.respond_api_token);
    let identifier = order.respond_contact_id || null;
    if (!identifier && order.customer_phone) {
      const phone = String(order.customer_phone).replace(/\s+/g, '');
      identifier = `phone:${phone.startsWith('+') ? phone : '+' + phone}`;
    }

    if (identifier) {
      await respondApiService.updateLifecycle(identifier, 'Delivered');
      console.log(`[Delivery] Lifecycle actualizado en Respond.io: ${order.customer_name || order.id} -> Delivered`);
    }
  } catch (error) {
    // The local delivery must remain committed even if Respond.io is
    // temporarily unavailable. The next lifecycle reconciliation can retry it.
    console.error(`[Delivery] Error actualizando Respond.io para ${order.customer_name || order.id}:`, error.message);
  }

  return order;
}