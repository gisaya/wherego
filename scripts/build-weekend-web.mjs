import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { catalog } from '../public/web/catalog.mjs';
import { guides } from '../public/web/guides.mjs';
import { escapeHtml as esc } from '../public/web/core.mjs';
import { resultMarkup, icon } from '../public/web/result-view.mjs';
import { monetizationConfig, publisherId } from './weekend-monetization.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const adConfig = monetizationConfig();
const adMeta = `<meta name="google-adsense-account" content="${publisherId}">`;
const displayAd = '<section class="display-ad" data-display-ad hidden aria-label="광고"><p>광고</p></section>';
const output = path.join(root, '.vercel', 'output');
if (!output.startsWith(root + path.sep)) throw new Error('Output must be inside the project');
if (fs.existsSync(output) && fs.lstatSync(output).isSymbolicLink()) throw new Error('Output must not be a link');
fs.rmSync(output, { recursive: true, force: true });
const staticRoot = path.join(output, 'static');
fs.cpSync(path.join(root, 'public'), staticRoot, { recursive: true });
fs.writeFileSync(path.join(staticRoot, 'web', 'monetization.json'), JSON.stringify(adConfig));
fs.writeFileSync(path.join(staticRoot, 'ads.txt'), `google.com, ${publisherId.replace('ca-', '')}, DIRECT, f08c47fec0942fa0\n`);

const iconRoot = path.dirname(createRequire(import.meta.url).resolve('lucide-static/package.json'));
fs.mkdirSync(path.join(staticRoot, 'web', 'icons'), { recursive: true });
for (const name of ['arrow-left', 'arrow-right', 'heart', 'map-pin', 'share-2', 'external-link', 'x', 'rotate-ccw', 'locate-fixed', 'pencil'])
  fs.copyFileSync(path.join(iconRoot, 'icons', name + '.svg'), path.join(staticRoot, 'web', 'icons', name + '.svg'));
fs.copyFileSync(path.join(iconRoot, 'LICENSE'), path.join(staticRoot, 'web', 'icons', 'LICENSE'));

// Reuse the miniapp's exact JPEG bytes; AST parsing avoids evaluating its source module.
const photoSource = ts.createSourceFile('introPhotoData.ts',
  fs.readFileSync(path.join(root, 'src', 'assets', 'introPhotoData.ts'), 'utf8'), ts.ScriptTarget.Latest);
const photoNames = { INTRO_COAST_SOURCE: 'coast', INTRO_FOREST_SOURCE: 'forest', INTRO_CULTURE_SOURCE: 'culture' };
const copiedPhotos = new Set();
function copyPhoto(node) {
  if (ts.isVariableDeclaration(node) && Object.hasOwn(photoNames, node.name.getText(photoSource))) {
    const value = ts.isAsExpression(node.initializer) ? node.initializer.expression : node.initializer;
    const uri = value.properties?.find(property => property.name?.getText(photoSource) === 'uri')?.initializer?.text;
    if (!uri?.startsWith('data:image/jpeg;base64,')) throw new Error('Expected an embedded intro JPEG');
    const name = photoNames[node.name.getText(photoSource)];
    fs.writeFileSync(path.join(staticRoot, 'web', 'intro-' + name + '.jpg'), Buffer.from(uri.split(',')[1], 'base64'));
    copiedPhotos.add(name);
  }
  ts.forEachChild(node, copyPhoto);
}
copyPhoto(photoSource);
if (copiedPhotos.size !== 3) throw new Error('All three miniapp intro photos are required');

const origin = 'https://wherego-lake.vercel.app';
const header = `<header class="site-header"><button class="icon-button" id="flow-back" aria-label="이전 단계" title="이전 단계" hidden>${icon('arrow-left')}</button><a class="brand" href="/"><img src="/assets/logo.png" width="30" height="30" alt="">주말어디</a><nav aria-label="주 메뉴"><span class="step-counter" id="step-counter" hidden></span><a class="guide-nav" href="/#guides">나들이 글</a><button class="icon-button" id="saved-button" aria-label="찜한 여행지" title="찜한 여행지">${icon('heart')}</button></nav></header>`;
const footer = `<footer><a href="/privacy/">웹 개인정보 안내</a><a href="/terms/service/">토스 미니앱 약관</a><a href="mailto:gisaya@naver.com">문의</a><button id="ad-privacy" class="text-button" hidden>광고 개인정보 설정</button><span>주말어디</span></footer>`;
const dialog = `<dialog id="saved-dialog" aria-labelledby="saved-title"><div class="dialog-heading"><h2 id="saved-title">찜한 여행지</h2><button class="icon-button" id="close-saved" aria-label="닫기" title="닫기">${icon('x')}</button></div><p class="muted">이 브라우저에만 저장돼요.</p><div id="saved-list"></div></dialog>`;
const guideLinks = guides.map((g, i) => `<a class="guide-link" href="/ideas/${g.slug}/"><span class="index">${String(i + 1).padStart(2, '0')}</span><span><small>${esc(g.label)}</small><b>${esc(g.title)}</b></span>${icon('arrow-right')}</a>`).join('');
const template = fs.readFileSync(path.join(root, 'web', 'index.html'), 'utf8');
fs.writeFileSync(path.join(staticRoot, 'index.html'), template.replace('<!-- ADSENSE_META -->', adMeta).replace('<!-- HEADER -->', header).replace('<!-- GUIDE_LINKS -->', guideLinks).replace('<!-- FOOTER -->', footer).replace('<!-- SAVED_DIALOG -->', dialog));
function writePage(route, { title, description, content: pageContent, place, image, adPage, noindex = false, layout = 'guide-article' }) {
  const content = pageContent + (adPage === 'guide' ? displayAd : '');
  const dir = path.join(staticRoot, route);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} | 주말어디</title><meta name="description" content="${esc(description)}">${adMeta}${noindex ? '<meta name="robots" content="noindex,follow">' : ''}<link rel="canonical" href="${origin}/${route}/"><meta property="og:title" content="${esc(title)} | 주말어디"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${origin}/${route}/"><meta property="og:image" content="${esc(image || origin + '/assets/logo.png')}"><link rel="icon" href="/assets/logo.png"><link rel="stylesheet" href="/web/style.css"><script type="module" src="/web/app.mjs"></script></head><body${place ? ` data-place="${place}"` : ''}${adPage ? ` data-ad-page="${adPage}"` : ''}>${header}<main><div class="${layout}">${content}</div></main>${footer}${dialog}</body></html>`);
}
for (const p of catalog) {
  writePage(`places/${p.id}`, { title: p.name, description: p.text, place: p.id, image: p.image, layout: 'result-page',
    content: `${resultMarkup(p)}${displayAd}<a class="secondary home-button" href="/?region=${p.region}">${icon('rotate-ccw')}나도 추천받기</a>` });
}
for (const g of guides) {
  writePage(`ideas/${g.slug}`, { title: g.title, description: g.intro, adPage: 'guide',
    content: `<p class="eyebrow">${esc(g.label)}</p><h1>${esc(g.title)}</h1><p class="intro">${esc(g.intro)}</p>${g.picks.map(id => { const p = catalog.find(p => p.id === id); return `<section class="guide-pick"><p class="place-meta">${esc(p.area)} · ${esc(p.kind)}</p><h2><a href="/places/${id}/">${esc(p.name)}</a></h2><p>${esc(p.text)}</p><p class="muted">${esc(p.note)}</p><a class="source" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">공식 관광 안내 ↗</a></section>`; }).join('')}<h2>이렇게 정해 보세요</h2><ol>${g.tips.map(t => `<li>${esc(t)}</li>`).join('')}</ol><section class="notice"><h2>이럴 때는 다시 생각해요</h2><p>${esc(g.avoid)}</p></section><a class="primary" href="/?region=${g.region}&from=guide">다른 조건으로 추천받기 <span aria-hidden="true">→</span></a><p class="fine">2026-09-29 확인 · 동선 제안은 편집 의견이며 운영·예약 정보는 출발 전 확인하세요.</p><a href="/#guides">상황별 나들이 모두 보기</a>` });
}
writePage('recommendation', { title: '내 선택에 맞는 한 곳', description: '6가지 선택에 맞춰 고른 주말 여행지',
  layout: 'result-page', noindex: true,
  content: '<div id="recommendation"><div class="empty-screen"><h1>선택을 마친 뒤 확인할 수 있어요.</h1><p>결과는 선택 후 30분 동안 같은 탭에서 확인할 수 있어요.</p><a class="primary" href="/">6가지 선택 시작하기</a></div></div>' });
writePage('privacy', { title: '웹 개인정보 안내', description: '주말어디 공개 웹의 저장 및 이용 기록 안내', content: `
  <h1>웹 개인정보 안내</h1><p>적용일: 2026-10-03</p>
  <h2>조건별 추천</h2><p>6문항의 원래 답변과 현재 위치 좌표는 추천을 고르는 동안 브라우저 메모리에서만 사용합니다. 현재 위치 버튼을 누른 경우에만 위치 권한을 요청하며, 위치 권한 없이 지역을 직접 선택할 수도 있습니다. 지역을 직접 선택할 때만 대표 좌표로 거리를 추정합니다. 정확한 좌표와 원래 답변은 URL, 방문 기록, 로컬·세션 저장소, 로그, 서버나 AI 서비스에 넣지 않습니다. 웹 추천에는 AI 호출과 로그인이 없습니다.</p>
  <h2>임시 결과</h2><p>별도 결과 페이지로 전달하기 위해 선택한 장소의 공개 ID, 추천 근거·주의사항, 출발 기준의 명칭과 추정 왕복 시간만 같은 탭의 세션 저장소에 보관합니다. 정확한 좌표나 원래 답변은 포함하지 않습니다. 마지막 결과 한 건만 보관하며, 30분이 지나면 다시 열 수 없고 만료 확인 시 삭제합니다. 결과 페이지를 열어 둔 경우 30분 만료 시 임시 저장값을 지웁니다. 새 추천으로 덮어쓰거나 탭 세션이 끝나면 삭제됩니다. 새로고침은 유효한 임시 결과만 복구하며 위치 권한이나 답변을 복구하지 않습니다. 이동 시간은 직선거리 기반 추정치이며 실제 경로와 교통상황은 반영하지 않습니다.</p>
  <h2>저장한 곳과 공유</h2><p>찜한 장소의 공개 ID는 로컬 저장소에 보관합니다. 개별 삭제하거나 브라우저 사이트 데이터를 지우면 삭제됩니다. 공유 링크에는 공개 장소 주소만 포함되며 개인 선택 조건·현재 위치·추정 이동 시간은 포함하지 않습니다.</p>
  <h2>이용 기록</h2><p>방문, 추천 시작, 선택 확인, 결과 요청·준비, 장소 조회, 지도 열기, 저장, 공유 이벤트와 유입 유형(검색·공유·직접 등)을 호스팅 로그에 기록합니다. 앱 이벤트에는 이름, 사용자 식별자, IP 주소, 정확한 위치, 원래 답변, 원본 유입 URL을 넣지 않습니다. 유입 유형 하나만 탭의 세션 저장소에 보관합니다. Do Not Track을 켜면 자체 이벤트와 유입 유형 저장을 생략합니다. 이는 Google 광고의 개인정보 설정과는 별개입니다. 호스팅 제공자의 접속·보안 로그는 별도로 생성될 수 있으며 보관 기간은 제공자 설정에 따릅니다.</p>
  <h2>Google 광고</h2><p>AdSense 사이트 승인과 광고 설정이 완료되면 결과·장소·나들이 글 페이지에서 Google AdSense와 공식 Offerwall을 사용할 수 있습니다. 반복 조회 시 광고를 통해 콘텐츠 접근 권한을 얻는 안내가 표시될 수 있으며, 표시 조건과 접근 권한은 Google이 관리합니다. 일반 광고 클릭을 추천 조건으로 요구하지 않습니다. 승인 준비 상태와 로컬 미리보기에서는 광고 요청을 하지 않습니다.</p>
  <p>광고 게재 시 Google 및 협력사는 쿠키·기기 정보·IP 주소와 사이트 방문 정보를 광고 게재, 빈도 관리, 측정, 부정 이용 방지 등에 사용할 수 있습니다. 필요한 동의와 개인정보 선택은 Google의 개인정보 보호 및 메시지 설정을 따릅니다. 해당 메시지가 지원되는 경우 하단의 광고 개인정보 설정에서 다시 선택할 수 있습니다. 자세한 내용은 <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener noreferrer">Google 파트너 사이트 정보 이용 안내</a>와 <a href="https://myadcenter.google.com/" target="_blank" rel="noopener noreferrer">Google 광고 설정</a>을 확인하세요. 앱이 정확한 현재 위치나 원래 답변을 Google에 전달하지는 않습니다.</p>
  <h2>외부 서비스</h2><p>웹 호스팅은 Vercel입니다. 장소 사진은 서울관광재단·한국관광공사 서버에서 불러오며 일반적인 접속 정보가 전달될 수 있습니다. 지도·공식 안내 링크에는 각 서비스 정책이 적용됩니다. 웹에는 결제를 연결하지 않습니다.</p>
  <h2>토스 미니앱</h2><p>미니앱의 AI 추천·기존 결제 등은 <a href="/terms/privacy/">미니앱 개인정보 처리방침</a>을 확인하세요.</p>
  <h2>문의</h2><p>개인정보 보호책임자: 권민아<br>문의: <a href="mailto:gisaya@naver.com">gisaya@naver.com</a></p>` });
const publicRoutes = ['', 'privacy/', ...catalog.map(p => `places/${p.id}/`), ...guides.map(g => `ideas/${g.slug}/`)];
const routes = [...publicRoutes, 'recommendation/'];
fs.writeFileSync(path.join(staticRoot, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${publicRoutes.map(route => `<url><loc>${origin}/${route}</loc></url>`).join('')}</urlset>`);
fs.writeFileSync(path.join(staticRoot, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /mockups/\nDisallow: /api/\nSitemap: ${origin}/sitemap.xml\n`);
const fn = path.join(output, 'functions', 'api', 'events.func');
fs.mkdirSync(fn, { recursive: true });
fs.copyFileSync(path.join(root, 'web-server', 'events.cjs'), path.join(fn, 'index.js'));
fs.writeFileSync(path.join(fn, '.vc-config.json'), JSON.stringify({ runtime: 'nodejs22.x', handler: 'index.js', launcherType: 'Nodejs' }));
fs.writeFileSync(path.join(output, 'config.json'), JSON.stringify({ version: 3, routes: [
  { src: '^/api/events$', dest: '/api/events' },
  { src: '^/terms/(service|privacy)/?$', dest: '/terms/$1/index.html' },
  ...routes.map(route => ({ src: route ? `^/${route.replace(/\/$/, '')}/?$` : '^/$', dest: `/${route}index.html` })),
  { handle: 'filesystem' },
  { src: '/.*', status: 404, dest: '/404.html' },
] }, null, 2));
fs.writeFileSync(path.join(staticRoot, '404.html'), '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>페이지를 찾지 못했어요 | 주말어디</title><link rel="stylesheet" href="/web/style.css"><main class="guide-article"><h1>페이지를 찾지 못했어요</h1><a href="/">주말어디로 돌아가기</a></main></html>');
console.log(`Built ${catalog.length} places, ${guides.length} guides, and browser-side recommendations. No AI routes.`);
