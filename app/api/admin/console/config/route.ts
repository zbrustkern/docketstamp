import {NextRequest,NextResponse} from 'next/server';
import {requireCapability,AdminAccessError,serverEnvironment} from '@/lib/admin-console/commands/access';
import {getAdminSessionSigningKey} from '@/lib/admin-auth';
import {normalizeStripeSecretKey,resolvePaymentMode} from '@/lib/payment-mode';
import {getLobDispatchApiKey,getLobVerificationApiKey,resolveLobDispatchMode} from '@/src/lib/fulfillment/lob';

// Intentionally inspect compiled public configuration separately from runtime.
const compiledPublishableKey=process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY||'';
const kind=(key:string,prefix:string)=>key.startsWith(`${prefix}_test_`)?'test':key.startsWith(`${prefix}_live_`)?'live':'unconfigured';
export async function GET(req:NextRequest){
  try{
    requireCapability(req,'controls.manage');
    const key=normalizeStripeSecretKey(),runtimePk=Reflect.get(process.env,'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY')||'';
    let stripeMode:string='unconfigured';try{stripeMode=resolvePaymentMode();}catch{}
    const configured=(v:string|undefined)=>Boolean(v&&v.length>=12&&!/placeholder|replace_me/i.test(v));
    return NextResponse.json({
      authority:'configuration_only_not_provider_verification',checkedAt:new Date().toISOString(),
      environment:serverEnvironment(),projectId:process.env.FIREBASE_PROJECT_ID||process.env.GOOGLE_CLOUD_PROJECT||null,backendService:process.env.K_SERVICE||null,revision:process.env.K_REVISION||null,
      stripe:{secretKeyType:key.keyType,paymentMode:stripeMode,webhookSecretConfigured:configured(process.env.STRIPE_WEBHOOK_SECRET||process.env['stripe-webhook-secret']),accountIdConfigured:Boolean(process.env.STRIPE_ACCOUNT_ID),compiledPublishableKeyMode:kind(compiledPublishableKey,'pk'),runtimePublishableKeyMode:kind(runtimePk,'pk'),compiledMatchesRuntime:compiledPublishableKey===runtimePk},
      lob:{dispatchMode:resolveLobDispatchMode(),dedicatedDispatchKeyConfigured:Boolean(getLobDispatchApiKey()),dedicatedVerificationKeyConfigured:Boolean(getLobVerificationApiKey()),addressVerificationMode:process.env.LOB_ENV==='staging_mock_cass'?'deterministic_mock':'requires_live_probe',webhookSecretConfigured:configured(process.env.LOB_WEBHOOK_SECRET)},
      admin:{sessionSigningConfigured:Boolean(getAdminSessionSigningKey())},
      note:'No secret values are returned. Configuration presence does not prove provider connectivity, key validity, successful payment or mailing.',
    },{headers:{'Cache-Control':'private, no-store'}});
  }catch(error){return NextResponse.json({error:error instanceof AdminAccessError?error.code:'CONFIGURATION_UNAVAILABLE'},{status:error instanceof AdminAccessError?error.status:503});}
}
