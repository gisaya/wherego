export const BRAND = '주말어디';
export const REGIONS = [{ id: 'seoul', label: '서울' }, { id: 'gyeonggi', label: '경기' }, { id: 'incheon', label: '인천' }];
export const INTERESTS = { nature: '초록과 자연', culture: '전시와 역사', water: '물가 풍경', any: '상관없어요' };

const trafficSources = new Set(['direct', 'search', 'share', 'guide', 'referral']);
const searchHosts = new Set(['google.com', 'www.google.com', 'google.co.kr', 'www.google.co.kr',
  'search.naver.com', 'm.search.naver.com', 'bing.com', 'www.bing.com', 'search.daum.net', 'm.search.daum.net']);

export function trafficAttribution({ url, referrer = '', previousSource } = {}) {
  const current = new URL(url);
  let referring;
  try { referring = referrer ? new URL(referrer) : null; } catch { referring = null; }
  const internal = referring?.origin === current.origin;
  const hint = current.searchParams.get('from');
  let source;
  if (hint === 'share') source = 'share';
  else if (internal && trafficSources.has(previousSource)) source = previousSource;
  else if (hint === 'guide') source = 'guide';
  else if (internal || !referrer) source = 'direct';
  else source = referring && searchHosts.has(referring.hostname) ? 'search' : 'referral';
  return { source, sharedEntry: hint === 'share' && !internal };
}

export function recommend(catalog, preferences) {
  const { region, environment, interest, walking } = preferences;
  if (!REGIONS.some(r => r.id === region) || !['any', 'indoor', 'outdoor'].includes(environment) ||
      !Object.hasOwn(INTERESTS, interest) || !['light', 'active'].includes(walking)) return [];
  return catalog.filter(p => p.region === region && (environment === 'any' || p.environments.includes(environment)))
    .map(place => {
      const reasons = [REGIONS.find(r => r.id === region).label + ' 안에서 골랐어요.'];
      let score = 0;
      if (environment !== 'any') reasons.push(environment === 'indoor' ? '실내 관람을 중심으로 둘 수 있어요.' : '야외에서 시간을 보낼 수 있어요.');
      if (interest !== 'any' && place.interests.includes(interest)) {
        score += 5; reasons.push(INTERESTS[interest] + ' 취향을 반영했어요.');
      }
      const walkingMatch = walking === 'light' ? place.walking <= 2 : place.walking >= 2;
      score += walkingMatch ? 2 : 0;
      if (walkingMatch) reasons.push(walking === 'light' ? '한 구역만 골라 짧게 둘러보는 일정으로 제안해요.' : '여유 있게 걸으며 둘러보는 일정으로 제안해요.');
      const tradeoff = walking === 'light' && place.walking === 3 ? '걷는 양이 많을 수 있어요. 구간을 줄여 방문하세요.' :
        interest !== 'any' && !place.interests.includes(interest) ? '원하는 분위기보다 지역과 실내·야외 조건을 우선한 후보예요.' : '';
      return { ...place, reasons, tradeoff, score };
    })
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, 3);
}
export function mapUrl(place) { return 'https://map.naver.com/p/search/' + encodeURIComponent(place.name + ' ' + place.area); }
export function shareUrl(place, origin) { return new URL('/places/' + encodeURIComponent(place.id) + '/?from=share', origin).href; }
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
