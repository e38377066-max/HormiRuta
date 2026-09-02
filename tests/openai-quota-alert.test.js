import test from 'node:test';
import assert from 'node:assert/strict';
import { isOpenAIQuotaError } from '../src/services/openaiQuotaAlertService.js';

test('detects OpenAI quota exhaustion by code and no-credit message', () => {
  assert.equal(isOpenAIQuotaError({ code: 'insufficient_quota' }), true);
  assert.equal(isOpenAIQuotaError({
    status: 429,
    message: 'You have no credits remaining. Add credits to continue using the API.'
  }), true);
  assert.equal(isOpenAIQuotaError({
    status: 429,
    message: 'You exceeded your quota for this billing period.'
  }), true);
});

test('does not treat a normal temporary rate limit as exhausted credits', () => {
  assert.equal(isOpenAIQuotaError({
    status: 429,
    message: 'Too many requests. Please try again later.'
  }), false);
  assert.equal(isOpenAIQuotaError({
    status: 500,
    message: 'Internal server error'
  }), false);
});