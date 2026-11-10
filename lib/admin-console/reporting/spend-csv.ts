import { getRegisteredCampaign } from '../advertising/campaigns';
import { localMidnightUtc } from './scope';

export type SpendCsvRow = {
  kind:'spend'; campaignKey:string; amountMinor:number; currency:'USD'; effectiveAt:string;
  sourceRef:string; authority:'actual'; coverage:'complete'|'partial'; coverageStartUtc:string; coverageEndUtc:string;
  impressions:number; clicks:number; revision:number;
};
export type OrderCostCsvRow = {kind:'supplier'|'processor';orderId:string;amountMinor:number;currency:'USD';effectiveAt:string;sourceRef:string;authority:'actual'|'estimated';coverage:'complete'|'partial';revision:number};
export type ReviewedCostCsvRow = SpendCsvRow | OrderCostCsvRow;
const formulaPrefix = /^[\s\u0000-\u001f]*[=+@-]/;
function splitLine(line:string):string[] {
  const cells:string[]=[];let cell='',quoted=false;
  for(let i=0;i<line.length;i++){
    const c=line[i];
    if(c==='"'&&quoted&&line[i+1]==='"'){cell+='"';i++;}
    else if(c==='"')quoted=!quoted;
    else if(c===','&&!quoted){cells.push(cell.trim());cell='';}
    else cell+=c;
  }
  if(quoted)throw Error('CSV_UNCLOSED_QUOTE');
  cells.push(cell.trim());return cells;
}
export function parseSpendCsv(csv:string,mode:'spend'|'supplier'|'processor',campaignKey:string,sourceRef:string):ReviewedCostCsvRow[]{
  const campaign=mode==='spend'?getRegisteredCampaign(campaignKey):null;
  if(mode==='spend'&&!campaign)throw Error('CAMPAIGN_NOT_REGISTERED');
  if(mode==='spend'&&(!/^[A-Za-z0-9_.:-]{1,160}$/.test(sourceRef)||formulaPrefix.test(sourceRef)))throw Error('INVALID_SOURCE_REFERENCE');
  if(csv.length>500_000)throw Error('CSV_TOO_LARGE');
  const lines=csv.replace(/^\uFEFF/,'').split(/\r?\n/).filter(line=>line.trim());
  if(lines.length<2||lines.length>1001)throw Error('CSV_ROW_COUNT_INVALID');
  const headers=splitLine(lines[0]).map(v=>v.toLowerCase());
  const required=mode==='spend'?['campaign_id','date','impressions','clicks','spend','currency']:['order_id','amount','currency','effective_at','source_ref','authority','coverage'];
  const allowed=mode==='spend'?[...required,'revision','coverage','coverage_end_utc']: [...required,'revision'];
  if(new Set(headers).size!==headers.length||required.some(h=>!headers.includes(h))||headers.some(h=>!allowed.includes(h)))throw Error('CSV_HEADERS_INVALID');
  const indexes=Object.fromEntries(headers.map((name,i)=>[name,i]));
  const results=lines.slice(1).map((line,rowIndex)=>{
    const values=splitLine(line);
    if(values.length!==headers.length||values.some(v=>formulaPrefix.test(v)))throw Error(`CSV_ROW_INVALID:${rowIndex+2}`);
    if(mode!=='spend'){
      const currency=values[indexes.currency].toUpperCase();if(currency!=='USD')throw Error(`CURRENCY_UNSUPPORTED:${rowIndex+2}`);
      const amount=values[indexes.amount];if(!/^\$?\d+(?:\.\d{1,2})?$/.test(amount))throw Error(`CSV_AMOUNT_INVALID:${rowIndex+2}`);
      const amountMinor=Math.round(Number(amount.replace('$',''))*100);
      if(!Number.isSafeInteger(amountMinor))throw Error(`CSV_AMOUNT_INVALID:${rowIndex+2}`);
      const orderId=values[indexes.order_id],source=values[indexes.source_ref],effectiveAt=values[indexes.effective_at];
      if(!/^[A-Za-z0-9_-]{1,128}$/.test(orderId)||! /^[A-Za-z0-9_.:-]{1,160}$/.test(source))throw Error(`CSV_ROW_INVALID:${rowIndex+2}`);
      if(!Number.isSafeInteger(Date.parse(effectiveAt))||new Date(effectiveAt).toISOString()!==effectiveAt)throw Error(`CSV_EFFECTIVE_AT_INVALID:${rowIndex+2}`);
      const authority=values[indexes.authority],coverage=values[indexes.coverage];
      if(!['actual','estimated'].includes(authority)||!['complete','partial'].includes(coverage))throw Error(`CSV_ROW_INVALID:${rowIndex+2}`);
      const revision=headers.includes('revision')&&values[indexes.revision]?Number(values[indexes.revision]):1;
      if(!Number.isSafeInteger(revision)||revision<1||revision>1000)throw Error(`CSV_REVISION_INVALID:${rowIndex+2}`);
      return {kind:mode,orderId,amountMinor,currency:'USD' as const,effectiveAt,sourceRef:source,authority:authority as 'actual'|'estimated',coverage:coverage as 'complete'|'partial',revision};
    }
    if(values[indexes.campaign_id]!==campaign!.platformId)throw Error(`CAMPAIGN_ID_MISMATCH:${rowIndex+2}`);
    if(values[indexes.currency].toUpperCase()!==campaign!.currency)throw Error(`CURRENCY_UNSUPPORTED:${rowIndex+2}`);
    const date=values[indexes.date];
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||new Date(`${date}T00:00:00Z`).toISOString().slice(0,10)!==date)throw Error(`CSV_DATE_INVALID:${rowIndex+2}`);
    const count=(name:string)=>{const raw=values[indexes[name]];if(!/^\d+$/.test(raw))throw Error(`CSV_${name.toUpperCase()}_INVALID:${rowIndex+2}`);const n=Number(raw);if(!Number.isSafeInteger(n))throw Error(`CSV_${name.toUpperCase()}_INVALID:${rowIndex+2}`);return n;};
    const spend=values[indexes.spend];
    if(!/^\$?\d+(?:\.\d{1,2})?$/.test(spend))throw Error(`CSV_SPEND_INVALID:${rowIndex+2}`);
    const amountMinor=Math.round(Number(spend.replace('$',''))*100);
    if(!Number.isSafeInteger(amountMinor))throw Error(`CSV_SPEND_INVALID:${rowIndex+2}`);
    const impressions=count('impressions'),clicks=count('clicks');
    if(clicks>impressions)throw Error(`CSV_CLICKS_EXCEED_IMPRESSIONS:${rowIndex+2}`);
    const start=localMidnightUtc(date,campaign!.timezone);
    const [y,m,d]=date.split('-').map(Number);
    const nextDate=new Date(Date.UTC(y,m-1,d+1)).toISOString().slice(0,10);
    let end=localMidnightUtc(nextDate,campaign!.timezone);
    const coverage=headers.includes('coverage')&&values[indexes.coverage]?values[indexes.coverage]:'complete';
    if(!['complete','partial'].includes(coverage))throw Error(`CSV_COVERAGE_INVALID:${rowIndex+2}`);
    if(coverage==='partial'){
      const specified=headers.includes('coverage_end_utc')?values[indexes.coverage_end_utc]:'';
      end=specified || new Date().toISOString();
      if(!Number.isFinite(Date.parse(end))||new Date(end).toISOString()!==end||Date.parse(end)<=Date.parse(start)||Date.parse(end)>Date.now()||Date.parse(end)>Date.parse(localMidnightUtc(nextDate,campaign!.timezone)))throw Error(`CSV_COVERAGE_END_INVALID:${rowIndex+2}`);
    } else if(Date.parse(end)>Date.now())throw Error(`CSV_DAY_NOT_COMPLETE:${rowIndex+2}`);
    const revision=headers.includes('revision')?(values[indexes.revision]===''?1:Number(values[indexes.revision])):1;
    if(!Number.isSafeInteger(revision)||revision<1||revision>1000)throw Error(`CSV_REVISION_INVALID:${rowIndex+2}`);
    return {kind:'spend' as const,campaignKey,amountMinor,currency:campaign!.currency,effectiveAt:start,sourceRef,authority:'actual' as const,coverage:coverage as 'complete'|'partial',coverageStartUtc:start,coverageEndUtc:end,impressions,clicks,revision};
  });
  const dates=new Set<string>();
  if(mode==='spend')for(const row of results as SpendCsvRow[]){if(dates.has(row.coverageStartUtc))throw Error('CSV_DUPLICATE_CAMPAIGN_DAY');dates.add(row.coverageStartUtc);}
  return results;
}
