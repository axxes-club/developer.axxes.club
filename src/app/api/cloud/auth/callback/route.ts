import {cookies} from 'next/headers';import {NextResponse} from 'next/server'
import {optionsFromEnvironment,statesMatch,exchangeCode} from '@/lib/cloud/oidc'
import {consumeAuthTransaction,createSession,SESSION_COOKIE,TRANSACTION_COOKIE} from '@/lib/cloud/session'
import {platformAccessAllowed} from '@/lib/platform-access'
export async function GET(request:Request){
 try{const options=optionsFromEnvironment();const url=new URL(request.url);const state=url.searchParams.get('state')??'';const cookie=(await cookies()).get(TRANSACTION_COOKIE)?.value??'';if(!statesMatch(state,cookie))throw Error('invalid state');const tx=await consumeAuthTransaction(state);const userId=await exchangeCode(url.searchParams.get('code')??'',tx,options);if(!await platformAccessAllowed(userId))throw Error('access denied');const token=await createSession(userId);const response=NextResponse.redirect(options.origin+tx.returnPath);response.cookies.set(SESSION_COOKIE,token,{secure:true,httpOnly:true,sameSite:'lax',path:'/',maxAge:28800});response.cookies.set(TRANSACTION_COOKIE,'',{secure:true,httpOnly:true,sameSite:'lax',path:'/',maxAge:0});return response}catch{return NextResponse.json({error:'identity_rejected'},{status:401})}
}
