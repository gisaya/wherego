export function validAdConfig(config) {
  return config?.enabled === true && /^ca-pub-\d{16}$/.test(config.clientId) &&
    Array.isArray(config.hosts) && config.hosts.length > 0 &&
    config.hosts.every(host => /^[a-z0-9][a-z0-9.-]+\.[a-z]{2,}$/.test(host)) &&
    (config.displaySlot === '' || /^\d{5,20}$/.test(config.displaySlot));
}

export function canServeAds(config, url, page) {
  try {
    const location = new URL(url);
    return validAdConfig(config) && location.protocol === 'https:' &&
      config.hosts.includes(location.hostname) && ['recommendation', 'place', 'guide'].includes(page);
  } catch { return false; }
}

let started = false;
export async function setupAds(page) {
  if (started) return;
  started = true;
  try {
    const response = await fetch('/web/monetization.json');
    if (!response.ok) return;
    const config = await response.json();
    if (!canServeAds(config, location.href, page)) return;
    // Offerwall metering, rewards, and consent belong to Google's published messages.
    // The app does not grant access on an arbitrary timeout or display-ad impression.
    window.googlefc = window.googlefc || {};
    window.googlefc.callbackQueue = window.googlefc.callbackQueue || [];
    window.googlefc.callbackQueue.push({ CONSENT_API_READY: () => {
      const button = document.querySelector('#ad-privacy');
      if (button && typeof window.googlefc.showRevocationMessage === 'function') {
        button.hidden = false;
        button.onclick = () => window.googlefc.callbackQueue.push({ CONSENT_API_READY: () =>
          window.googlefc.showRevocationMessage() });
      }
    } });
    const script = document.createElement('script');
    script.id = 'weekend-adsense'; script.async = true; script.crossOrigin = 'anonymous';
    script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + config.clientId;
    const block = document.querySelector('[data-display-ad]');
    if (block && config.displaySlot) {
      const ad = document.createElement('ins');
      ad.className = 'adsbygoogle'; ad.style.display = 'block';
      ad.setAttribute('data-ad-client', config.clientId);
      ad.setAttribute('data-ad-slot', config.displaySlot);
      ad.setAttribute('data-ad-format', 'horizontal');
      ad.setAttribute('data-full-width-responsive', 'false');
      block.append(ad); block.hidden = false;
      const observer = new MutationObserver(() => {
        if (ad.getAttribute('data-ad-status') === 'unfilled') { block.hidden = true; observer.disconnect(); }
      });
      observer.observe(ad, { attributes: true, attributeFilter: ['data-ad-status'] });
      script.onload = () => {
        try { (window.adsbygoogle = window.adsbygoogle || []).push({}); }
        catch { block.hidden = true; observer.disconnect(); }
      };
      script.onerror = () => { block.hidden = true; observer.disconnect(); };
    }
    document.head.append(script);
  } catch { /* Ad blockers and network failures must not break navigation. */ }
}
