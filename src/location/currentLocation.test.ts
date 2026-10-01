import { getCurrentLocationOnce } from './currentLocation';

describe('getCurrentLocationOnce', () => {
  const location = { coords: { latitude: 37.5665, longitude: 126.978, accuracy: 50 } };

  it('returns valid coordinates from a one-shot request', async () => {
    await expect(getCurrentLocationOnce(async () => location)).resolves.toEqual(location);
  });

  it('rejects invalid coordinates instead of continuing with an unusable origin', async () => {
    await expect(getCurrentLocationOnce(async () => ({ coords: { latitude: NaN, longitude: 126.978 } })))
      .rejects.toThrow('현재 위치를 확인하지 못했어요.');
  });

  it('times out if the native location request never resolves', async () => {
    jest.useFakeTimers();
    try {
      const pending = getCurrentLocationOnce(() => new Promise(() => {}), 100);
      jest.advanceTimersByTime(100);
      await expect(pending).rejects.toThrow('위치 확인 시간이 초과됐어요.');
    } finally {
      jest.useRealTimers();
    }
  });
});
