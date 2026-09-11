import test from 'node:test';
import assert from 'node:assert/strict';
import { Op } from 'sequelize';
import { shouldProtectAssignedRoute } from '../src/utils/routeLifecycleProtection.js';
import pollingService from '../src/services/pollingService.js';
import ValidatedAddress from '../src/models/ValidatedAddress.js';

test('protects active route assignments from external lifecycle regressions', () => {
  const assigned = { route_id: 72, order_status: 'on_delivery' };

  assert.equal(shouldProtectAssignedRoute(assigned, 'pickup_ready'), true);
  assert.equal(shouldProtectAssignedRoute(assigned, 'pending'), true);
  assert.equal(shouldProtectAssignedRoute(assigned, 'approved'), true);
  assert.equal(shouldProtectAssignedRoute(assigned, 'ups_shipped'), true);
  assert.equal(shouldProtectAssignedRoute(assigned, null), true);
});

test('still allows delivery completion and legitimate post-delivery reactivation', () => {
  assert.equal(
    shouldProtectAssignedRoute({ route_id: 72, order_status: 'on_delivery' }, 'delivered'),
    false
  );
  assert.equal(
    shouldProtectAssignedRoute({ route_id: 72, order_status: 'delivered' }, 'pickup_ready'),
    false
  );
  assert.equal(
    shouldProtectAssignedRoute({ route_id: null, order_status: 'on_delivery' }, 'pickup_ready'),
    false
  );
});

test('bulk lifecycle archival only targets orders that are not assigned to a route', async () => {
  const originalUpdate = ValidatedAddress.update;
  const calls = [];
  ValidatedAddress.update = async (fields, options) => {
    calls.push({ fields, where: options.where });
    return [1];
  };

  try {
    await pollingService.archiveUpsShippedOrders([
      { id: 101, lifecycle: 'UPS Shipped' }
    ]);
    await pollingService.archiveExcludedLifecycleOrders([
      { id: 102, lifecycle: 'New Lead' }
    ]);
  } finally {
    ValidatedAddress.update = originalUpdate;
  }

  assert.equal(calls.length, 2);
  for (const call of calls) {
    assert.equal(call.where.route_id[Op.is], null);
    assert.equal(Object.hasOwn(call.fields, 'route_id'), false);
  }
});

test('normal polling does not apply a Pickup Ready regression to an assigned order', async () => {
  const originalFindAll = ValidatedAddress.findAll;
  const originalUpdate = ValidatedAddress.update;
  const updates = [];
  ValidatedAddress.findAll = async () => [{
    id: 700,
    route_id: 74,
    order_status: 'on_delivery',
    dispatch_status: 'assigned',
    respond_contact_id: '365900728',
    customer_name: 'Hernandez Tree'
  }];
  ValidatedAddress.update = async (fields, options) => {
    updates.push({ fields, where: options.where });
    return [1];
  };

  try {
    await pollingService.syncContactNames(1, [{
      id: 365900728,
      firstName: 'Hernandez',
      lastName: 'Tree',
      lifecycle: 'Pickup Ready'
    }]);
  } finally {
    ValidatedAddress.findAll = originalFindAll;
    ValidatedAddress.update = originalUpdate;
  }

  assert.deepEqual(updates, []);
});