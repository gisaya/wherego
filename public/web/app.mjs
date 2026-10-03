import { catalog } from './catalog.mjs';
import { shareUrl, trafficAttribution, escapeHtml as esc } from './core.mjs';
import { questions } from './questions.mjs';
import { origins, resolveOrigin, initialFlow, transitionFlow, recommendFromAnswers } from './flow.mjs';
import { requestCurrentOrigin } from './location.mjs';
import { resultMarkup, icon } from './result-view.mjs';
import { readRecommendation, saveRecommendation, markRecommendationCounted, resultLifetimeMs } from './recommendation.mjs';
import { setupAds } from './adsense.mjs';

let previousSource;
if (navigator.doNotTrack !== '1') {
  try { previousSource = sessionStorage.getItem('weekend-source-v1'); } catch {}
}
const { source, sharedEntry } = trafficAttribution({ url: location.href, referrer: document.referrer, previousSource });
if (navigator.doNotTrack !== '1') {
  try { sessionStorage.setItem('weekend-source-v1', source); } catch {}
}
function track(event) {
  if (navigator.doNotTrack === '1') return;
  void fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,
    body: JSON.stringify({ event, source }) }).catch(() => {});
}
track(sharedEntry ? 'share_visit' : 'visit');

function storedIds() {
  try {
    const value = JSON.parse(localStorage.getItem('weekend-saved-v1') || '[]');
    return Array.isArray(value) ? [...new Set(value.filter(id => catalog.some(place => place.id === id)))].slice(0, 20) : [];
  } catch { return []; }
}
function bindPlaceActions(place) {
  const messageElement = document.querySelector('#result-message');
  const message = text => { messageElement.textContent = text; };
  const save = document.querySelector('#save');
  const refresh = () => {
    const saved = storedIds().includes(place.id);
    save.setAttribute('aria-pressed', String(saved));
    save.setAttribute('aria-label', saved ? '이 여행지 찜 해제' : '이 여행지 찜하기');
    save.innerHTML = icon('heart') + (saved ? '찜했어요' : '찜하기');
  };
  refresh();
  document.querySelector('#map').onclick = () => track('map');
  save.onclick = () => {
    try {
      const ids = storedIds();
      const saved = ids.includes(place.id);
      localStorage.setItem('weekend-saved-v1', JSON.stringify(saved ? ids.filter(id => id !== place.id) : [place.id, ...ids].slice(0, 20)));
      refresh();
      message(saved ? '찜을 해제했어요.' : '이 브라우저에 찜했어요.');
      if (!saved) track('save');
    } catch { message('저장 공간을 사용할 수 없어요. 공유 링크를 이용해 주세요.'); }
  };
  document.querySelector('#share').onclick = async () => {
    const url = shareUrl(place, location.origin);
    try {
      if (navigator.share) await navigator.share({ title: place.name + ' | 주말어디', text: '이번 주말 여기 어때요?', url });
      else { await navigator.clipboard.writeText(url); message('장소 링크를 복사했어요.'); }
      track('share');
    } catch (error) {
      if (error.name === 'AbortError') return;
      message('링크를 길게 눌러 복사해 주세요.');
      const input = document.createElement('input');
      input.className = 'share-input'; input.readOnly = true; input.value = url;
      input.setAttribute('aria-label', '공유 링크');
      messageElement.append(input); input.select();
    }
  };
}

const experience = document.querySelector('#experience');
if (experience) {
  const intro = experience.innerHTML;
  const preset = new URLSearchParams(location.search).get('region');
  const back = document.querySelector('#flow-back');
  const counter = document.querySelector('#step-counter');
  let state = initialFlow();
  let depth = 0;
  let advanceTimer;
  let currentLocation = null;
  let locationController;
  let locationStatus = '';
  const cancelLocation = () => { locationController?.abort(); locationController = undefined; };
  const cancelAdvance = () => { clearTimeout(advanceTimer); advanceTimer = undefined; };
  const descriptor = () => ({ step: state.step, index: state.index, originId: state.originId, depth });
  const url = () => location.pathname + location.search + (state.step === 'intro' ? '' :
    state.step === 'question' ? '#question-' + (state.index + 1) : '#' + state.step);
  // Only navigation position enters history. Answers and exact coordinates stay in memory.
  history.replaceState({ weekendFlow: descriptor() }, '', url());
  function push(next) {
    cancelAdvance(); cancelLocation();
    if (next === state) return;
    state = next; depth++;
    history.pushState({ weekendFlow: descriptor() }, '', url());
    render();
  }
  function home() {
    cancelAdvance(); cancelLocation(); currentLocation = null; locationStatus = '';
    const previousDepth = depth;
    state = initialFlow();
    if (previousDepth > 0) history.go(-previousDepth);
    else { depth = 0; history.replaceState({ weekendFlow: descriptor() }, '', url()); }
    render();
  }
  back.onclick = () => {
    const regionDialog = document.querySelector('#region-dialog');
    if (regionDialog?.open) { regionDialog.close(); return; }
    cancelAdvance(); cancelLocation();
    if (depth > 0) history.back();
    else {
      state = transitionFlow(state, { type: 'back' });
      history.replaceState({ weekendFlow: descriptor() }, '', url()); render();
    }
  };
  document.querySelector('.brand').addEventListener('click', event => {
    if (state.step !== 'intro') { event.preventDefault(); home(); }
  });
  addEventListener('popstate', event => {
    cancelAdvance(); cancelLocation();
    const position = event.state?.weekendFlow;
    if (!position || position.step === 'intro') { state = initialFlow(); depth = 0; currentLocation = null; }
    else {
      const origin = position.originId === 'current' ? currentLocation : resolveOrigin(position.originId);
      const answers = position.originId === state.originId ? state.answers : {};
      const missing = questions.findIndex(question => !answers[question.id]);
      const index = missing < 0 ? position.index : Math.min(position.index, missing);
      state = { ...state, ...position, origin, answers, index,
        step: ['question', 'review'].includes(position.step) && !origin ? 'origin' :
          position.step === 'review' && missing >= 0 ? 'question' : position.step };
      depth = position.depth;
    }
    render();
    if (location.hash === '#guides') document.querySelector('#guides').scrollIntoView();
  });
  addEventListener('pagehide', cancelLocation);
  addEventListener('pageshow', event => {
    if (!event.persisted) return;
    cancelAdvance(); cancelLocation();
    state = initialFlow(); depth = 0; currentLocation = null; locationStatus = '';
    history.replaceState({ weekendFlow: descriptor() }, '', url()); render();
  });
  async function useCurrentLocation() {
    if (locationController) return;
    const controller = new AbortController();
    locationController = controller;
    locationStatus = '현재 위치를 확인하고 있어요. 권한 요청이 보이면 허용해 주세요.';
    render();
    try {
      const origin = await requestCurrentOrigin({ signal: controller.signal });
      if (locationController !== controller || state.step !== 'origin') return;
      currentLocation = origin;
      locationController = undefined; locationStatus = '';
      push(transitionFlow(state, { type: 'origin', origin }));
    } catch (error) {
      if (locationController !== controller || error.name === 'AbortError') return;
      locationController = undefined; locationStatus = error.message;
      render();
      experience.querySelector('#location-status').focus({ preventScroll: true });
    }
  }
  function changeOrigin() {
    cancelAdvance(); cancelLocation(); currentLocation = null; locationStatus = '';
    const previousDepth = depth;
    state = { ...initialFlow(), step: 'origin' }; depth = 1;
    if (previousDepth > 1) history.go(1 - previousDepth);
    else history.replaceState({ weekendFlow: descriptor() }, '', url());
    render();
  }
  function render() {
    document.body.dataset.flow = state.step;
    back.hidden = state.step === 'intro';
    counter.hidden = state.step !== 'question';
    counter.textContent = (state.index + 1) + ' / ' + questions.length;
    if (state.step === 'intro') {
      experience.innerHTML = intro;
      experience.querySelector('#start').onclick = () => {
        track('start'); push(transitionFlow(state, { type: 'start' }));
      };
    } else if (state.step === 'origin') {
      const waiting = !!locationController;
      experience.innerHTML = `<div class="origin-screen"><p class="intro-pill">위치 기반 추천</p><h1 tabindex="-1">어디에서 출발하세요?</h1>
        <p class="screen-lead">현재 위치는 출발 기준과 근교 후보 계산에만 사용하고 저장하지 않아요. 위치 권한 없이도 지역을 골라 시작할 수 있어요.</p>
        <div class="origin-actions"><button class="primary" id="use-current-location" ${waiting ? 'disabled aria-busy="true"' : ''}>${icon('locate-fixed')}${waiting ? '위치 확인 중' : '현재 위치로 추천'}</button>
          <button class="secondary" id="choose-region">${icon('map-pin')}지역 직접 선택</button></div>
        <p class="origin-status" id="location-status" role="status" tabindex="-1">${esc(locationStatus || '현재 위치 권한은 버튼을 누른 뒤에만 요청돼요.')}</p>
        <p class="catalog-scope">지금은 서울·경기·인천의 등록된 여행지를 추천해요.</p>
        <dialog id="region-dialog" aria-labelledby="region-title"><div class="dialog-heading"><h2 id="region-title">출발 지역 선택</h2><button class="icon-button" id="close-region" aria-label="지역 선택 닫기" title="닫기">${icon('x')}</button></div>
          <p class="muted">전국 권역 중 하나를 고르면 질문이 시작돼요.</p><div class="region-grid">${origins.map(origin => `<button class="region-option ${preset === origin.id ? 'suggested' : ''}" data-origin="${origin.id}"><strong>${esc(origin.label)}</strong><span>${esc(origin.description)}</span></button>`).join('')}</div>
          <p class="region-note">직접 선택은 권역의 대표 위치로 거리를 추정해요.<br>내 위치 기준으로 보려면 현재 위치를 사용해 주세요.</p></dialog></div>`;
      experience.querySelector('#use-current-location').onclick = useCurrentLocation;
      experience.querySelector('#choose-region').onclick = () => {
        cancelLocation(); locationStatus = ''; render();
        experience.querySelector('#region-dialog').showModal();
      };
      experience.querySelector('#close-region').onclick = () => experience.querySelector('#region-dialog').close();
      experience.querySelectorAll('[data-origin]').forEach(button => button.onclick = () => {
        currentLocation = null; locationStatus = '';
        experience.querySelector('#region-dialog').close();
        push(transitionFlow(state, { type: 'origin', id: button.dataset.origin }));
      });
    } else if (state.step === 'question') {
      const question = questions[state.index];
      const origin = state.origin;
      experience.innerHTML = `<div class="question-screen"><div class="progress" role="progressbar" aria-label="선택 진행" aria-valuemin="0" aria-valuemax="${questions.length}" aria-valuenow="${state.index}"><span style="width:${state.index / questions.length * 100}%"></span></div>
        <p class="origin-chip">${icon('map-pin')}${esc(origin.label)} 출발</p><p class="eyebrow">${esc(question.eyebrow)}</p><h1 tabindex="-1">${esc(question.question)}</h1>
        <div class="option-grid">${question.options.map((option, i) => `<button class="option-card tone-${i}" data-question="${question.id}" data-answer="${option.key}" aria-pressed="${state.answers[question.id] === option.key}"><span class="option-number" aria-hidden="true">${i + 1}</span><strong>${esc(option.label)}</strong>${icon('arrow-right')}</button>`).join('')}</div></div>`;
      experience.querySelectorAll('[data-answer]').forEach(button => button.onclick = () => {
        if (advanceTimer !== undefined) return;
        experience.querySelectorAll('[data-answer]').forEach(other => { other.disabled = true; other.setAttribute('aria-pressed', String(other === button)); });
        const answer = { type: 'answer', questionId: button.dataset.question, key: button.dataset.answer };
        advanceTimer = setTimeout(() => {
          const next = transitionFlow(state, answer);
          if (next.step === 'review' && next !== state) track('result_review');
          push(next);
        }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 160);
      });
    } else {
      const matches = recommendFromAnswers(catalog, state.origin, state.answers);
      const place = matches[0];
      if (!place) {
        experience.innerHTML = '<div class="empty-screen"><h1 tabindex="-1">조건에 맞는 등록 여행지가 없어요.</h1><p>웹에는 아직 서울·경기·인천의 13곳이 등록되어 있어요. 출발지와 이동 범위에 맞는 곳이 없으면 먼 장소로 대신 추천하지 않아요.</p><button class="primary" id="change-origin">출발지 다시 선택</button><button class="secondary home-button" id="adjust">선택 다시 보기</button><button class="secondary home-button" id="restart">처음으로</button></div>';
        experience.querySelector('#change-origin').onclick = changeOrigin;
        experience.querySelector('#adjust').onclick = () => back.click();
      } else {
        const labels = ['이동 범위', '동행', '장소 취향', '날씨', '사진 취향', '휴식과 활동'];
        experience.innerHTML = `<div class="review-screen"><p class="eyebrow">6가지 선택 완료</p><h1 tabindex="-1">이 조건으로 한 곳을 골라요.</h1>
          <p class="screen-lead">${esc(state.origin.label)} 출발</p><dl class="selection-summary">${questions.map((question, index) => {
            const option = question.options.find(option => option.key === state.answers[question.id]);
            return `<div><dt>${labels[index]}</dt><dd>${esc(option.label)}</dd><button class="icon-button" data-edit="${index}" aria-label="${labels[index]} 선택 수정" title="선택 수정">${icon('pencil')}</button></div>`;
          }).join('')}</dl><button class="primary" id="reveal-result">${icon('arrow-right')}내 조건으로 결과 확인</button>
          <p class="fine review-notice">한 번의 선택에는 한 곳을 추천해요.</p><p class="inline-message" id="review-message" role="status"></p>
          <button class="secondary home-button" id="restart">${icon('rotate-ccw')}처음부터 다시 선택</button></div>`;
        experience.querySelectorAll('[data-edit]').forEach(button => button.onclick = () =>
          push({ ...state, step: 'question', index: Number(button.dataset.edit) }));
        experience.querySelector('#reveal-result').onclick = event => {
          if (event.currentTarget.disabled) return;
          let saved = false;
          try { saved = saveRecommendation(sessionStorage, place); } catch {}
          if (!saved) {
            experience.querySelector('#review-message').textContent = '결과를 전달할 임시 저장소를 사용할 수 없어요. 브라우저의 사이트 저장 허용 후 다시 눌러 주세요. 선택은 그대로 있어요.';
            return;
          }
          event.currentTarget.disabled = true;
          track('result_request');
          location.assign('/recommendation/');
        };
      }
      experience.querySelector('#restart').onclick = home;
    }
    experience.querySelector('h1[tabindex]')?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  render();
}

const place = catalog.find(place => place.id === document.body.dataset.place);
if (place) { bindPlaceActions(place); track('place_view'); }
if (place) void setupAds('place');
if (document.body.dataset.adPage === 'guide') void setupAds('guide');

const recommendation = document.querySelector('#recommendation');
if (recommendation) {
  let result;
  try { result = readRecommendation(sessionStorage); } catch {}
  if (result) {
    recommendation.innerHTML = resultMarkup(result) + `<section class="display-ad" data-display-ad hidden aria-label="광고"><p>광고</p></section>
      <div class="result-next"><a class="secondary" id="restart" href="/">${icon('rotate-ccw')}새 조건으로 다시 선택</a></div>`;
    bindPlaceActions(result);
    if (!result.counted) { track('result'); try { markRecommendationCounted(sessionStorage); } catch {} }
    track('place_view');
    document.body.dataset.adPage = 'recommendation';
    void setupAds('recommendation');
    setTimeout(() => { try { readRecommendation(sessionStorage); } catch {} },
      Math.max(0, result.createdAt + resultLifetimeMs - Date.now()));
  }
  const back = document.querySelector('#flow-back');
  back.hidden = false;
  back.onclick = () => location.assign('/');
}

document.querySelector('#saved-button')?.addEventListener('click', () => {
  const list = document.querySelector('#saved-list');
  const refresh = () => {
    const ids = storedIds();
    list.innerHTML = ids.length ? ids.map(id => {
      const place = catalog.find(place => place.id === id);
      return `<div class="saved-row"><a href="/places/${place.id}/">${esc(place.name)}<small>${esc(place.area)}</small></a><button class="icon-button" aria-label="${esc(place.name)} 삭제" title="삭제" data-remove="${place.id}">${icon('x')}</button></div>`;
    }).join('') : '<p class="empty">아직 찜한 곳이 없어요.</p>';
    list.querySelectorAll('[data-remove]').forEach(button => button.onclick = () => {
      try {
        localStorage.setItem('weekend-saved-v1', JSON.stringify(ids.filter(id => id !== button.dataset.remove)));
        refresh();
        const save = document.querySelector('#save');
        if (save && document.querySelector('[data-result-place]')?.dataset.resultPlace === button.dataset.remove) {
          save.setAttribute('aria-pressed', 'false');
          save.setAttribute('aria-label', '이 여행지 찜하기'); save.innerHTML = icon('heart') + '찜하기';
        }
      } catch { list.textContent = '저장 공간을 사용할 수 없어요.'; }
    });
  };
  refresh(); document.querySelector('#saved-dialog').showModal();
});
document.querySelector('#close-saved')?.addEventListener('click', () => document.querySelector('#saved-dialog').close());
