/* eslint-env jest */
// Unit tests for vendor WalletService — balance/earnings math and the
// frozen-wallet hold-back path. creditOrder is called only from
// orderService.handlePaymentSuccess (webhook-driven), never directly by a user.

jest.mock('../../repositories/walletRepository');
jest.mock('../../repositories/vendorRepository');

const walletRepository = require('../../repositories/walletRepository');
const vendorRepository = require('../../repositories/vendorRepository');

const walletService = require('../walletService');

const VENDOR_ID = 'aaaa0000-0000-0000-0000-000000000001';
const VENDOR_USER_ID = 'aaaa0000-0000-0000-0000-000000000002';
const WALLET_ID = 'bbbb0000-0000-0000-0000-000000000003';

function makeWallet(overrides = {}) {
  return {
    id: WALLET_ID,
    vendorId: VENDOR_ID,
    availableBalanceNgn: '5000.0000',
    pendingClearanceNgn: '0.0000',
    totalEarningsNgn: '20000.0000',
    isActive: true,
    isFrozen: false,
    frozenReason: null,
    lastPayoutAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();

  walletRepository.findByVendorId = jest.fn().mockResolvedValue(makeWallet());
  walletRepository.createWallet = jest.fn().mockResolvedValue(makeWallet());
  walletRepository.update = jest.fn().mockResolvedValue(undefined);
  walletRepository.saveTransaction = jest.fn().mockResolvedValue(undefined);
  walletRepository.findTransactionsByVendor = jest.fn().mockResolvedValue({ transactions: [], total: 0, page: 1, limit: 20 });

  vendorRepository.findByUserId = jest.fn().mockResolvedValue({ id: VENDOR_ID });
});

// ============================================================================
// SUITE 1 - getOrCreateWallet
// ============================================================================

describe('getOrCreateWallet', () => {
  test('returns the existing wallet without creating a new one', async () => {
    const wallet = await walletService.getOrCreateWallet(VENDOR_ID);
    expect(wallet.id).toBe(WALLET_ID);
    expect(walletRepository.createWallet).not.toHaveBeenCalled();
  });

  test('creates a new wallet when none exists yet', async () => {
    walletRepository.findByVendorId = jest.fn().mockResolvedValue(null);
    await walletService.getOrCreateWallet(VENDOR_ID);
    expect(walletRepository.createWallet).toHaveBeenCalledWith(VENDOR_ID);
  });
});

// ============================================================================
// SUITE 2 - getWalletSummary / getTransactions
// ============================================================================

describe('getWalletSummary', () => {
  test('throws when caller has no vendor profile', async () => {
    vendorRepository.findByUserId = jest.fn().mockResolvedValue(null);
    await expect(walletService.getWalletSummary(VENDOR_USER_ID)).rejects.toThrow('Vendor profile not found');
  });

  test('returns parsed numeric balances', async () => {
    const summary = await walletService.getWalletSummary(VENDOR_USER_ID);
    expect(summary).toEqual({
      availableBalanceNgn: 5000,
      pendingClearanceNgn: 0,
      totalEarningsNgn: 20000,
      isActive: true,
      isFrozen: false,
      frozenReason: null,
      lastPayoutAt: null,
    });
  });
});

describe('getTransactions', () => {
  test('throws when caller has no vendor profile', async () => {
    vendorRepository.findByUserId = jest.fn().mockResolvedValue(null);
    await expect(walletService.getTransactions(VENDOR_USER_ID, {})).rejects.toThrow('Vendor profile not found');
  });

  test('defaults page/limit and scopes to the vendor', async () => {
    await walletService.getTransactions(VENDOR_USER_ID, {});
    expect(walletRepository.findTransactionsByVendor).toHaveBeenCalledWith(
      expect.objectContaining({ vendorId: VENDOR_ID, page: 1, limit: 20 })
    );
  });
});

// ============================================================================
// SUITE 3 - creditOrder: the money-moving core
// ============================================================================

describe('creditOrder', () => {
  test('adds the credited amount to both availableBalanceNgn and totalEarningsNgn', async () => {
    await walletService.creditOrder(VENDOR_ID, {
      orderId: 'order-1',
      amountNgn: 1500,
      reference: 'ref-1',
      description: 'Order payment',
    });

    expect(walletRepository.update).toHaveBeenCalledWith(WALLET_ID, {
      availableBalanceNgn: 6500,   // 5000 + 1500
      totalEarningsNgn: 21500,     // 20000 + 1500
    });
    expect(walletRepository.saveTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        walletId: WALLET_ID,
        vendorId: VENDOR_ID,
        type: 'credit',
        category: 'order_payment',
        status: 'completed',
        amountNgn: 1500,
        balanceAfterNgn: 6500,
        orderId: 'order-1',
        reference: 'ref-1',
      })
    );
  });

  test('rounds the new balance/earnings to 4 decimal places', async () => {
    walletRepository.findByVendorId = jest.fn().mockResolvedValue(makeWallet({
      availableBalanceNgn: '10.00005',
      totalEarningsNgn: '10.00005',
    }));

    await walletService.creditOrder(VENDOR_ID, { orderId: 'o1', amountNgn: 0.00003, reference: 'r1', description: 'd' });

    const updateArg = walletRepository.update.mock.calls[0][1];
    expect(updateArg.availableBalanceNgn).toBeCloseTo(10.0001, 4);
    expect(updateArg.totalEarningsNgn).toBeCloseTo(10.0001, 4);
  });

  test('creates the wallet first if the vendor has none yet, then credits it', async () => {
    walletRepository.findByVendorId = jest.fn().mockResolvedValue(null);
    walletRepository.createWallet = jest.fn().mockResolvedValue(makeWallet({ availableBalanceNgn: '0.0000', totalEarningsNgn: '0.0000' }));

    await walletService.creditOrder(VENDOR_ID, { orderId: 'o1', amountNgn: 500, reference: 'r1', description: 'd' });

    expect(walletRepository.createWallet).toHaveBeenCalledWith(VENDOR_ID);
    expect(walletRepository.update).toHaveBeenCalledWith(WALLET_ID, { availableBalanceNgn: 500, totalEarningsNgn: 500 });
  });

  test('frozen wallet: records a pending transaction and does NOT touch the balance', async () => {
    walletRepository.findByVendorId = jest.fn().mockResolvedValue(makeWallet({ isFrozen: true, availableBalanceNgn: '5000.0000' }));

    await walletService.creditOrder(VENDOR_ID, { orderId: 'o1', amountNgn: 2000, reference: 'r1', description: 'd' });

    expect(walletRepository.update).not.toHaveBeenCalled();
    expect(walletRepository.saveTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'pending',
        amountNgn: 2000,
        balanceAfterNgn: 5000, // unchanged — the credit is held, not applied
      })
    );
  });
});
