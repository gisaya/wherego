/// <reference types="jest" />

import { Storage } from '@apps-in-toss/framework';

import { WheregoApiError } from '../api/wheregoApi';
import { grantResultViewPromotion } from './resultPromotion';

jest.mock('@apps-in-toss/framework', () => ({
  Storage: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

const storageGetItemMock = jest.mocked(Storage.getItem);
const storageSetItemMock = jest.mocked(Storage.setItem);
const storageRemoveItemMock = jest.mocked(Storage.removeItem);

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

  it('does not call the server when a local guard already exists', async () => {
    storageGetItemMock.mockResolvedValue('existing-reward-key');
    const grant = jest.fn();

    await expect(grantResultViewPromotion(grant)).resolves.toEqual({ status: 'alreadyGranted' });

    expect(grant).not.toHaveBeenCalled();
    expect(storageSetItemMock).not.toHaveBeenCalled();
  });

  it('clears the local guard when the server says retry is safe', async () => {
    const grant = jest.fn().mockRejectedValue(
      new WheregoApiError('server unavailable', 503, 'apps_in_toss_unavailable'),
    );

    await expect(grantResultViewPromotion(grant)).resolves.toEqual({
      status: 'error',
      errorCode: 'apps_in_toss_unavailable',
      retryable: true,
    });

    expect(storageRemoveItemMock).toHaveBeenCalledTimes(1);
  });

  it('returns already granted when the server rejects a duplicate', async () => {
    const grant = jest.fn().mockResolvedValue({ status: 'alreadyGranted' });

    await expect(grantResultViewPromotion(grant)).resolves.toEqual({ status: 'alreadyGranted' });

    expect(storageRemoveItemMock).not.toHaveBeenCalled();
  });

  it('keeps the local guard when the server outcome may be ambiguous', async () => {
    const grant = jest.fn().mockRejectedValue(
      new WheregoApiError('unknown outcome', 409, 'wherego_promotion_pending'),
    );

    await expect(grantResultViewPromotion(grant)).resolves.toEqual({
      status: 'error',
      errorCode: 'wherego_promotion_pending',
      retryable: false,
    });

    expect(storageRemoveItemMock).not.toHaveBeenCalled();
  });

  it('persists the reward key after a server-side grant succeeds', async () => {
    const grant = jest.fn().mockResolvedValue({ status: 'success', key: 'reward-key' });

    await expect(grantResultViewPromotion(grant)).resolves.toEqual({ status: 'success' });

    expect(storageSetItemMock).toHaveBeenLastCalledWith(expect.any(String), 'reward-key');
    expect(storageRemoveItemMock).not.toHaveBeenCalled();
  });
});
