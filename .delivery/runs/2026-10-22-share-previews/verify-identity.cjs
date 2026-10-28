const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

(async () => {
  const [origin, checkout, evidence] = process.argv.slice(2);
  if (!['https://staging.docketstamp.com', 'https://docketstamp.com'].includes(origin)) throw Error('Unexpected target');
  const files = [
    ['app/icon.png', '/icon.png', 'image/png'],
    ['app/apple-icon.png', '/apple-icon.png', 'image/png'],
    ['app/favicon.ico', '/favicon.ico', 'image/'],
    ...['icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'apple-touch-icon-precomposed.png', 'favicon-32x32.png', 'og-image.png'].map(name => [`public/${name}`, `/${name}`, 'image/png']),
    ['public/og-image.jpg', '/og-image.jpg', 'image/jpeg'],
    ['public/share/v1/square.png', '/share/v1/square.png', 'image/png'],
    ['public/share/v1/manifest.json', '/share/v1/manifest.json', 'application/json'],
    ['public/site.webmanifest', '/site.webmanifest', 'application/'],
  ];
  const checks = [];
  for (const [file, route, mime] of files) {
    const response = await fetch(origin + route, { headers: { 'user-agent': 'DocketStampShareQA/1.0' }, signal: AbortSignal.timeout(20000) });
    const bytes = Buffer.from(await response.arrayBuffer());
    const hash = value => createHash('sha256').update(value).digest('hex');
    const expected = hash(fs.readFileSync(path.join(checkout, file)));
    const actual = hash(bytes);
    const contentType = response.headers.get('content-type') || '';
    checks.push({ route, status: response.status, contentType, sha256: actual, expectedSha256: expected, pass: response.status === 200 && contentType.startsWith(mime) && actual === expected });
  }
  const result = { checkedAt: new Date().toISOString(), origin, checks, failures: checks.filter(c => !c.pass).length };
  fs.writeFileSync(evidence, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ origin, checks: checks.length, failures: result.failures, failedChecks: checks.filter(c => !c.pass) }, null, 2));
  process.exitCode = result.failures ? 1 : 0;
})().catch(error => { console.error(error.message); process.exitCode = 1; });
