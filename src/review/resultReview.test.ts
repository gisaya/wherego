import { Storage } from '@apps-in-toss/framework';

import { recordSuccessfulResultForReview } from './resultReview';

jest.mock('@apps-in-toss/framework', () => ({
  Storage: {
    getItem: jest.fn(),
    setItem: jest.fn(),
  },
}));

const storageGetItemMock = jest.mocked(Storage.getItem);
const storageSetItemMock = jest.mocked(Storage.setItem);

describe('recordSuccessfulResultForReview', () => {
  beforeEach(() => {
    storageGetItemMock.mockReset();
    storageSetItemMock.mockReset();
    storageSetItemMock.mockResolvedValue(undefined);
  });

  it('does not show the review prompt after the first successful result', async () => {
    storageGetItemMock.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

    await expect(recordSuccessfulResultForReview()).resolves.toBe(false);

    expect(storageSetItemMock).toHaveBeenCalledTimes(1);
    expect(storageSetItemMock).toHaveBeenCalledWith(expect.any(String), '1');
  });

  it('shows the review prompt once after the second successful result', async () => {
    storageGetItemMock.mockResolvedValueOnce('1').mockResolvedValueOnce(null);

    await expect(recordSuccessfulResultForReview()).resolves.toBe(true);

    expect(storageSetItemMock).toHaveBeenNthCalledWith(1, expect.any(String), '2');
    expect(storageSetItemMock).toHaveBeenNthCalledWith(2, expect.any(String), 'shown');
  });

  it('does not show the review prompt again after it was already shown', async () => {
    storageGetItemMock.mockResolvedValueOnce('2').mockResolvedValueOnce('shown');

    await expect(recordSuccessfulResultForReview()).resolves.toBe(false);

    expect(storageSetItemMock).toHaveBeenCalledTimes(1);
  });
});
