const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const events = require('../web-server/events.cjs');
const root = path.resolve(__dirname, '../.vercel/output/static');
const types = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.xml': 'application/xml', '.txt': 'text/plain' };
const server = http.createServer(async (req, res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { res.writeHead(400).end(); return; }
  if (pathname === '/api/events') return events(req, res);
  let target = path.resolve(root, '.' + pathname);
  if (target !== root && !target.startsWith(root + path.sep)) return res.writeHead(403).end();
  if (fs.existsSync(target) && fs.statSync(target).isDirectory()) target = path.join(target, 'index.html');
  if (!fs.existsSync(target)) { target = path.join(root, '404.html'); res.statusCode = 404; }
  res.setHeader('Content-Type', types[path.extname(target)] || 'application/octet-stream');
  fs.createReadStream(target).pipe(res);
});
let port = Number(process.env.PORT || 4173);
server.on('error', error => { if (error.code === 'EADDRINUSE') server.listen(++port, '127.0.0.1'); else throw error; });
server.listen(port, '127.0.0.1', () => console.log(`Preview: http://127.0.0.1:${port}`));
