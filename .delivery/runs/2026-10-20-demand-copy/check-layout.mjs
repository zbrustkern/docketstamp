import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { ALL_NOTICE_CARTRIDGES } from '../../../src/lib/docket/notices/index.ts';
import { STATE_STATUTES } from '../../../src/lib/docket/data/state-statutes.ts';
import { interpolateNotice } from '../../../src/lib/docket/renderer/interpolate.ts';
import { renderLobHtmlPayload } from '../../../src/lib/docket/renderer/lob-html-shell.ts';
const require = createRequire(import.meta.url);
const { chromium } = require('/Users/zeke/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const label = process.argv[2] || 'revised';
const out = path.resolve('.delivery/runs/2026-10-20-demand-copy/evidence', label);
fs.mkdirSync(out, { recursive: true });
const maxText = (length, prefix = 'Wide Worldwide') => (prefix + ' Worldwide Western Williams Washington'.repeat(30)).slice(0, length).trim();
function valuesFor(notice, variant = 'max') {
  const values = { senderFullName: maxText(70, 'Worldwide Williams'), recipientFormalName: maxText(80, 'Worldwide Management') };
  for (const field of notice.fields) {
    if (field.inputType === 'select') values[field.key] = [...field.options].sort((a,b) => b.value.length-a.value.length)[0].value;
    else if (field.inputType === 'date') values[field.key] = '2026-10-20';
    else if (field.inputType === 'currency') values[field.key] = '$999,999,999,999.99';
    else if (field.inputType === 'state_select') values[field.key] = 'CT';
    else if (field.key === 'ssnLast4') values[field.key] = '1234';
    else values[field.key] = maxText(field.maxLength || 60, /Address/.test(field.key) ? '123 Main Street' : 'Worldwide Williams');
    if (variant === 'unbroken' && ['text','textarea_short'].includes(field.inputType) && field.key !== 'ssnLast4') values[field.key] = 'W'.repeat(field.maxLength || 60);
    if (variant === 'linebreaks' && field.inputType === 'textarea_short') values[field.key] = ('W\n').repeat(Math.floor((field.maxLength || 200)/2));
  }
  return values;
}
const results=[];
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const page=await browser.newPage({viewport:{width:816,height:1056},deviceScaleFactor:1});
try {
  const cases=[];
  for(const notice of ALL_NOTICE_CARTRIDGES) {
    for(const tier of ['first_class','certified','certified_return_receipt']) cases.push({notice,tier,variant:'max'});
    cases.push({notice,tier:notice.recommendedTier,variant:'unbroken'});
    if(notice.fields.some(f=>f.inputType==='textarea_short')) cases.push({notice,tier:notice.recommendedTier,variant:'linebreaks'});
  }
  const deposit=ALL_NOTICE_CARTRIDGES.find(n=>n.slug==='security-deposit-accounting-request');
  for(const state of Object.keys(STATE_STATUTES)) cases.push({notice:deposit,tier:'certified_return_receipt',variant:'max',state});
  for(const {notice,tier,variant,state} of cases){
    const values=valuesFor(notice,variant);
    if(state)values.propertyState=state;
    const doc=interpolateNotice({notice,userValues:values,docketId:'DS-2026-LAYOUT',serviceLevel:tier,executionDate:'October 20, 2026',senderAddress:{name:values.senderFullName,addressLine1:maxText(64,'123 Main Street'),city:maxText(40,'Washington'),state:'TX',zip:'78701-1234'},recipientAddress:{name:values.recipientFormalName,addressLine1:'456 Main Street',city:'Austin',state:'TX',zip:'78702'}});
    const parity=doc.paragraphs.every((tokens,i)=>tokens.map(t=>t.content).join('')===doc.rawParagraphs[i]);
    const html=renderLobHtmlPayload(doc);
    await page.setContent(html,{waitUntil:'load'});
    const metrics=await page.evaluate(()=>{
      const rect=sel=>{const r=document.querySelector(sel).getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:r.height};};
      const body=rect('.letter-body-container'),footer=rect('.compliance-footer'),signature=rect('.signature-block'),stamp=rect('.docket-stamp-box');
      let textRight=0,textBottom=0,textLeft=816;
      const walker=document.createTreeWalker(document.querySelector('.letter-body-container'),NodeFilter.SHOW_TEXT);
      while(walker.nextNode()){const node=walker.currentNode;if(!node.textContent.trim())continue;const range=document.createRange();range.selectNodeContents(node);for(const r of range.getClientRects()){textRight=Math.max(textRight,r.right);textLeft=Math.min(textLeft,r.left);textBottom=Math.max(textBottom,r.bottom);}}
      return {body,footer,signature,stamp,textRight,textLeft,textBottom,overflow:document.documentElement.scrollWidth>816};
    });
    const fits=metrics.textBottom<=metrics.body.bottom+1 && metrics.textRight<=metrics.body.right+1 && metrics.textLeft>=metrics.body.left-1 && metrics.signature.bottom<=metrics.footer.top && metrics.stamp.top>=176.6;
    const result={slug:notice.slug,tier,variant,state:state||null,parity,fits,...metrics};results.push(result);
    if((!state&&tier===notice.recommendedTier&&variant==='max')||!fits){
      const name=`${notice.slug}-${variant}${state?'-'+state:''}`;
      fs.writeFileSync(path.join(out,name+'.html'),html);
      await page.screenshot({path:path.join(out,name+'.png'),fullPage:false});
    }
  }
} finally {await browser.close();}
fs.writeFileSync(path.join(out,'layout-results.json'),JSON.stringify(results,null,2)+'\n');
const failures=results.filter(r=>!r.fits||!r.parity);
console.log(JSON.stringify({label,cases:results.length,passing:results.length-failures.length,failures:failures.slice(0,12).map(r=>({slug:r.slug,tier:r.tier,state:r.state,variant:r.variant,parity:r.parity,bottom:r.textBottom,limit:r.body.bottom,right:r.textRight,rightLimit:r.body.right}))},null,2));
if(failures.length)process.exitCode=1;
