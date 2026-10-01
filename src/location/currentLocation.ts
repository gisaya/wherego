export type CurrentLocation = {
  coords: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
};

export async function getCurrentLocationOnce(
  request: () => Promise<CurrentLocation>,
  timeoutMs = 12000,
): Promise<CurrentLocation> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    const location = await Promise.race([
      request(),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('위치 확인 시간이 초과됐어요. 다시 시도하거나 지역을 직접 선택해 주세요.')), timeoutMs);
      }),
    ]);
    const { latitude, longitude } = location?.coords || {};
    if (
      typeof latitude !== 'number' ||
      typeof longitude !== 'number' ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 ||
      Math.abs(longitude) > 180
    ) {
      throw new Error('현재 위치를 확인하지 못했어요. 다시 시도하거나 지역을 직접 선택해 주세요.');
    }
    return location;
  } finally {
    if (timeoutId != null) {
      clearTimeout(timeoutId);
    }
  }
}
