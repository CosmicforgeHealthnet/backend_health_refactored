/* eslint-env jest */
// Unit tests for LogisticsService — currently a stub with no external I/O,
// but its contract (return shape, provider fallback) is relied on by
// shipmentService and the frontend provider dropdown, so it's worth pinning.

const logisticsService = require('../logisticsService');

describe('schedulePickup', () => {
  test('returns a scheduled placeholder response, echoing the given provider', async () => {
    const result = await logisticsService.schedulePickup({ id: 's1', logisticsProvider: 'dhl' });
    expect(result).toEqual({
      scheduled: true,
      provider: 'dhl',
      message: 'Pickup scheduled. Integration with provider pending.',
    });
  });

  test('falls back to "custom" when no provider is set on the shipment', async () => {
    const result = await logisticsService.schedulePickup({ id: 's1' });
    expect(result.provider).toBe('custom');
  });
});

describe('getTrackingStatus', () => {
  test('returns a pending-integration placeholder for the given tracking number/provider', async () => {
    const result = await logisticsService.getTrackingStatus('TRK123', 'dhl');
    expect(result).toEqual({
      trackingNumber: 'TRK123',
      provider: 'dhl',
      status: 'pending_integration',
      message: 'Live tracking will be available once logistics provider is connected.',
    });
  });

  test('falls back to "custom" when no provider is given', async () => {
    const result = await logisticsService.getTrackingStatus('TRK123');
    expect(result.provider).toBe('custom');
  });
});

describe('getSupportedProviders', () => {
  test('lists exactly the four documented providers with stable keys', () => {
    const providers = logisticsService.getSupportedProviders();
    expect(providers).toEqual([
      { key: 'gig_logistics', label: 'GIG Logistics' },
      { key: 'dhl', label: 'DHL Express' },
      { key: 'jumia_logistics', label: 'Jumia Logistics' },
      { key: 'custom', label: 'Own Delivery / Custom Courier' },
    ]);
  });
});
