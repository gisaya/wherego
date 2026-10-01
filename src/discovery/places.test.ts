import { addSavedPlace, parseSharedPlace, placeKey, publicPlaceMap, readSavedPlaces, sharedPlacePath } from './places';

const sample = { place: '서울숲', address: '서울 성동구', region: '서울' };
describe('public place sharing and saved places', () => {
  it('only shares public place fields, never answers, origin or AI reasons', () => {
    const path = sharedPlacePath({ ...sample, lat: 37, user: 'private', reason: 'private', answers: ['private'], sessionId: 'private' });
    const raw = decodeURIComponent(path.split('?shared=')[1]!);
    expect(raw).not.toMatch(/private|lat|user|reason|answers|sessionId/);
    expect(parseSharedPlace({ shared: raw })).toEqual(sample);
    expect(parseSharedPlace({ shared: JSON.parse(raw) })).toEqual(sample);
    expect(path).toMatch(/^intoss:\/\/wherego\?shared=/);
  });
  it('rejects malformed links and unknown versions', () => {
    for (const shared of ['{', 'null', '{}', JSON.stringify({ ...sample, v: 2 }), 'x'.repeat(2001), ['bad']]) {
      expect(parseSharedPlace({ shared })).toBeNull();
    }
    expect(parseSharedPlace(undefined)).toBeNull();
  });
  it('normalizes controls and bounds public values', () => {
    const result = parseSharedPlace({ shared: JSON.stringify({ v: 1, place: '\n' + 'x'.repeat(200), address: 42 }) });
    expect(result?.place).toHaveLength(100);
    expect(result?.address).toBe('');
  });
  it('deduplicates bookmarks and retains at most twenty', () => {
    const places = Array.from({ length: 25 }, (_, i) => ({ ...sample, place: `place ${i}` }));
    expect(readSavedPlaces(JSON.stringify(places))).toHaveLength(20);
    expect(addSavedPlace([sample], sample)).toEqual([sample]);
    expect(addSavedPlace(places.slice(0, 20), sample)).toHaveLength(20);
    expect(placeKey(sample)).not.toEqual(placeKey({ ...sample, address: '다른 지역' }));
  });
  it('recovers corrupt storage and strips extra data', () => {
    for (const raw of [null, '{', '{}', 'null', 'x'.repeat(30001)]) expect(readSavedPlaces(raw)).toEqual([]);
    expect(readSavedPlaces(JSON.stringify([null, sample, sample, { ...sample, user: 'private' }]))).toEqual([sample]);
  });
  it('constructs its own map URL rather than accepting arbitrary shared URLs', () => {
    expect(publicPlaceMap(sample)).toBe('https://map.naver.com/p/search/' + encodeURIComponent('서울숲 서울 성동구'));
  });
});
