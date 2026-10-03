import { questions } from './questions.mjs';
import { origins } from './origins.mjs';
import { validCoordinates } from './location.mjs';

export { origins };

export function resolveOrigin(value) {
  if (typeof value === 'string') return origins.find(origin => origin.id === value) || null;
  if (value?.type === 'selected_region') return origins.find(origin => origin.id === value.id) || null;
  if (value?.type === 'current_location' && validCoordinates(value.lat, value.lng))
    return { id: 'current', type: 'current_location', label: '현재 위치', lat: value.lat, lng: value.lng,
      accuracy: Number.isFinite(value.accuracy) && value.accuracy >= 0 ? value.accuracy : undefined };
  return null;
}

export function initialFlow() { return { step: 'intro', originId: null, origin: null, index: 0, answers: {} }; }

export function transitionFlow(state, event) {
  if (event.type === 'home') return initialFlow();
  if (event.type === 'start' && state.step === 'intro') return { ...state, step: 'origin' };
  if (event.type === 'origin' && state.step === 'origin') {
    const origin = resolveOrigin(event.origin || event.id);
    if (origin) return { step: 'question', originId: origin.id, origin, index: 0, answers: {} };
    return state;
  }
  if (event.type === 'back') {
    if (state.step === 'review') return { ...state, step: 'question', index: questions.length - 1 };
    if (state.step === 'question') return { ...state, step: state.index === 0 ? 'origin' : 'question', index: Math.max(0, state.index - 1) };
    if (state.step === 'origin') return initialFlow();
  }
  const question = questions[state.index];
  if (event.type !== 'answer' || state.step !== 'question' || question.id !== event.questionId ||
    !question.options.some(option => option.key === event.key)) return state;
  const changed = state.answers[question.id] !== event.key;
  const answers = { ...state.answers, [question.id]: event.key };
  if (changed) for (const later of questions.slice(state.index + 1)) delete answers[later.id];
  return { ...state, answers, index: Math.min(state.index + 1, questions.length - 1),
    step: state.index === questions.length - 1 ? 'review' : 'question' };
}

export function estimateTravel(origin, place) {
  if (!validCoordinates(origin?.lat, origin?.lng) || !validCoordinates(place.lat, place.lng) ||
    place.lat < 37 || place.lat > 38.4 || place.lng < 126 || place.lng > 128) return null;
  // The current catalog is mainland-only. Do not claim a driving route from overseas or Jeju.
  if (origin.lat < 34 || origin.lat > 38.9 || origin.lng < 124 || origin.lng > 132) return null;
  const radians = value => value * Math.PI / 180;
  const a = Math.sin(radians(place.lat - origin.lat) / 2) ** 2 +
    Math.cos(radians(origin.lat)) * Math.cos(radians(place.lat)) * Math.sin(radians(place.lng - origin.lng) / 2) ** 2;
  const straightKm = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  // Same estimate as the miniapp server: straight distance x 1.35, driving at 45 km/h.
  return { roundTripMinutes: Math.ceil(straightKm * 1.35 / 45 * 120),
    anchor: origin.type === 'current_location' ? '내 현재 위치' : `${origin.label} 대표 위치`,
    originType: origin.type, accuracy: origin.accuracy };
}

export function recommendFromAnswers(catalog, originValue, answers) {
  const origin = resolveOrigin(originValue);
  const selected = questions.map(question => question.options.find(option => option.key === answers?.[question.id]));
  if (!origin || selected.some(option => !option)) return [];
  const [movement, party, intent, weather, photo, energy] = selected;
  const wantsNature = intent.tags.includes('nature');
  const indoor = weather.tags.includes('indoor_required');
  const family = party.constraints.preferFlatWalk === true;
  const rest = energy.tags.includes('rest');
  const naturePhoto = photo.tags.includes('nature_photo');
  const maxRoundTrip = movement.constraints.maxRoundTripMinutes;
  return catalog.map(place => ({ ...place, travel: estimateTravel(origin, place) }))
    .filter(place => (!maxRoundTrip || (place.travel && place.travel.roundTripMinutes <= maxRoundTrip)) &&
      (!indoor || place.environments.includes('indoor')) && (wantsNature || place.interests.includes('culture')))
    .map(place => {
      const natural = place.interests.some(interest => ['nature', 'water'].includes(interest));
      const intentMatch = wantsNature ? natural : place.interests.includes('culture');
      const photoMatch = naturePhoto ? natural : place.interests.includes('culture');
      let score = intentMatch ? 6 : 0;
      score += photoMatch ? 1.5 : 0;
      score += family && place.walking <= 2 ? 2 : 0;
      score += rest ? (place.walking <= 2 ? 1 : 0) : Math.min(place.walking, 3) / 2;
      if (place.travel) score += maxRoundTrip ? 1 - place.travel.roundTripMinutes / 120 : Math.min(place.travel.roundTripMinutes / 120, 1);
      const reasons = [intentMatch ? `${intent.label} 선택과 장소의 ${natural && wantsNature ? '자연·물가' : '문화'} 특징을 함께 봤어요.` :
        '원하는 풍경보다 이동 범위와 실내 조건을 먼저 반영했어요.'];
      if (indoor) reasons.push('실내에서 관람할 수 있는 후보로 골랐어요.');
      if (family) reasons.push('동행을 배려해 걷는 구간을 줄이기 쉬운 후보에 가중치를 줬어요.');
      reasons.push(rest ? '한 장소에 머물며 쉬는 일정으로 제안해요.' : '관람이나 산책으로 시간을 보내는 일정으로 제안해요.');
      const cautions = [place.note];
      if (!intentMatch) cautions.push('자연 풍경 취향이 덜 맞는 후보예요. 다른 조건으로 다시 골라도 좋아요.');
      if (family && place.walking === 3) cautions.push('걷는 양이나 경사가 부담될 수 있어요. 동행자의 보행 여건을 먼저 확인하세요.');
      return { ...place, score, reasons, cautions, persona: wantsNature && natural ? '초록과 풍경을 만나는 주말' : '새로운 공간을 만나는 주말' };
    }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, 3);
}
