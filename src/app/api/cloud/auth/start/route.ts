import {NextResponse} from 'next/server'
import {authorizationUrl,createAuthTransaction,optionsFromEnvironment} from '@/lib/cloud/oidc'
import {persistAuthTransaction,TRANSACTION_COOKIE} from '@/lib/cloud/session'
export async function GET(request:Request){try{const options=optionsFromEnvironment();const tx=createAuthTransaction(new URL(request.url).searchParams.get('next')??'/cloud');await persistAuthTransaction(tx);const res=NextResponse.redirect(authorizationUrl(options,tx));res.cookies.set(TRANSACTION_COOKIE,tx.state,{secure:true,httpOnly:true,sameSite:'lax',path:'/',maxAge:300});return res}catch{return NextResponse.json({error:'identity_unavailable'},{status:503})}}
