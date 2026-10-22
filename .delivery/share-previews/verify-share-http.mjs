#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const base = args.find((arg) => !arg.startsWith('--'));
const evidenceFlag = args.indexOf('--evidence');
const evidencePath = evidenceFlag >= 0 ? args[evidenceFlag + 1] : null;
const privatePathsFlag = args.indexOf('--private-paths');
const privatePaths = privatePathsFlag >= 0 ? args[privatePathsFlag + 1].split(',').filter(Boolean) : ['/account', '/admin', '/docket/DS-QA-NONEXISTENT'];
const staging = args.includes('--staging');
if (!base || !/^https?:\/\//i.test(base)) {
  console.error('Usage: node --import tsx .delivery/share-previews/verify-share-http.mjs https://host [--staging] [--evidence file.json] [--private-paths /account,/admin,/docket/DS-QA-NONEXISTENT]');
  process.exit(2);
}

const origin = new URL(base).origin;
const failures = [];
const observations = [];
const htmlCache = new Map();
const imageCache = new Map();
const agents = {
  normal: 'DocketStampShareQA/1.0 (+read-only GET)',
  twitterbot: 'Twitterbot',
  facebookexternalhit: 'facebookexternalhit/1.1',
};
const sentinels = ['QA-SENTINEL-8F3A2', 'recipient.qa@example.invalid', '999 QA Example Street'];
const pass = (condition, label, details = undefined) => {
  observations.push({ result: condition ? 'pass' : 'fail', check: label, ...(details === undefined ? {} : { details }) });
  if (!condition) failures.push(label);
};

function decodeEntities(value = '') {
  return value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (_, entity) => {
    if (entity[0] === '#') {
      const hex = entity[1]?.toLowerCase() === 'x';
      const n = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : _;
    }
    return ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' })[entity.toLowerCase()] ?? _;
  });
}

// Parse attributes independently of order and quote style; tolerate boolean attrs and HTML entities.
function attributes(tag) {
  const result = {};
  const body = tag.replace(/^<\/?[\w:-]+/, '').replace(/\/?>\s*$/, '');
  const re = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  for (const match of body.matchAll(re)) result[match[1].toLowerCase()] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? '');
  return result;
}

function parseMetadata(html) {
  const metas = [];
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) metas.push(attributes(match[0]));
  const links = [];
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) links.push(attributes(match[0]));
  const title = decodeEntities((html.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i)?.[1] ?? '').replace(/<[^>]+>/g, '').trim());
  const first = (key, value) => metas.find((m) => (m[key] || '').toLowerCase() === value.toLowerCase())?.content || '';
  const og = {};
  const twitter = {};
  const ogImages = [];
  const twitterImages = [];
  for (const meta of metas) {
    const property = (meta.property || '').toLowerCase();
    const name = (meta.name || '').toLowerCase();
    if (property.startsWith('og:')) {
      const key = property.slice(3).replaceAll(':', '_');
      (og[key] ||= []).push(meta.content || '');
      if (key === 'image') ogImages.push(meta.content || '');
    }
    if (name.startsWith('twitter:')) {
      const key = name.slice(8).replaceAll(':', '_');
      (twitter[key] ||= []).push(meta.content || '');
      if (key === 'image') twitterImages.push(meta.content || '');
    }
  }
  const canonical = links.find((l) => (l.rel || '').toLowerCase().split(/\s+/).includes('canonical'))?.href || '';
  return { title, description: first('name', 'description'), robots: first('name', 'robots'), canonical, canonicalCount: links.filter((l) => (l.rel || '').toLowerCase().split(/\s+/).includes('canonical')).length, og: lastFields(og), twitter: lastFields(twitter), ogImages, twitterImages };
}

function lastFields(fields) { return Object.fromEntries(Object.entries(fields).map(([key, values]) => [key, (Array.isArray(values) ? values.at(-1) : values) || ''])); }

async function get(pathname, userAgent, cache = true) {
  const url = new URL(pathname, origin);
  const key = `${url.href}|${userAgent}`;
  if (cache && htmlCache.has(key)) return htmlCache.get(key);
  try {
    const response = await fetch(url, { headers: { 'user-agent': userAgent }, redirect: 'follow', signal: AbortSignal.timeout(20000) });
    const contentType = response.headers.get('content-type') || '';
    const body = await response.text();
    const entry = { status: response.status, contentType, html: body, url: response.url, headers: { cacheControl: response.headers.get('cache-control') || '', robots: response.headers.get('x-robots-tag') || '' } };
    if (cache) htmlCache.set(key, entry);
    return entry;
  } catch (error) {
    return { status: 0, contentType: '', html: '', error: String(error) };
  }
}

const manifestPaths = [path.join(root, 'public/share/v1/manifest.json'), path.join(root, 'public/share/v1/share-manifest.json')];
let manifest = null;
for (const p of manifestPaths) {
  try { manifest = JSON.parse(await readFile(p, 'utf8')); break; } catch {}
}
let registry;
try {
  const mod = await import(pathToFileURL(path.join(root, 'src/lib/docket/notices/index.ts')));
  registry = mod.ALL_NOTICE_CARTRIDGES;
} catch (error) {
  console.error('Could not load canonical notice registry. Run with --import tsx.');
  throw error;
}

function pathToFileURL(p) { return new URL(`file://${p}`); }
const slugs = registry.map((n) => ({ slug: n.slug, aliases: n.aliases || [] }));
const expectedPages = [
  { route: '/', image: '/share/v1/home.png', type: 'home' },
  { route: '/companies', image: '/share/v1/home.png', type: 'directory' },
  ...slugs.map(({ slug }) => ({ route: `/notices/${slug}`, image: `/share/v1/${slug}.png`, type: 'notice', slug })),
];

function expectedLocalImage(urlPath) {
  const rawEntries = Array.isArray(manifest) ? manifest : manifest?.assets || manifest?.images || [];
  const entries = Array.isArray(rawEntries) ? rawEntries : Object.entries(rawEntries).map(([key, value]) => ({ path: key, ...value }));
  const entry = entries.find((item) => [item.path, item.url, item.src, item.publicPath].includes(urlPath));
  const local = path.join(root, 'public', urlPath.replace(/^\//, ''));
  return { entry, local };
}

function pngInfo(buf) {
  if (buf.length < 24 || buf.toString('hex', 0, 8) !== '89504e470d0a1a0a') return null;
  return { mime: 'image/png', width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

async function checkImage(imageUrl, pageLabel) {
  let url;
  try { url = new URL(imageUrl, origin); } catch { pass(false, `${pageLabel}: image URL parses`); return; }
  if (imageCache.has(url.href)) return;
  let response;
  try { response = await fetch(url, { headers: { 'user-agent': agents.normal }, redirect: 'follow', signal: AbortSignal.timeout(20000) }); }
  catch (error) { pass(false, `${pageLabel}: image fetch`, String(error)); return; }
  const bytes = Buffer.from(await response.arrayBuffer());
  const mime = (response.headers.get('content-type') || '').split(';')[0].toLowerCase();
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const dimensions = pngInfo(bytes);
  const local = expectedLocalImage(url.pathname);
  let localHash = null;
  if (url.origin === origin) {
    try { localHash = createHash('sha256').update(await readFile(local.local)).digest('hex'); } catch {}
  }
  const manifestEntry = local.entry;
  const validations = {
    status: response.status,
    mime,
    bytes: bytes.length,
    sha256,
    dimensions,
    localHash,
    manifest: manifestEntry || null,
    url: url.href,
  };
  pass(response.ok, `${pageLabel}: image HTTP success`, response.status);
  pass(mime === 'image/png', `${pageLabel}: image MIME is image/png`, mime);
  pass(bytes.length > 0 && bytes.length < 1_000_000, `${pageLabel}: image size is 1..999999 bytes`, bytes.length);
  if (dimensions) pass(dimensions.width === 1200 && dimensions.height === 630 || dimensions.width === 1080 && dimensions.height === 1080, `${pageLabel}: image dimensions match approved wide/square art`, dimensions);
  else pass(false, `${pageLabel}: PNG dimensions readable`, mime);
  if (manifestEntry) {
    const expectedHash = manifestEntry.sha256 || manifestEntry.hash || manifestEntry.contentHash;
    if (expectedHash) pass(expectedHash.replace(/^sha256[:-]/, '') === sha256, `${pageLabel}: image hash matches manifest`, { expectedHash, actual: sha256 });
    const expectedSize = manifestEntry.bytes ?? manifestEntry.size;
    if (expectedSize !== undefined) pass(Number(expectedSize) === bytes.length, `${pageLabel}: image byte count matches manifest`, { expected: expectedSize, actual: bytes.length });
    const expectedMime = manifestEntry.mime || manifestEntry.mimeType;
    if (expectedMime) pass(expectedMime === mime, `${pageLabel}: image MIME matches manifest`, { expected: expectedMime, actual: mime });
    const expectedWidth = manifestEntry.width ?? manifestEntry.dimensions?.width;
    const expectedHeight = manifestEntry.height ?? manifestEntry.dimensions?.height;
    if (expectedWidth && expectedHeight && dimensions) pass(expectedWidth === dimensions.width && expectedHeight === dimensions.height, `${pageLabel}: image dimensions match manifest`, { expectedWidth, expectedHeight, actual: dimensions });
  }
  if (localHash) pass(localHash === sha256, `${pageLabel}: hosted bytes match local image`, { local: localHash, hosted: sha256 });
  else if (url.origin === origin) observations.push({ result: 'info', check: `${pageLabel}: no local image source found for byte comparison`, details: url.pathname });
  imageCache.set(url.href, validations);
}

async function checkPage(page) {
  for (const [agentName, userAgent] of Object.entries(agents)) {
    const result = await get(page.route, userAgent);
    const label = `${page.route} [${agentName}]`;
    pass(result.status === 200, `${label}: HTTP 200`, result.status || result.error);
    pass(/text\/html/i.test(result.contentType), `${label}: HTML content type`, result.contentType);
    if (!result.html) continue;
    const meta = parseMetadata(result.html);
    const parsed = meta;
    const expectedCanonical = page.route === '/' ? origin : new URL(page.route, origin).href;
    pass(Boolean(meta.title), `${label}: title exists`, meta.title);
    pass(Boolean(meta.description), `${label}: description exists`, meta.description);
    pass(meta.canonical === expectedCanonical, `${label}: canonical is clean and canonical`, { expected: expectedCanonical, actual: meta.canonical });
    pass(meta.canonicalCount === 1, `${label}: exactly one canonical link`, meta.canonicalCount);
    pass(Boolean(meta.og.title && meta.og.description && meta.og.url && meta.og.image && meta.og.image_alt), `${label}: complete Open Graph tags`, meta.og);
    pass(Boolean(meta.twitter.card && meta.twitter.title && meta.twitter.description && meta.twitter.image), `${label}: complete Twitter tags`, meta.twitter);
    pass(meta.og.url === expectedCanonical, `${label}: og:url matches canonical`, { expected: expectedCanonical, actual: meta.og.url });
    pass(meta.og.image === meta.twitter.image, `${label}: OG and Twitter images match`, { og: meta.og.image, twitter: meta.twitter.image });
    for (const [kind, value] of Object.entries({ title: meta.title, description: meta.description, canonical: meta.canonical, ...Object.fromEntries(Object.entries(meta.og).map(([k,v]) => [`og:${k}`,v])), ...Object.fromEntries(Object.entries(meta.twitter).map(([k,v]) => [`twitter:${k}`,v])) })) {
      pass(!sentinels.some((sentinel) => value.includes(sentinel)), `${label}: no query sentinel in ${kind}`, value.includes('QA-SENTINEL') ? value : undefined);
    }
    if (agentName === 'normal') {
      const image = meta.og.image;
      const expectedImagePath = page.image;
      let imagePath = '';
      try { imagePath = new URL(image, origin).pathname; } catch {}
      pass(imagePath === expectedImagePath, `${label}: expected image path`, { expected: expectedImagePath, actual: imagePath });
      pass(parsed.ogImages.length > 0 && parsed.ogImages.every((src) => { try { return new URL(src, origin).pathname === expectedImagePath; } catch { return false; } }), `${label}: all emitted OG images use expected path`, parsed.ogImages);
      pass(parsed.twitterImages.length > 0 && parsed.twitterImages.every((src) => { try { return new URL(src, origin).pathname === expectedImagePath; } catch { return false; } }), `${label}: all emitted Twitter images use expected path`, parsed.twitterImages);
      pass(Boolean(meta.og.image_alt), `${label}: descriptive image alt`, meta.og.image_alt);
      if (image) await checkImage(image, label);
      if (staging) pass(/noindex/i.test(meta.robots), `${label}: staging page has robots noindex`, meta.robots);
    }
  }
}

for (const page of expectedPages) await checkPage(page);

// Alias requests must resolve metadata to the canonical route/image, regardless of redirect strategy.
for (const { slug, aliases } of slugs) {
  for (const alias of aliases) {
    const route = `/notices/${alias}`;
    const response = await get(route, agents.normal, false);
    const meta = parseMetadata(response.html);
    const canonical = new URL(`/notices/${slug}`, origin).href;
    pass(response.status === 200 || response.status === 308 || response.status === 301, `${route}: recognized alias resolves`, response.status);
    if (response.status === 200 && response.html) {
      pass(meta.canonical === canonical, `${route}: alias canonicalizes`, { expected: canonical, actual: meta.canonical });
      pass(new URL(meta.og.image || '/', origin).pathname === `/share/v1/${slug}.png`, `${route}: alias uses canonical image`, meta.og.image);
    } else if (response.status >= 300 && response.status < 400) {
      pass(new URL(response.url).pathname === `/notices/${slug}`, `${route}: alias redirect target is canonical`, response.url);
    }
  }
}

const unknownRoute = '/notices/qa-unknown-route-8f3a2';
const unknown = await get(unknownRoute, agents.normal, false);
pass(unknown.status === 404, `${unknownRoute}: unknown notice remains 404`, unknown.status);

const queryRoute = '/?name=QA-SENTINEL-8F3A2&address=999%20QA%20Example%20Street&email=recipient.qa%40example.invalid';
for (const agentName of Object.keys(agents)) {
  const response = await get(queryRoute, agents[agentName], false);
  const meta = parseMetadata(response.html);
  const publicFields = [meta.title, meta.description, meta.canonical, ...Object.values(meta.og), ...Object.values(meta.twitter)];
  pass(response.status === 200, `query sentinel [${agentName}]: route loads`, response.status);
  pass(!publicFields.some((value) => sentinels.some((sentinel) => value.includes(sentinel))), `query sentinel [${agentName}]: not echoed in metadata`, publicFields.filter((value) => sentinels.some((s) => value.includes(s))));
  pass(meta.canonical === origin, `query sentinel [${agentName}]: canonical omits query`, meta.canonical);
}

for (const route of privatePaths) {
  const response = await get(route, agents.normal, false);
  if (response.status === 404) {
    observations.push({ result: 'unavailable', check: `private route ${route}: HTTP 404`, details: 'Route unavailable for this build; no real identifiers or private data used.' });
    continue;
  }
  pass(response.status === 200, `private route ${route}: expected page or 404`, response.status);
  const meta = parseMetadata(response.html);
  pass(/noindex/i.test(meta.robots), `private route ${route}: robots noindex`, meta.robots);
  pass(meta.canonicalCount === 0 && !meta.canonical, `private route ${route}: canonical omitted`, { canonicalCount: meta.canonicalCount, canonical: meta.canonical });
  pass(!meta.og.url, `private route ${route}: og:url omitted`, meta.og.url || '');
  pass(!/[A-Z]{2,}-\d{4,}|DS-[A-Z0-9-]+/i.test(`${meta.title} ${meta.description} ${meta.canonical} ${meta.og.url || ''}`), `private route ${route}: metadata excludes record IDs`, { title: meta.title, description: meta.description, canonical: meta.canonical, ogUrl: meta.og.url });
}

const report = {
  checkedAt: new Date().toISOString(), baseUrl: origin, mode: staging ? 'staging' : 'unspecified',
  routeCounts: { canonical: expectedPages.length, aliases: slugs.reduce((sum, item) => sum + item.aliases.length, 0), private: privatePaths.length },
  manifestLoaded: Boolean(manifest), summary: { checks: observations.length, failures: failures.length, unavailable: observations.filter((x) => x.result === 'unavailable').length },
  observations,
};
console.log(JSON.stringify({
  checkedAt: report.checkedAt,
  baseUrl: report.baseUrl,
  mode: report.mode,
  routeCounts: report.routeCounts,
  manifestLoaded: report.manifestLoaded,
  summary: report.summary,
  failures: observations.filter((x) => x.result === 'fail'),
  unavailable: observations.filter((x) => x.result === 'unavailable'),
}, null, 2));
if (evidencePath) await writeFile(path.resolve(evidencePath), `${JSON.stringify(report, null, 2)}\n`);
process.exitCode = failures.length ? 1 : 0;
