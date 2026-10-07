import {NextResponse,type NextRequest} from 'next/server'
export function proxy(request:NextRequest){
 const host=request.headers.get('host')?.toLowerCase();if((host==='cloud.axxes.app'||host==='cloud.v2.axxes.app')&&request.nextUrl.pathname==='/'){const url=request.nextUrl.clone();url.pathname='/cloud';return NextResponse.rewrite(url)}return NextResponse.next()
}
export const config={matcher:['/']}
