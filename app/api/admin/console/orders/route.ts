import {NextRequest,NextResponse} from 'next/server';
import {firestoreDb} from '@/lib/firebase-admin';
import {requireCapability,AdminAccessError,serverEnvironment} from '@/lib/admin-console/commands/access';
export async function GET(req:NextRequest){
  try{
    requireCapability(req,'evidence.private');
    const params=req.nextUrl.searchParams,environment=serverEnvironment(),id=params.get('id'),cursor=params.get('cursor'),status=params.get('status');
    if(id&&!/^[A-Za-z0-9_:-]{1,128}$/.test(id))throw new AdminAccessError(400,'ORDER_ID_INVALID');
    if(cursor&&!/^[A-Za-z0-9_:-]{1,128}$/.test(cursor))throw new AdminAccessError(400,'CURSOR_INVALID');
    let query=firestoreDb.collection('orders').where('environment','==',environment).orderBy('id').limit(51);
    if(id)query=firestoreDb.collection('orders').where('environment','==',environment).where('id','==',id).orderBy('id').limit(51);
    if(status)query=query.where('status','==',status);
    if(cursor)query=query.startAfter(cursor);
    const snap=await query.get(),rows=snap.docs.slice(0,50).map(doc=>{
      const o=doc.data();return {id:doc.id,docketId:o.docketId,noticeId:o.noticeId||o.noticeType,status:o.status,tier:o.serviceLevel,amountMinor:o.finalAmountInCents??o.amountInCents,paymentMode:o.paymentMode,paymentVerified:Boolean(o.paymentFactId),freeAuthorization:Boolean(o.freeAuthorizationId),updatedAt:o.updatedAt,postalMode:o.postalMode||null,createdAt:o.createdAt};
    });
    return NextResponse.json({environment,rows,nextCursor:snap.size>50?rows.at(-1)?.id:null,scope:'Environment-classified orders; legacy records without environment remain in legacy tools',asOf:new Date().toISOString()},{headers:{'Cache-Control':'private, no-store'}});
  }catch(error){return NextResponse.json({error:error instanceof AdminAccessError?error.code:'ORDERS_UNAVAILABLE'},{status:error instanceof AdminAccessError?error.status:503});}
}
