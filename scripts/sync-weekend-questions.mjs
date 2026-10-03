import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const bankDir = process.argv[2];
if (!bankDir) throw new Error('Pass the latest JBG wherego resource directory');
const read = name => {
  const raw = fs.readFileSync(path.join(bankDir, name), 'utf8');
  return { data: JSON.parse(raw), digest: createHash('sha256').update(raw).digest('hex') };
};
const source = read('source-question-blueprint.json');
const general = read('general-question-bank.json');
const selection = [
  ['source', 'movement_scope', 'move_time_binary_01'],
  ['source', 'party_constraints', 'party_companion_binary_01'],
  ['source', 'destination_intent', 'intent_nature_city_binary_01'],
  ['general', 'weather', 'gen_weather_01'],
  ['general', 'photo', 'gen_photo_02'],
  ['general', 'healing_energy', 'gen_healing_energy_01'],
];
const questions = selection.map(([type, theme, id]) => {
  const group = type === 'source' ? source.data.requiredAxes.find(axis => axis.axis === theme) :
    general.data.tagGroups.find(group => group.tagGroup === theme);
  const question = (group?.variants || group?.questions || []).find(question => question.id === id);
  if (!question || question.options.length < 2) throw new Error(`Missing question ${id}`);
  return { id, type, theme, eyebrow: group.label, question: question.question,
    options: question.options.map(option => ({ key: option.key, label: option.label,
      tags: option.tags || [], constraints: option.constraints || {} })) };
});
const version = { source: source.data.version, general: general.data.version,
  sourceDigest: source.digest, generalDigest: general.digest };
const output = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/web/questions.mjs');
fs.writeFileSync(output, `// Generated from the JBG question banks; regenerate with scripts/sync-weekend-questions.mjs.\nexport const questionBankVersion = ${JSON.stringify(version, null, 2)};\nexport const questions = ${JSON.stringify(questions, null, 2)};\n`);
console.log(`Synced ${questions.length} questions: 3 source + 3 general. No network or AI calls.`);
