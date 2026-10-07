import {cookies} from 'next/headers';import {NextResponse} from 'next/server'
import {SESSION_COOKIE,revokeSession} from '@/lib/cloud/session'
import {optionsFromEnvironment} from '@/lib/cloud/oidc'
export async function POST(request:Request){const options=optionsFromEnvironment();if(request.headers.get('origin')!==options.origin)return NextResponse.json({error:'forbidden'},{status:403});const token=(await cookies()).get(SESSION_COOKIE)?.value;if(token)await revokeSession(token);const res=NextResponse.json({ok:true});res.cookies.set(SESSION_COOKIE,'',{secure:true,httpOnly:true,sameSite:'lax',path:'/',maxAge:0});return res}
