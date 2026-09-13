/* eslint-env jest */
// Unit tests for vendor ShipmentService — dispatch/deliver state machine and
// the ownership guards that keep one vendor from touching another's shipment.

jest.mock('../../repositories/shipmentRepository');
jest.mock('../../repositories/orderRepository');
jest.mock('../../repositories/vendorRepository');
jest.mock('../logisticsService');
jest.mock('../../../notifications/services/notificationService');

const shipmentRepository = require('../../repositories/shipmentRepository');
const orderRepository = require('../../repositories/orderRepository');
const vendorRepository = require('../../repositories/vendorRepository');
const logisticsService = require('../logisticsService');
const NotificationService = require('../../../notifications/services/notificationService');

const shipmentService = require('../shipmentService');

const VENDOR_USER_ID = 'aaaa0000-0000-0000-0000-000000000001';
const VENDOR_ID = 'bbbb0000-0000-0000-0000-000000000002';
const ORDER_ID = 'cccc0000-0000-0000-0000-000000000003';
const PATIENT_ID = 'dddd0000-0000-0000-0000-000000000004';
const SHIPMENT_ID = 'eeee0000-0000-0000-0000-000000000005';

function makeOrder(overrides = {}) {
  return {
    id: ORDER_ID,
    vendorId: VENDOR_ID,
    patientId: PATIENT_ID,
    status: 'processing',
    paymentStatus: 'paid',
    ...overrides,
  };
}

function makeShipment(overrides = {}) {
  return {
    id: SHIPMENT_ID,
    orderId: ORDER_ID,
    vendorId: VENDOR_ID,
    patientId: PATIENT_ID,
    status: 'dispatched',
    deliveryMethod: 'delivery',
    ...overrides,
  };
}

const mockNotify = NotificationService.mock.instances[0].createNotification;

beforeEach(() => {
  jest.clearAllMocks();

  vendorRepository.findByUserId = jest.fn().mockResolvedValue({ id: VENDOR_ID, userId: VENDOR_USER_ID });
  orderRepository.findById = jest.fn().mockResolvedValue(makeOrder());
  orderRepository.update = jest.fn().mockResolvedValue(undefined);

  shipmentRepository.findByOrderId = jest.fn().mockResolvedValue(null);
  shipmentRepository.save = jest.fn().mockImplementation((data) => Promise.resolve({ id: SHIPMENT_ID, ...data }));
  shipmentRepository.update = jest.fn().mockResolvedValue(undefined);

  logisticsService.schedulePickup = jest.fn().mockResolvedValue({ scheduled: true });
  logisticsService.getSupportedProviders = jest.fn().mockReturnValue([{ key: 'custom', label: 'Custom' }]);

  mockNotify.mockReset().mockResolvedValue(undefined);
});

// ============================================================================
// SUITE 1 - dispatchOrder
// ============================================================================

describe('dispatchOrder', () => {
  test('requires deliveryMethod', async () => {
    await expect(shipmentService.dispatchOrder(VENDOR_USER_ID, ORDER_ID, {})).rejects.toThrow(
      'deliveryMethod is required (pickup or delivery)'
    );
  });

  test('rejects an invalid deliveryMethod', async () => {
    await expect(
      shipmentService.dispatchOrder(VENDOR_USER_ID, ORDER_ID, { deliveryMethod: 'teleport' })
    ).rejects.toThrow('deliveryMethod must be pickup or delivery');
  });

  test('requires deliveryAddress when deliveryMethod is delivery', async () => {
    await expect(
      shipmentService.dispatchOrder(VENDOR_USER_ID, ORDER_ID, { deliveryMethod: 'delivery' })
    ).rejects.toThrow('deliveryAddress is required for delivery');
  });

  test('pickup does not require a deliveryAddress', async () => {
    await expect(
      shipmentService.dispatchOrder(VENDOR_USER_ID, ORDER_ID, { deliveryMethod: 'pickup' })
    ).resolves.toBeDefined();
  });

  test('throws when caller has no vendor profile', async () => {
    vendorRepository.findByUserId = jest.fn().mockResolvedValue(null);
    await expect(
      shipmentService.dispatchOrder(VENDOR_USER_ID, ORDER_ID, { deliveryMethod: 'pickup' })
    ).rejects.toThrow('Vendor profile not found');
  });

  test('throws when order belongs to a different vendor', async () => {
    orderRepository.findById = jest.fn().mockResolvedValue(makeOrder({ vendorId: 'someone-else' }));
    await expect(
      shipmentService.dispatchOrder(VENDOR_USER_ID, ORDER_ID, { deliveryMethod: 'pickup' })
    ).rejects.toThrow('Order not found');
  });

  test('refuses to dispatch an unpaid order', async () => {
    orderRepository.findById = jest.fn().mockResolvedValue(makeOrder({ paymentStatus: 'unpaid' }));
    await expect(
      shipmentService.dispatchOrder(VENDOR_USER_ID, ORDER_ID, { deliveryMethod: 'pickup' })
    ).rejects.toThrow('Cannot dispatch an unpaid order');
  });

  test('refuses to dispatch an order that is not "processing"', async () => {
    orderRepository.findById = jest.fn().mockResolvedValue(makeOrder({ status: 'pending' }));
    await expect(
      shipmentService.dispatchOrder(VENDOR_USER_ID, ORDER_ID, { deliveryMethod: 'pickup' })
    ).rejects.toThrow('Only processing orders can be dispatched');
  });

  test('refuses to create a second shipment for the same order', async () => {
    shipmentRepository.findByOrderId = jest.fn().mockResolvedValue(makeShipment());
    await expect(
      shipmentService.dispatchOrder(VENDOR_USER_ID, ORDER_ID, { deliveryMethod: 'pickup' })
    ).rejects.toThrow('Shipment already created for this order');
  });

  test('creates the shipment and updates the order delivery fields', async () => {
    const result = await shipmentService.dispatchOrder(VENDOR_USER_ID, ORDER_ID, {
      deliveryMethod: 'delivery', deliveryAddress: '1 Main St', trackingNumber: 'TRK1',
    });

    expect(shipmentRepository.save).toHaveBeenCalledWith(expect.objectContaining({
      orderId: ORDER_ID, vendorId: VENDOR_ID, patientId: PATIENT_ID, status: 'dispatched',
      deliveryMethod: 'delivery', deliveryAddress: '1 Main St', trackingNumber: 'TRK1',
    }));
    expect(orderRepository.update).toHaveBeenCalledWith(ORDER_ID, {
      deliveryMethod: 'delivery', deliveryAddress: '1 Main St',
    });
    expect(result.status).toBe('dispatched');
  });

  test('schedules pickup with the logistics provider when one is given (and not "custom")', async () => {
    await shipmentService.dispatchOrder(VENDOR_USER_ID, ORDER_ID, {
      deliveryMethod: 'pickup', logisticsProvider: 'gig_logistics',
    });
    expect(logisticsService.schedulePickup).toHaveBeenCalled();
  });

  test('does not schedule pickup for "custom" logistics provider', async () => {
    await shipmentService.dispatchOrder(VENDOR_USER_ID, ORDER_ID, {
      deliveryMethod: 'pickup', logisticsProvider: 'custom',
    });
    expect(logisticsService.schedulePickup).not.toHaveBeenCalled();
  });

  test('dispatch succeeds even if the patient notification fails', async () => {
    mockNotify.mockRejectedValue(new Error('down'));
    await expect(
      shipmentService.dispatchOrder(VENDOR_USER_ID, ORDER_ID, { deliveryMethod: 'pickup' })
    ).resolves.toBeDefined();
  });
});

// ============================================================================
// SUITE 2 - markDelivered
// ============================================================================

describe('markDelivered', () => {
  test('throws when caller has no vendor profile', async () => {
    vendorRepository.findByUserId = jest.fn().mockResolvedValue(null);
    await expect(shipmentService.markDelivered(VENDOR_USER_ID, ORDER_ID)).rejects.toThrow('Vendor profile not found');
  });

  test('throws when shipment does not exist or belongs to another vendor', async () => {
    shipmentRepository.findByOrderId = jest.fn().mockResolvedValue(makeShipment({ vendorId: 'someone-else' }));
    await expect(shipmentService.markDelivered(VENDOR_USER_ID, ORDER_ID)).rejects.toThrow('Shipment not found');
  });

  test('refuses to re-deliver an already-delivered shipment', async () => {
    shipmentRepository.findByOrderId = jest.fn().mockResolvedValue(makeShipment({ status: 'delivered' }));
    await expect(shipmentService.markDelivered(VENDOR_USER_ID, ORDER_ID)).rejects.toThrow(
      'Shipment is already marked as delivered'
    );
  });

  test('marks the shipment delivered and completes the order together', async () => {
    shipmentRepository.findByOrderId = jest.fn()
      .mockResolvedValueOnce(makeShipment({ status: 'dispatched' })) // lookup
      .mockResolvedValueOnce(makeShipment({ status: 'delivered' })); // re-fetch for the return value

    await shipmentService.markDelivered(VENDOR_USER_ID, ORDER_ID);

    expect(shipmentRepository.update).toHaveBeenCalledWith(SHIPMENT_ID, expect.objectContaining({ status: 'delivered' }));
    expect(orderRepository.update).toHaveBeenCalledWith(ORDER_ID, expect.objectContaining({ status: 'completed' }));
  });
});

// ============================================================================
// SUITE 3 - read paths: vendor/patient ownership guards
// ============================================================================

describe('getByOrderForVendor', () => {
  test('throws when order belongs to another vendor', async () => {
    orderRepository.findById = jest.fn().mockResolvedValue(makeOrder({ vendorId: 'someone-else' }));
    await expect(shipmentService.getByOrderForVendor(VENDOR_USER_ID, ORDER_ID)).rejects.toThrow('Order not found');
  });

  test('throws when no shipment exists yet for a valid order', async () => {
    shipmentRepository.findByOrderId = jest.fn().mockResolvedValue(null);
    await expect(shipmentService.getByOrderForVendor(VENDOR_USER_ID, ORDER_ID)).rejects.toThrow(
      'No shipment found for this order'
    );
  });
});

describe('getByOrderForPatient', () => {
  test('throws when order belongs to another patient', async () => {
    orderRepository.findById = jest.fn().mockResolvedValue(makeOrder({ patientId: 'someone-else' }));
    await expect(shipmentService.getByOrderForPatient(PATIENT_ID, ORDER_ID)).rejects.toThrow('Order not found');
  });

  test('returns the formatted shipment for the owning patient', async () => {
    shipmentRepository.findByOrderId = jest.fn().mockResolvedValue(makeShipment());
    const result = await shipmentService.getByOrderForPatient(PATIENT_ID, ORDER_ID);
    expect(result.id).toBe(SHIPMENT_ID);
  });
});

describe('getSupportedProviders', () => {
  test('delegates to logisticsService', () => {
    const result = shipmentService.getSupportedProviders();
    expect(result).toEqual([{ key: 'custom', label: 'Custom' }]);
  });
});
