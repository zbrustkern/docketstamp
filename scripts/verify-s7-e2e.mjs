import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { createCDPConnection } from './cdp-client.mjs';

const PORT = 3098;
const CHROME_DEBUG_PORT = 9226;
const EVIDENCE_DIR = path.join(process.cwd(), 'docs/evidence/home-redesign/s7');

fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForHttp(url, timeoutMs = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    function tryConnect() {
      const req = http.get(url, (res) => {
        res.resume();
        if (res.statusCode >= 200 && res.statusCode < 500) {
          resolve();
        } else {
          setTimeout(tryConnect, 300);
        }
      });
      req.on('error', () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Timed out waiting for ${url}`));
        } else {
          setTimeout(tryConnect, 300);
        }
      });
    }
    tryConnect();
  });
}

async function getChromeWebSocketUrl(port) {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await new Promise((resolve, reject) => {
        http
          .get(`http://127.0.0.1:${port}/json`, (r) => {
            let data = '';
            r.on('data', (c) => (data += c));
            r.on('end', () => resolve(data));
          })
          .on('error', reject);
      });
      const pages = JSON.parse(res);
      const page = pages.find((p) => p.type === 'page');
      if (page && page.webSocketDebuggerUrl) {
        return page.webSocketDebuggerUrl;
      }
    } catch {
      await sleep(250);
    }
  }
  throw new Error('Could not get Chrome page WebSocket URL');
}

async function runS7Verification() {
  console.log('--- Starting S7 Release Candidate Visual & E2E Verification ---');

  // 1. Start Next.js Server
  console.log(`Starting Next.js dev server on port ${PORT}...`);
  const nextServer = spawn('npx', ['next', 'dev', '-p', String(PORT), '-H', '127.0.0.1'], {
    stdio: 'inherit',
    cwd: process.cwd(),
    env: {
      ...process.env,
      ALLOW_LOCAL_MOCK_PAYMENTS: 'true',
      USE_MOCK_FIRESTORE: 'true',
    },
  });

  // 2. Start Google Chrome with remote debugging
  const userDataDir = `/tmp/chrome-test-s7-${Date.now()}`;
  console.log(`Starting headless Chrome on remote debugging port ${CHROME_DEBUG_PORT}...`);
  const chromeProcess = spawn(
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      '--disable-crash-reporter',
      `--remote-debugging-port=${CHROME_DEBUG_PORT}`,
      `--user-data-dir=${userDataDir}`,
      'about:blank',
    ],
    { stdio: 'ignore' }
  );

  let cdp = null;

  async function cleanup() {
    console.log('Cleaning up processes...');
    if (cdp) {
      try {
        cdp.close();
      } catch {}
    }
    try {
      chromeProcess.kill('SIGTERM');
    } catch {}
    try {
      nextServer.kill('SIGTERM');
    } catch {}
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch {}
  }

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  try {
    console.log(`Waiting for Next.js server at http://127.0.0.1:${PORT}/...`);
    await waitForHttp(`http://127.0.0.1:${PORT}/`);
    console.log('Next.js server is up.');

    console.log('Connecting to Chrome via CDP...');
    const wsUrl = await getChromeWebSocketUrl(CHROME_DEBUG_PORT);
    cdp = await createCDPConnection(wsUrl);
    console.log('CDP connection established.');

    await cdp.send('Page.enable');
    await cdp.send('DOM.enable');
    await cdp.send('Runtime.enable');

    async function setViewport(width, height) {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 2,
        mobile: width < 768,
      });
    }

    async function captureScreenshot(filename) {
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
      const filePath = path.join(EVIDENCE_DIR, filename);
      fs.writeFileSync(filePath, Buffer.from(data, 'base64'));
      console.log(`  [Screenshot Saved] ${filePath}`);
    }

    async function evaluate(expression) {
      const res = await cdp.send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      return res.result ? res.result.value : null;
    }

    async function navigateAndWait(url, waitMs = 1200) {
      console.log(`Navigating to ${url}...`);
      await cdp.send('Page.navigate', { url });
      await sleep(waitMs);
    }

    // ========================================================================
    // Screenshot 1: Companies directory desktop (1280x720)
    // ========================================================================
    console.log('\n[Capture 1/7] Companies directory desktop (1280x720)...');
    await setViewport(1280, 720);
    await navigateAndWait(`http://127.0.0.1:${PORT}/companies`, 1500);
    await captureScreenshot('01-companies-directory-desktop-1280x720.png');

    // ========================================================================
    // Screenshot 2: Companies directory mobile (390x844)
    // ========================================================================
    console.log('\n[Capture 2/7] Companies directory mobile (390x844)...');
    await setViewport(390, 844);
    await sleep(600);
    await captureScreenshot('02-companies-directory-mobile-390x844.png');

    // ========================================================================
    // Screenshot 3: Hardware Purpose Disambiguation Desktop (Sonos: 3 options)
    // ========================================================================
    console.log('\n[Capture 3/7] Hardware purpose disambiguation desktop (Sonos)...');
    await setViewport(1280, 720);
    await navigateAndWait(`http://127.0.0.1:${PORT}/`, 1500);

    // Search for Sonos and click it
    await evaluate(`
      (() => {
        const input = document.getElementById('docket-chooser-search');
        if (input) {
          input.focus();
          const proto = window.HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
          if (setter) setter.call(input, 'Sonos');
          else input.value = 'Sonos';
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      })()
    `);
    await sleep(600);

    // Click Sonos from search results
    await evaluate(`
      (() => {
        const options = Array.from(document.querySelectorAll('[role="option"]'));
        const sonosOpt = options.find(o => o.textContent && o.textContent.includes('Sonos'));
        if (sonosOpt) {
          sonosOpt.click();
        }
      })()
    `);
    await sleep(600);
    await captureScreenshot('03-hardware-purpose-disambiguation-desktop.png');

    // ========================================================================
    // Screenshot 4: Restricted Fitness Entity Blocked on Home (Equinox / Planet Fitness)
    // ========================================================================
    console.log('\n[Capture 4/7] Restricted fitness entity blocked on home...');
    await evaluate(`
      (() => {
        const input = document.getElementById('docket-chooser-search');
        if (input) {
          input.focus();
          const proto = window.HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
          if (setter) setter.call(input, 'Planet Fitness');
          else input.value = 'Planet Fitness';
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      })()
    `);
    await sleep(600);
    await captureScreenshot('04-restricted-fitness-entity-blocked-home.png');

    // ========================================================================
    // Screenshot 5: Restricted Fitness Entity Blocked on /companies
    // ========================================================================
    console.log('\n[Capture 5/7] Restricted fitness entity blocked on /companies...');
    await navigateAndWait(`http://127.0.0.1:${PORT}/companies`, 1500);
    await evaluate(`
      (() => {
        const input = document.querySelector('input[type="search"]');
        if (input) {
          input.focus();
          const proto = window.HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
          if (setter) setter.call(input, 'Equinox');
          else input.value = 'Equinox';
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      })()
    `);
    await sleep(600);
    await captureScreenshot('05-restricted-fitness-entity-blocked-companies.png');

    // ========================================================================
    // Screenshot 6: Specimen Tracking Page Truthful Status (/docket/DS-2026-88419-X)
    // ========================================================================
    console.log('\n[Capture 6/7] Specimen tracking page truthful status (/docket/DS-2026-88419-X)...');
    await setViewport(1280, 720);
    await navigateAndWait(`http://127.0.0.1:${PORT}/docket/DS-2026-88419-X`, 1500);
    await captureScreenshot('06-specimen-tracking-page-truthful-status.png');

    // ========================================================================
    // Screenshot 7: Direct Notice Workspace Prefilled (1280x720)
    // ========================================================================
    console.log('\n[Capture 7/7] Direct notice workspace prefilled (1280x720)...');
    await navigateAndWait(
      `http://127.0.0.1:${PORT}/notices/security-deposit-return-demand-letter?tier=certified&focus=depositAmount`,
      2000
    );
    await captureScreenshot('07-direct-notice-workspace-prefilled-1280x720.png');

    console.log('\n✅ All 7 S7 screenshots captured successfully!');
  } catch (err) {
    console.error('Error in S7 visual verification:', err);
    throw err;
  } finally {
    await cleanup();
  }
}

runS7Verification()
  .then(() => {
    console.log('S7 verification completed with exit 0');
    process.exit(0);
  })
  .catch((err) => {
    console.error('S7 verification failed:', err);
    process.exit(1);
  });
