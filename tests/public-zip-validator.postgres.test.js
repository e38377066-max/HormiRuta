import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

// This suite is intentionally opt-in to keep `npm test` deterministic and
// database-free. Point DATABASE_URL_TEST at an isolated PostgreSQL database
// (or use the development DATABASE_URL explicitly) to run it.
const databaseUrl = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL;
const shouldRun = Boolean(databaseUrl) && process.env.NODE_ENV !== 'production';

if (shouldRun) {
  process.env.DATABASE_URL = databaseUrl;
}

let router;
let sequelize;
let ZipValidation;
let savedContactId;

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

async function callHistory(query) {
  const layer = router.stack.find(item =>
    item.route?.path === '/public/validator/history' && item.route.methods.get
  );
  assert.ok(layer, 'history route not found');

  const req = {
    query,
    ip: `postgres-history-${savedContactId}`,
    socket: { remoteAddress: `postgres-history-${savedContactId}` },
    headers: {},
    get(name) {
      return this.headers[name.toLowerCase()];
    }
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

describe('public ZIP validator history with PostgreSQL', { skip: !shouldRun }, () => {
  before(async () => {
    ({ sequelize, ZipValidation } = await import('../src/models/index.js'));
    ({ default: router } = await import('../src/routes/messaging.js'));

    await sequelize.authenticate();
    // Sync only the model under test; do not alter unrelated application tables.
    await ZipValidation.sync();

    savedContactId = `integration-${randomUUID()}`;
    await ZipValidation.destroy({
      where: { contact_id: savedContactId }
    });

    const indexes = await sequelize.getQueryInterface().showIndex('zip_validations');
    const indexedColumns = new Set(
      indexes.flatMap(index => index.fields.map(field => field.attribute))
    );
    for (const column of ['contact_id', 'source', 'created_at']) {
      assert.ok(indexedColumns.has(column), `missing index on ${column}`);
    }
  });

  after(async () => {
    if (ZipValidation && savedContactId) {
      await ZipValidation.destroy({
        where: { contact_id: savedContactId }
      });
    }
    await sequelize?.close();
  });

  it('creates, filters, paginates, and serializes history records', async () => {
    const records = [
      {
        source: 'integration-a',
        input: '75201',
        value: '75201',
        validation_type: 'zip',
        valid: true,
        zone_snapshot: { zip_code: '75201', city: 'Test City' },
        message: 'synthetic integration result',
        copy_message: 'synthetic copy',
        metadata: { test: true }
      },
      {
        source: 'integration-a',
        input: 'Test City',
        value: 'Test City',
        validation_type: 'city',
        valid: false,
        zone_snapshot: null,
        message: 'synthetic no-coverage result',
        copy_message: 'synthetic copy',
        metadata: { test: true }
      },
      {
        source: 'integration-b',
        input: '75202',
        value: '75202',
        validation_type: 'zip',
        valid: true,
        zone_snapshot: { zip_code: '75202', city: 'Test City' },
        message: 'synthetic integration result',
        copy_message: 'synthetic copy',
        metadata: { test: true }
      }
    ];

    for (const record of records) {
      const created = await ZipValidation.create({
        contact_id: savedContactId,
        contact_name: 'Synthetic integration contact',
        contact_phone: '+10000000000',
        ...record
      });
      assert.ok(created.id);
      assert.equal(created.toDict().covered, created.valid);
    }

    const firstPage = await callHistory({
      contact_id: savedContactId,
      source: 'integration-a',
      limit: '1',
      offset: '0'
    });
    assert.equal(firstPage.statusCode, 200);
    assert.equal(firstPage.body.success, true);
    assert.equal(firstPage.body.validations.length, 1);
    assert.deepEqual(firstPage.body.pagination, {
      total: 2,
      limit: 1,
      offset: 0,
      has_more: true
    });
    assert.equal(firstPage.body.validations[0].contact_id, savedContactId);
    assert.equal(firstPage.body.validations[0].type, 'city');
    assert.equal(firstPage.body.validations[0].covered, false);
    assert.equal(firstPage.body.validations[0].zone, null);

    const secondPage = await callHistory({
      contact_id: savedContactId,
      source: 'integration-a',
      limit: '1',
      offset: '1'
    });
    assert.equal(secondPage.statusCode, 200);
    assert.equal(secondPage.body.validations.length, 1);
    assert.equal(secondPage.body.pagination.has_more, false);
    assert.equal(secondPage.body.validations[0].type, 'zip');
    assert.equal(secondPage.body.validations[0].zone.city, 'Test City');

    const differentSource = await callHistory({
      contact_id: savedContactId,
      source: 'integration-b'
    });
    assert.equal(differentSource.body.pagination.total, 1);
    assert.equal(differentSource.body.validations[0].input, '75202');
    assert.equal('respond_api_token' in differentSource.body.validations[0], false);
  });
});