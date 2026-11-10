import test from 'node:test';
import assert from 'node:assert/strict';
import { observeAcquisition, sanitizeAcquisition, sanitizeRawClicks, PILOT_CAMPAIGN, CLICK_EVIDENCE_MS, FIRST_TOUCH_MS } from '../lib/acquisition';
import { captureCurrentAcquisition, readCurrentAcquisition, CURRENT_KEY } from '../lib/acquisition-client';
import { getBusinessSessionId } from '../lib/admin-console/measurement/session';

class Storage {
  data = new Map<string,string>();
  getItem(k:string) { return this.data.get(k) ?? null; }
  setItem(k:string,v:string) { this.data.set(k,v); }
  removeItem(k:string) { this.data.delete(k); }
}
const paid = `?utm_source=google&utm_medium=cpc&utm_campaign=${PILOT_CAMPAIGN}&utm_content=831080861436&gclid=synthetic_click_01`;
const now = Date.now();
const observe = (search:string, extra:Record<string,unknown>={}) => observeAcquisition({ search, origin:'https://staging.docketstamp.com',sessionId:'session_test',surface:'notice_workspace',now,touchId:'touch_test',...extra } as any);

test('pilot evidence is bounded, malformed parameters do not become direct or a guessed campaign', () => {
  const {touch,rawClicks} = observe(paid);
  assert.equal(touch?.campaignId,PILOT_CAMPAIGN);
  assert.equal(touch?.platformCampaignId,'24457739017');
  assert.equal(touch?.creativeId,'831080861436');
  assert.equal(touch?.clicks.length,1);
  assert.ok(!JSON.stringify(touch).includes('synthetic_click_01'));
  assert.equal(rawClicks.length,1);
  for (const query of ['?gclid=synthetic_click_01','?utm_source=google&utm_medium=cpc']) {
    const missing=observe(query).touch!;
    assert.equal(missing.source,'google'); assert.equal(missing.campaignId,undefined); assert.ok(missing.issues.includes('campaign_missing'));
  }
  for (const query of [`${paid}&utm_campaign=evil`, '?utm_source=user%40example.com&utm_medium=cpc', '?utm_source=google&utm_medium=cpc&utm_campaign=%00', '?utm_source=google&utm_medium=cpc&utm_campaign='+ 'a'.repeat(300)]) {
    const invalid=observe(query).touch!;
    assert.equal(invalid.source,'unknown'); assert.equal(invalid.campaignId,undefined);
  }
  const ignored=observe(paid+'&field.factualSummary=private&email=private@example.com&stage=secret&utm_term=private+query');
  assert.ok(!JSON.stringify(ignored).includes('private'));
  assert.equal(observe('',{referrer:'https://evilgoogle.com/search?q=private'}).touch?.source,'referral');
  assert.equal(observe('',{referrer:'https://staging.docketstamp.com/pricing'}).touch,null);
});

test('server sanitizer binds session, strips extra fields, expires evidence and rejects unbound raw clicks', () => {
  const {touch,rawClicks}=observe(paid);
  const raw={schemaVersion:2, firstObserved:touch, currentSession:{...touch,email:'private'}, persistence:'persistent',missingReasons:[],customerEmail:'private'};
  const good=sanitizeAcquisition(raw,'session_test',now);
  assert.ok(!JSON.stringify(good).includes('private'));
  assert.equal(sanitizeRawClicks(rawClicks,good,now).length,1);
  assert.equal(sanitizeRawClicks([{...rawClicks[0],value:'forged'}],good,now).length,0);
  assert.equal(sanitizeAcquisition(raw,'another_session',now).currentSession,null);
  assert.equal(sanitizeAcquisition(raw,'session_test',now+CLICK_EVIDENCE_MS+1).currentSession?.clicks.length,0);
  assert.equal(sanitizeAcquisition(raw,'session_test',now+FIRST_TOUCH_MS+1).firstObserved,null);
});

test('browser first/current sessions survive navigation, refresh, denied storage and paid/direct returns', () => {
  const descriptors = new Map(['window','document','navigator','sessionStorage','localStorage','performance'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
  const local=new Storage(), session=new Storage();
  const put=(key:string,value:unknown)=>Object.defineProperty(globalThis,key,{configurable:true,value});
  function documentEntry(search:string, type='navigate', denied=false) {
    put('sessionStorage',denied?{getItem(){throw Error('denied')},setItem(){throw Error('denied')}}:session);
    put('localStorage',denied?{getItem(){throw Error('denied')},setItem(){throw Error('denied')}}:local);
    put('document',{referrer:''}); put('navigator',{globalPrivacyControl:false});
    put('performance',{getEntriesByType:()=>[{type}]});
    put('window',{location:{pathname:'/notices/security-deposit-return-demand-letter',search,origin:'https://staging.docketstamp.com'}});
  }
  try {
    documentEntry('');
    const first=captureCurrentAcquisition(); assert.equal(first.snapshot.currentSession?.source,'direct');
    const directSession=getBusinessSessionId();
    documentEntry(paid);
    const second=captureCurrentAcquisition();
    assert.equal(second.snapshot.firstObserved?.source,'direct'); assert.equal(second.snapshot.currentSession?.campaignId,PILOT_CAMPAIGN);
    assert.notEqual(getBusinessSessionId(),directSession);
    const paidSession=getBusinessSessionId(), touch=second.snapshot.currentSession?.touchId;
    documentEntry(paid,'reload');
    assert.equal(captureCurrentAcquisition().snapshot.currentSession?.touchId,touch);
    assert.equal(getBusinessSessionId(),paidSession);
    (window as any).location.search='';
    assert.equal(captureCurrentAcquisition().snapshot.currentSession?.touchId,touch,'SPA navigation retains acquisition');
    // A fresh direct document arrival resets current acquisition; the first observation remains.
    documentEntry('');
    assert.equal(captureCurrentAcquisition().snapshot.currentSession?.source,'direct');
    assert.equal(readCurrentAcquisition().snapshot.firstObserved?.source,'direct');
    local.data.clear(); session.data.clear();
    documentEntry(paid); captureCurrentAcquisition();
    documentEntry('');
    const returned=captureCurrentAcquisition();
    assert.equal(returned.snapshot.firstObserved?.source,'google'); assert.equal(returned.snapshot.currentSession?.source,'direct');
    documentEntry(paid,'navigate',true);
    const memory=captureCurrentAcquisition();
    assert.equal(memory.snapshot.persistence,'memory_only'); assert.equal(memory.snapshot.currentSession?.campaignId,PILOT_CAMPAIGN);
    assert.equal(readCurrentAcquisition().snapshot.currentSession?.touchId,memory.snapshot.currentSession?.touchId);
    documentEntry(paid); session.setItem(CURRENT_KEY,'not json');
    assert.doesNotThrow(()=>captureCurrentAcquisition());
    documentEntry(paid); session.setItem(CURRENT_KEY,JSON.stringify({rawClicks:{invalid:true}}));
    assert.doesNotThrow(()=>captureCurrentAcquisition());
    put('navigator',{globalPrivacyControl:true});
    assert.deepEqual(captureCurrentAcquisition().rawClicks,[]);
    assert.deepEqual(readCurrentAcquisition().snapshot.currentSession?.clicks,[]);
  } finally {
    for(const [k,d] of descriptors) { if(d)Object.defineProperty(globalThis,k,d);else delete (globalThis as any)[k]; }
  }
});
