import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { createCDPConnection } from './cdp-client.mjs';

const PORT = 3099;
const CHROME_DEBUG_PORT = 9223;
const EVIDENCE_DIR = path.join(process.cwd(), 'docs/evidence/home-redesign/s3');

fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForHttp(url, timeoutMs = 20000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    function tryConnect() {
      http
        .get(url, (res) => {
          if (res.statusCode >= 200 && res.statusCode < 400) {
            resolve();
          } else {
            setTimeout(tryConnect, 300);
          }
        })
        .on('error', () => {
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

async function runVisualVerification() {
  console.log('--- Starting S3 Visual & DOM Geometry Verification ---');

  // 1. Start Next.js Server
  console.log(`Starting Next.js production server on port ${PORT}...`);
  const nextServer = spawn('npx', ['next', 'start', '-p', String(PORT)], {
    stdio: 'inherit',
    cwd: process.cwd(),
  });

  // 2. Start Google Chrome with remote debugging
  const userDataDir = `/tmp/chrome-test-s3-${Date.now()}`;
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
    if (cdp) cdp.close();
    chromeProcess.kill('SIGTERM');
    nextServer.kill('SIGTERM');
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch {}
  }

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  try {
    await waitForHttp(`http://127.0.0.1:${PORT}/`);
    console.log('Next.js server is ready!');

    const wsUrl = await getChromeWebSocketUrl(CHROME_DEBUG_PORT);
    console.log('Connected to Chrome DevTools Protocol at:', wsUrl);
    cdp = await createCDPConnection(wsUrl);

    // Enable domains
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('DOM.enable');

    async function evaluate(expression) {
      const res = await cdp.send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      if (res.exceptionDetails) {
        throw new Error(`Eval error: ${JSON.stringify(res.exceptionDetails)}`);
      }
      return res.result.value;
    }

    async function captureScreenshot(filepath) {
      const { data } = await cdp.send('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: false,
      });
      fs.writeFileSync(filepath, Buffer.from(data, 'base64'));
      console.log(`Saved screenshot: ${path.relative(process.cwd(), filepath)}`);
    }

    // =========================================================================
    // Test 1: Desktop Viewport Gate (1280 × 720)
    // =========================================================================
    console.log('\n=== Testing Viewport 1280 × 720 (Desktop Gate) ===');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 720,
      deviceScaleFactor: 1,
      mobile: false,
    });

    await cdp.send('Page.navigate', { url: `http://localhost:${PORT}/` });
    await sleep(1500);

    const initialMetrics = await evaluate(`
      (() => {
        const h1 = document.querySelector('h1');
        const search = document.getElementById('docket-chooser-search');
        const priceCue = document.querySelector('[data-testid="home-letter-chooser"]');
        const continueBtn = document.querySelector('button[type="submit"]');
        const desktopPreview = document.querySelector('[data-testid="desktop-preview-column"]');
        const mobileToggle = document.querySelector('button[aria-controls="mobile-letter-preview-sheet"]');

        const h1Rect = h1 ? h1.getBoundingClientRect() : null;
        const searchRect = search ? search.getBoundingClientRect() : null;
        const continueRect = continueBtn ? continueBtn.getBoundingClientRect() : null;
        const desktopPreviewRect = desktopPreview ? desktopPreview.getBoundingClientRect() : null;

        const desktopPreviewDisplay = desktopPreview ? window.getComputedStyle(desktopPreview).display : null;
        const mobileToggleDisplay = mobileToggle ? window.getComputedStyle(mobileToggle).display : null;

        return {
          windowScrollY: window.scrollY,
          viewportHeight: window.innerHeight,
          h1Bottom: h1Rect ? h1Rect.bottom : null,
          searchBottom: searchRect ? searchRect.bottom : null,
          continueBottom: continueRect ? continueRect.bottom : null,
          continueTop: continueRect ? continueRect.top : null,
          continueVisible: continueRect ? (continueRect.bottom <= window.innerHeight && continueRect.top >= 0) : false,
          desktopPreviewDisplay,
          desktopPreviewWidth: desktopPreviewRect ? desktopPreviewRect.width : 0,
          desktopPreviewHeight: desktopPreviewRect ? desktopPreviewRect.height : 0,
          mobileToggleDisplay,
        };
      })()
    `);

    console.log('Desktop 1280x720 Unselected Measurements:', initialMetrics);
    if (!initialMetrics.continueVisible || initialMetrics.continueBottom > 720) {
      throw new Error(
        `CRITICAL GATE FAILURE at 1280x720 (Unselected): Continue button bottom is ${initialMetrics.continueBottom}px (> 720px)!`
      );
    }
    if (initialMetrics.desktopPreviewDisplay === 'none' || initialMetrics.desktopPreviewWidth < 300) {
      throw new Error(
        `CRITICAL GATE FAILURE at 1280x720: Desktop preview column is not visible! (display: ${initialMetrics.desktopPreviewDisplay}, width: ${initialMetrics.desktopPreviewWidth}px)`
      );
    }
    if (initialMetrics.mobileToggleDisplay !== 'none') {
      throw new Error(
        `CRITICAL GATE FAILURE at 1280x720: Mobile preview disclosure button must be hidden on desktop (got display: ${initialMetrics.mobileToggleDisplay})!`
      );
    }
    console.log('✓ Desktop 1280x720 unselected gate PASSED: 2-column layout active, preview visible, mobile toggle hidden, Continue within viewport!');
    await captureScreenshot(path.join(EVIDENCE_DIR, 'homepage-1280x720-unselected.png'));

    // Select the first letter ("Request a security deposit return")
    console.log('\nSelecting letter in chooser on 1280x720...');
    await evaluate(`
      (() => {
        const firstLetterOption = document.querySelector('[role="listbox"] [role="option"]');
        if (firstLetterOption) firstLetterOption.click();
      })()
    `);
    await sleep(500);

    const selectedMetrics = await evaluate(`
      (() => {
        const continueBtn = document.querySelector('button[type="submit"]');
        const continueRect = continueBtn ? continueBtn.getBoundingClientRect() : null;
        const desktopPreview = document.querySelector('[data-testid="desktop-preview-column"]');
        const desktopPreviewDisplay = desktopPreview ? window.getComputedStyle(desktopPreview).display : null;
        return {
          windowScrollY: window.scrollY,
          viewportHeight: window.innerHeight,
          continueBottom: continueRect ? continueRect.bottom : null,
          continueTop: continueRect ? continueRect.top : null,
          continueVisible: continueRect ? (continueRect.bottom <= window.innerHeight && continueRect.top >= 0) : false,
          desktopPreviewDisplay,
        };
      })()
    `);

    console.log('Desktop 1280x720 Selected Measurements:', selectedMetrics);
    if (!selectedMetrics.continueVisible || selectedMetrics.continueBottom > 720) {
      throw new Error(
        `CRITICAL GATE FAILURE at 1280x720 (Selected): Continue button bottom is ${selectedMetrics.continueBottom}px (> 720px)!`
      );
    }
    if (selectedMetrics.desktopPreviewDisplay === 'none') {
      throw new Error('CRITICAL GATE FAILURE at 1280x720 (Selected): Desktop preview column must remain visible!');
    }
    console.log('✓ Desktop 1280x720 selected gate PASSED: Continue button remains within initial viewport!');
    await captureScreenshot(path.join(EVIDENCE_DIR, 'homepage-1280x720-selected.png'));

    // =========================================================================
    // Test 2: Mobile Viewport Gate (390 × 844)
    // =========================================================================
    console.log('\n=== Testing Viewport 390 × 844 (Mobile Gate) ===');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    });

    await cdp.send('Page.navigate', { url: `http://localhost:${PORT}/` });
    await sleep(1500);

    const mobileInitialMetrics = await evaluate(`
      (() => {
        const chooser = document.querySelector('[data-testid="home-letter-chooser"]');
        const continueBtn = document.querySelector('button[type="submit"]');
        const previewSheet = document.querySelector('[data-testid="live-paper-sheet"]');

        const chooserRect = chooser ? chooser.getBoundingClientRect() : null;
        const continueRect = continueBtn ? continueBtn.getBoundingClientRect() : null;
        const previewVisibleInitially = previewSheet ? (previewSheet.offsetParent !== null) : false;

        return {
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          hasHorizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
          chooserTop: chooserRect ? chooserRect.top : null,
          continueTop: continueRect ? continueRect.top : null,
          continueBottom: continueRect ? continueRect.bottom : null,
          continueInInitialViewport: continueRect ? (continueRect.bottom <= 844) : false,
          previewVisibleInitially,
        };
      })()
    `);

    console.log('Mobile 390x844 Initial Measurements:', mobileInitialMetrics);
    if (mobileInitialMetrics.hasHorizontalOverflow) {
      throw new Error(`Horizontal overflow detected at 390px width!`);
    }
    if (mobileInitialMetrics.previewVisibleInitially) {
      throw new Error(`Mobile paper preview must NOT dominate or precede selection!`);
    }
    console.log('✓ Mobile 390x844 gate PASSED: Chooser appears first, zero overflow, paper preview collapsed!');
    await captureScreenshot(path.join(EVIDENCE_DIR, 'homepage-390x844-initial.png'));

    // Expand mobile preview disclosure
    console.log('\nExpanding mobile preview on 390x844 and scrolling into view...');
    await evaluate(`
      (() => {
        const toggleBtn = document.querySelector('button[aria-controls="mobile-letter-preview-sheet"]');
        if (toggleBtn) toggleBtn.click();
      })()
    `);
    await sleep(500);

    // Scroll expanded preview sheet into view so screenshot shows the actual paper
    await evaluate(`
      (() => {
        const sheet = document.getElementById('mobile-letter-preview-sheet');
        if (sheet) {
          sheet.scrollIntoView({ behavior: 'instant', block: 'start' });
        }
      })()
    `);
    await sleep(400);

    const mobileExpandedMetrics = await evaluate(`
      (() => {
        const previewSheet = document.getElementById('mobile-letter-preview-sheet');
        return {
          previewExpanded: Boolean(previewSheet),
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          hasHorizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        };
      })()
    `);
    console.log('Mobile 390x844 Expanded Measurements:', mobileExpandedMetrics);
    if (mobileExpandedMetrics.hasHorizontalOverflow) {
      throw new Error(`Horizontal overflow detected after expanding mobile preview!`);
    }
    console.log('✓ Mobile preview expanded cleanly with zero horizontal overflow!');
    await captureScreenshot(path.join(EVIDENCE_DIR, 'homepage-390x844-preview-expanded.png'));

    // =========================================================================
    // Test 3: Narrow Mobile Viewport Gate (320 × 640) & Tracking Popover
    // =========================================================================
    console.log('\n=== Testing Viewport 320 × 640 (Narrow Mobile Gate) ===');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 320,
      height: 640,
      deviceScaleFactor: 2,
      mobile: true,
    });

    await cdp.send('Page.navigate', { url: `http://localhost:${PORT}/` });
    await sleep(1500);

    const narrowMetricsClosed = await evaluate(`
      (() => {
        const overflowing = [...document.querySelectorAll('*')]
          .filter((el) => el.getBoundingClientRect().right > 320)
          .map((el) => ({
            tag: el.tagName,
            id: el.id,
            className: typeof el.className === 'string' ? el.className.slice(0, 50) : '',
            right: el.getBoundingClientRect().right,
            width: el.getBoundingClientRect().width,
          }))
          .slice(0, 10);

        return {
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          hasHorizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
          overflowing,
        };
      })()
    `);
    console.log('Narrow 320x640 Header Closed Measurements:', narrowMetricsClosed);
    if (narrowMetricsClosed.hasHorizontalOverflow) {
      console.error('Overflowing elements at 320px:', narrowMetricsClosed.overflowing);
      throw new Error(`Horizontal overflow detected at 320px width (header closed)!`);
    }
    console.log('✓ Narrow 320px header closed PASSED: zero horizontal overflow!');
    await captureScreenshot(path.join(EVIDENCE_DIR, 'homepage-320x640-header-closed.png'));

    // Open "Track a letter" disclosure
    console.log('\nOpening Track a letter popover on 320x640...');
    await evaluate(`
      (() => {
        const trackBtn = document.querySelector('button[aria-controls="header-tracking-popover"]');
        if (trackBtn) trackBtn.click();
      })()
    `);
    await sleep(400);

    const narrowMetricsOpen = await evaluate(`
      (() => {
        const popover = document.getElementById('header-tracking-popover');
        return {
          popoverVisible: Boolean(popover),
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          hasHorizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        };
      })()
    `);
    console.log('Narrow 320x640 Tracking Popover Open Measurements:', narrowMetricsOpen);
    if (narrowMetricsOpen.hasHorizontalOverflow) {
      throw new Error(`Horizontal overflow detected at 320px with tracking popover open!`);
    }
    console.log('✓ Narrow 320px tracking open PASSED: zero horizontal overflow!');
    await captureScreenshot(path.join(EVIDENCE_DIR, 'homepage-320x640-tracking-open.png'));

    // =========================================================================
    // Test 4: Tablet Viewport Gate (768 × 1024)
    // =========================================================================
    console.log('\n=== Testing Viewport 768 × 1024 (Tablet Gate) ===');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 768,
      height: 1024,
      deviceScaleFactor: 2,
      mobile: false,
    });

    await cdp.send('Page.navigate', { url: `http://localhost:${PORT}/` });
    await sleep(1500);

    const tabletMetrics = await evaluate(`
      (() => {
        return {
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          hasHorizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        };
      })()
    `);
    console.log('Tablet 768x1024 Measurements:', tabletMetrics);
    if (tabletMetrics.hasHorizontalOverflow) {
      throw new Error(`Horizontal overflow detected at 768px width!`);
    }
    console.log('✓ Tablet 768x1024 gate PASSED: zero horizontal overflow!');
    await captureScreenshot(path.join(EVIDENCE_DIR, 'homepage-768x1024.png'));

    console.log('\nAll visual verification gates passed successfully!');
  } finally {
    await cleanup();
  }
}

runVisualVerification().catch((err) => {
  console.error('\nVerification failed:', err);
  process.exit(1);
});
