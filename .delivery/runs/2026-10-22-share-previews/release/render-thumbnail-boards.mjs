import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const qaDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(qaDir, '../..');
const publicDir = path.join(root, 'public/share/v1');
const names = [
  'home',
  'tenant-notice-of-intent-to-vacate',
  'security-deposit-accounting-request',
  'tenant-repair-and-maintenance-notice',
  'credit-report-dispute-request',
  'debt-dispute-information-request',
  'service-cancellation-request',
  'product-complaint-refund-request',
  'arbitration-opt-out-procedure-request',
  'personal-data-deletion-request',
];

async function board({ filename, names: cardNames, size, columns, labelHeight = 38 }) {
  const [width, height] = size;
  const cellWidth = width + 20;
  const cellHeight = height + labelHeight + 20;
  const rows = Math.ceil(cardNames.length / columns);
  const canvasWidth = columns * cellWidth + 20;
  const canvasHeight = rows * cellHeight + 20;
  const layers = [];
  for (let i = 0; i < cardNames.length; i++) {
    const name = cardNames[i];
    const input = path.join(publicDir, `${name}.png`);
    const left = 20 + (i % columns) * cellWidth;
    const top = 20 + Math.floor(i / columns) * cellHeight;
    const thumb = await sharp(input).resize(width, height, { fit: 'contain', background: '#0f172a' }).png().toBuffer();
    layers.push({ input: thumb, left, top });
    const label = `<svg width="${width}" height="${labelHeight}"><rect width="100%" height="100%" fill="#ffffff"/><text x="8" y="25" font-family="Arial,sans-serif" font-size="15" fill="#0f172a">${name.replaceAll('&', '&amp;')}</text></svg>`;
    layers.push({ input: Buffer.from(label), left, top: top + height });
  }
  await sharp({ create: { width: canvasWidth, height: canvasHeight, channels: 4, background: '#e2e8f0' } })
    .composite(layers)
    .png()
    .toFile(path.join(qaDir, filename));
}

await board({ filename: 'wide-600x315.png', names, size: [600, 315], columns: 2 });
await board({ filename: 'wide-300x158.png', names, size: [300, 158], columns: 3, labelHeight: 36 });
await board({ filename: 'square-160x160.png', names: ['square'], size: [160, 160], columns: 1, labelHeight: 36 });
