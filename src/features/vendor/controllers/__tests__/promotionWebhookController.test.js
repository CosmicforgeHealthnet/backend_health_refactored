/* eslint-env jest */
// Unit tests for PromotionWebhookController — signature verification and
// idempotent activation for the Paystack/Flutterwave promotion webhooks.
// These are public, unauthenticated endpoints (verified by HMAC/shared-secret
// instead of JWT), so a broken signature check is a real security hole and a
// non-idempotent activation would double-charge bookkeeping on retries.

const crypto = require('crypto');

jest.mock('../../services/promotionService');
const promotionService = require('../../services/promotionService');

const promotionWebhookController = require('../promotionWebhookController');

function makeRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.sendStatus = jest.fn().mockReturnValue(res);
  return res;
}

const OLD_ENV = process.env;

beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...OLD_ENV, PAYSTACK_SECRET_KEY: 'paystack-secret', FLUTTERWAVE_SECRET_KEY: 'flutterwave-secret' };
  promotionService.activatePromotion = jest.fn().mockResolvedValue(undefined);
});

afterAll(() => {
  process.env = OLD_ENV;
});

// ============================================================================
// SUITE 1 - Paystack: HMAC-SHA512 signature over the raw body
// ============================================================================

describe('handlePaystack', () => {
  function validSignature(rawBody) {
    return crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY).update(rawBody).digest('hex');
  }

  test('rejects with 401 when the signature does not match', async () => {
    const req = {
      headers: { 'x-paystack-signature': 'wrong-signature' },
      rawBody: Buffer.from(JSON.stringify({ event: 'charge.success', data: { reference: 'ref-1' } })),
      body: { event: 'charge.success', data: { reference: 'ref-1' } },
    };
    const res = makeRes();

    await promotionWebhookController.handlePaystack(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid signature' });
    expect(promotionService.activatePromotion).not.toHaveBeenCalled();
  });

  test('activates the promotion on a valid charge.success signature and returns 200', async () => {
    const rawBody = Buffer.from(JSON.stringify({ event: 'charge.success', data: { reference: 'ref-1' } }));
    const req = {
      headers: { 'x-paystack-signature': validSignature(rawBody) },
      rawBody,
      body: { event: 'charge.success', data: { reference: 'ref-1' } },
    };
    const res = makeRes();

    await promotionWebhookController.handlePaystack(req, res);

    expect(promotionService.activatePromotion).toHaveBeenCalledWith('ref-1');
    expect(res.sendStatus).toHaveBeenCalledWith(200);
  });

  test('ignores non "charge.success" events but still returns 200 (valid signature)', async () => {
    const rawBody = Buffer.from(JSON.stringify({ event: 'charge.failed', data: {} }));
    const req = {
      headers: { 'x-paystack-signature': validSignature(rawBody) },
      rawBody,
      body: { event: 'charge.failed', data: {} },
    };
    const res = makeRes();

    await promotionWebhookController.handlePaystack(req, res);

    expect(promotionService.activatePromotion).not.toHaveBeenCalled();
    expect(res.sendStatus).toHaveBeenCalledWith(200);
  });

  test('returns 400 when charge.success has no reference in the payload', async () => {
    const rawBody = Buffer.from(JSON.stringify({ event: 'charge.success', data: {} }));
    const req = {
      headers: { 'x-paystack-signature': validSignature(rawBody) },
      rawBody,
      body: { event: 'charge.success', data: {} },
    };
    const res = makeRes();

    await promotionWebhookController.handlePaystack(req, res);

    expect(res.sendStatus).toHaveBeenCalledWith(400);
    expect(promotionService.activatePromotion).not.toHaveBeenCalled();
  });

  test('still returns 200 (not a 500) when activatePromotion throws, so Paystack does not retry forever', async () => {
    promotionService.activatePromotion = jest.fn().mockRejectedValue(new Error('DB down'));
    const rawBody = Buffer.from(JSON.stringify({ event: 'charge.success', data: { reference: 'ref-1' } }));
    const req = {
      headers: { 'x-paystack-signature': validSignature(rawBody) },
      rawBody,
      body: { event: 'charge.success', data: { reference: 'ref-1' } },
    };
    const res = makeRes();

    await promotionWebhookController.handlePaystack(req, res);

    expect(res.sendStatus).toHaveBeenCalledWith(200);
  });

  test('a second delivery of the same event activates again (idempotency is promotionService\'s job, not the controller\'s)', async () => {
    const rawBody = Buffer.from(JSON.stringify({ event: 'charge.success', data: { reference: 'ref-1' } }));
    const req = {
      headers: { 'x-paystack-signature': validSignature(rawBody) },
      rawBody,
      body: { event: 'charge.success', data: { reference: 'ref-1' } },
    };

    await promotionWebhookController.handlePaystack(req, makeRes());
    await promotionWebhookController.handlePaystack(req, makeRes());

    expect(promotionService.activatePromotion).toHaveBeenCalledTimes(2);
    expect(promotionService.activatePromotion).toHaveBeenNthCalledWith(1, 'ref-1');
    expect(promotionService.activatePromotion).toHaveBeenNthCalledWith(2, 'ref-1');
  });
});

// ============================================================================
// SUITE 2 - Flutterwave: shared-secret header comparison
// ============================================================================

describe('handleFlutterwave', () => {
  test('rejects with 401 when verif-hash does not match the configured secret', async () => {
    const req = {
      headers: { 'verif-hash': 'wrong-secret' },
      body: { event: 'charge.completed', data: { status: 'successful', tx_ref: 'ref-1' } },
    };
    const res = makeRes();

    await promotionWebhookController.handleFlutterwave(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(promotionService.activatePromotion).not.toHaveBeenCalled();
  });

  test('activates the promotion when the header matches and status is successful', async () => {
    const req = {
      headers: { 'verif-hash': 'flutterwave-secret' },
      body: { event: 'charge.completed', data: { status: 'successful', tx_ref: 'ref-1' } },
    };
    const res = makeRes();

    await promotionWebhookController.handleFlutterwave(req, res);

    expect(promotionService.activatePromotion).toHaveBeenCalledWith('ref-1');
    expect(res.sendStatus).toHaveBeenCalledWith(200);
  });

  test('does not activate when status is not "successful", even for a charge.completed event', async () => {
    const req = {
      headers: { 'verif-hash': 'flutterwave-secret' },
      body: { event: 'charge.completed', data: { status: 'failed', tx_ref: 'ref-1' } },
    };
    const res = makeRes();

    await promotionWebhookController.handleFlutterwave(req, res);

    expect(promotionService.activatePromotion).not.toHaveBeenCalled();
    expect(res.sendStatus).toHaveBeenCalledWith(200);
  });

  test('returns 400 when tx_ref is missing from a successful charge.completed payload', async () => {
    const req = {
      headers: { 'verif-hash': 'flutterwave-secret' },
      body: { event: 'charge.completed', data: { status: 'successful' } },
    };
    const res = makeRes();

    await promotionWebhookController.handleFlutterwave(req, res);

    expect(res.sendStatus).toHaveBeenCalledWith(400);
  });

  test('still returns 200 when activatePromotion throws', async () => {
    promotionService.activatePromotion = jest.fn().mockRejectedValue(new Error('DB down'));
    const req = {
      headers: { 'verif-hash': 'flutterwave-secret' },
      body: { event: 'charge.completed', data: { status: 'successful', tx_ref: 'ref-1' } },
    };
    const res = makeRes();

    await promotionWebhookController.handleFlutterwave(req, res);

    expect(res.sendStatus).toHaveBeenCalledWith(200);
  });
});
