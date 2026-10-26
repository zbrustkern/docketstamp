import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { ALL_NOTICE_CARTRIDGES } from '../../../src/lib/docket/notices/index.ts';
import { CANCELLATION_STARTING_POINTS, buildCancellationStartingPointUrl } from '../../../src/lib/docket/letter-library.ts';
import { STATUTORY_COMPLIANCE_DISCLOSURE, UPL_COMPLIANCE_FOOTER_TEXT } from '../../../src/lib/docket/guardrails.ts';

const require = createRequire(import.meta.url);
const { chromium } = require('/Users/zeke/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base = 'http://127.0.0.1:3115';
const out = new URL('./evidence/ui/', import.meta.url);
await mkdir(out, { recursive: true });
const results = [];
const layoutOnly = process.argv.includes('--layout-only');
const resultFile = layoutOnly ? 'layout-results.json' : 'results.json';
const forbiddenRequests = [];
let blockedTelemetryRequests = 0;
const pageErrors = [];
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const templateData = () => ({ revision: 1, templates: ALL_NOTICE_CARTRIDGES.map(notice => ({
  slug: notice.slug, title: notice.title, category: notice.category, contentDigest: 'a'.repeat(64),
  available: true, reasonCode: null, reason: null, requiresResidence: false, requiresProperty: false,
  residenceRules: [{ mode: 'all', states: [] }], propertyRules: [],
})) });
const cancelSlug = 'service-cancellation-request';
let activePage;

async function setup(viewport = { width: 1440, height: 1000 }) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  activePage = page;
  page.on('pageerror', error => pageErrors.push(error.stack || String(error)));
  const control = { mode: 'good', data: templateData(), release: null };
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== base) return route.abort();
    if (route.request().method() !== 'GET' && route.request().method() !== 'HEAD') {
      if (url.pathname === '/api/telemetry') blockedTelemetryRequests += 1;
      else forbiddenRequests.push({ method: route.request().method(), path: url.pathname });
      return route.abort();
    }
    if (url.pathname === '/api/docket/availability') {
      if (control.mode === 'loading') await new Promise(resolve => { control.release = resolve; });
      if (control.mode === 'error') return route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(control.mode === 'malformed' ? {} : control.data) });
    }
    return route.continue();
  });
  return { context, page, control };
}
async function until(fn, label) {
  const end = Date.now() + 15000;
  while (Date.now() < end) { if (await fn()) return; await new Promise(r => setTimeout(r, 100)); }
  throw new Error(`Timed out: ${label}`);
}
async function checkLinks(page, count) {
  await until(async () => await page.locator('a[href^="/notices/"]').count() === count, `expected ${count} links`);
}
async function noOverflow(page) {
  const size = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
  assert.ok(size.scroll <= size.width + 1, JSON.stringify(size));
}
async function screenshot(page, name) { await page.screenshot({ path: new URL(name, out).pathname, fullPage: true }); }

try {
  for (const [name, viewport] of Object.entries({ desktop: { width: 1440, height: 1000 }, mobile: { width: 390, height: 844 }, narrow: { width: 320, height: 740 } })) {
    const { context, page } = await setup(viewport);
    await page.goto(`${base}/letters`, { waitUntil: 'domcontentloaded' });
    await checkLinks(page, 15);
    await page.getByRole('heading', { level: 1, name: 'Choose a letter to prepare and mail' }).waitFor();
    const links = await page.locator('a[href^="/notices/"]').evaluateAll(nodes => nodes.map(node => node.getAttribute('href')));
    assert.equal(links.filter(link => !link.includes('?')).length, 9);
    assert.deepEqual(links.filter(link => link.includes('?')), CANCELLATION_STARTING_POINTS.map(point => buildCancellationStartingPointUrl(point.value)));
    const text = await page.locator('main').innerText();
    assert.ok(text.includes(STATUTORY_COMPLIANCE_DISCLOSURE));
    assert.ok(text.includes(UPL_COMPLIANCE_FOOTER_TEXT('DS-2026-DEMO')));
    await noOverflow(page);
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement?.tagName), 'A');
    const focus = await page.evaluate(() => ({ style: getComputedStyle(document.activeElement).outlineStyle, width: getComputedStyle(document.activeElement).outlineWidth }));
    assert.notEqual(focus.style, 'none');
    assert.notEqual(focus.width, '0px');
    await screenshot(page, `${name}.png`);
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('home-letter-chooser').waitFor();
    assert.equal(await page.getByTestId('home-letter-chooser').count(), 1);
    const entry = page.getByRole('link', { name: 'Browse letters', exact: true });
    await entry.scrollIntoViewIfNeeded();
    assert.equal(await entry.isVisible(), true);
    await noOverflow(page);
    assert.equal(await page.locator('#notice-catalog').count(), 1);
    assert.equal(await page.getByRole('link', { name: 'Browse the directory', exact: true }).count(), 1);
    await screenshot(page, `home-${name}.png`);
    await entry.click();
    await page.waitForURL(`${base}/letters`);
    await checkLinks(page, 15);
    results.push({ check: `library and home ${name}`, passed: true, viewport, letters: 9, cancellationStartingPoints: 6, keyboardFocus: focus });
    await context.close();
  }

  if (!layoutOnly) {
  for (const [index, point] of CANCELLATION_STARTING_POINTS.entries()) {
    const { context, page } = await setup();
    await page.goto(`${base}${buildCancellationStartingPointUrl(point.value)}`, { waitUntil: 'domcontentloaded' });
    const field = page.locator('select[data-field-key="serviceTypeLabel"]');
    await field.waitFor();
    assert.equal(await field.inputValue(), point.value);
    const other = CANCELLATION_STARTING_POINTS[(index + 1) % CANCELLATION_STARTING_POINTS.length].value;
    await field.selectOption(other);
    assert.equal(await field.inputValue(), other);
    if (index === 0) await screenshot(page, 'editable-preset-workspace.png');
    results.push({ check: 'preset hydration and editability', passed: true, value: point.value, editedTo: other });
    await context.close();
  }

  {
    const { context, page, control } = await setup();
    control.mode = 'loading';
    await page.goto(`${base}/letters`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('status').filter({ hasText: 'Checking current letter availability' }).waitFor();
    await checkLinks(page, 0);
    await screenshot(page, 'loading.png');
    await until(() => control.release !== null, 'availability request waiting');
    control.mode = 'good'; control.release();
    await checkLinks(page, 15);
    results.push({ check: 'loading hides all start links then recovers', passed: true });
    await context.close();
  }
  for (const mode of ['error', 'malformed']) {
    const { context, page, control } = await setup();
    control.mode = mode;
    await page.goto(`${base}/letters`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('alert').filter({ hasText: 'We couldn’t check letter availability' }).waitFor();
    await checkLinks(page, 0);
    await screenshot(page, `${mode}.png`);
    control.mode = 'good';
    await page.getByRole('button', { name: 'Try again', exact: true }).click();
    await checkLinks(page, 15);
    results.push({ check: `${mode} response hides all start links and retry recovers`, passed: true });
    await context.close();
  }
  for (const mode of ['paused', 'held', 'missing', 'all-unavailable']) {
    const { context, page, control } = await setup();
    if (mode === 'missing') control.data.templates = control.data.templates.filter(item => item.slug !== cancelSlug);
    else control.data.templates = control.data.templates.map(item => (mode === 'all-unavailable' || item.slug === cancelSlug) ? { ...item, available: false, reasonCode: mode === 'held' ? 'REVIEW_REQUIRED' : 'TEMPLATE_UNAVAILABLE', reason: 'This notice is not currently available.' } : item);
    await page.goto(`${base}/letters`, { waitUntil: 'domcontentloaded' });
    if (mode === 'all-unavailable') await page.getByRole('status').filter({ hasText: 'Letters are temporarily unavailable' }).waitFor();
    else await page.getByText('Showing 8 letters currently available to start.', { exact: true }).waitFor();
    await checkLinks(page, mode === 'all-unavailable' ? 0 : 8);
    assert.equal(await page.locator('#cancellation-heading').count(), 0);
    await screenshot(page, `${mode}.png`);
    if (mode === 'all-unavailable') {
      control.data = templateData();
      await page.getByRole('button', { name: 'Check again', exact: true }).click();
      await checkLinks(page, 15);
    }
    results.push({ check: `${mode} excludes cancellation and its shortcuts`, passed: true });
    await context.close();
  }
  {
    const { context, page, control } = await setup({ width: 390, height: 844 });
    control.data.templates = control.data.templates.map(item => item.slug === cancelSlug ? { ...item, requiresResidence: true, residenceRules: [{ mode: 'allowlist', states: ['CA'] }] } : item);
    const point = CANCELLATION_STARTING_POINTS[0];
    await page.goto(`${base}/letters`, { waitUntil: 'domcontentloaded' });
    await checkLinks(page, 15);
    await page.getByRole('link', { name: point.label, exact: true }).click();
    await page.getByRole('heading', { name: 'Check availability for your location' }).waitFor();
    assert.equal(await page.locator('select[data-field-key="serviceTypeLabel"]').count(), 0);
    await screenshot(page, 'location-gate-mobile.png');
    await page.getByLabel('State where you live', { exact: true }).selectOption('TX');
    assert.equal(await page.locator('select[data-field-key="serviceTypeLabel"]').count(), 0);
    await page.getByLabel('State where you live', { exact: true }).selectOption('CA');
    const field = page.locator('select[data-field-key="serviceTypeLabel"]');
    await field.waitFor();
    assert.equal(await field.inputValue(), point.value);
    results.push({ check: 'preset respects location gate, denies TX and permits CA with value retained', passed: true });
    await context.close();
  }
  }
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(forbiddenRequests, []);
  await writeFile(new URL(resultFile, out), JSON.stringify({ passed: true, checkedAt: new Date().toISOString(), base, scenarios: results, pageErrors, forbiddenRequests, blockedTelemetryRequests }, null, 2) + '\n');
  console.log(JSON.stringify({ passed: true, scenarios: results.length, pageErrors, forbiddenRequests, blockedTelemetryRequests }, null, 2));
} catch (error) {
  if (activePage && !activePage.isClosed()) { await screenshot(activePage, 'failure.png'); await writeFile(new URL('failure.txt', out), await activePage.locator('body').innerText()); }
  await writeFile(new URL(resultFile, out), JSON.stringify({ passed: false, checkedAt: new Date().toISOString(), scenarios: results, error: String(error), pageErrors, forbiddenRequests }, null, 2) + '\n');
  throw error;
} finally {
  await browser.close();
}
