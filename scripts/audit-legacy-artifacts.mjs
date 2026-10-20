/** Recursive tracked-source audit. Report by default; --check fails on unclassified matches. */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const check = process.argv.includes('--check');
const allowlist = JSON.parse(fs.readFileSync(path.join(root, 'docs/legacy-compatibility.json'), 'utf8'));
const patterns = [
  ['brand', /send[\s_-]*my[\s_-]*notes|aster\s*(?:&|and|&amp;)\s*blanche/ig],
  ['provider', /handwrytten/ig],
  ['namespace', /\bsmn[_-][a-z_0-9]*/ig],
  ['firebase_identity', /910796604705|486379422282|G-5DV25FZ7Q8|G-YL7ZK51DTQ/g],
  ['card_workflow', /Handwritten Card|Send Card|greeting card|calculateDaysUntilNextOccasion|occasion_reminders|hwDavid/ig],
  ['unverified_analytics_destination', /GT-TNPN256B|AW-18474411963|ZzzVCMqAjoUdELvPpOlE|1773518093991339/g],
];
const tracked = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' }).split('\0');
const files = [...new Set(tracked)].filter(f => /^(app|components|context|lib|src|public)\//.test(f) || /^apphosting.*\.yaml$/.test(f) || f === '.env.example');
const findings = [];
const used = new Set();
for (const file of files.sort()) {
  if (!/\.(?:tsx?|jsx?|json|yaml|css|html|webmanifest|txt)$/.test(file) && file !== '.env.example') continue;
  let contents;
  try { contents = fs.readFileSync(path.join(root, file), 'utf8'); } catch { continue; }
  for (const [index, line] of contents.split('\n').entries()) {
    for (const [category, regex] of patterns) {
      regex.lastIndex = 0;
      for (const match of line.matchAll(regex)) {
        const exception = allowlist.exceptions.find(e => e.file === file && e.category === category && new RegExp(e.match, 'i').test(match[0]));
        if (exception) used.add(exception.id);
        findings.push({ file, line: index + 1, category, token: match[0], classification: exception ? 'intentional_compatibility' : 'needs_replacement', exception: exception?.id });
      }
    }
  }
}
const unresolved = findings.filter(f => f.classification === 'needs_replacement');
const report = { schemaVersion: 1, generatedAt: new Date().toISOString(), scannedFiles: files.length, unresolved: unresolved.length, findings, unusedExceptions: allowlist.exceptions.filter(e => !used.has(e.id)).map(e => e.id) };
if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 2));
else {
  console.log(`Legacy audit: ${files.length} tracked/new active files; ${unresolved.length} unclassified matches.`);
  for (const f of unresolved) console.log(`${f.file}:${f.line} [${f.category}] ${f.token}`);
  console.log(`Intentional compatibility: ${findings.length - unresolved.length} matches. Unused exceptions: ${report.unusedExceptions.join(', ') || 'none'}.`);
}
if (check && (unresolved.length || report.unusedExceptions.length)) process.exitCode = 1;
