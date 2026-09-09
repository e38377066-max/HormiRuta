import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  hasProcessedPickupEmail,
  isPickupEmailStaleForOrder
} from '../src/services/gmailSyncService.js';

describe('Gmail Pickup Ready lifecycle protection', () => {
  it('detects an order already associated with a Pickup Ready email', () => {
    assert.equal(hasProcessedPickupEmail({ pickup_email_id: 'gmail-message-1' }), true);
  });

  it('allows a new order cycle with no associated Pickup Ready email', () => {
    assert.equal(hasProcessedPickupEmail({ pickup_email_id: null }), false);
    assert.equal(hasProcessedPickupEmail({}), false);
    assert.equal(hasProcessedPickupEmail(null), false);
  });

  it('rejects a legacy Pickup Ready email older than a manual order update', () => {
    assert.equal(isPickupEmailStaleForOrder(
      { order_status: 'pending', updated_at: '2026-09-08T18:00:00.000Z' },
      { date: 'Tue, 08 Sep 2026 17:00:00 +0000' }
    ), true);
  });

  it('allows a Pickup Ready email newer than the order update', () => {
    assert.equal(isPickupEmailStaleForOrder(
      { order_status: 'pending', updated_at: '2026-09-08T17:00:00.000Z' },
      { date: 'Tue, 08 Sep 2026 18:00:00 +0000' }
    ), false);
  });
});