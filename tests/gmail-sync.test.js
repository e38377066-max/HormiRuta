import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hasProcessedPickupEmail } from '../src/services/gmailSyncService.js';

describe('Gmail Pickup Ready lifecycle protection', () => {
  it('detects an order already associated with a Pickup Ready email', () => {
    assert.equal(hasProcessedPickupEmail({ pickup_email_id: 'gmail-message-1' }), true);
  });

  it('allows a new order cycle with no associated Pickup Ready email', () => {
    assert.equal(hasProcessedPickupEmail({ pickup_email_id: null }), false);
    assert.equal(hasProcessedPickupEmail({}), false);
    assert.equal(hasProcessedPickupEmail(null), false);
  });
});