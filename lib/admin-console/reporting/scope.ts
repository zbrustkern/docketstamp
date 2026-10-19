import type { ReportScope } from './compute';
function parts(at: number, timezone: string) {
  return Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(at).filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));
}
function midnight(calendar: Date, timezone: string) {
  const target=Date.UTC(calendar.getUTCFullYear(),calendar.getUTCMonth(),calendar.getUTCDate());
  let estimate=target;
  for(let i=0;i<4;i++){
    const p=parts(estimate,timezone);
    const displayed=Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second);
    const next=estimate+(target-displayed);
    if(next===estimate)break;
    estimate=next;
  }
  return new Date(estimate).toISOString();
}
export function calendarScope(environment: 'local'|'staging'|'production', now=new Date(), timezone='America/Chicago'): ReportScope {
  const p=parts(now.getTime(),timezone);
  const endDate=new Date(Date.UTC(p.year,p.month-1,p.day+1));
  const startDate=new Date(Date.UTC(p.year,p.month-1,p.day-6));
  return { startUtc:midnight(startDate,timezone),endUtcExclusive:midnight(endDate,timezone),displayTimezone:timezone,environment,classification:'customer',reportVersion:1,cohortPolicyVersion:1 };
}
