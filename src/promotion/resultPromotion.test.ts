/// <reference types="jest" />

import { grantPromotionReward, Storage } from '@apps-in-toss/framework';

import { grantResultViewPromotion } from './resultPromotion';

jest.mock('@apps-in-toss/framework', () => ({
  grantPromotionReward: jest.fn(),
  Storage: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

const grantPromotionRewardMock = jest.mocked(grantPromotionReward);
const storageGetItemMock = jest.mocked(Storage.getItem);
const storageSetItemMock = jest.mocked(Storage.setItem);
const storageRemoveItemMock = jest.mocked(Storage.removeItem);

function createGuard() {
  return {
    reserve: jest.fn<Promise<boolean>, []>(),
    resolve: jest.fn<Promise<void>, [boolean]>(),
  };
}

describe('grantResultViewPromotion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    storageGetItemMock.mockResolvedValue(null);
    storageSetItemMock.mockResolvedValue(undefined);
    storageRemoveItemMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does not reserve or call the SDK when a local guard already exists', async () => {
    storageGetItemMock.mockResolvedValue('existing-reward-key');
    const guard = createGuard();

    await expect(grantResultViewPromotion(guard)).resolves.toEqual({ status: 'alreadyGranted' });

    expect(guard.reserve).not.toHaveBeenCalled();
    expect(grantPromotionRewardMock).not.toHaveBeenCalled();
    expect(storageSetItemMock).not.toHaveBeenCalled();
  });

  it('fails closed when the server guard is unavailable', async () => {
    const guard = createGuard();
    guard.reserve.mockRejectedValue(new Error('server unavailable'));

    await expect(grantResultViewPromotion(guard)).resolves.toEqual({
      status: 'error',
      errorCode: 'GUARD_UNAVAILABLE',
      retryable: true,
    });

    expect(grantPromotionRewardMock).not.toHaveBeenCalled();
    expect(storageRemoveItemMock).toHaveBeenCalledTimes(1);
    expect(guard.resolve).not.toHaveBeenCalled();
  });

  it('does not call the SDK when the server guard rejects a duplicate', async () => {
    const guard = createGuard();
    guard.reserve.mockResolvedValue(false);

    await expect(grantResultViewPromotion(guard)).resolves.toEqual({ status: 'alreadyGranted' });

    expect(grantPromotionRewardMock).not.toHaveBeenCalled();
    expect(storageRemoveItemMock).not.toHaveBeenCalled();
  });

  it('keeps both guards and disables retry when the SDK promise rejects', async () => {
    const guard = createGuard();
    guard.reserve.mockResolvedValue(true);
    grantPromotionRewardMock.mockRejectedValue(new Error('unknown SDK outcome'));

    await expect(grantResultViewPromotion(guard)).resolves.toEqual({
      status: 'error',
      errorCode: 'SDK_REJECTED',
      retryable: false,
    });

    expect(storageRemoveItemMock).not.toHaveBeenCalled();
    expect(guard.resolve).not.toHaveBeenCalled();
  });

  it('releases both guards for a retryable structured SDK error', async () => {
    const guard = createGuard();
    guard.reserve.mockResolvedValue(true);
    grantPromotionRewardMock.mockResolvedValue({ errorCode: '4110', message: 'retry' });

    await expect(grantResultViewPromotion(guard)).resolves.toEqual({
      status: 'error',
      errorCode: '4110',
      retryable: true,
    });

    expect(storageRemoveItemMock).toHaveBeenCalledTimes(1);
    expect(guard.resolve).toHaveBeenCalledWith(false);
  });

  it('releases both guards when the SDK is unsupported', async () => {
    const guard = createGuard();
    guard.reserve.mockResolvedValue(true);
    grantPromotionRewardMock.mockResolvedValue(undefined);

    await expect(grantResultViewPromotion(guard)).resolves.toEqual({ status: 'unsupported' });

    expect(storageRemoveItemMock).toHaveBeenCalledTimes(1);
    expect(guard.resolve).toHaveBeenCalledWith(false);
  });

  it('persists the reward key and finalizes the server guard after success', async () => {
    const guard = createGuard();
    guard.reserve.mockResolvedValue(true);
    grantPromotionRewardMock.mockResolvedValue({ key: 'reward-key' });

    await expect(grantResultViewPromotion(guard)).resolves.toEqual({ status: 'success' });

    expect(storageSetItemMock).toHaveBeenLastCalledWith(expect.any(String), 'reward-key');
    expect(storageRemoveItemMock).not.toHaveBeenCalled();
    expect(guard.resolve).toHaveBeenCalledWith(true);
  });
});
