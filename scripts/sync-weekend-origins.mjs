import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const raw = fs.readFileSync(path.join(root, 'src', 'WheregoApp.tsx'), 'utf8');
const source = ts.createSourceFile('WheregoApp.tsx', raw, ts.ScriptTarget.Latest);
const ids = ['seoul', 'gyeonggi', 'gyeonggi-north', 'incheon', 'chungcheong', 'gangwon', 'jeonbuk', 'jeonnam', 'gyeongbuk', 'gyeongnam', 'jeju'];
function literal(node) {
  if (ts.isStringLiteral(node) || ts.isNumericLiteral(node)) return ts.isNumericLiteral(node) ? Number(node.text) : node.text;
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(literal);
  if (ts.isObjectLiteralExpression(node)) return Object.fromEntries(node.properties.map(property => {
    if (!ts.isPropertyAssignment(property)) throw new Error('Expected literal region metadata');
    return [property.name.getText(source), literal(property.initializer)];
  }));
  throw new Error('Region metadata must remain literal data');
}
let regions;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'regionOptions') regions = literal(node.initializer);
  ts.forEachChild(node, visit);
}
visit(source);
if (regions?.length !== ids.length) throw new Error('Review region IDs when the miniapp region count changes');
const origins = regions.map((region, index) => ({ id: ids[index], ...region }));
const digest = createHash('sha256').update(JSON.stringify(regions)).digest('hex');
fs.writeFileSync(path.join(root, 'public', 'web', 'origins.mjs'),
  `// Generated from the miniapp's regionOptions; regenerate with scripts/sync-weekend-origins.mjs.\nexport const originMetadataDigest = '${digest}';\nexport const origins = ${JSON.stringify(origins, null, 2)};\n`);
console.log(`Synced ${origins.length} miniapp departure regions. No network or location access.`);
