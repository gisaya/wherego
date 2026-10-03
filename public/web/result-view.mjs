import { escapeHtml as esc, mapUrl } from './core.mjs';

export const icon = name => `<img class="icon" src="/web/icons/${name}.svg" alt="" aria-hidden="true">`;

export function resultMarkup(place) {
  const reasons = place.reasons?.length ? `<section class="result-reasons"><h2>이렇게 골랐어요</h2><ul>${place.reasons.map(reason => `<li>${esc(reason)}</li>`).join('')}</ul></section>` : '';
  const accuracy = place.travel?.approximateLocation ? '기기 위치 오차가 커요. ' :
    place.travel?.originType === 'current_location' && place.travel.accuracy > 100 ? `기기 위치 오차 약 ${Math.ceil(place.travel.accuracy)}m. ` : '';
  const travel = place.travel ? `<p class="travel-note">${esc(place.travel.anchor)} 기준 자동차 왕복 약 ${place.travel.roundTripMinutes}분<span>${accuracy}직선거리로 계산한 추정치예요. 실제 동선은 지도에서 확인하세요.</span></p>` : '';
  return `<article class="result-card" data-result-place="${esc(place.id)}">
    <img class="place-photo" src="${esc(place.image)}" alt="${esc(place.name)}" referrerpolicy="no-referrer">
    <p class="photo-credit">사진 출처 · <a href="${esc(place.url)}" target="_blank" rel="noopener noreferrer">${esc(place.attribution)}</a></p>
    <div class="result-body"><p class="eyebrow">${esc(place.persona || place.kind)}</p><h1 id="place-title" tabindex="-1">${esc(place.name)}</h1>
      <p class="result-description">${esc(place.text)}</p>${reasons}
      <section class="location-summary"><h2>위치</h2><p>${esc(place.area)}</p>${travel}</section>
      <button class="primary result-share" id="share">${icon('share-2')}친구에게 여기 어때?</button>
      <p class="share-disclosure">장소 이름과 위치만 공유해요.</p>
      <div class="result-actions"><button class="secondary" id="save" aria-label="이 여행지 찜하기" aria-pressed="false">${icon('heart')}찜하기</button>
        <a class="secondary" id="map" href="${esc(mapUrl(place))}" target="_blank" rel="noopener noreferrer">${icon('map-pin')}지도 열기</a></div>
      <p class="inline-message" id="result-message" role="status"></p>
      <details class="visit-notice"><summary>방문 전 확인</summary>${(place.cautions || [place.note]).map(note => `<p>${esc(note)}</p>`).join('')}
        <a class="source" href="${esc(place.url)}" target="_blank" rel="noopener noreferrer">공식 관광 안내 ${icon('external-link')}</a>
        <p class="fine">정보 확인: ${esc(place.reviewedAt)}</p></details>
    </div></article>`;
}
