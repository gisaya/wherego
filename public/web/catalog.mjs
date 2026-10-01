import { places } from './guides.mjs';
const kto = id => `https://english.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=${id}`;
const photo = name => `https://tong.visitkorea.or.kr/cms/resource/${name}`;
const seoulPhoto = (sn, n = 1) => `https://english.visitseoul.net/comm/getImage?srvcId=MEDIA&parentSn=${sn}&fileTy=MEDIA&fileNo=${n}`;
const metadata = {
  forest: { region: 'seoul', environments: ['outdoor'], interests: ['nature'], walking: 2, image: seoulPhoto(72834) },
  botanic: { region: 'seoul', environments: ['indoor', 'outdoor'], interests: ['nature'], walking: 2, image: seoulPhoto(68414, 2) },
  craft: { region: 'seoul', environments: ['indoor'], interests: ['culture'], walking: 1, image: seoulPhoto(73866) },
  tank: { region: 'seoul', environments: ['outdoor'], interests: ['culture'], walking: 2, image: 'https://english.visitseoul.net/comm/getImage?srvcId=POST&parentSn=24422&fileTy=POSTTHUMB&fileNo=1' },
  fortress: { region: 'gyeonggi', environments: ['outdoor'], interests: ['culture'], walking: 3, image: 'https://tong.visitkorea.or.kr/cms/resource_photo/97/3478597_image2_1.jpg' },
  songdo: { region: 'incheon', environments: ['outdoor'], interests: ['water'], walking: 2, image: photo('15/3025915_image2_1.JPG') },
};
const additional = [
  { id: 'science', name: '국립과천과학관', area: '경기 과천시 상하벌로 110', kind: '실내 중심', region: 'gyeonggi', environments: ['indoor'], interests: ['culture'], walking: 2, text: '과학 전시와 체험을 중심으로 보내는 나들이예요.', note: '실내 상설전시를 기준으로 한 추천이에요. 체험·천체관 등은 예약과 운영 조건을 별도로 확인하세요.', url: kto(87936), image: photo('77/3492577_image2_1.jpg') },
  { id: 'gyeonggi-museum', name: '경기도박물관', area: '경기 용인시 기흥구 상갈로 6', kind: '실내', region: 'gyeonggi', environments: ['indoor'], interests: ['culture'], walking: 1, text: '경기도의 역사와 전통문화를 전시로 만나는 곳이에요.', note: '특별전·교육 프로그램은 일정과 예약 여부를 따로 확인하세요.', url: kto(77615), image: photo('77/3038977_image2_1.jpg') },
  { id: 'paik', name: '백남준아트센터', area: '경기 용인시 기흥구 백남준로 10', kind: '실내', region: 'gyeonggi', environments: ['indoor'], interests: ['culture'], walking: 1, text: '백남준과 미디어 아트를 중심으로 전시를 살펴보는 나들이예요.', note: '전시 교체 기간과 특별전 입장 조건은 방문 전에 확인하세요.', url: kto(93733), image: photo('19/3068419_image2_1.jpg') },
  { id: 'ilsan', name: '일산호수공원', area: '경기 고양시 일산동구 호수로 595', kind: '야외', region: 'gyeonggi', environments: ['outdoor'], interests: ['nature', 'water'], walking: 3, text: '호수 주변 산책로와 공원 풍경을 즐길 수 있어요.', note: '넓은 공원이니 걷는 구간을 미리 정하세요. 축제 기간에는 평소와 이용 동선이 다를 수 있어요.', url: kto(75425), image: photo('91/3513491_image2_1.jpg') },
  { id: 'writing', name: '국립세계문자박물관', area: '인천 연수구 센트럴로 217', kind: '실내', region: 'incheon', environments: ['indoor'], interests: ['culture'], walking: 1, text: '세계의 문자와 기록 문화를 전시로 만나는 곳이에요.', note: '특별전과 교육 프로그램의 운영·예약 조건은 공식 안내를 확인하세요.', url: kto(248238), image: photo('18/3097718_image2_1.jpg') },
  { id: 'biology', name: '국립생물자원관', area: '인천 서구', kind: '실내 중심', region: 'incheon', environments: ['indoor'], interests: ['nature', 'culture'], walking: 2, text: '우리나라의 생물과 생태계를 실내 전시로 살펴보는 나들이예요.', note: '전시·교육 시설의 이용 시간과 휴관일을 확인하세요. 야외 구역은 실내 추천에 포함하지 않아요.', url: kto(83671), image: photo('36/1578836_image2_1.jpg') },
  { id: 'incheon-park', name: '인천대공원', area: '인천 남동구 무네미로 236', kind: '야외', region: 'incheon', environments: ['outdoor'], interests: ['nature'], walking: 3, text: '넓은 공원에서 녹지와 산책로를 즐기고 싶을 때의 후보예요.', note: '공원과 내부 시설의 운영일은 달라요. 방문 구역을 정하고 보행량을 조절하세요.', url: kto(81246), image: photo('28/2943428_image2_1.bmp') },
];
export const catalog = [
  ...Object.entries(places).map(([id, p]) => ({ id, ...p, ...metadata[id] })),
  ...additional,
].map(p => ({ ...p, reviewedAt: '2026-09-29', attribution: p.url.includes('visitseoul') ? '서울관광재단 Visit Seoul' : '한국관광공사 VISITKOREA' }));
