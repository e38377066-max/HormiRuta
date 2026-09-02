import assert from 'node:assert/strict';
import { before, beforeEach, describe, it } from 'node:test';

process.env.DATABASE_URL ||= 'postgres://stop-address-contract-test';

let router;
let User;
let Route;
let Stop;
let ValidatedAddress;
let sequelize;
let geocodingService;

const assignedDriver = { id: 7, role: 'driver', active: true };
const admin = { id: 1, role: 'admin', active: true };

let currentUser;
let currentStop;
let currentRoute;
let currentOrder;
let geocodeResult;
let geocodeCalls;

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
    }
  };
}

async function callUpdateAddress({ userId = 7, body = { address: '456 New Street, Dallas, TX 75201' } } = {}) {
  const layer = router.stack.find(item =>
    item.route?.path === '/stops/:id/address' && item.route.methods.put
  );
  assert.ok(layer, 'route not found: PUT /stops/:id/address');
  const req = {
    method: 'PUT',
    params: { id: '30' },
    body,
    session: { userId },
    headers: {}
  };
  const res = response();

  for (const handler of layer.route.stack.map(item => item.handle)) {
    await new Promise((resolve, reject) => {
      let settled = false;
      const finish = () => {
        if (!settled) {
          settled = true;
          resolve();
        }
      };
      Promise.resolve(handler(req, res, finish)).then(finish, reject);
    });
    if (res.finished) break;
  }
  return res;
}

function makeStop(overrides = {}) {
  const stop = {
    id: 30,
    route_id: 12,
    address: '123 Old Street, Dallas, TX 75201',
    lat: 32.1,
    lng: -96.1,
    status: 'pending',
    toDict() {
      return {
        id: this.id,
        route_id: this.route_id,
        address: this.address,
        lat: this.lat,
        lng: this.lng,
        status: this.status
      };
    },
    async save() {
      return this;
    },
    ...overrides
  };
  return stop;
}

function makeOrder(overrides = {}) {
  return {
    id: 99,
    validated_address: '123 Old Street, Dallas, TX 75201',
    address_lat: 32.1,
    address_lng: -96.1,
    zip_code: '75201',
    city: 'Dallas',
    state: 'TX',
    confidence: 'high',
    async save() {
      return this;
    },
    ...overrides
  };
}

before(async () => {
  ({ default: router } = await import('../src/routes/dispatch.js'));
  ({ User, Route, Stop, ValidatedAddress, sequelize } = await import('../src/models/index.js'));
  ({ default: geocodingService } = await import('../src/services/geocodingService.js'));
});

beforeEach(() => {
  currentUser = assignedDriver;
  currentStop = makeStop();
  currentRoute = {
    id: 12,
    assigned_driver_id: 7,
    status: 'in_progress'
  };
  currentOrder = makeOrder();
  geocodeCalls = 0;
  geocodeResult = {
    success: true,
    streetNumber: '456',
    fullAddress: '456 New Street, Dallas, TX 75201',
    latitude: 32.2,
    longitude: -96.2,
    zip: '75201',
    city: 'Dallas',
    stateShort: 'TX',
    confidence: 'high'
  };

  User.findByPk = async () => currentUser;
  Stop.findByPk = async () => currentStop;
  Route.findByPk = async () => currentRoute;
  ValidatedAddress.findAll = async () => [currentOrder];
  geocodingService.geocodeAddress = async () => {
    geocodeCalls += 1;
    return geocodeResult;
  };
  sequelize.transaction = async () => ({
    LOCK: { UPDATE: 'UPDATE' },
    async commit() {},
    async rollback() {}
  });
});

describe('driver stop address update contract', () => {
  it('updates the stop and its matching order for the assigned driver', async () => {
    const result = await callUpdateAddress();

    assert.equal(result.statusCode, 200);
    assert.equal(result.body.success, true);
    assert.equal(geocodeCalls, 1);
    assert.equal(currentStop.address, '456 New Street, Dallas, TX 75201');
    assert.equal(currentStop.lat, 32.2);
    assert.equal(currentStop.lng, -96.2);
    assert.equal(currentOrder.validated_address, '456 New Street, Dallas, TX 75201');
    assert.equal(currentOrder.address_lat, 32.2);
    assert.equal(currentOrder.address_lng, -96.2);
    assert.equal(result.body.order_id, 99);
  });

  it('previews a normalized address without changing the stop or order', async () => {
    const result = await callUpdateAddress({
      body: { address: '456 New Street, Dallas, TX 75201', preview: true }
    });

    assert.equal(result.statusCode, 200);
    assert.equal(result.body.preview, true);
    assert.equal(result.body.address, '456 New Street, Dallas, TX 75201');
    assert.equal(result.body.lat, 32.2);
    assert.equal(currentStop.address, '123 Old Street, Dallas, TX 75201');
    assert.equal(currentOrder.validated_address, '123 Old Street, Dallas, TX 75201');
  });

  it('rejects a driver who is not assigned to the route', async () => {
    currentUser = { id: 8, role: 'driver', active: true };

    const result = await callUpdateAddress({ userId: 8 });

    assert.equal(result.statusCode, 403);
    assert.equal(geocodeCalls, 0);
    assert.equal(currentStop.address, '123 Old Street, Dallas, TX 75201');
  });

  it('protects a completed stop even for an administrator', async () => {
    currentUser = admin;
    currentStop.status = 'completed';

    const result = await callUpdateAddress({ userId: 1 });

    assert.equal(result.statusCode, 409);
    assert.equal(geocodeCalls, 0);
  });

  it('rejects a geocoder result that silently changes the street number', async () => {
    geocodeResult = {
      ...geocodeResult,
      streetNumber: '235',
      fullAddress: '235 New Street, Dallas, TX 75201'
    };

    const result = await callUpdateAddress();

    assert.equal(result.statusCode, 422);
    assert.match(result.body.error, /número/i);
    assert.equal(geocodeCalls, 1);
    assert.equal(currentStop.address, '123 Old Street, Dallas, TX 75201');
    assert.equal(currentOrder.validated_address, '123 Old Street, Dallas, TX 75201');
  });
});