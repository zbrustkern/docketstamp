import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { createCDPConnection } from './cdp-client.mjs';

const PORT = 3097;
const CHROME_DEBUG_PORT = 9225;
const EVIDENCE_DIR = path.join(process.cwd(), 'docs/evidence/home-redesign/s5');

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
  console.log('--- Starting S5 Delivery & Payment Visual Verification ---');

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
  const userDataDir = `/tmp/chrome-test-s5-${Date.now()}`;
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

    async function clickElement(selectorOrFn) {
      const res = await evaluate(`
        (() => {
          let el;
          try {
            const arg = ${selectorOrFn};
            if (typeof arg === 'function') el = arg();
            else if (typeof arg === 'string') el = document.querySelector(arg);
            else el = arg;
          } catch (e) {
            return { success: false, error: String(e) };
          }
          if (!el) return { success: false, reason: 'element not found' };
          el.scrollIntoView({ behavior: 'instant', block: 'center' });
          const r = el.getBoundingClientRect();
          try { el.click(); } catch {}
          return { success: true, x: r.left + r.width / 2, y: r.top + r.height / 2 };
        })()
      `);
      if (res && res.success && res.x != null && res.y != null) {
        try {
          await cdp.send('Input.dispatchMouseEvent', {
            type: 'mousePressed',
            x: Math.round(res.x),
            y: Math.round(res.y),
            button: 'left',
            clickCount: 1,
          });
          await sleep(50);
          await cdp.send('Input.dispatchMouseEvent', {
            type: 'mouseReleased',
            x: Math.round(res.x),
            y: Math.round(res.y),
            button: 'left',
            clickCount: 1,
          });
        } catch {}
        return true;
      }
      return false;
    }

    // Helper to fill form and adopt signature
    async function fillDepositNoticeForm() {
      const fillLog = await evaluate(`
        (() => {
          const setVal = (selector, val) => {
            let el = document.querySelector(selector);
            if (!el) return { success: false, selector, error: 'not found' };
            if (el.tagName === 'DIV') {
              el = el.querySelector('input, select, textarea') || el;
            }
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
              const proto = el.tagName === 'INPUT' ? window.HTMLInputElement.prototype : window.HTMLTextAreaElement.prototype;
              const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
              if (nativeSetter) nativeSetter.call(el, val);
              else el.value = val;
            } else if (el.tagName === 'SELECT') {
              const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')?.set;
              if (nativeSetter) nativeSetter.call(el, val);
              else el.value = val;
            }
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            return { success: true, selector, val: el.value };
          };

          const log = [];
          log.push(setVal('[data-field-key="senderFullName"]', 'Alex M. Rivera'));
          log.push(setVal('[data-field-key="senderAddressLine1"]', '742 Evergreen Terrace'));
          log.push(setVal('[data-field-key="senderCity"]', 'Springfield'));
          log.push(setVal('[data-field-key="senderState"]', 'OR'));
          log.push(setVal('[data-field-key="senderZip"]', '97477'));

          log.push(setVal('[data-field-key="recipientFormalName"]', 'Oakridge Properties LLC'));
          log.push(setVal('[data-field-key="recipientAddressLine1"]', '100 Main Street, Suite 400'));
          log.push(setVal('[data-field-key="recipientCity"]', 'Eugene'));
          log.push(setVal('[data-field-key="recipientState"]', 'OR'));
          log.push(setVal('[data-field-key="recipientZip"]', '97401'));

          log.push(setVal('[data-field-key="propertyState"]', 'OR'));
          log.push(setVal('[data-field-key="vacatedPremisesAddress"]', '742 Evergreen Terrace, Apt 4B'));
          log.push(setVal('[data-field-key="moveOutDate"]', '2026-09-30'));
          log.push(setVal('[data-field-key="depositAmount"]', '$1,800.00'));
          log.push(setVal('[data-field-key="amountReceivedToDate"]', '$0.00'));
          log.push(setVal('[data-field-key="balanceRequested"]', '$1,800.00'));
          log.push(setVal('[data-field-key="responseDays"]', '14 calendar days'));

          // Scroll signature block into view
          const sigSection = document.getElementById('signature-adoption-control');
          if (sigSection) {
            sigSection.scrollIntoView({ behavior: 'instant', block: 'center' });
          }

          log.push(setVal('[data-testid="signature-input"]', 'Alex M. Rivera'));

          const check = document.querySelector('#signature-adoption-control input[type="checkbox"]');
          if (check && !check.checked) {
            check.click();
          }

          return log;
        })()
      `);
      console.log('  [fillDepositNoticeForm log]:', JSON.stringify(fillLog));
      await sleep(600);

      // Click "Adopt & sign letter" using CDP click
      await clickElement(`() => Array.from(document.querySelectorAll('#signature-adoption-control button')).find(b => b.textContent.toLowerCase().includes('adopt'))`);
      await sleep(600);
    }

    // Helper to open checkout modal
    async function openCheckoutModal() {
      // Click the primary drawer CTA button: "Choose delivery and pay →"
      await clickElement(`() => Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Choose delivery and pay') || b.textContent.includes('Proceed to delivery') || b.textContent.includes('delivery & payment'))`);
      await sleep(800);

      const status = await evaluate(`
        (() => {
          const modal = document.querySelector('#checkout-modal-title');
          const btns = Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim());
          const errors = Array.from(document.querySelectorAll('.text-rose-400')).map(e => e.textContent.trim());
          return { modalOpen: !!modal, btns, errors };
        })()
      `);
      console.log('  [openCheckoutModal status]:', JSON.stringify(status));
    }

    // ==========================================
    // 1. Desktop Step 1: Tier Selector & Recommendation Badge (1280x800)
    // ==========================================
    console.log('\n--- 1. Desktop Step 1: Tier Selector & Recommended Certified Mail ---');
    await setViewport(1280, 800);
    const depositUrl = `http://127.0.0.1:${PORT}/notices/security-deposit-return-demand-letter`;
    await cdp.send('Page.navigate', { url: depositUrl });
    await sleep(2000);

    await fillDepositNoticeForm();
    await openCheckoutModal();
    await captureScreenshot('01-desktop-checkout-step1-tier-selector.png');

    // ==========================================
    // 2. Desktop Step 1: Select First-Class Mail ($12.95)
    // ==========================================
    console.log('\n--- 2. Desktop Step 1: Select Standard First-Class Mail ($12.95) ---');
    await clickElement(`'#tier-radio-first_class'`);
    await sleep(500);
    await captureScreenshot('02-desktop-checkout-tier-change-first-class.png');

    // ==========================================
    // 3. Desktop Error Preservation on Missing/Invalid Email
    // ==========================================
    console.log('\n--- 3. Desktop Error Preservation on Missing/Invalid Email ---');
    await evaluate(`
      (() => {
        const emailInput = document.querySelector('#checkout-email');
        if (emailInput) {
          const proto = window.HTMLInputElement.prototype;
          const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
          if (nativeSetter) nativeSetter.call(emailInput, 'invalid-email');
          else emailInput.value = 'invalid-email';
          emailInput.dispatchEvent(new Event('input', { bubbles: true }));
          emailInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
      })()
    `);
    await sleep(300);
    await clickElement(`() => document.querySelector('form button[type="submit"]')`);
    await sleep(600);
    await captureScreenshot('03-desktop-checkout-error-preservation.png');

    // ==========================================
    // 4. Desktop Step 2: Payment Confirmation Form
    // ==========================================
    console.log('\n--- 4. Desktop Step 2: Payment Confirmation Form ---');
    // Switch back to Certified Mail ($19.95) and enter valid email
    await clickElement(`'#tier-radio-certified'`);
    await sleep(300);
    await evaluate(`
      (() => {
        const emailInput = document.querySelector('#checkout-email');
        if (emailInput) {
          const proto = window.HTMLInputElement.prototype;
          const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
          if (nativeSetter) nativeSetter.call(emailInput, 'alex.rivera@example.com');
          else emailInput.value = 'alex.rivera@example.com';
          emailInput.dispatchEvent(new Event('input', { bubbles: true }));
          emailInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
      })()
    `);
    await sleep(300);
    await clickElement(`() => document.querySelector('form button[type="submit"]')`);
    await sleep(2000);
    await captureScreenshot('04-desktop-checkout-step2-payment-form.png');

    // ==========================================
    // 5. Desktop Step 3: Truthful Post-Payment Confirmation
    // ==========================================
    console.log('\n--- 5. Desktop Step 3: Truthful Post-Payment Confirmation ---');
    await clickElement(`() => document.querySelector('form button[type="submit"]')`);
    await sleep(2000);
    await captureScreenshot('05-desktop-checkout-step3-truthful-confirmation.png');

    // ==========================================
    // 6. Mobile Step 1 Viewport (390x844)
    // ==========================================
    console.log('\n--- 6. Mobile Step 1 Viewport (390x844) ---');
    await setViewport(390, 844);
    const disputeUrl = `http://127.0.0.1:${PORT}/notices/fcra-credit-bureau-written-dispute-letter?recipientId=cra_eqf`;
    await cdp.send('Page.navigate', { url: disputeUrl });
    await sleep(2000);

    // Pre-fill bureau dispute details on mobile
    const mobileFillLog = await evaluate(`
      (() => {
        const setVal = (selector, val) => {
          let el = document.querySelector(selector);
          if (!el) return { success: false, selector, error: 'not found' };
          if (el.tagName === 'DIV') {
            el = el.querySelector('input, select, textarea') || el;
          }
          if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
            const proto = el.tagName === 'INPUT' ? window.HTMLInputElement.prototype : window.HTMLTextAreaElement.prototype;
            const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
            if (nativeSetter) nativeSetter.call(el, val);
            else el.value = val;
          } else if (el.tagName === 'SELECT') {
            const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')?.set;
            if (nativeSetter) nativeSetter.call(el, val);
            else el.value = val;
          }
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          return { success: true, selector, val: el.value };
        };

        const log = [];
        log.push(setVal('[data-field-key="senderFullName"]', 'Jane Doe'));
        log.push(setVal('[data-field-key="senderAddressLine1"]', '123 Main St Apt 4B'));
        log.push(setVal('[data-field-key="senderCity"]', 'Los Angeles'));
        log.push(setVal('[data-field-key="senderState"]', 'CA'));
        log.push(setVal('[data-field-key="senderZip"]', '90001'));

        log.push(setVal('[data-field-key="bureauEntityId"]', 'cra_eqf'));
        log.push(setVal('[data-field-key="senderDob"]', '1985-06-15'));
        log.push(setVal('[data-field-key="ssnLast4"]', '4321'));
        log.push(setVal('[data-field-key="furnisherName"]', 'Acme Financial Services'));
        log.push(setVal('[data-field-key="partialAccountNumber"]', '4012-XXXX-XXXX-5678'));
        log.push(setVal('[data-field-key="disputeReason"]', 'Balance or past-due amount is inaccurately reported'));
        log.push(setVal('[data-field-key="factualExplanation"]', 'The reported balance includes erroneous late fees that were waived.'));

        // Scroll signature block into view
        const sigSection = document.getElementById('signature-adoption-control');
        if (sigSection) {
          sigSection.scrollIntoView({ behavior: 'instant', block: 'center' });
        }

        log.push(setVal('[data-testid="signature-input"]', 'Jane Doe'));
        const check = document.querySelector('#signature-adoption-control input[type="checkbox"]');
        if (check && !check.checked) check.click();

        return log;
      })()
    `);
    console.log('  [mobileFillLog]:', JSON.stringify(mobileFillLog));
    await sleep(600);

    // Adopt signature button
    await clickElement(`() => Array.from(document.querySelectorAll('#signature-adoption-control button')).find(b => b.textContent.toLowerCase().includes('adopt'))`);
    await sleep(600);

    // Open mobile checkout
    await clickElement(`() => Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Choose delivery and pay') || b.textContent.includes('delivery & payment') || b.textContent.includes('Proceed to delivery'))`);
    await sleep(800);
    await captureScreenshot('06-mobile-checkout-step1-tier-selector.png');

    // ==========================================
    // 7. Mobile Step 2 Viewport (390x844)
    // ==========================================
    console.log('\n--- 7. Mobile Step 2 Viewport (390x844) ---');
    await evaluate(`
      (() => {
        const emailInput = document.querySelector('#checkout-email');
        if (emailInput) {
          const proto = window.HTMLInputElement.prototype;
          const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
          if (nativeSetter) nativeSetter.call(emailInput, 'jane.doe@example.com');
          else emailInput.value = 'jane.doe@example.com';
          emailInput.dispatchEvent(new Event('input', { bubbles: true }));
          emailInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
      })()
    `);
    await sleep(300);
    await clickElement(`() => document.querySelector('form button[type="submit"]')`);
    await sleep(2000);
    await captureScreenshot('07-mobile-checkout-step2-payment-form.png');

    console.log('\n✅ All 7 S5 visual verification screenshots captured successfully!');
  } finally {
    await cleanup();
  }
}

runVisualVerification().catch((err) => {
  console.error('[Visual Verification Error]', err);
  process.exit(1);
});
