import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { catalog } from '../public/web/catalog.mjs';
import { guides } from '../public/web/guides.mjs';
import { escapeHtml as esc, mapUrl } from '../public/web/core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, '.vercel', 'output');
if (!output.startsWith(root + path.sep)) throw new Error('Output must be inside the project');
fs.rmSync(output, { recursive: true, force: true });
const staticRoot = path.join(output, 'static');
fs.cpSync(path.join(root, 'public'), staticRoot, { recursive: true });
const origin = 'https://wherego-lake.vercel.app';
const header = `<header class="site-header"><a class="brand" href="/">주말어디<span class="brand-dot" aria-hidden="true"></span></a><nav aria-label="주 메뉴"><a href="/#guides">상황별 나들이</a><button class="text-button" id="saved-button">저장한 곳</button></nav></header>`;
const footer = `<footer><a href="/privacy/">웹 개인정보 안내</a><a href="/terms/service/">토스 미니앱 약관</a><a href="mailto:gisaya@naver.com">문의</a><span>주말어디</span></footer>`;
const dialog = `<dialog id="saved-dialog" aria-labelledby="saved-title"><div class="dialog-heading"><h2 id="saved-title">저장한 곳</h2><button class="icon-button" id="close-saved" aria-label="닫기" title="닫기">×</button></div><p class="muted">이 브라우저에만 저장돼요.</p><div id="saved-list"></div></dialog>`;
const guideLinks = guides.map((g, i) => `<a class="guide-link" href="/ideas/${g.slug}/"><span class="index">${String(i + 1).padStart(2, '0')}</span><span><small>${esc(g.label)}</small><b>${esc(g.title)}</b></span><span class="arrow" aria-hidden="true">↗</span></a>`).join('');
const template = fs.readFileSync(path.join(root, 'web', 'index.html'), 'utf8');
fs.writeFileSync(path.join(staticRoot, 'index.html'), template.replace('<!-- GUIDE_LINKS -->', guideLinks).replace('<!-- FOOTER -->', footer).replace('<!-- SAVED_DIALOG -->', dialog));
function writePage(route, { title, description, content, place, image }) {
  const dir = path.join(staticRoot, route);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} | 주말어디</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${origin}/${route}/"><meta property="og:title" content="${esc(title)} | 주말어디"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${origin}/${route}/"><meta property="og:image" content="${esc(image || origin + '/assets/logo.png')}"><link rel="icon" href="/assets/logo.png"><link rel="stylesheet" href="/web/style.css"><script type="module" src="/web/app.mjs"></script></head><body${place ? ` data-place="${place}"` : ''}>${header}<main><article class="guide-article">${content}</article></main>${footer}${dialog}</body></html>`);
}
for (const p of catalog) {
  writePage(`places/${p.id}`, { title: p.name, description: p.text, place: p.id, image: p.image,
    content: `<div class="place-toolbar"><a href="/?region=${p.region}">← 다른 장소 고르기</a><span class="muted">${esc(p.kind)}</span></div><p class="eyebrow">이번 주말의 나들이 후보</p><h1>${esc(p.name)}</h1><p>${esc(p.area)}</p><img class="place-photo" src="${esc(p.image)}" alt="${esc(p.name)}" referrerpolicy="no-referrer"><p class="photo-credit">사진·정보 출처: <a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">${esc(p.attribution)}</a></p><p class="intro">${esc(p.text)}</p><section class="notice"><h2>방문 전 확인</h2><p>${esc(p.note)}</p></section><a class="source" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">관광 안내에서 운영 정보 확인 ↗</a><div class="actions"><a id="map" class="primary" href="${esc(mapUrl(p))}" target="_blank" rel="noopener noreferrer">지도에서 확인하기 <span aria-hidden="true">↗</span></a><button class="secondary" id="save">이 장소 저장</button><button class="secondary" id="share">친구에게 보내기</button></div><p class="fine">장소 페이지를 공유해요. 개인 선택이나 위치는 포함되지 않아요.</p><p class="inline-message" id="result-message" role="status"></p><p class="fine">정보 확인: ${p.reviewedAt} · 방문 가능 여부는 시설의 최신 공지를 확인하세요.</p>` });
}
for (const g of guides) {
  writePage(`ideas/${g.slug}`, { title: g.title, description: g.intro,
    content: `<p class="eyebrow">${esc(g.label)}</p><h1>${esc(g.title)}</h1><p class="intro">${esc(g.intro)}</p>${g.picks.map(id => { const p = catalog.find(p => p.id === id); return `<section class="guide-pick"><p class="place-meta">${esc(p.area)} · ${esc(p.kind)}</p><h2><a href="/places/${id}/">${esc(p.name)}</a></h2><p>${esc(p.text)}</p><p class="muted">${esc(p.note)}</p><a class="source" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">공식 관광 안내 ↗</a></section>`; }).join('')}<h2>이렇게 정해 보세요</h2><ol>${g.tips.map(t => `<li>${esc(t)}</li>`).join('')}</ol><section class="notice"><h2>이럴 때는 다시 생각해요</h2><p>${esc(g.avoid)}</p></section><a class="primary" href="/?region=${g.region}&from=guide">다른 조건으로 후보 비교하기 <span aria-hidden="true">→</span></a><p class="fine">2026-09-29 확인 · 동선 제안은 편집 의견이며 운영·예약 정보는 출발 전 확인하세요.</p><a href="/#guides">상황별 나들이 모두 보기</a>` });
}
writePage('privacy', { title: '웹 개인정보 안내', description: '주말어디 공개 웹의 저장 및 이용 기록 안내', content: `<h1>웹 개인정보 안내</h1><p>적용일: 2026-09-29</p><h2>조건별 추천</h2><p>공개 웹의 기본 추천은 브라우저 안에서 계산합니다. 추천 조건을 AI 서비스로 전송하지 않으며, 로그인이나 현재 위치 권한을 요청하지 않습니다.</p><h2>저장한 곳</h2><p>저장한 장소의 공개 ID는 이 브라우저의 로컬 저장소에 보관합니다. 저장한 곳에서 개별 삭제하거나 브라우저 사이트 데이터를 지우면 삭제됩니다. 공유 링크에는 공개 장소의 주소만 포함되며 개인 선택 조건은 포함되지 않습니다.</p><h2>이용 기록</h2><p>서비스 개선을 위해 방문, 추천 시작·완료, 장소 조회, 지도 열기, 저장, 공유 이벤트와 유입 유형(검색·공유·직접 등)을 호스팅 로그에 기록합니다. 앱이 전송하는 이벤트에는 이름, 사용자 식별자, IP 주소, 정확한 위치, 선택한 답변, 원본 유입 URL을 넣지 않습니다. 브라우저의 Do Not Track 설정을 켜면 이 이벤트를 보내지 않습니다. 호스팅 제공자의 접속·보안 로그는 별도로 생성될 수 있으며 보관 기간은 제공자 설정에 따릅니다.</p><h2>외부 서비스</h2><p>웹 호스팅은 Vercel을 사용합니다. 장소 사진은 서울관광재단·한국관광공사의 서버에서 불러오며 해당 서버에 일반적인 접속 정보가 전달될 수 있습니다. 지도·공식 안내 링크를 열면 해당 서비스의 정책이 적용됩니다. 공개 웹에는 현재 광고·결제·AI 추천을 연결하지 않았습니다.</p><h2>토스 미니앱</h2><p>토스 미니앱의 로그인, 결제 및 AI 추천 처리는 <a href="/terms/privacy/">미니앱 개인정보 처리방침</a>을 확인하세요.</p><h2>문의</h2><p>개인정보 보호책임자: 권민아<br>문의: <a href="mailto:gisaya@naver.com">gisaya@naver.com</a></p>` });
const routes = ['', 'privacy/', ...catalog.map(p => `places/${p.id}/`), ...guides.map(g => `ideas/${g.slug}/`)];
fs.writeFileSync(path.join(staticRoot, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${routes.map(route => `<url><loc>${origin}/${route}</loc></url>`).join('')}</urlset>`);
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
