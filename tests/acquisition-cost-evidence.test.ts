import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { CostEvidenceSchema } from '../lib/admin-console/reporting/cost-evidence';
import { PILOT_KEY } from '../lib/acquisition';
import { POST } from '../app/api/admin/console/cost-evidence/route';
import { generateAdminSessionToken } from '../lib/admin-auth';
import { firestoreDb } from '../lib/firebase-admin';
const record={kind:'spend',campaignKey:PILOT_KEY,amountMinor:300,currency:'USD',effectiveAt:'2026-11-01T06:00:00.000Z',coverageStartUtc:'2026-11-01T06:00:00.000Z',coverageEndUtc:'2026-11-02T06:00:00.000Z',sourceRef:'reviewed_export_fixture',authority:'actual',coverage:'complete'};
test('cost evidence refuses private data and incomplete coverage contracts',()=>{
  assert.ok(CostEvidenceSchema.safeParse(record).success);
  assert.equal(CostEvidenceSchema.safeParse({...record,email:'private@example.com'}).success,false);
  assert.equal(CostEvidenceSchema.safeParse({...record,sourceRef:'https://private.example/letter'}).success,false);
  assert.equal(CostEvidenceSchema.safeParse({...record,coverageEndUtc:undefined}).success,false);
});
test('reviewed cost import requires admin origin, deduplicates and refuses conflicting amounts',async()=>{
  process.env.ADMIN_SESSION_SIGNING_KEY='offline_attribution_admin_signing_key_123456789';
  process.env.NEXT_PUBLIC_APP_URL='http://localhost:3000';
  const token=generateAdminSessionToken();
  const request=(records:unknown[],requestId:string,authenticated=true,origin=true)=>new NextRequest('http://localhost:3000/api/admin/console/cost-evidence',{method:'POST',headers:{'Content-Type':'application/json',...(authenticated?{Cookie:`docketstamp_admin_session=${token}`} : {}),...(origin?{Origin:'http://localhost:3000'}:{})},body:JSON.stringify({records,requestId,reason:'Reviewed offline provider evidence'})});
  assert.equal((await POST(request([record],'request_no_auth',false))).status,401);
  assert.equal((await POST(request([record],'request_no_origin',true,false))).status,403);
  assert.equal((await POST(request([record],'request_valid_1'))).status,200);
  assert.equal((await POST(request([record],'request_valid_2'))).status,200);
  assert.equal((await firestoreDb.collection('cost_records_v1').get()).size,1);
  assert.equal((await POST(request([{...record,amountMinor:500}],'request_conflict'))).status,400);
  assert.equal((await POST(request([{...record,amountMinor:500}],'request_valid_1'))).status,409);
});
