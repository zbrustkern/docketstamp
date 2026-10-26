import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('/Users/zeke/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base = 'http://127.0.0.1:3112';
const out = path.resolve('.delivery/runs/2026-10-20-template-governance/evidence/ui');
fs.mkdirSync(out, { recursive: true });
const key = 'template-governance-browser-fixture-only';
const cookie = email => {
  const payload = `ds_admin_v2_${Date.now()}_${Buffer.from(email).toString('hex')}`;
  return `${payload}.${crypto.createHmac('sha256', key).update(payload).digest('hex')}`;
};
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const results = [], errors = [];
let forbiddenRequests = 0;
const slug = 'security-deposit-return-demand-letter';
const all = { mode: 'all', states: [] };
const owner = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await owner.addCookies([{ name: 'docketstamp_admin_session', value: cookie('owner@example.test'), url: base }]);
const api = owner.request;
async function catalog() { const res = await api.get(`${base}/api/admin/console/templates`); assert.equal(res.status(), 200); return res.json(); }
async function mutate(body) { const res = await api.post(`${base}/api/admin/console/templates`, { headers: { origin: base }, data: { requestId: crypto.randomUUID(), reason: 'Local browser verification fixture only.', ...body } }); assert.equal(res.status(), 200, await res.text()); return res.json(); }
async function setGlobal(global) { const c = await catalog(); return mutate({ action: 'set_global', expectedRevision: c.policy.revision, global }); }
async function setTemplate(patch) {
  const c = await catalog(), entry = c.templates.find(t => t.slug === slug), { review, ...settings } = entry.policy;
  return mutate({ action: 'set_template', expectedRevision: c.policy.revision, expectedContentDigest: entry.contentDigest, slug, settings: { ...settings, ...patch } });
}
async function safePage(context) {
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', error => { errors.push(error.stack || error.message); console.error(error.stack || error.message); });
  page.on('dialog', dialog => dialog.accept());
  await page.route('**/*', route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== base) return route.abort();
    if (url.pathname.includes('lock-and-intent') || /dispatch|retry-fulfillment|sync-stripe|sync-lob/.test(url.pathname)) { forbiddenRequests++; return route.abort(); }
    if (request.method() !== 'GET' && request.method() !== 'HEAD' && !['/api/admin/console/templates', '/api/docket/stage', '/api/mcp'].includes(url.pathname)) return route.abort();
    return route.continue();
  });
  return page;
}
async function screenshot(page, name) { await page.screenshot({ path: path.join(out, `${name}.png`), fullPage: false }); }
async function noOverflow(page, surface) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  assert.equal(overflow, false, `${surface} horizontal overflow`); results.push({ surface, width: page.viewportSize().width, noOverflow: true });
}
const stageBody = fieldValues => ({ noticeSlug: slug, customRecipient: { name: 'Example Property LLC', addressLine1: '100 Main Street', city: 'Sacramento', state: 'CA', zip: '95814' }, fieldValues });
try {
 if (process.argv.includes('--extra')) {
  const page = await safePage(owner);
  await page.addInitScript(() => { Object.defineProperty(navigator, 'modelContext', { configurable: true, value: { registerTool(tool) { window.__fixtureTool = tool; return {}; }, unregisterTool() {} } }); });
  await page.goto(`${base}/notices/${slug}?consumerResidenceState=IL&propertyState=CA`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForFunction(() => !!window.__fixtureTool);
  const filled = await page.evaluate(() => window.__fixtureTool.execute({ fields: { senderFullName: 'Browser Agent Fixture' } }));
  assert.equal(filled.success, true);
  await page.getByDisplayValue?.('Browser Agent Fixture');
  const denied = await page.evaluate(() => window.__fixtureTool.execute({ fields: { consumerResidenceState: 'NC', senderFullName: 'Must Not Apply' } }));
  assert.equal(denied.code, 'LOCATION_UNAVAILABLE');
  assert.equal(await page.getByText('Must Not Apply', { exact: true }).count(), 0);
  const publicPolicy = await (await api.get(`${base}/api/docket/availability`)).json();
  const paused = { ...publicPolicy, templates: publicPolicy.templates.map(entry => entry.slug === slug ? { ...entry, available: false, reasonCode: 'TEMPLATE_UNAVAILABLE', reason: 'This notice is not currently available.' } : entry) };
  await page.route('**/api/docket/availability', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(paused) }));
  const stale = await page.evaluate(() => window.__fixtureTool.execute({ fields: { senderFullName: 'Must Not Apply' } }));
  assert.equal(stale.code, 'TEMPLATE_UNAVAILABLE');
  results.push({ case: 'WebMCP checks fresh policy before field mutation', passed: true });
  await page.goto(`${base}/admin?tab=templates`, { waitUntil: 'networkidle' });
  await page.getByTestId('template-governance-panel').waitFor();
  const tab = page.getByRole('button', { name: 'Templates & coverage', exact: true });
  const bounds = await tab.boundingBox(); assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 1440);
  await screenshot(page, 'admin-desktop');
  let attempts = [];
  await page.route('**/api/admin/console/templates', route => {
    if (route.request().method() !== 'POST') return route.continue();
    attempts.push(route.request().postDataJSON());
    return route.fulfill({ status: attempts.length === 1 ? 400 : 503, contentType: 'application/json', body: JSON.stringify({ code: attempts.length === 1 ? 'TEMPLATE_MUTATION_INVALID' : 'TEMPLATE_POLICY_UNAVAILABLE', error: attempts.length === 1 ? 'TEMPLATE_MUTATION_INVALID' : 'TEMPLATE_POLICY_UNAVAILABLE' }) });
  });
  await page.getByLabel('Reason for this policy change').fill('Local definitive rejection fixture');
  await page.getByRole('button', { name: 'Save global policy', exact: true }).click();
  await page.getByText('TEMPLATE_MUTATION_INVALID', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Retry exact save' }).count(), 0);
  await page.getByLabel('Reason for this policy change').fill('Local corrected request fixture');
  await page.getByRole('button', { name: 'Save global policy', exact: true }).click();
  await page.getByRole('button', { name: 'Retry exact save' }).click();
  await page.getByText('TEMPLATE_POLICY_UNAVAILABLE', { exact: true }).waitFor();
  assert.equal(attempts.length, 3); assert.notEqual(attempts[0].requestId, attempts[1].requestId); assert.deepEqual(attempts[1], attempts[2]);
  results.push({ case: 'definitive rejection allows correction; uncertain retry uses identical request', passed: true });
  assert.deepEqual(errors, []);
 } else {
  await setGlobal({ enabled: true, requireCurrentReview: false, residence: all, property: all });
  await setTemplate({ enabled: true, requireCurrentReview: false, residence: all, property: all });
  const stageResponse = await api.post(`${base}/api/docket/stage`, { data: stageBody({ senderFullName: 'Local Draft Tester' }) });
  assert.equal(stageResponse.status(), 201, await stageResponse.text());
  const oldStage = await stageResponse.json();
  const page = await safePage(owner);
  await page.goto(`${base}/admin?tab=templates`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.getByTestId('template-governance-panel').waitFor();
  await page.getByText('Migration defaults · not a saved policy').count();
  const globalMode = page.locator('#global-residence-consumer-residence-mode');
  const globalStates = page.locator('#global-residence-consumer-residence-mode-states');
  await globalMode.selectOption('blocklist');
  await globalStates.pressSequentially('NC, AZ', { delay: 50 });
  assert.equal(await globalStates.inputValue(), 'NC, AZ');
  await page.getByLabel('Reason for this policy change').fill('Local test of typed state list');
  await page.getByRole('button', { name: 'Save global policy', exact: true }).click();
  await page.getByText(/Saved policy revision/).waitFor();
  assert.deepEqual((await catalog()).policy.global.residence.states, ['NC', 'AZ']);
  results.push({ case: 'typing and saving multi-state rule', passed: true });
  await globalMode.selectOption('all');
  assert.equal(await globalStates.isDisabled(), true);
  await page.getByLabel('Reason for this policy change').fill('Return local fixture to all states');
  await page.getByRole('button', { name: 'Save global policy', exact: true }).click();
  await page.getByText(/Saved policy revision/).waitFor();
  assert.deepEqual((await catalog()).policy.global.residence, all);
  await page.getByRole('button').filter({ hasText: slug }).click();
  await page.getByLabel('Template enabled').uncheck();
  await page.getByLabel('Reason for this template change').fill('Pause local fixture for verification');
  await page.getByRole('button', { name: 'Save template policy', exact: true }).click();
  await page.getByText(/Saved policy revision/).waitFor();
  assert.equal((await catalog()).templates.find(t => t.slug === slug).availability.available, false);
  await page.evaluate(()=>window.scrollTo(0,0)); await screenshot(page, 'admin-desktop'); await noOverflow(page, 'admin');
  const publicResponse = await api.get(`${base}/api/docket/availability`);
  const publicData = await publicResponse.json();
  assert.doesNotMatch(JSON.stringify(publicData), /reviewer|evidenceUrl|notes|updatedBy|sources/);
  const deniedStage = await api.post(`${base}/api/docket/stage`, { data: stageBody({}) });
  assert.equal(deniedStage.status(), 403); assert.equal((await deniedStage.json()).code, 'TEMPLATE_UNAVAILABLE');
  const resumedPaused = await api.get(`${base}/api/docket/stage/${oldStage.stageId}`); assert.equal(resumedPaused.status(), 403);
  const mcp = await api.post(`${base}/api/mcp`, { data: { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'stage_certified_notice', arguments: stageBody({}) } } });
  assert.match(await mcp.text(), /TEMPLATE_UNAVAILABLE/);
  const list = await api.post(`${base}/api/mcp`, { data: { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'list_docket_notices', arguments: {} } } });
  assert.doesNotMatch(await list.text(), new RegExp(slug));
  const customer = await safePage(owner);
  await customer.goto(`${base}/notices/${slug}`, { waitUntil: 'networkidle', timeout: 120000 });
  await customer.getByRole('heading', { name: 'This notice is temporarily unavailable' }).waitFor();
  await screenshot(customer, 'paused-direct');
  await customer.goto(base, { waitUntil: 'networkidle' });
  assert.equal(await customer.getByRole('option').filter({ hasText: 'Demand your security deposit back' }).count(), 0);
  results.push({ case: 'paused direct page, chooser, REST creation/resume and MCP', passed: true });
  await setTemplate({ enabled: true, residence: { mode: 'blocklist', states: ['NC'] }, property: { mode: 'allowlist', states: ['CA'] } });
  const missing = await api.post(`${base}/api/docket/stage`, { data: stageBody({}) });
  assert.equal((await missing.json()).code, 'LOCATION_REQUIRED');
  const blocked = await api.post(`${base}/api/docket/stage`, { data: stageBody({ consumerResidenceState: 'NC', propertyState: 'CA' }) });
  assert.equal((await blocked.json()).code, 'LOCATION_UNAVAILABLE');
  const allowed = await api.post(`${base}/api/docket/stage`, { data: stageBody({ consumerResidenceState: 'IL', propertyState: 'CA', recipientState: 'NC' }) });
  assert.equal(allowed.status(), 201, await allowed.text());
  const resumed = await api.get(`${base}/api/docket/stage/${oldStage.stageId}?consumerResidenceState=IL&propertyState=CA`);
  assert.equal(resumed.status(), 200); assert.equal((await resumed.json()).fieldValues.consumerResidenceState, 'IL');
  await customer.goto(`${base}/notices/${slug}?stage=${oldStage.stageId}`, { waitUntil: 'networkidle' });
  await customer.getByRole('heading', { name: 'Check availability for your location' }).waitFor();
  await customer.getByLabel('State where you live', { exact: true }).selectOption('NC');
  await customer.getByLabel('State where the rental property is located').selectOption('CA');
  await customer.getByText('This notice is not currently available.', { exact: true }).waitFor();
  await screenshot(customer, 'blocked-location-desktop');
  await customer.getByLabel('State where you live', { exact: true }).selectOption('IL');
  await customer.getByRole('heading', { name: 'Check availability for your location' }).waitFor({ state: 'hidden' });
  await customer.getByText('Local Draft Tester', { exact: false }).first().waitFor();
  await screenshot(customer, 'resumed-workspace-desktop'); await noOverflow(customer, 'resumed workspace');
  results.push({ case: 'explicit nexus and old-stage location hydration', passed: true });
  await page.getByRole('button', { name: 'Reload policy', exact: true }).click();
  await page.getByLabel('Reason for this policy change').fill('Local stale save conflict check');
  const before = await catalog(); await setGlobal(before.policy.global);
  await page.getByRole('button', { name: 'Save global policy', exact: true }).click();
  await page.getByText(/Policy changed since this panel loaded/).waitFor();
  results.push({ case: 'stale revision conflict reload', passed: true });
  await page.route('**/api/admin/console/templates', route => route.request().method() === 'GET' ? route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ code: 'TEMPLATE_POLICY_UNAVAILABLE', error: 'TEMPLATE_POLICY_UNAVAILABLE' }) }) : route.continue());
  await page.getByRole('button', { name: 'Reload policy', exact: true }).click();
  await page.getByText('Policy refresh failed.', { exact: true }).waitFor();
  assert.equal(await page.getByLabel('Service enabled').isDisabled(), true);
  await screenshot(page, 'admin-stale-policy');
  await page.unroute('**/api/admin/console/templates');
  await page.getByRole('button', { name: 'Reload policy', exact: true }).click();
  await page.getByText('Policy refresh failed.', { exact: true }).waitFor({ state: 'hidden' });
  results.push({ case: 'failed refresh freezes controls until reload', passed: true });
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await mobile.addCookies([{ name: 'docketstamp_admin_session', value: cookie('viewer@example.test'), url: base }]);
  const viewer = await safePage(mobile);
  await viewer.goto(`${base}/admin?tab=templates`, { waitUntil: 'networkidle' });
  await viewer.getByText('Read-only access.', { exact: false }).waitFor();
  assert.equal(await viewer.getByLabel('Service enabled').isDisabled(), true);
  await screenshot(viewer, 'admin-viewer-mobile'); await noOverflow(viewer, 'admin viewer');
  const mobileCustomer = await safePage(mobile);
  await mobileCustomer.goto(`${base}/notices/${slug}`, { waitUntil: 'networkidle' });
  await mobileCustomer.getByRole('heading', { name: 'Check availability for your location' }).waitFor();
  await screenshot(mobileCustomer, 'location-mobile'); await noOverflow(mobileCustomer, 'location gate');
  await mobileCustomer.route('**/api/docket/availability', route => route.fulfill({ status: 503, body: '{}' }));
  await mobileCustomer.reload({ waitUntil: 'networkidle' });
  await mobileCustomer.getByRole('button', { name: 'Try again', exact: true }).waitFor();
  results.push({ case: 'mobile customer policy fetch failure is closed', passed: true });
  assert.equal(forbiddenRequests, 0);
  assert.deepEqual(errors, []);
  results.push({ case: 'no checkout/dispatch requests or uncaught browser errors', passed: true });
 }
} catch (error) {
  for (const context of browser.contexts()) for (const [index,page] of context.pages().entries()) { await screenshot(page, `failure-${index}`).catch(()=>{}); fs.writeFileSync(path.join(out, `failure-${index}.txt`), await page.locator('body').innerText().catch(()=>'')); }
  throw error;
} finally {
  fs.writeFileSync(path.join(out, process.argv.includes('--extra') ? 'extra-results.json' : 'results.json'), JSON.stringify({ results, errors, forbiddenRequests }, null, 2) + '\n');
  await browser.close();
}
console.log(JSON.stringify(results, null, 2));
