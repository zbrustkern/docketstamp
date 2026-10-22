#!/usr/bin/env node
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = join(repoRoot, 'assets/share');
const publicDir = join(repoRoot, 'public/share/v1');
const legacyPngPath = join(repoRoot, 'public/og-image.png');
const legacyJpgPath = join(repoRoot, 'public/og-image.jpg');
const outputDir = resolve(process.env.SHARE_ASSET_OUTPUT_DIR || publicDir);
const contactSheetPath = resolve(
  process.env.SHARE_CONTACT_SHEET_PATH || join(repoRoot, '.delivery/share-previews/contact-sheet.png'),
);
const require = createRequire(import.meta.url);

function loadPlaywright() {
  const customPath = process.env.PLAYWRIGHT_MODULE;
  if (customPath) return require(customPath);
  try {
    return require('playwright');
  } catch (error) {
    throw new Error(
      'Playwright was not found. Install it in this workspace or set PLAYWRIGHT_MODULE to its module entry point.',
      { cause: error },
    );
  }
}

function escapeHtml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function makeCard(route) {
  const headline = route.headline.map((line) => `<span>${escapeHtml(line)}</span>`).join('');
  const paperTitle = route.paperTitle || 'Your formal<br>letter';
  const paperField = route.paperField || 'LETTER DETAILS';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><base href="${pathToFileURL(`${sourceDir}/`).href}"><style>${route.css}</style></head><body><article class="card route" aria-label="${escapeHtml(route.alt)}">
    <div class="brand"><span class="monogram">DS</span><span class="wordmark">DOCKETSTAMP<span class="trademark">™</span></span></div>
    <div class="eyebrow">${escapeHtml(route.eyebrow)}</div>
    <h1 class="headline">${headline}</h1>
    <p class="promise">Prepare and review your letter online.<br>We’ll print and mail it.</p>
    <p class="support">Send by USPS.</p>
    <div class="rule"></div>
    <div class="benefit"><svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><rect x="2.5" y="4.5" width="19" height="15" rx="2"/><path d="m3 6 9 7 9-7"/></svg><span>Certified Mail available</span></div>
    <div class="art" aria-label="Illustration of an abstract letter and envelope"><div class="paper"><div class="paper-brand">DOCKETSTAMP</div><div class="paper-label">LETTER PREVIEW</div><div class="paper-title">${paperTitle}</div><div class="field">${escapeHtml(paperField)}</div><div class="line"></div><div class="line"></div><div class="line mid"></div><div style="height:6px"></div><div class="line"></div><div class="line short"></div><div class="paper-foot">ILLUSTRATION · NOT A MAILED LETTER</div></div><div class="envelope"><div class="flap"></div><div class="fold"></div><div class="envelope-label">PREPARED ONLINE. MAILED FOR YOU.</div><div class="seal">DS</div></div></div>
    <div class="disclosure">Self-help document preparation.<br>Not a law firm. No legal advice.</div>
    <div class="domain">docketstamp.com</div>
  </article></body></html>`;
}

async function main() {
  const copy = JSON.parse(await readFile(join(sourceDir, 'card-copy.json'), 'utf8'));
  let css = await readFile(join(sourceDir, 'card.css'), 'utf8');
  const monoBase64 = (await readFile(join(sourceDir, 'fonts/bb3ef058b751a6ad-s.p.woff2'))).toString('base64');
  for (const fileName of [
    'e4af272ccee01ff0-s.p.woff2',
    '1f3fe8c6df3d47c1-s.p.woff2',
    'bb3ef058b751a6ad-s.p.woff2',
  ]) {
    const fontData = (await readFile(join(sourceDir, 'fonts', fileName))).toString('base64');
    css = css.replace(`url('./fonts/${fileName}')`, `url(data:font/woff2;base64,${fontData})`);
  }
  const { chromium } = loadPlaywright();
  const sharp = require('sharp');
  const browserOptions = { headless: true };
  if (process.env.BROWSER_EXECUTABLE_PATH) browserOptions.executablePath = process.env.BROWSER_EXECUTABLE_PATH;
  const browser = await chromium.launch(browserOptions);
  const images = [];
  await mkdir(outputDir, { recursive: true });
  await mkdir(dirname(contactSheetPath), { recursive: true });

  try {
    for (const key of ['home', 'square']) {
      const source = join(sourceDir, copy[key].source);
      const fileName = `${key}.png`;
      const destination = join(outputDir, fileName);
      await copyFile(source, destination);
      images.push({ name: key, path: `/share/v1/${fileName}`, source: `assets/share/${copy[key].source}`, alt: copy[key].alt, file: destination });
    }

    const routeManifest = [];
    for (const route of copy.routeCards) {
      const destination = join(outputDir, `${route.slug}.png`);
      const serviceCancellation = route.slug === 'service-cancellation-request';
      if (serviceCancellation) {
        await copyFile(join(sourceDir, 'approved/cancellation.png'), destination);
        images.push({ name: route.slug, path: `/share/v1/${route.slug}.png`, source: 'assets/share/approved/cancellation.png', alt: route.alt, file: destination });
      } else {
        const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
        await page.setContent(makeCard({ ...route, css }), { waitUntil: 'load' });
        await page.evaluate(async () => {
          await Promise.all([
            document.fonts.load('400 21px Inter'),
            document.fonts.load('700 54px Merriweather'),
            document.fonts.load('600 25px "JetBrains Mono"'),
          ]);
          await document.fonts.ready;
        });
        const diagnostics = await page.evaluate(() => {
          const elements = ['.brand', '.eyebrow', '.headline', '.promise', '.support', '.benefit', '.disclosure', '.domain'];
          const bounds = elements.map((selector) => {
            const node = document.querySelector(selector);
            const rect = node.getBoundingClientRect();
            return { selector, text: node.textContent.trim(), x: Math.round(rect.x), y: Math.round(rect.y), right: Math.round(rect.right), bottom: Math.round(rect.bottom), width: Math.round(rect.width), height: Math.round(rect.height) };
          });
          const headlineLines = [...document.querySelectorAll('.headline span')].map((node) => {
            const rect = node.getBoundingClientRect();
            return { text: node.textContent, right: Math.round(rect.right), bottom: Math.round(rect.bottom), scrollWidth: node.scrollWidth, clientWidth: node.clientWidth };
          });
          return {
            viewport: { width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight },
            fonts: { inter: document.fonts.check('400 21px Inter'), merriweather: document.fonts.check('700 54px Merriweather'), jetBrainsMono: document.fonts.check('600 25px "JetBrains Mono"') },
            bounds,
            headlineLines,
          };
        });
        const failed = diagnostics.viewport.scrollWidth !== 1200 || diagnostics.viewport.scrollHeight !== 630 || Object.values(diagnostics.fonts).some((loaded) => !loaded) || diagnostics.bounds.some((item) => item.x < 0 || item.y < 0 || item.right > 1200 || item.bottom > 630) || diagnostics.headlineLines.some((line) => line.scrollWidth > line.clientWidth || line.right > 680);
        if (failed) throw new Error(`Layout/font verification failed for ${route.slug}: ${JSON.stringify(diagnostics)}`);
        await page.screenshot({ path: destination, type: 'png' });
        await page.close();
        images.push({ name: route.slug, path: `/share/v1/${route.slug}.png`, source: 'assets/share/card-copy.json + assets/share/card.css', alt: route.alt, diagnostics, file: destination });
      }
      routeManifest.push({ slug: route.slug, path: `/share/v1/${route.slug}.png`, alt: route.alt });
    }

    for (const image of images) {
      const metadata = await sharp(image.file).metadata();
      if (metadata.width !== 1200 || metadata.height !== 630 || metadata.format !== 'png') {
        if (image.name !== 'square' || metadata.width !== 1080 || metadata.height !== 1080) {
          throw new Error(`Unexpected image dimensions/type for ${image.name}: ${metadata.width}x${metadata.height} ${metadata.format}`);
        }
      }
      image.width = metadata.width;
      image.height = metadata.height;
      image.mimeType = 'image/png';
      const imageBuffer = await readFile(image.file);
      image.bytes = imageBuffer.length;
      image.sha256 = (await import('node:crypto')).createHash('sha256').update(imageBuffer).digest('hex');
      delete image.file;
    }

    await copyFile(join(sourceDir, copy.home.source), legacyPngPath);
    await sharp(join(sourceDir, copy.home.source)).jpeg({ quality: 90, mozjpeg: true }).toFile(legacyJpgPath);
    const legacyFallbacks = [];
    for (const filePath of [legacyPngPath, legacyJpgPath]) {
      const metadata = await sharp(filePath).metadata();
      const fileBytes = await readFile(filePath);
      legacyFallbacks.push({
        path: `/${filePath.slice(repoRoot.length + 1)}`,
        mimeType: metadata.format === 'jpeg' ? 'image/jpeg' : 'image/png',
        width: metadata.width,
        height: metadata.height,
        bytes: fileBytes.length,
        sha256: (await import('node:crypto')).createHash('sha256').update(fileBytes).digest('hex'),
      });
    }

    const tiles = await Promise.all(images.map(async (image) => {
      const ratio = image.width / image.height;
      const width = image.name === 'square' ? 260 : 360;
      const height = Math.round(width / ratio);
      const localImage = `data:image/png;base64,${(await readFile(join(outputDir, basename(image.path)))).toString('base64')}`;
      return `<figure><img src="${localImage}" style="width:${width}px;height:${height}px;object-fit:cover"><figcaption>${escapeHtml(image.name)}</figcaption><small>${image.width}×${image.height} · ${image.sha256.slice(0, 12)}</small></figure>`;
    }));
    const contactPage = await browser.newPage({ viewport: { width: 1520, height: 1700 }, deviceScaleFactor: 1 });
    await contactPage.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>body{margin:24px;background:#e2e8f0;color:#0f172a;font:14px Inter,Arial,sans-serif}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;align-items:start}figure{margin:0;background:white;padding:10px;border-radius:8px;box-shadow:0 2px 8px #0f172a22}img{display:block;max-width:100%;object-fit:contain;background:#0f172a}figcaption{font-weight:700;margin-top:8px}small{color:#475569}</style></head><body><div class="grid">${tiles.join('')}</div></body></html>`);
    await contactPage.waitForFunction(() => [...document.images].every((image) => image.complete && image.naturalWidth > 0));
    await contactPage.screenshot({ path: contactSheetPath, fullPage: true });
    await contactPage.close();

    const iconSvg = (await readFile(join(sourceDir, 'icon-source.svg'), 'utf8')).replace('{{JETBRAINS_MONO_WOFF2_BASE64}}', monoBase64);
    const iconPage = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 });
    await iconPage.setContent(`<!doctype html><html><head><style>html,body{margin:0;width:512px;height:512px;overflow:hidden}</style></head><body>${iconSvg}</body></html>`);
    await iconPage.evaluate(async () => {
      await document.fonts.load('700 190px "JetBrains Mono"');
      await document.fonts.ready;
    });
    const icon512 = await iconPage.screenshot({ type: 'png', omitBackground: true });
    await iconPage.close();
    const iconFiles = [
      { path: 'app/icon.png', size: 512 },
      { path: 'app/apple-icon.png', size: 180 },
      { path: 'public/icon-192.png', size: 192 },
      { path: 'public/icon-512.png', size: 512 },
      { path: 'public/apple-touch-icon.png', size: 180 },
      { path: 'public/apple-touch-icon-precomposed.png', size: 180 },
      { path: 'public/favicon-32x32.png', size: 32 },
    ];
    const icons = [];
    for (const item of iconFiles) {
      const destination = join(repoRoot, item.path);
      await mkdir(dirname(destination), { recursive: true });
      const data = item.size === 512 ? icon512 : await sharp(icon512).resize(item.size, item.size, { fit: 'fill', kernel: 'lanczos3' }).png().toBuffer();
      await writeFile(destination, data);
      icons.push({ filePath: item.path, path: `/${basename(item.path)}`, width: item.size, height: item.size, mimeType: 'image/png', bytes: data.length, sha256: (await import('node:crypto')).createHash('sha256').update(data).digest('hex') });
    }
    const faviconPng = await sharp(icon512).resize(32, 32, { fit: 'fill', kernel: 'lanczos3' }).png().toBuffer();
    const ico = Buffer.alloc(22 + faviconPng.length);
    ico.writeUInt16LE(0, 0);
    ico.writeUInt16LE(1, 2);
    ico.writeUInt16LE(1, 4);
    ico.writeUInt8(32, 6);
    ico.writeUInt8(32, 7);
    ico.writeUInt8(0, 8);
    ico.writeUInt8(0, 9);
    ico.writeUInt16LE(1, 10);
    ico.writeUInt16LE(32, 12);
    ico.writeUInt32LE(faviconPng.length, 14);
    ico.writeUInt32LE(22, 18);
    faviconPng.copy(ico, 22);
    await writeFile(join(repoRoot, 'app/favicon.ico'), ico);
    icons.push({ filePath: 'app/favicon.ico', path: '/favicon.ico', width: 32, height: 32, mimeType: 'image/x-icon', bytes: ico.length, sha256: (await import('node:crypto')).createHash('sha256').update(ico).digest('hex') });

    const iconContactSheet = join(repoRoot, '.delivery/share-previews/icon-contact-sheet.png');
    const iconTiles = await Promise.all(icons.map(async (icon) => {
      const filePath = join(repoRoot, icon.filePath);
      const source = await readFile(filePath);
      const png = icon.mimeType === 'image/x-icon' ? faviconPng : source;
      const size = 180;
      return `<figure><img src="data:image/png;base64,${png.toString('base64')}" style="width:${size}px;height:${size}px;object-fit:contain"><figcaption>${escapeHtml(icon.path)}</figcaption><small>${icon.width}×${icon.height} · ${icon.sha256.slice(0, 12)}</small></figure>`;
    }));
    const iconSheet = await browser.newPage({ viewport: { width: 1000, height: 900 }, deviceScaleFactor: 1 });
    await iconSheet.setContent(`<!doctype html><html><head><style>body{margin:24px;background:#e2e8f0;color:#0f172a;font:14px Inter,Arial,sans-serif}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}figure{margin:0;background:white;padding:10px;border-radius:8px;text-align:center}img{display:block;margin:auto;background:#fff}figcaption{font-weight:700;margin-top:8px;word-break:break-all}small{color:#475569}</style></head><body><div class="grid">${iconTiles.join('')}</div></body></html>`);
    await iconSheet.waitForFunction(() => [...document.images].every((image) => image.complete && image.naturalWidth > 0));
    await iconSheet.screenshot({ path: iconContactSheet, fullPage: true });
    await iconSheet.close();
    const manifest = {
      version: 'v1',
      generatedAt: 'reproducible-build',
      fonts: [
        { family: 'Inter', file: '/assets/share/fonts/e4af272ccee01ff0-s.p.woff2', license: 'SIL Open Font License 1.1' },
        { family: 'Merriweather', file: '/assets/share/fonts/1f3fe8c6df3d47c1-s.p.woff2', license: 'SIL Open Font License 1.1' },
        { family: 'JetBrains Mono', file: '/assets/share/fonts/bb3ef058b751a6ad-s.p.woff2', license: 'SIL Open Font License 1.1' },
      ],
      images,
      icons,
      routeMap: routeManifest,
      legacyFallbacks,
      contactSheet: contactSheetPath,
      iconContactSheet,
    };
    await writeFile(join(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(JSON.stringify({ outputDir, contactSheetPath, images: images.map(({ name, width, height, bytes, sha256 }) => ({ name, width, height, bytes, sha256 })), routeMap: routeManifest }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
