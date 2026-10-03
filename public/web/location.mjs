export function validCoordinates(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

export function currentOrigin(position) {
  const { latitude, longitude, accuracy } = position?.coords || {};
  if (!validCoordinates(latitude, longitude)) throw new Error('현재 위치를 확인하지 못했어요. 다시 시도하거나 지역을 직접 선택해 주세요.');
  return { id: 'current', type: 'current_location', label: '현재 위치', lat: latitude, lng: longitude,
    accuracy: Number.isFinite(accuracy) && accuracy >= 0 ? accuracy : undefined };
}

function locationError(error) {
  if (error?.code === 1) return new Error('위치 권한이 허용되지 않았어요. 브라우저 권한을 확인하거나 지역을 직접 선택해 주세요.');
  if (error?.code === 3) return new Error('위치 확인 시간이 초과됐어요. 다시 시도하거나 지역을 직접 선택해 주세요.');
  return new Error('현재 위치를 확인하지 못했어요. 다시 시도하거나 지역을 직접 선택해 주세요.');
}

export function requestCurrentOrigin({ geolocation = globalThis.navigator?.geolocation,
  secureContext = globalThis.isSecureContext !== false, signal, timeoutMs = 12000 } = {}) {
  if (!secureContext) return Promise.reject(new Error('현재 위치는 보안 연결에서 사용할 수 있어요. 지역을 직접 선택해 주세요.'));
  if (!geolocation?.getCurrentPosition) return Promise.reject(new Error('이 브라우저는 위치 확인을 지원하지 않아요. 지역을 직접 선택해 주세요.'));
  return new Promise((resolve, reject) => {
    let settled = false;
    let timeout;
    function finish(error, origin) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
      if (error) reject(error); else resolve(origin);
    }
    const abort = () => finish(new DOMException('Location request cancelled', 'AbortError'));
    if (signal?.aborted) { abort(); return; }
    signal?.addEventListener('abort', abort, { once: true });
    // A separate deadline also covers a permission dialog that remains unanswered.
    timeout = setTimeout(() => finish(locationError({ code: 3 })), timeoutMs);
    try {
      geolocation.getCurrentPosition(position => {
        if (settled) return;
        try { finish(null, currentOrigin(position)); } catch (error) { finish(error); }
      }, error => finish(locationError(error)), { enableHighAccuracy: true, maximumAge: 0, timeout: timeoutMs });
    } catch { finish(locationError()); }
  });
}
