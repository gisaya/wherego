const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const source = path.join(root, 'public');
const output = path.join(root, '.vercel', 'output');
const staticOutput = path.join(output, 'static');

function copyDirectory(from, to) {
  fs.mkdirSync(to, { recursive: true });

  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const sourcePath = path.join(from, entry.name);
    const targetPath = path.join(to, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(sourcePath, targetPath);
      continue;
    }

    fs.copyFileSync(sourcePath, targetPath);
  }
}

fs.rmSync(output, { recursive: true, force: true });
copyDirectory(source, staticOutput);

fs.writeFileSync(
  path.join(output, 'config.json'),
  JSON.stringify(
    {
      version: 3,
      routes: [
        { src: '^/terms/service/?$', dest: '/terms/service/index.html' },
        { src: '^/terms/privacy/?$', dest: '/terms/privacy/index.html' },
        { src: '^/$', dest: '/index.html' },
      ],
    },
    null,
    2,
  ),
);

console.log('Built static terms pages for Vercel.');
