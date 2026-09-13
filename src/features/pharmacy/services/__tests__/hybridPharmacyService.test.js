/* eslint-env jest */
// Unit tests for hybridPharmacyService — lets an already-approved pharmacy
// opt into listing products as a vendor in the general shop.

jest.mock('../../../../config/database');

const AppDataSource = require('../../../../config/database');
const hybridPharmacyService = require('../hybridPharmacyService');

const USER_ID = 'aaaa0000-0000-0000-0000-000000000001';
const PHARMACY_ID = 'bbbb0000-0000-0000-0000-000000000002';

function makePharmacy(overrides = {}) {
  return {
    id: PHARMACY_ID, userId: USER_ID, pharmacyName: 'Test Pharmacy',
    email: 'p@example.com', phone: '08000000000', address: '1 Main St',
    verificationStatus: 'approved',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();

  const pharmacyRepo = { findOne: jest.fn().mockResolvedValue(makePharmacy()) };
  const vendorRepo = {
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn((data) => data),
    // Mirrors real TypeORM behavior: save() assigns generated columns (id)
    // back onto the SAME object it was given, not just onto its return value —
    // the service relies on this (it returns the `vendor` object passed into
    // create(), not save()'s return value).
    save: jest.fn(async (data) => { data.id = 'vendor-1'; return data; }),
  };
  AppDataSource.getRepository = jest.fn((name) => (name === 'PharmacyProfile' ? pharmacyRepo : vendorRepo));
  AppDataSource.__pharmacyRepo = pharmacyRepo;
  AppDataSource.__vendorRepo = vendorRepo;
});

describe('enableVendorMode', () => {
  test('throws when no pharmacy profile exists for this account', async () => {
    AppDataSource.__pharmacyRepo.findOne = jest.fn().mockResolvedValue(null);
    await expect(hybridPharmacyService.enableVendorMode(USER_ID, { state: 'Lagos', city: 'Ikeja' }))
      .rejects.toThrow('Pharmacy profile not found for this account');
  });

  test('refuses when the pharmacy is not yet approved', async () => {
    AppDataSource.__pharmacyRepo.findOne = jest.fn().mockResolvedValue(makePharmacy({ verificationStatus: 'under_review' }));
    await expect(hybridPharmacyService.enableVendorMode(USER_ID, { state: 'Lagos', city: 'Ikeja' }))
      .rejects.toThrow('Your pharmacy must be fully approved before enabling vendor mode. Current status: under_review');
  });

  test('refuses if vendor mode is already enabled', async () => {
    AppDataSource.__vendorRepo.findOne = jest.fn().mockResolvedValue({ id: 'existing-vendor' });
    await expect(hybridPharmacyService.enableVendorMode(USER_ID, { state: 'Lagos', city: 'Ikeja' }))
      .rejects.toThrow('Vendor mode is already enabled for this account');
  });

  test('requires state and city', async () => {
    await expect(hybridPharmacyService.enableVendorMode(USER_ID, { state: 'Lagos' }))
      .rejects.toThrow('state and city are required to enable vendor mode');
    await expect(hybridPharmacyService.enableVendorMode(USER_ID, { city: 'Ikeja' }))
      .rejects.toThrow('state and city are required to enable vendor mode');
  });

  test('rejects an invalid businessCategory', async () => {
    await expect(
      hybridPharmacyService.enableVendorMode(USER_ID, { state: 'Lagos', city: 'Ikeja', businessCategory: 'not_a_real_category' })
    ).rejects.toThrow('Invalid businessCategory');
  });

  test('defaults businessCategory to health_wellness and falls back to pharmacy profile fields', async () => {
    const vendor = await hybridPharmacyService.enableVendorMode(USER_ID, { state: 'Lagos', city: 'Ikeja' });

    expect(AppDataSource.__vendorRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      businessCategory: 'health_wellness',
      businessName: 'Test Pharmacy',
      businessEmail: 'p@example.com',
      businessPhone: '08000000000',
      fullAddress: '1 Main St',
      isHybridPharmacy: true,
      isActive: true,
      pharmacyProfileId: PHARMACY_ID,
      verificationStatus: 'approved',
    }));
    expect(vendor.id).toBe('vendor-1');
  });

  test('caller-supplied business fields override the pharmacy profile defaults', async () => {
    await hybridPharmacyService.enableVendorMode(USER_ID, {
      state: 'Lagos', city: 'Ikeja', businessName: 'Custom Shop Name', businessCategory: 'medical_supplies',
    });

    expect(AppDataSource.__vendorRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      businessName: 'Custom Shop Name', businessCategory: 'medical_supplies',
    }));
  });
});

describe('getVendorModeStatus', () => {
  test('throws when no pharmacy profile exists', async () => {
    AppDataSource.__pharmacyRepo.findOne = jest.fn().mockResolvedValue(null);
    await expect(hybridPharmacyService.getVendorModeStatus(USER_ID)).rejects.toThrow('Pharmacy profile not found for this account');
  });

  test('reports vendorModeEnabled: false when no hybrid vendor profile exists', async () => {
    AppDataSource.__vendorRepo.findOne = jest.fn().mockResolvedValue(null);
    const result = await hybridPharmacyService.getVendorModeStatus(USER_ID);
    expect(result.vendorModeEnabled).toBe(false);
    expect(result.vendor).toBeNull();
  });

  test('reports vendorModeEnabled: true with vendor details when one exists', async () => {
    AppDataSource.__vendorRepo.findOne = jest.fn().mockResolvedValue({
      id: 'vendor-1', businessName: 'Test Pharmacy', businessCategory: 'health_wellness',
      verificationStatus: 'approved', isActive: true, createdAt: '2026-01-01',
    });
    const result = await hybridPharmacyService.getVendorModeStatus(USER_ID);
    expect(result.vendorModeEnabled).toBe(true);
    expect(result.vendor.id).toBe('vendor-1');
  });
});

describe('disableVendorMode', () => {
  test('throws when vendor mode is not enabled', async () => {
    AppDataSource.__vendorRepo.findOne = jest.fn().mockResolvedValue(null);
    await expect(hybridPharmacyService.disableVendorMode(USER_ID)).rejects.toThrow('Vendor mode is not enabled for this account');
  });

  test('sets isActive false on the vendor profile', async () => {
    const vendor = { id: 'vendor-1', userId: USER_ID, isHybridPharmacy: true, isActive: true };
    AppDataSource.__vendorRepo.findOne = jest.fn().mockResolvedValue(vendor);

    await hybridPharmacyService.disableVendorMode(USER_ID);

    expect(vendor.isActive).toBe(false);
    expect(AppDataSource.__vendorRepo.save).toHaveBeenCalledWith(vendor);
  });
});
