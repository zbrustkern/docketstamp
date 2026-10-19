// Run individually audited tests in fresh processes, without workspace secrets,
// with a disposable cwd and network transport denied before any app import.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const files = process.argv.slice(2);
if (!files.length) throw new Error('Supply audited test paths explicitly');
let failed = false;
for (const file of files) {
  const target = path.resolve(root, file);
  if (!target.startsWith(root + path.sep) || !fs.existsSync(target) || !/\.test\.tsx?$/.test(target)) {
    throw new Error('Expected repository test file');
  }
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'docket-console-test-'));
  const env = {
    PATH: process.env.PATH,
    TMPDIR: cwd,
    NODE_ENV: 'test',
    USE_MOCK_FIRESTORE: 'true',
    ALLOW_LOCAL_MOCK_PAYMENTS: 'true',
    LOB_ENV: 'staging_mock_cass',
    FIREBASE_PROJECT_ID: 'docketstamp-offline-fixture',
    NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
    TSX_TSCONFIG_PATH: path.join(root, 'tsconfig.json'),
    DOCKETSTAMP_TEST_ROOT: root,
  };
  const result = spawnSync(process.execPath, [
    '--require', path.join(root, 'tests/admin-console/offline-preload.cjs'),
    '--import', path.join(root, 'node_modules/tsx/dist/loader.mjs'), target,
  ], { cwd, env, encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024 });
  console.log(`\n=== ${file}: ${result.status === 0 ? 'PASS' : 'FAIL'} ===`);
  process.stdout.write(result.stdout || '');
  process.stderr.write(result.stderr || '');
  if (result.error) console.error(result.error.message);
  failed ||= result.status !== 0;
  // This directory was created by this process and contains only test artifacts.
  fs.rmSync(cwd, { recursive: true, force: true });
}
process.exitCode = failed ? 1 : 0;
