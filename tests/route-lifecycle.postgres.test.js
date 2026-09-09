import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { randomUUID } from 'node:crypto';

// This suite is intentionally opt-in. Use an isolated PostgreSQL database by
// setting DATABASE_URL_TEST (or DATABASE_URL outside production).
const databaseUrl = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL;
const shouldRun = Boolean(databaseUrl) && process.env.NODE_ENV !== 'production';

if (shouldRun) {
  process.env.DATABASE_URL = databaseUrl;
}

let router;
let routesRouter;
let stopsRouter;
let sequelize;
let User;
let Route;
let Stop;
let ValidatedAddress;
let DeliveryHistory;
let FavoriteAddress;
let MessagingSettings;
let ServiceAgent;
let Op;
let admin;
let driver;
const created = {
  routeIds: [],
  stopIds: [],
  orderIds: [],
  favoriteIds: [],
  messagingSettingsIds: [],
  serviceAgentIds: [],
  driverIds: []
};
let marker;

function response() {
  return {
    statusCode: 200,
    body: undefined,
    finished: false,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      this.finished = true;
      return this;
    },
    send(body) {
      this.body = body;
      this.finished = true;
      return this;
    }
  };
}

function findRoute(routerToSearch, method, path) {
  const layer = routerToSearch.stack.find(item =>
    item.route?.path === path && item.route.methods[method.toLowerCase()]
  );
  assert.ok(layer, `route not found: ${method} ${path}`);
  return layer.route.stack.map(item => item.handle);
}

async function callRoute(routerToSearch, method, path, {
  userId = admin.id,
  params = {},
  body = {},
  query = {}
} = {}) {
  const req = {
    params,
    body,
    query,
    headers: {},
    session: { userId }
  };
  const res = response();

  for (const handler of findRoute(routerToSearch, method, path)) {
    await new Promise((resolve, reject) => {
      let nextCalled = false;
      const next = (error) => {
        nextCalled = true;
        if (error) reject(error);
        else resolve();
      };

      Promise.resolve(handler(req, res, next)).then(() => {
        if (!nextCalled) resolve();
      }, reject);
    });
    if (res.finished) break;
  }
  return res;
}

async function createRoute(attributes = {}) {
  const route = await Route.create({
    user_id: admin.id,
    name: `${marker}-route-${created.routeIds.length}`,
    ...attributes
  });
  created.routeIds.push(route.id);
  return route;
}

async function createStop(routeId, order, attributes = {}) {
  const stop = await Stop.create({
    route_id: routeId,
    address: `${marker} address ${created.stopIds.length}`,
    lat: 32.8 + created.stopIds.length / 10000,
    lng: -96.8 - created.stopIds.length / 10000,
    order: created.stopIds.length,
    customer_name: 'Lifecycle test customer',
    ...attributes
  });
  created.stopIds.push(stop.id);
  if (order) {
    order.address_lat = stop.lat;
    order.address_lng = stop.lng;
    order.validated_address = stop.address;
    await order.save();
  }
  return stop;
}

async function createOrder(routeId, attributes = {}) {
  const order = await ValidatedAddress.create({
    user_id: admin.id,
    original_address: `${marker} original ${created.orderIds.length}`,
    validated_address: `${marker} order ${created.orderIds.length}`,
    address_lat: 33 + created.orderIds.length / 10000,
    address_lng: -97 - created.orderIds.length / 10000,
    customer_name: 'Lifecycle test customer',
    route_id: routeId,
    dispatch_status: 'assigned',
    order_status: 'approved',
    payment_status: 'pending',
    package_disposition: 'normal',
    ...attributes
  });
  created.orderIds.push(order.id);
  return order;
}

async function createMatchedPair(routeId, orderAttributes = {}, stopAttributes = {}) {
  const pairIndex = created.orderIds.length;
  const order = await createOrder(routeId, {
    validated_address: `${marker} matched pair ${pairIndex}`,
    address_lat: 40 + pairIndex,
    address_lng: -100 - pairIndex,
    ...orderAttributes
  });
  const stop = await Stop.create({
    route_id: routeId,
    address: order.validated_address,
    lat: order.address_lat,
    lng: order.address_lng,
    order: created.stopIds.length,
    customer_name: order.customer_name,
    ...stopAttributes
  });
  created.stopIds.push(stop.id);
  return { order, stop };
}

describe('route lifecycle delivery-history protections with PostgreSQL', { skip: !shouldRun }, () => {
  before(async () => {
    ({ sequelize, User, Route, Stop, ValidatedAddress, DeliveryHistory, FavoriteAddress, MessagingSettings, ServiceAgent } =
      await import('../src/models/index.js'));
    ({ Op } = await import('sequelize'));
    ({ default: router } = await import('../src/routes/dispatch.js'));
    ({ default: routesRouter } = await import('../src/routes/routes.js'));
    ({ default: stopsRouter } = await import('../src/routes/stops.js'));

    await sequelize.authenticate();
    // Sync only the tables used by this suite; alter them so newly added
    // lifecycle columns are present in an existing test database.
    for (const model of [User, FavoriteAddress, Route, Stop, ValidatedAddress, DeliveryHistory, MessagingSettings, ServiceAgent]) {
      await model.sync({ alter: { drop: false } });
    }

    marker = `route-lifecycle-${randomUUID()}`;
    admin = await User.create({
      username: `${marker}-admin`,
      email: `${marker}@example.test`,
      role: 'admin'
    });

    const messagingSettings = await MessagingSettings.create({
      user_id: admin.id,
      respond_api_token: 'postgres-test-token',
      default_agent_name: 'Felipe Delgado'
    });
    created.messagingSettingsIds.push(messagingSettings.id);

    const receptionAgent = await ServiceAgent.create({
      user_id: admin.id,
      agent_id: `${marker}-felipe-agent`,
      agent_name: 'Felipe Delgado',
      service_name: 'Area 862',
      is_active: true
    });
    created.serviceAgentIds.push(receptionAgent.id);
  });

  after(async () => {
    if (sequelize && admin) {
      await Stop.destroy({ where: { id: { [Op.in]: created.stopIds } } });
      await ValidatedAddress.destroy({ where: { id: { [Op.in]: created.orderIds } } });
      await Route.destroy({ where: { id: { [Op.in]: created.routeIds } } });
      await FavoriteAddress.destroy({ where: { id: { [Op.in]: created.favoriteIds } } });
      await DeliveryHistory.destroy({
        where: { original_order_id: { [Op.in]: created.orderIds } }
      });
      await ServiceAgent.destroy({ where: { id: { [Op.in]: created.serviceAgentIds } } });
      await MessagingSettings.destroy({ where: { id: { [Op.in]: created.messagingSettingsIds } } });
      await User.destroy({ where: { id: { [Op.in]: created.driverIds } } });
      await User.destroy({ where: { id: admin.id } });
      await sequelize.close();
    }
  });

  it('deletes an untouched draft but rejects assignment, pickup, progress, evidence, and payment activity', async () => {
    const draft = await createRoute({ status: 'draft' });
    const ordinaryStop = await createStop(draft.id);
    const draftOrder = await createOrder(draft.id, {
      validated_address: ordinaryStop.address,
      address_lat: ordinaryStop.lat,
      address_lng: ordinaryStop.lng
    });

    const deleted = await callRoute(routesRouter, 'DELETE', '/:id', {
      params: { id: draft.id }
    });
    assert.equal(deleted.statusCode, 200);
    assert.equal(deleted.body.success, true);
    assert.equal(await Route.findByPk(draft.id), null);
    assert.equal(await Stop.findByPk(ordinaryStop.id), null);
    const releasedOrder = await ValidatedAddress.findByPk(draftOrder.id);
    assert.equal(releasedOrder.route_id, null);
    assert.equal(releasedOrder.dispatch_status, 'available');

    const protectedCases = [
      { name: 'assignment', route: { assigned_driver_id: admin.id } },
      { name: 'pickup confirmation', route: { pickup_admin_confirmed_at: new Date() } },
      { name: 'progress', stop: { status: 'arrived' } },
      { name: 'evidence', stop: { photo_url: '/uploads/evidence/proof.jpg' } },
      { name: 'payment', route: { payment_delivered: true } }
    ];

    for (const protectedCase of protectedCases) {
      const route = await createRoute({ status: 'draft', ...protectedCase.route });
      const stop = await createStop(route.id, null, protectedCase.stop);
      const result = await callRoute(routesRouter, 'DELETE', '/:id', {
        params: { id: route.id }
      });
      assert.equal(result.statusCode, 409, `${protectedCase.name} must block deletion`);
      assert.ok(await Route.findByPk(route.id), `${protectedCase.name} route was deleted`);
      assert.ok(await Stop.findByPk(stop.id), `${protectedCase.name} stop was deleted`);
    }
  });

  it('returns only pending orders while preserving every handled stop category and favorites', async () => {
    const route = await createRoute({
      status: 'assigned',
      assigned_driver_id: admin.id
    });
    const pending = await createMatchedPair(route.id, {
      order_status: 'on_delivery',
      previous_order_status: 'ordered'
    });
    const delivered = await createMatchedPair(route.id, {
      order_status: 'delivered',
      delivered_at: new Date()
    }, {
      status: 'completed',
      completed_at: new Date()
    });
    const collected = await createMatchedPair(route.id, {
      amount_collected: 25,
      payment_status: 'pending'
    }, {
      amount_collected: 25
    });
    const skipped = await createMatchedPair(route.id, {}, {
      status: 'skipped',
      completed_at: new Date()
    });
    const held = await createMatchedPair(route.id, {
      package_disposition: 'held_by_driver',
      held_by_driver_id: admin.id
    }, {
      package_disposition: 'held_by_driver',
      held_by_driver_id: admin.id
    });
    const returned = await createMatchedPair(route.id, {
      package_disposition: 'returned_to_office',
      returned_at: new Date()
    }, {
      package_disposition: 'returned_to_office',
      returned_at: new Date()
    });
    const favorite = await FavoriteAddress.create({
      name: `${marker}-return-favorite`,
      address: `${marker} return favorite`,
      lat: 34,
      lng: -98
    });
    created.favoriteIds.push(favorite.id);
    const favoriteStop = await Stop.create({
      route_id: route.id,
      favorite_address_id: favorite.id,
      address: favorite.address,
      lat: favorite.lat,
      lng: favorite.lng,
      order: created.stopIds.length,
      customer_name: favorite.name
    });
    created.stopIds.push(favoriteStop.id);

    const result = await callRoute(router, 'POST', '/routes/:id/return-orders', {
      params: { id: route.id }
    });
    assert.equal(result.statusCode, 200);
    assert.deepEqual(result.body.released_order_ids, [pending.order.id]);
    assert.deepEqual(result.body.released_stop_ids, [pending.stop.id]);
    assert.deepEqual(result.body.preserved, {
      delivered: 1,
      collected: 1,
      skipped: 1,
      returned: 1,
      held: 1,
      favorites: 1
    });

    const releasedOrder = await ValidatedAddress.findByPk(pending.order.id);
    assert.equal(releasedOrder.route_id, null);
    assert.equal(releasedOrder.dispatch_status, 'available');
    assert.equal(releasedOrder.order_status, 'ordered');
    assert.equal(releasedOrder.previous_order_status, null);
    assert.equal(await Stop.findByPk(pending.stop.id), null);

    for (const { order, stop } of [delivered, collected, skipped, held, returned]) {
      const retainedOrder = await ValidatedAddress.findByPk(order.id);
      const retainedStop = await Stop.findByPk(stop.id);
      assert.equal(retainedOrder.route_id, route.id);
      assert.equal(retainedStop.route_id, route.id);
    }
    assert.equal((await Stop.findByPk(favoriteStop.id)).route_id, route.id);
    assert.equal((await Route.findByPk(route.id)).status, 'returned');
  });

  it('restores a skipped unpaid stop and rejects evidence or payment restorations', async () => {
    const restorableRoute = await createRoute({
      status: 'assigned',
      assigned_driver_id: admin.id
    });
    const restorableOrder = await createOrder(restorableRoute.id, {
      route_id: null,
      dispatch_status: 'available'
    });
    const restorableStop = await createStop(restorableRoute.id, restorableOrder, {
      status: 'skipped',
      package_disposition: 'normal',
      completed_at: new Date(),
      skip_reason: 'customer unavailable'
    });
    const restored = await callRoute(router, 'PUT', '/stops/:id/restore', {
      params: { id: restorableStop.id }
    });
    assert.equal(restored.statusCode, 200);
    const restoredOrder = await ValidatedAddress.findByPk(restorableOrder.id);
    const restoredStop = await Stop.findByPk(restorableStop.id);
    assert.equal(restoredOrder.route_id, restorableRoute.id);
    assert.equal(restoredOrder.dispatch_status, 'assigned');
    assert.equal(restoredOrder.order_status, 'on_delivery');
    assert.equal(restoredStop.status, 'pending');
    assert.equal(restoredStop.package_disposition, 'normal');
    assert.equal(restoredStop.completed_at, null);

    const rejectedCases = [
      { name: 'evidence', stop: { photo_url: '/uploads/evidence/proof.jpg' } },
      { name: 'payment', order: { amount_collected: 7, payment_status: 'paid' } }
    ];
    for (const rejectedCase of rejectedCases) {
      const route = await createRoute({
        status: 'assigned',
        assigned_driver_id: admin.id
      });
      const order = await createOrder(route.id, {
        route_id: null,
        dispatch_status: 'available',
        ...rejectedCase.order
      });
      const stop = await createStop(route.id, order, {
        status: 'skipped',
        package_disposition: 'normal',
        completed_at: new Date(),
        ...rejectedCase.stop
      });
      const result = await callRoute(router, 'PUT', '/stops/:id/restore', {
        params: { id: stop.id }
      });
      assert.equal(result.statusCode, 409, `${rejectedCase.name} must block restore`);
      assert.equal((await Stop.findByPk(stop.id)).status, 'skipped');
      assert.equal((await ValidatedAddress.findByPk(order.id)).route_id, null);
    }
  });

  it('returns pending orders to the configured reception agent and restores their lifecycle', async () => {
    const { default: respondApiService } = await import('../src/services/respondApiService.js');
    const route = await createRoute({
      status: 'assigned',
      assigned_driver_id: admin.id
    });
    const order = await createOrder(route.id, {
      order_status: 'on_delivery',
      previous_order_status: 'ordered',
      respond_contact_id: `${marker}-respond-contact`
    });
    const stop = await createStop(route.id, order);
    const calls = [];
    const originalSetContext = respondApiService.setContext;
    const originalAssignConversation = respondApiService.assignConversation;
    const originalUpdateLifecycle = respondApiService.updateLifecycle;

    respondApiService.setContext = (...args) => calls.push({
      method: 'setContext',
      args
    });
    respondApiService.assignConversation = async (...args) => {
      calls.push({ method: 'assignConversation', args });
      return { success: true };
    };
    respondApiService.updateLifecycle = async (...args) => {
      calls.push({ method: 'updateLifecycle', args });
      return { success: true };
    };

    try {
      const result = await callRoute(router, 'POST', '/routes/:id/return-orders', {
        params: { id: route.id }
      });

      assert.equal(result.statusCode, 200);
      assert.deepEqual(result.body.released_order_ids, [order.id]);
      assert.deepEqual(result.body.released_stop_ids, [stop.id]);
      assert.equal((await Route.findByPk(route.id)).status, 'returned');

      const restoredOrder = await ValidatedAddress.findByPk(order.id);
      assert.equal(restoredOrder.route_id, null);
      assert.equal(restoredOrder.dispatch_status, 'available');
      assert.equal(restoredOrder.assigned_driver_id, null);
      assert.equal(restoredOrder.order_status, 'ordered');
      assert.equal(restoredOrder.previous_order_status, null);
      assert.equal(await Stop.findByPk(stop.id), null);

      assert.deepEqual(
        calls.filter(call => call.method === 'assignConversation').map(call => call.args),
        [[`${order.respond_contact_id}`, `${marker}-felipe-agent`]]
      );
      assert.deepEqual(
        calls.filter(call => call.method === 'updateLifecycle').map(call => call.args),
        [[`${order.respond_contact_id}`, 'Ordered']]
      );
    } finally {
      respondApiService.setContext = originalSetContext;
      respondApiService.assignConversation = originalAssignConversation;
      respondApiService.updateLifecycle = originalUpdateLifecycle;
    }
  });

  it('keeps a returned order restored when Respond.io fails', async () => {
    const { default: respondApiService } = await import('../src/services/respondApiService.js');
    const route = await createRoute({
      status: 'assigned',
      assigned_driver_id: admin.id
    });
    const order = await createOrder(route.id, {
      order_status: 'on_delivery',
      previous_order_status: 'approved',
      respond_contact_id: `${marker}-respond-failure-contact`
    });
    const stop = await createStop(route.id, order);
    const originalAssignConversation = respondApiService.assignConversation;
    let attemptedAssignment = false;

    respondApiService.assignConversation = async () => {
      attemptedAssignment = true;
      throw new Error('Respond.io unavailable in test');
    };

    try {
      const result = await callRoute(router, 'POST', '/routes/:id/return-orders', {
        params: { id: route.id }
      });

      assert.equal(result.statusCode, 200);
      assert.equal(result.body.released_count, 1);
      assert.equal(attemptedAssignment, true);
      assert.equal((await Route.findByPk(route.id)).status, 'returned');

      const restoredOrder = await ValidatedAddress.findByPk(order.id);
      assert.equal(restoredOrder.route_id, null);
      assert.equal(restoredOrder.dispatch_status, 'available');
      assert.equal(restoredOrder.order_status, 'approved');
      assert.equal(restoredOrder.previous_order_status, null);
      assert.equal(await Stop.findByPk(stop.id), null);
    } finally {
      respondApiService.assignConversation = originalAssignConversation;
    }
  });

  it('reloads a pending return into the driver next route until office reception', async () => {
    const route = await createRoute({ status: 'draft' });
    const pendingReturn = await createOrder(null, {
      route_id: null,
      dispatch_status: 'available',
      order_status: 'ordered',
      package_disposition: 'pending_return',
      held_by_driver_id: admin.id
    });

    const assigned = await callRoute(router, 'PUT', '/routes/:id/assign', {
      params: { id: route.id },
      body: { driver_id: admin.id }
    });
    assert.equal(assigned.statusCode, 200);

    const reloadedOrder = await ValidatedAddress.findByPk(pendingReturn.id);
    assert.equal(reloadedOrder.route_id, route.id);
    assert.equal(reloadedOrder.package_disposition, 'normal');
    assert.equal(reloadedOrder.held_by_driver_id, null);
    assert.equal(reloadedOrder.order_status, 'on_delivery');
    assert.equal(reloadedOrder.previous_order_status, 'ordered');

    const reloadedStop = await Stop.findOne({
      where: { route_id: route.id, customer_name: pendingReturn.customer_name }
    });
    assert.ok(reloadedStop);
    assert.equal(reloadedStop.status, 'pending');
  });

  it('keeps skipped orders on delivery with the driver until office reception', async () => {
    const { default: respondApiService } = await import('../src/services/respondApiService.js');
    const route = await createRoute({
      status: 'assigned',
      assigned_driver_id: admin.id
    });
    const heldOrder = await createOrder(route.id, {
      order_status: 'ordered',
      previous_order_status: null,
      respond_contact_id: null
    });
    const officeOrder = await createOrder(route.id, {
      order_status: 'ordered',
      previous_order_status: null,
      respond_contact_id: `${marker}-office-contact`
    });
    const heldStop = await createStop(route.id, heldOrder);
    const officeStop = await createStop(route.id, officeOrder);
    const calls = [];
    const originalAssignConversation = respondApiService.assignConversation;
    const originalUpdateLifecycle = respondApiService.updateLifecycle;
    const originalSetContext = respondApiService.setContext;

    respondApiService.setContext = (...args) => calls.push({ method: 'setContext', args });
    respondApiService.assignConversation = async (...args) => {
      calls.push({ method: 'assignConversation', args });
      return { success: true };
    };
    respondApiService.updateLifecycle = async (...args) => {
      calls.push({ method: 'updateLifecycle', args });
      return { success: true };
    };

    try {
      const heldResult = await callRoute(router, 'PUT', '/stops/:id/skip', {
        params: { id: heldStop.id },
        userId: admin.id,
        body: { disposition: 'held_by_driver', reason: 'El chofer conserva el paquete' }
      });
      const officeResult = await callRoute(router, 'PUT', '/stops/:id/skip', {
        params: { id: officeStop.id },
        userId: admin.id,
        body: { disposition: 'pending_return', reason: 'Se entrega en oficina' }
      });

      assert.equal(heldResult.statusCode, 200);
      assert.equal(officeResult.statusCode, 200);

      const heldAfterSkip = await ValidatedAddress.findByPk(heldOrder.id);
      assert.equal(heldAfterSkip.order_status, 'on_delivery');
      assert.equal(heldAfterSkip.previous_order_status, 'ordered');
      assert.equal(heldAfterSkip.package_disposition, 'held_by_driver');
      assert.equal(heldAfterSkip.route_id, null);
      assert.equal(heldAfterSkip.assigned_driver_id, admin.id);
      assert.equal(heldAfterSkip.dispatch_status, 'assigned');

      const officeAfterSkip = await ValidatedAddress.findByPk(officeOrder.id);
      assert.equal(officeAfterSkip.order_status, 'on_delivery');
      assert.equal(officeAfterSkip.previous_order_status, 'ordered');
      assert.equal(officeAfterSkip.package_disposition, 'pending_return');
      assert.equal(officeAfterSkip.route_id, null);
      assert.equal(officeAfterSkip.assigned_driver_id, admin.id);
      assert.equal(officeAfterSkip.dispatch_status, 'assigned');

      assert.equal((await Stop.findByPk(heldStop.id)).package_disposition, 'held_by_driver');
      assert.equal((await Stop.findByPk(officeStop.id)).package_disposition, 'pending_return');

      const received = await callRoute(router, 'PUT', '/returns/:id/receive', {
        params: { id: officeOrder.id }
      });
      assert.equal(received.statusCode, 200);

      const officeAfterReceive = await ValidatedAddress.findByPk(officeOrder.id);
      assert.equal(officeAfterReceive.order_status, 'ordered');
      assert.equal(officeAfterReceive.previous_order_status, null);
      assert.equal(officeAfterReceive.package_disposition, 'returned_to_office');
      assert.equal(officeAfterReceive.route_id, null);
      assert.equal(officeAfterReceive.assigned_driver_id, null);
      assert.equal(officeAfterReceive.dispatch_status, 'available');

      assert.deepEqual(
        calls.filter(call => call.method === 'assignConversation').map(call => call.args),
        [[officeOrder.respond_contact_id, `${marker}-felipe-agent`]]
      );
      assert.deepEqual(
        calls.filter(call => call.method === 'updateLifecycle').map(call => call.args),
        [[officeOrder.respond_contact_id, 'Ordered']]
      );

      const nextRoute = await createRoute({ status: 'draft' });
      const nextRouteResult = await callRoute(router, 'PUT', '/routes/:id/assign', {
        params: { id: nextRoute.id },
        body: { driver_id: admin.id }
      });
      assert.equal(nextRouteResult.statusCode, 200);

      const heldAfterReload = await ValidatedAddress.findByPk(heldOrder.id);
      assert.equal(heldAfterReload.route_id, nextRoute.id);
      assert.equal(heldAfterReload.order_status, 'on_delivery');
      assert.equal(heldAfterReload.previous_order_status, 'ordered');
      assert.equal(heldAfterReload.package_disposition, 'normal');
      assert.equal(heldAfterReload.held_by_driver_id, null);
      assert.equal(heldAfterReload.assigned_driver_id, admin.id);

      const reloadedHeldStop = await Stop.findOne({
        where: { route_id: nextRoute.id, customer_name: heldOrder.customer_name }
      });
      assert.ok(reloadedHeldStop);
      assert.equal(reloadedHeldStop.status, 'pending');
    } finally {
      respondApiService.setContext = originalSetContext;
      respondApiService.assignConversation = originalAssignConversation;
      respondApiService.updateLifecycle = originalUpdateLifecycle;
    }
  });

  it('marks driver-added and dispatch-added orders as delivered through every delivery path', async () => {
    const { default: respondApiService } = await import('../src/services/respondApiService.js');
    const route = await createRoute({
      status: 'in_progress',
      assigned_driver_id: admin.id
    });
    const driverAddedOrder = await createOrder(route.id, {
      added_by_driver: true,
      added_by_driver_id: admin.id,
      order_status: 'on_delivery',
      previous_order_status: 'pickup_ready',
      respond_contact_id: `${marker}-driver-delivered`
    });
    const dispatchAddedOrder = await createOrder(route.id, {
      added_by_driver: false,
      order_status: 'on_delivery',
      previous_order_status: 'ordered',
      respond_contact_id: `${marker}-dispatch-delivered`
    });
    const driverAddedStop = await createStop(route.id, driverAddedOrder);
    const calls = [];
    const originalSetContext = respondApiService.setContext;
    const originalUpdateLifecycle = respondApiService.updateLifecycle;

    respondApiService.setContext = (...args) => calls.push({ method: 'setContext', args });
    respondApiService.updateLifecycle = async (...args) => {
      calls.push({ method: 'updateLifecycle', args });
      return { success: true };
    };

    try {
      const stopCompleted = await callRoute(stopsRouter, 'POST', '/:id/complete', {
        params: { id: driverAddedStop.id },
        body: { delivery_notes: 'Entregado por el chofer' }
      });
      assert.equal(stopCompleted.statusCode, 200);

      const driverDelivered = await ValidatedAddress.findByPk(driverAddedOrder.id);
      assert.equal(driverDelivered.order_status, 'delivered');
      assert.equal(driverDelivered.previous_order_status, null);

      const orderDelivered = await callRoute(router, 'PUT', '/orders/:id/delivered', {
        params: { id: dispatchAddedOrder.id }
      });
      assert.equal(orderDelivered.statusCode, 200);

      const dispatchDelivered = await ValidatedAddress.findByPk(dispatchAddedOrder.id);
      assert.equal(dispatchDelivered.order_status, 'delivered');
      assert.equal(dispatchDelivered.previous_order_status, null);

      assert.deepEqual(
        calls.filter(call => call.method === 'updateLifecycle').map(call => call.args),
        [
          [driverAddedOrder.respond_contact_id, 'Delivered'],
          [dispatchAddedOrder.respond_contact_id, 'Delivered']
        ]
      );
    } finally {
      respondApiService.setContext = originalSetContext;
      respondApiService.updateLifecycle = originalUpdateLifecycle;
    }
  });

  it('lists Pickup Ready and Dispatching contacts and adds the selected contact to the driver route', async () => {
    const { default: respondApiService } = await import('../src/services/respondApiService.js');
    const { default: geocodingService } = await import('../src/services/geocodingService.js');
    driver = await User.create({
      username: `${marker}-driver`,
      email: `${marker}-driver@example.test`,
      role: 'driver'
    });
    created.driverIds.push(driver.id);
    const route = await createRoute({
      user_id: driver.id,
      status: 'assigned',
      assigned_driver_id: driver.id
    });
    const pickupContact = {
      id: `${marker}-pickup-contact`,
      firstName: 'Pickup',
      lastName: 'Customer',
      phone: '+12145550123',
      lifecycle: { name: 'Pickup Ready' },
      custom_fields: {
        address: '123 Main St, Dallas, TX 75201'
      }
    };
    const dispatchingContact = {
      id: `${marker}-dispatching-contact`,
      firstName: 'Dispatching',
      lastName: 'Customer',
      phone: '+12145550124',
      lifecycle: { name: 'Dispatching' },
      custom_fields: {
        address: '456 Oak St, Dallas, TX 75202'
      }
    };
    const originalListContacts = respondApiService.listContacts;
    const originalGetContact = respondApiService.getContact;
    const originalUpdateLifecycle = respondApiService.updateLifecycle;
    const originalFindUserByEmail = respondApiService.findUserByEmail;
    const originalAssignConversation = respondApiService.assignConversation;
    const originalGeocodeAddress = geocodingService.geocodeAddress;
    let requestedRespondSearch = null;
    let requestedContactIdentifier = null;
    let lifecycleUpdateCall = null;
    let assignmentCall = null;

    respondApiService.listContacts = async (filters) => {
      requestedRespondSearch = filters.search;
      return {
        items: [pickupContact, dispatchingContact, {
          id: `${marker}-not-pickup`,
          name: 'Not ready',
          lifecycle: { name: 'Ordered' }
        }]
      };
    };
    respondApiService.getContact = async (contactId) => {
      requestedContactIdentifier = contactId;
      const normalizedContactId = String(contactId).replace(/^id:/, '');
      return normalizedContactId === dispatchingContact.id ? dispatchingContact : pickupContact;
    };
    respondApiService.updateLifecycle = async (...args) => {
      lifecycleUpdateCall = args;
      return { success: true };
    };
    respondApiService.findUserByEmail = async () => ({ id: `${marker}-respond-driver` });
    respondApiService.assignConversation = async (...args) => {
      assignmentCall = args;
      return { success: true };
    };
    geocodingService.geocodeAddress = async (address) => ({
      success: true,
      fullAddress: address,
      latitude: 32.7767,
      longitude: -96.797,
      streetNumber: address.startsWith('456') ? '456' : '123',
      zip: address.includes('75202') ? '75202' : '75201',
      city: 'Dallas',
      stateShort: 'TX',
      confidence: 'high'
    });

    try {
      const listed = await callRoute(router, 'GET', '/routes/:id/respond-pickup-orders', {
        params: { id: route.id },
        query: { search: 'Dispatching' },
        userId: driver.id
      });
      assert.equal(listed.statusCode, 200);
      assert.equal(requestedRespondSearch, 'Dispatching');
      assert.deepEqual(listed.body.orders, [
        {
          id: pickupContact.id,
          name: 'Pickup Customer',
          phone: pickupContact.phone,
          email: '',
          address: pickupContact.custom_fields.address,
          lifecycle: 'Pickup Ready'
        },
        {
          id: dispatchingContact.id,
          name: 'Dispatching Customer',
          phone: dispatchingContact.phone,
          email: '',
          address: dispatchingContact.custom_fields.address,
          lifecycle: 'Dispatching'
        }
      ]);

      const added = await callRoute(router, 'POST', '/routes/:id/respond-pickup-orders', {
        params: { id: route.id },
        body: { contact_id: dispatchingContact.id },
        userId: driver.id
      });
      assert.equal(added.statusCode, 201);
      assert.equal(requestedContactIdentifier, `id:${dispatchingContact.id}`);
      assert.deepEqual(lifecycleUpdateCall, [`id:${dispatchingContact.id}`, 'On Delivery']);
      assert.deepEqual(assignmentCall, [`id:${dispatchingContact.id}`, `${marker}-respond-driver`]);
      assert.equal(added.body.respond_sync.lifecycle_updated, true);
      assert.equal(added.body.respond_sync.conversation_assigned, true);

      const createdOrder = await ValidatedAddress.findByPk(added.body.order.id);
      assert.equal(createdOrder.respond_contact_id, dispatchingContact.id);
      assert.equal(createdOrder.route_id, route.id);
      assert.equal(createdOrder.order_status, 'on_delivery');
      assert.equal(createdOrder.previous_order_status, 'pickup_ready');
      assert.equal(createdOrder.customer_name, 'Dispatching Customer');
      assert.equal(createdOrder.added_by_driver, true);
      assert.equal(createdOrder.added_by_driver_id, driver.id);

      const createdStop = await Stop.findByPk(added.body.stop.id);
      assert.equal(createdStop.route_id, route.id);
      assert.equal(createdStop.address, dispatchingContact.custom_fields.address);
      assert.equal(createdStop.added_by_driver, true);
      assert.equal(createdStop.added_by_driver_id, driver.id);

      created.orderIds.push(createdOrder.id);
      created.stopIds.push(createdStop.id);
      const { saveToDeliveryHistory } = await import('../src/utils/deliveryHistory.js');
      createdOrder.order_status = 'delivered';
      createdOrder.delivered_at = new Date();
      await createdOrder.save();
      await saveToDeliveryHistory(createdOrder);
      const history = await DeliveryHistory.findOne({
        where: { original_order_id: createdOrder.id }
      });
      assert.ok(history);
      assert.equal(history.added_by_driver, true);
      assert.equal(history.added_by_driver_id, driver.id);
    } finally {
      respondApiService.listContacts = originalListContacts;
      respondApiService.getContact = originalGetContact;
      respondApiService.updateLifecycle = originalUpdateLifecycle;
      respondApiService.findUserByEmail = originalFindUserByEmail;
      respondApiService.assignConversation = originalAssignConversation;
      geocodingService.geocodeAddress = originalGeocodeAddress;
    }
  });

  it('separates driver payment delivery from administrative receipt confirmation', async () => {
    const deliveredRoute = await createRoute({
      status: 'completed',
      assigned_driver_id: admin.id,
      completed_at: new Date(),
      payment_delivered: true,
      admin_confirmed: false,
      admin_amount_received: 0
    });
    await createStop(deliveredRoute.id, null, {
      status: 'completed',
      completed_at: new Date(),
      payment_method: 'cash',
      amount_collected: 100,
      payment_status: 'paid'
    });

    const pendingRoute = await createRoute({
      status: 'completed',
      assigned_driver_id: admin.id,
      completed_at: new Date(),
      payment_delivered: false,
      admin_confirmed: false,
      admin_amount_received: 0
    });
    await createStop(pendingRoute.id, null, {
      status: 'completed',
      completed_at: new Date(),
      payment_method: 'cash',
      amount_collected: 60,
      payment_status: 'paid'
    });

    const accounting = await callRoute(router, 'GET', '/my-accounting');
    assert.equal(accounting.statusCode, 200);
    assert.equal(accounting.body.totals.to_deliver, 60);
    assert.equal(accounting.body.totals.pending_routes, 1);
    assert.equal(accounting.body.totals.stops_pending, 1);

    const completedRoutes = await callRoute(router, 'GET', '/my-completed-routes');
    assert.equal(completedRoutes.statusCode, 200);
    const deliveredView = completedRoutes.body.routes.find(route => route.id === deliveredRoute.id);
    const pendingView = completedRoutes.body.routes.find(route => route.id === pendingRoute.id);
    assert.ok(deliveredView);
    assert.ok(pendingView);

    assert.equal(deliveredView.to_deliver, 0);
    assert.equal(deliveredView.admin_remaining, 100);
    assert.equal(deliveredView.payment_delivered, true);
    assert.equal(deliveredView.admin_confirmed, false);
    assert.equal(pendingView.to_deliver, 60);
    assert.equal(pendingView.admin_remaining, 60);
    assert.equal(pendingView.payment_delivered, false);
  });

  it('excludes skipped stops from route payment totals and driver delivery', async () => {
    const route = await createRoute({
      status: 'completed',
      assigned_driver_id: admin.id,
      completed_at: new Date()
    });
    await createStop(route.id, null, {
      status: 'completed',
      completed_at: new Date(),
      payment_method: 'cash',
      amount_collected: 50,
      payment_status: 'paid'
    });
    await createStop(route.id, null, {
      status: 'skipped',
      completed_at: new Date(),
      payment_method: 'cash',
      amount_collected: 90,
      payment_status: 'pending'
    });

    const paymentStatus = await callRoute(router, 'GET', '/routes/payment-status', {
      query: { driver_id: String(admin.id) }
    });
    assert.equal(paymentStatus.statusCode, 200);
    const paymentView = paymentStatus.body.routes.find(item => item.id === route.id);
    assert.ok(paymentView);
    assert.equal(paymentView.stops_count, 1);
    assert.equal(paymentView.route_gross_collected, 50);
    assert.equal(paymentView.route_total_collected, 50);
    assert.equal(paymentView.admin_remaining, 50);

    const routeList = await callRoute(router, 'GET', '/routes');
    assert.equal(routeList.statusCode, 200);
    const routeView = routeList.body.routes.find(item => item.id === route.id);
    assert.ok(routeView);
    assert.equal(routeView.route_total_collected, 50);

    const deliveredPayment = await callRoute(router, 'PUT', '/routes/:id/deliver-payment', {
      params: { id: route.id },
      body: { payment_method: 'cash' }
    });
    assert.equal(deliveredPayment.statusCode, 200);
    assert.equal(deliveredPayment.body.total_collected, 50);
    assert.equal(deliveredPayment.body.cash_collected, 50);
    assert.equal((await Route.findByPk(route.id)).route_total_collected, '50.00');
  });

  it('shows an order in pickup reception and history even when its Stop is missing', async () => {
    const pendingRoute = await createRoute({
      status: 'assigned',
      assigned_driver_id: admin.id
    });
    const pendingOrder = await createOrder(pendingRoute.id);
    const reception = await callRoute(router, 'GET', '/pickup/pending');
    assert.equal(reception.statusCode, 200);
    const pendingView = reception.body.routes.find(route => route.id === pendingRoute.id);
    assert.ok(pendingView);
    assert.equal(pendingView.stops_count, 1);
    assert.equal(pendingView.stops.length, 1);
    assert.equal(pendingView.stops[0].id, `order:${pendingOrder.id}`);
    assert.equal(pendingView.stops[0].address, pendingOrder.validated_address);

    const historyRoute = await createRoute({
      status: 'assigned',
      assigned_driver_id: admin.id,
      pickup_admin_confirmed_at: new Date(),
      pickup_admin_confirmed_by: admin.id
    });
    const historyOrder = await createOrder(historyRoute.id);
    const history = await callRoute(router, 'GET', '/pickup/history');
    assert.equal(history.statusCode, 200);
    const historyView = history.body.routes.find(route => route.id === historyRoute.id);
    assert.ok(historyView);
    assert.equal(historyView.stops_count, 1);
    assert.deepEqual(historyView.stops[0], {
      id: `order:${historyOrder.id}`,
      source: 'order',
      customer_name: historyOrder.customer_name,
      address: historyOrder.validated_address,
      status: 'pending',
      package_disposition: 'normal',
      amount_collected: 0,
      completed_at: null
    });
  });
});