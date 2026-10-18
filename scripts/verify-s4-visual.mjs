import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { createCDPConnection } from './cdp-client.mjs';

const PORT = 3098;
const CHROME_DEBUG_PORT = 9224;
const EVIDENCE_DIR = path.join(process.cwd(), 'docs/evidence/home-redesign/s4');

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

async function runVisualVerification() {
  console.log('--- Starting S4 Visual & State Verification ---');

  // 1. Start Next.js Server
  console.log(`Starting Next.js server on port ${PORT}...`);
  const nextServer = spawn('npx', ['next', 'start', '-p', String(PORT), '-H', '127.0.0.1'], {
    stdio: 'inherit',
    cwd: process.cwd(),
  });

  // 2. Start Google Chrome with remote debugging
  const userDataDir = `/tmp/chrome-test-s4-${Date.now()}`;
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

    // ==========================================
    // ROUTE 1: Security Deposit Return Demand
    // ==========================================
    const depositUrl = `http://127.0.0.1:${PORT}/notices/security-deposit-return-demand-letter`;

    // 1. Desktop Initial Details View (1280x800)
    console.log('\n--- 1. Security Deposit Return (Desktop Details Stage) ---');
    await setViewport(1280, 800);
    await cdp.send('Page.navigate', { url: depositUrl });
    await sleep(2000);

    await captureScreenshot('01-desktop-deposit-details-initial.png');

    // 2. Desktop Trigger Validation Errors
    console.log('--- 2. Triggering Field Validation Feedback ---');
    await evaluate(`
      (() => {
        // Find and click "Complete required details" / primary action
        const btns = Array.from(document.querySelectorAll('button'));
        const completeBtn = btns.find(b => b.textContent.includes('Complete required details') || b.textContent.includes('Next detail'));
        if (completeBtn) completeBtn.click();
      })()
    `);
    await sleep(600);
    await captureScreenshot('02-desktop-deposit-validation-errors.png');

    // 3. Fill details and Adopt Signature using native descriptor setter
    console.log('--- 3. Filling Details and Adopting Signature ---');
    await evaluate(`
      (() => {
        const setVal = (selector, val) => {
          const el = document.querySelector(selector);
          if (el) {
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
              const proto = el.tagName === 'INPUT' ? window.HTMLInputElement.prototype : window.HTMLTextAreaElement.prototype;
              const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
              if (nativeSetter) nativeSetter.call(el, val);
              else el.value = val;
            } else {
              el.value = val;
            }
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          }
        };

        const setCheckbox = (selector, checked) => {
          const el = document.querySelector(selector);
          if (el) {
            const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'checked')?.set;
            if (nativeSetter) nativeSetter.call(el, checked);
            else el.checked = checked;
            el.dispatchEvent(new Event('change', { bubbles: true }));
            el.dispatchEvent(new Event('input', { bubbles: true }));
          }
        };

        // Fill sender details
        setVal('[data-field-key="senderFullName"] input', 'Alex M. Rivera');
        setVal('[data-field-key="senderAddressLine1"]', '742 Evergreen Terrace');
        setVal('[data-field-key="senderCity"]', 'Springfield');
        setVal('[data-field-key="senderState"]', 'OR');
        setVal('[data-field-key="senderZip"]', '97477');

        // Fill recipient details
        setVal('[data-field-key="recipientFormalName"] input', 'Oakridge Properties LLC');
        setVal('[data-field-key="recipientAddressLine1"]', '100 Main Street, Suite 400');
        setVal('[data-field-key="recipientCity"]', 'Eugene');
        setVal('[data-field-key="recipientState"]', 'OR');
        setVal('[data-field-key="recipientZip"]', '97401');

        // Fill notice specific fields
        setVal('select[data-field-key="propertyState"]', 'OR');
        setVal('[data-field-key="vacatedPremisesAddress"] input', '742 Evergreen Terrace, Apt 4B');
        setVal('[data-field-key="moveOutDate"] input', '2026-09-30');
        setVal('[data-field-key="depositAmount"] input', '$1,800.00');
        setVal('[data-field-key="amountReceivedToDate"] input', '$0.00');
        setVal('[data-field-key="balanceRequested"] input', '$1,800.00');
        setVal('[data-field-key="responseDays"] select', '14 calendar days');

        // Scroll signature block into view
        const sigSection = document.getElementById('signature-adoption-control');
        if (sigSection) {
          sigSection.scrollIntoView({ behavior: 'instant', block: 'center' });
        }

        // Set signature name input
        setVal('[data-testid="signature-input"]', 'Alex M. Rivera');

        // Check affirmation box via real click if not checked
        const check = document.querySelector('#signature-adoption-control input[type="checkbox"]');
        if (check && !check.checked) {
          check.click();
        }
      })()
    `);
    await sleep(600);

    // Diagnostic check before click
    const preAdoptState = await evaluate(`
      (() => {
        const check = document.querySelector('#signature-adoption-control input[type="checkbox"]');
        const sigInput = document.querySelector('[data-testid="signature-input"]');
        const btns = Array.from(document.querySelectorAll('#signature-adoption-control button'));
        const adoptBtn = btns.find(b => b.textContent.toLowerCase().includes('adopt') || b.innerText.toLowerCase().includes('adopt'));
        const errors = Array.from(document.querySelectorAll('.text-rose-400')).map(e => e.textContent);
        const headerText = document.querySelector('header')?.innerText;
        return {
          checked: check?.checked,
          sigVal: sigInput?.value,
          adoptDisabled: adoptBtn?.disabled,
          adoptText: adoptBtn?.innerText,
          errors,
          headerText
        };
      })()
    `);
    console.log('  [Diagnostic Pre-Adopt State]:', preAdoptState);

    // Get exact button position for CDP real mouse click
    const btnPos = await evaluate(`
      (() => {
        const btns = Array.from(document.querySelectorAll('#signature-adoption-control button'));
        const adoptBtn = btns.find(b => b.textContent.toLowerCase().includes('adopt') || b.innerText.toLowerCase().includes('adopt'));
        if (!adoptBtn) return null;
        adoptBtn.scrollIntoView({ behavior: 'instant', block: 'center' });
        const r = adoptBtn.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      })()
    `);

    if (btnPos) {
      console.log('  Dispatching CDP native mouse click at:', btnPos);
      await cdp.send('Input.dispatchMouseEvent', {
        type: 'mousePressed',
        x: Math.round(btnPos.x),
        y: Math.round(btnPos.y),
        button: 'left',
        clickCount: 1,
      });
      await sleep(50);
      await cdp.send('Input.dispatchMouseEvent', {
        type: 'mouseReleased',
        x: Math.round(btnPos.x),
        y: Math.round(btnPos.y),
        button: 'left',
        clickCount: 1,
      });
    }

    // Also trigger native events and React onClick directly if needed
    const clickDiagnostics = await evaluate(`
      (() => {
        const btns = Array.from(document.querySelectorAll('#signature-adoption-control button'));
        const adoptBtn = btns.find(b => b.textContent.toLowerCase().includes('adopt') || b.innerText.toLowerCase().includes('adopt'));
        if (!adoptBtn) return { error: 'No adopt button found' };

        adoptBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
        adoptBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
        adoptBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        adoptBtn.click();

        let directHandlerInvoked = false;
        const reactKey = Object.keys(adoptBtn).find(k => k.startsWith('__reactProps'));
        if (reactKey && adoptBtn[reactKey]?.onClick) {
          adoptBtn[reactKey].onClick({ preventDefault: () => {}, stopPropagation: () => {} });
          directHandlerInvoked = true;
        }

        return {
          directHandlerInvoked,
          buttonText: adoptBtn.innerText,
          disabled: adoptBtn.disabled
        };
      })()
    `);
    console.log('  [Adopt Click Action Diagnostics]:', clickDiagnostics);
    await sleep(800);

    // Ensure signature section is cleanly framed for screenshot
    await evaluate(`
      (() => {
        const sigSection = document.getElementById('signature-adoption-control');
        if (sigSection) {
          sigSection.scrollIntoView({ behavior: 'instant', block: 'center' });
        }
      })()
    `);
    await sleep(200);

    // Explicit DOM assertion for adopted state (case-insensitive to account for CSS text-transform: uppercase)
    const checkStep3 = await evaluate(`
      (() => {
        const text = document.body.innerText.toLowerCase();
        const hasDeliveryAction = text.includes('choose delivery and pay');
        const hasAdoptedStatus = text.includes('signature adopted') || text.includes('step 3: ready for delivery');
        const hasSignatureToken = text.includes('/s/ alex m. rivera');
        return { hasDeliveryAction, hasAdoptedStatus, hasSignatureToken };
      })()
    `);
    console.log('  State for 03-desktop-deposit-signature-adopted:', checkStep3);
    if (!checkStep3.hasDeliveryAction || !checkStep3.hasAdoptedStatus) {
      throw new Error(`Failed to reach adopted state: ${JSON.stringify(checkStep3)}`);
    }

    await captureScreenshot('03-desktop-deposit-signature-adopted.png');

    // 4. Edit content to demonstrate Signature Invalidation
    console.log('--- 4. Editing Content to Invalidate Signature ---');
    await evaluate(`
      (() => {
        const setVal = (selector, val) => {
          const el = document.querySelector(selector);
          if (el) {
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
              const proto = el.tagName === 'INPUT' ? window.HTMLInputElement.prototype : window.HTMLTextAreaElement.prototype;
              const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
              if (nativeSetter) nativeSetter.call(el, val);
              else el.value = val;
            } else {
              el.value = val;
            }
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          }
        };

        // Edit deposit amount to trigger invalidation
        setVal('[data-field-key="depositAmount"] input', '$2,200.00');

        // Scroll signature invalidation banner into view in drawer
        const sigSection = document.getElementById('signature-adoption-control');
        if (sigSection) {
          sigSection.scrollIntoView({ behavior: 'instant', block: 'center' });
        }
      })()
    `);
    await sleep(800);

    // Explicit DOM assertion for invalidation banner (case-insensitive)
    const checkInvalidation = await evaluate(`
      (() => {
        const text = document.body.innerText.toLowerCase();
        const hasBanner = text.includes('letter details changed — please review your updated letter and re-adopt your signature');
        const isNotAdopted = !text.includes('signature adopted ✓');
        return { hasBanner, isNotAdopted };
      })()
    `);
    console.log('  State for 04-desktop-deposit-signature-invalidated:', checkInvalidation);
    if (!checkInvalidation.hasBanner || !checkInvalidation.isNotAdopted) {
      throw new Error(`Failed to verify signature invalidation: ${JSON.stringify(checkInvalidation)}`);
    }

    await captureScreenshot('04-desktop-deposit-signature-invalidated.png');

    // 5. Mobile View (390x844) - Security Deposit Return
    console.log('\n--- 5. Mobile View (390x844) ---');
    await setViewport(390, 844);
    await cdp.send('Page.navigate', { url: depositUrl });
    await sleep(2000);
    await captureScreenshot('05-mobile-deposit-details.png');

    // Mobile Validation Errors
    await evaluate(`
      (() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const completeBtn = btns.find(b => b.textContent.includes('Complete required details') || b.textContent.includes('Next detail'));
        if (completeBtn) completeBtn.click();
      })()
    `);
    await sleep(600);
    await captureScreenshot('06-mobile-deposit-validation-errors.png');

    // ==========================================
    // ROUTE 2: FCRA Dispute with Bureau Prefill
    // ==========================================
    const bureauUrl = `http://127.0.0.1:${PORT}/notices/fcra-credit-bureau-written-dispute-letter?recipientId=cra_eqf`;

    // 6. Desktop Bureau Dispute with Equifax prefilled (1280x800)
    console.log('\n--- 6. Bureau Dispute with Equifax Prefill (Desktop) ---');
    await setViewport(1280, 800);
    await cdp.send('Page.navigate', { url: bureauUrl });
    await sleep(2000);
    await captureScreenshot('07-desktop-bureau-prefilled-details.png');

    // 7. Mobile Bureau Dispute with Equifax prefilled (390x844)
    console.log('--- 7. Bureau Dispute with Equifax Prefill (Mobile) ---');
    await setViewport(390, 844);
    await cdp.send('Page.navigate', { url: bureauUrl });
    await sleep(2000);
    await captureScreenshot('08-mobile-bureau-details.png');

    console.log('\nAll 8 S4 visual screenshots successfully captured.');
  } catch (err) {
    console.error('Visual verification error:', err);
    throw err;
  } finally {
    await cleanup();
  }
}

runVisualVerification().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
