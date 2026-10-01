import { catalog } from './catalog.mjs';
import { recommend, shareUrl, escapeHtml as esc } from './core.mjs';
const source = new URLSearchParams(location.search).get('from') === 'share' ? 'share' : new URLSearchParams(location.search).get('from') === 'guide' ? 'guide' : /google|naver|bing|daum/i.test(document.referrer) ? 'search' : document.referrer ? 'referral' : 'direct';
function track(event) {
  if (navigator.doNotTrack === '1') return;
  void fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,
    body: JSON.stringify({ event, source }) }).catch(() => {});
}
track(source === 'share' ? 'share_visit' : 'visit');
function storedIds() {
  try { const value = JSON.parse(localStorage.getItem('weekend-saved-v1') || '[]'); return Array.isArray(value) ? [...new Set(value.filter(id => catalog.some(p => p.id === id)))].slice(0, 20) : []; }
  catch { return []; }
}
const form = document.querySelector('#recommend-form');
if (form) {
  const initialRegion = new URLSearchParams(location.search).get('region');
  if (['seoul', 'gyeonggi', 'incheon'].includes(initialRegion)) form.querySelector(`input[value="${initialRegion}"]`).checked = true;
  let started = false;
  form.addEventListener('change', () => { if (!started) { track('start'); started = true; } });
  form.onsubmit = event => {
    event.preventDefault(); if (!started) { track('start'); started = true; }
    const matches = recommend(catalog, Object.fromEntries(new FormData(form)));
    const results = document.querySelector('#results');
    results.hidden = false;
    results.innerHTML = `<div class="section-heading"><div><p class="eyebrow">조건에 맞춰 골랐어요</p><h2 tabindex="-1">${matches.length ? `이번 주말 후보 ${matches.length}곳` : '아직 등록된 후보가 없어요'}</h2></div><button class="text-button" id="adjust">조건 바꾸기 ↑</button></div><div class="result-grid">${matches.map(p => `<article class="place-card"><a href="/places/${p.id}/" tabindex="-1" aria-hidden="true"><img src="${esc(p.image)}" alt="" loading="lazy" referrerpolicy="no-referrer"></a><div class="place-body"><p class="place-meta">${esc(p.area)} · ${esc(p.kind)}</p><h3><a href="/places/${p.id}/">${esc(p.name)}</a></h3><p>${esc(p.text)}</p><ul>${p.reasons.map(reason => `<li>${esc(reason)}</li>`).join('')}</ul>${p.tradeoff ? `<p class="tradeoff">${esc(p.tradeoff)}</p>` : ''}<a class="secondary" href="/places/${p.id}/">장소 자세히 보기</a></div></article>`).join('')}</div>`;
    results.querySelector('#adjust').onclick = () => { form.scrollIntoView({ behavior: 'smooth', block: 'start' }); form.querySelector('input:checked').focus({ preventScroll: true }); };
    results.querySelector('h2').focus({ preventScroll: true }); results.scrollIntoView({ behavior: 'smooth', block: 'start' }); track('result');
  };
}
const placeId = document.body.dataset.place;
const place = catalog.find(p => p.id === placeId);
const message = text => { document.querySelector('#result-message').textContent = text; };
if (place) {
  track('place_view');
  document.querySelector('#map').onclick = () => track('map');
  document.querySelector('#save').onclick = () => {
    try { localStorage.setItem('weekend-saved-v1', JSON.stringify([place.id, ...storedIds().filter(id => id !== place.id)].slice(0, 20))); message('이 브라우저에 저장했어요. 상단의 저장한 곳에서 다시 볼 수 있어요.'); track('save'); }
    catch { message('저장 공간을 사용할 수 없어요. 공유 링크를 이용해 주세요.'); }
  };
  document.querySelector('#share').onclick = async () => {
    const url = shareUrl(place, location.origin);
    try {
      if (navigator.share) await navigator.share({ title: `${place.name} | 주말어디`, text: '이번 주말 여기 어때요?', url });
      else { await navigator.clipboard.writeText(url); message('장소 링크를 복사했어요.'); }
      track('share');
    } catch (error) {
      if (error.name === 'AbortError') return;
      message('링크를 길게 눌러 복사해 주세요.');
      const input = document.createElement('input'); input.className = 'share-input'; input.readOnly = true; input.value = url; input.setAttribute('aria-label', '공유 링크');
      document.querySelector('#result-message').append(input); input.select();
    }
  };
}
document.querySelector('#saved-button')?.addEventListener('click', () => {
  const list = document.querySelector('#saved-list');
  const refresh = () => {
    const ids = storedIds();
    list.innerHTML = ids.length ? ids.map(id => { const p = catalog.find(p => p.id === id); return `<div class="saved-row"><a href="/places/${p.id}/">${esc(p.name)}<small>${esc(p.area)}</small></a><button class="icon-button" aria-label="${esc(p.name)} 삭제" title="삭제" data-remove="${p.id}">×</button></div>`; }).join('') : '<p class="empty">아직 저장한 곳이 없어요.</p>';
    list.querySelectorAll('[data-remove]').forEach(button => button.onclick = () => { try { localStorage.setItem('weekend-saved-v1', JSON.stringify(ids.filter(id => id !== button.dataset.remove))); refresh(); } catch { list.textContent = '저장 공간을 사용할 수 없어요.'; } });
  };
  refresh(); document.querySelector('#saved-dialog').showModal();
});
document.querySelector('#close-saved')?.addEventListener('click', () => document.querySelector('#saved-dialog').close());
