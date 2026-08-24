import assert from 'node:assert/strict';
import { before, beforeEach, describe, it } from 'node:test';

// The route imports Sequelize models, but these contract tests replace their
// query methods so they never require a database connection or real records.
process.env.DATABASE_URL ||= 'postgres://validator-contract-test';

let router;
let CoverageZone;
let MessagingOrder;
let MessageLog;
let MessagingSettings;
let ZipValidation;
let savedRecords;
let lastHistoryQuery;
let nextId;

const zone = {
  id: 9,
  zip_code: '75201',
  zone_name: 'Centro',
  city: 'Dallas',
  state: 'TX',
  country: 'US',
  delivery_fee: 10,
  min_order_amount: null,
  estimated_delivery_time: 60
};

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

async function callRoute(method, path, { body = {}, query = {}, ip = 'contract-test', origin } = {}) {
  const layer = router.stack.find(item => item.route?.path === path && item.route.methods[method]);
  assert.ok(layer, `route not found: ${method.toUpperCase()} ${path}`);
  const req = {
    method: method.toUpperCase(),
    body,
    query,
    ip,
    socket: { remoteAddress: ip },
    headers: origin ? { origin } : {},
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

before(async () => {
  ({ default: router } = await import('../src/routes/messaging.js'));
  ({
    CoverageZone,
    MessagingOrder,
    MessageLog,
    MessagingSettings,
    ZipValidation
  } = await import('../src/models/index.js'));
});

beforeEach(() => {
  savedRecords = [];
  lastHistoryQuery = null;
  nextId = 1;

  CoverageZone.findOne = async ({ where }) => {
    const values = Object.values(where);
    const hasZip = values.some(value => value === '75201');
    return hasZip ? { ...zone } : null;
  };
  MessagingSettings.findOne = async () => ({
    coverage_message: 'Cobertura disponible',
    no_coverage_message: 'Sin cobertura'
  });
  MessagingOrder.findAll = async () => [];
  MessageLog.findAll = async () => [];
  ZipValidation.create = async record => {
    const created = {
      id: nextId++,
      ...record,
      toDict() {
        return {
          id: this.id,
          contact_id: this.contact_id,
          contact_name: this.contact_name,
          contact_phone: this.contact_phone,
          source: this.source,
          input: this.input,
          value: this.value,
          type: this.validation_type,
          valid: this.valid,
          covered: this.valid,
          zone: this.zone_snapshot,
          message: this.message,
          copyMessage: this.copy_message,
          metadata: this.metadata,
          created_at: this.created_at,
          updated_at: this.updated_at
        };
      }
    };
    savedRecords.push(created);
    return created;
  };
  ZipValidation.findAndCountAll = async options => {
    lastHistoryQuery = options;
    return { rows: savedRecords, count: savedRecords.length };
  };
});

describe('public ZIP validator contract', () => {
  it('returns safe options and never exposes message content or credentials', async () => {
    MessagingOrder.findAll = async () => [{
      respond_contact_id: 'c-1',
      customer_name: 'María',
      customer_phone: '+15551234567',
      channel_type: 'whatsapp'
    }];
    MessageLog.findAll = async () => [{
      respond_contact_id: 'c-2',
      contact_name: 'Otro',
      contact_phone: '+15557654321',
      channel: 'sms',
      message: 'private message',
      respond_api_token: 'secret-token'
    }];

    const result = await callRoute('get', '/public/validator/options', {
      query: { search: 'maria', limit: '25' },
      ip: 'options-contract'
    });

    assert.equal(result.statusCode, 200);
    assert.equal(result.body.success, true);
    assert.equal(result.body.contacts[0].name, 'María');
    assert.equal(result.body.contacts[0].source, 'whatsapp');
    assert.equal('message' in result.body.contacts[0], false);
    assert.equal('respond_api_token' in result.body, false);
    assert.equal('respond_api_token' in result.body.contacts[0], false);
    assert.match(result.body.note, /omits message content and credentials/i);
  });

  it('validates, normalizes contact and origin, and saves history by default', async () => {
    const result = await callRoute('post', '/public/validate-zip', {
      body: {
        query: '75201',
        contact: { id: 'c-7', name: 'Cliente', phone: '+15550000000' },
        platform: 'facebook'
      },
      origin: 'https://checkout.example',
      ip: 'validate-contract'
    });

    assert.equal(result.statusCode, 200);
    assert.deepEqual(result.body.contact, {
      id: 'c-7',
      name: 'Cliente',
      phone: '+15550000000'
    });
    assert.equal(result.body.source, 'facebook');
    assert.equal(result.body.saved, true);
    assert.equal(result.body.validation_id, 1);
    assert.equal(savedRecords.length, 1);
    assert.equal(savedRecords[0].metadata.origin, 'https://checkout.example');
    assert.equal(savedRecords[0].metadata.user_agent, null);
    assert.equal('zoneModel' in result.body, false);
    assert.equal('respond_api_token' in result.body, false);
  });

  it('supports save=false without creating a history record', async () => {
    const result = await callRoute('post', '/public/validate-zip', {
      body: { zip_code: '75201', save: false, source: 'sms' },
      ip: 'no-save-contract'
    });

    assert.equal(result.statusCode, 200);
    assert.equal(result.body.saved, false);
    assert.equal(result.body.validation_id, null);
    assert.equal(savedRecords.length, 0);
  });

  it('passes contact, source, limit and offset filters to history', async () => {
    savedRecords.push({
      id: 3,
      toDict: () => ({ id: 3, contact_id: 'c-7', source: 'facebook' })
    });
    const result = await callRoute('get', '/public/validator/history', {
      query: { contact_id: 'c-7', source: 'facebook', limit: '20', offset: '2' },
      ip: 'history-contract'
    });

    assert.equal(result.statusCode, 200);
    assert.deepEqual(lastHistoryQuery.where, { contact_id: 'c-7', source: 'facebook' });
    assert.equal(lastHistoryQuery.limit, 20);
    assert.equal(lastHistoryQuery.offset, 2);
    assert.deepEqual(result.body.pagination, {
      total: 1, limit: 20, offset: 2, has_more: false
    });
  });

  it('rejects missing or non-string input without querying or saving', async () => {
    CoverageZone.findOne = async () => {
      throw new Error('must not query for invalid input');
    };

    for (const body of [{}, { query: '   ' }, { query: 75201 }]) {
      const result = await callRoute('post', '/public/validate-zip', {
        body,
        ip: `invalid-${JSON.stringify(body)}`
      });
      assert.equal(result.statusCode, 400);
      assert.equal(result.body.success, false);
      assert.match(result.body.error, /zipOrCity|zip_code|city|address|query/);
    }
    assert.equal(savedRecords.length, 0);
  });

  it('returns 429 after 60 requests from one IP', async () => {
    const ip = 'rate-limit-contract';
    let last;
    for (let count = 0; count < 61; count += 1) {
      last = await callRoute('get', '/public/validator/options', { ip });
    }
    assert.equal(last.statusCode, 429);
    assert.deepEqual(last.body, {
      success: false,
      error: 'Demasiadas solicitudes. Intenta nuevamente en un minuto.'
    });
  });
});
