import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('/Users/zeke/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out=path.resolve('.delivery/runs/2026-10-20-demand-copy/evidence/ui');
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const results=[];
const errors=[];
try {
 for(const viewport of [{width:1280,height:720},{width:390,height:844}]){
  const page=await browser.newPage({viewport});
  page.setDefaultTimeout(15000);
  page.on('pageerror', error => {errors.push(error.message);console.log('Page error: '+error.message);});
  console.log('Checking viewport '+viewport.width);
  await page.route('**/*',route=>{
   const url=new URL(route.request().url());
   if(url.hostname!=='127.0.0.1'||url.pathname.startsWith('/api/'))return route.abort();
   return route.continue();
  });
  await page.goto('http://127.0.0.1:3111/',{waitUntil:'networkidle',timeout:120000});
  await page.getByRole('heading',{name:'Make it formal. We’ll print and mail it.'}).waitFor();
  const choice=page.getByRole('option').filter({hasText:'Demand your security deposit back'});
  await choice.click();
  await page.waitForFunction(()=>document.querySelector('[role=option][aria-selected=true]'));
  console.log('Selected deposit');
  await page.screenshot({path:path.join(out,`home-${viewport.width}.png`)});
  results.push(await page.evaluate(()=>{
   const buttons=[...document.querySelectorAll('button')];const next=buttons.find(b=>b.textContent.trim()==='Continue');const r=next?.getBoundingClientRect();
   return {surface:'home',width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,headline:document.querySelector('h1')?.textContent,continueVisible:!!r&&r.top>=0&&r.bottom<=innerHeight};
  }));
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.waitForURL('**/notices/security-deposit-return-demand-letter**');
  await page.getByText('Demand your security deposit back',{exact:true}).first().waitFor();
  await page.screenshot({path:path.join(out,`workspace-${viewport.width}.png`)});
  if(viewport.width<1024){
   await page.getByRole('button',{name:'View letter →'}).click();
   await page.getByText('FORMAL DEMAND FOR RETURN OF SECURITY DEPOSIT',{exact:true}).waitFor();
   await page.screenshot({path:path.join(out,`preview-${viewport.width}.png`)});
  }
  results.push(await page.evaluate(()=>({surface:'workspace',width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,title:document.title,hasDemandHeading:document.body.innerText.includes('FORMAL DEMAND FOR RETURN OF SECURITY DEPOSIT')})));
  await page.close();
 }
}finally{fs.writeFileSync(path.join(out,'ui-errors.json'),JSON.stringify(errors,null,2)+'\n');await browser.close();}
fs.writeFileSync(path.join(out,'ui-results.json'),JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify(results,null,2));
if(results.some(r=>r.overflow||(r.surface==='home'&&!r.continueVisible)||(r.surface==='workspace'&&(!r.hasDemandHeading||r.title.split('DocketStamp').length!==2))))process.exitCode=1;
