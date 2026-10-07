import {createHash,randomBytes,timingSafeEqual} from 'node:crypto'
import {jwtVerify} from 'jose'
import {CloudError} from './types'
import {readBytes} from './http'
export type OidcOptions={issuer:string;clientId:string;clientSecret:string;origin:string}
export type AuthTransaction={state:string;nonce:string;verifier:string;returnPath:string}
import {CLOUD_ORIGINS} from './origins'
export {CLOUD_ORIGINS} from './origins'
export const hashToken=(value:string)=>createHash('sha256').update(value).digest('hex')
export function safeReturnPath(value:string){return /^\/cloud(?:\/[A-Za-z0-9/_-]*)?$/.test(value)?value:'/cloud'}
export function optionsFromEnvironment():OidcOptions{
 const options={issuer:'https://handshake.axxes.club',clientId:'cloud',clientSecret:process.env.CLOUD_OIDC_CLIENT_SECRET??'',origin:process.env.CLOUD_ORIGIN??'https://cloud.axxes.app'};validateOptions(options);return options
}
function validateOptions(options:OidcOptions){if(!CLOUD_ORIGINS.includes(options.origin as typeof CLOUD_ORIGINS[number])||options.issuer!=='https://handshake.axxes.club'||!options.clientId||options.clientSecret.length<32)throw new CloudError('identity_not_configured',503)}
export function createAuthTransaction(returnPath:string):AuthTransaction{return {state:randomBytes(32).toString('base64url'),nonce:randomBytes(32).toString('base64url'),verifier:randomBytes(32).toString('base64url'),returnPath:safeReturnPath(returnPath)}}
export function authorizationUrl(options:OidcOptions,tx:AuthTransaction){
 validateOptions(options);const url=new URL('/api/auth/oauth2/authorize',options.issuer)
 for(const [key,value] of Object.entries({client_id:options.clientId,redirect_uri:options.origin+'/api/cloud/auth/callback',response_type:'code',scope:'openid email profile',state:tx.state,nonce:tx.nonce,code_challenge:createHash('sha256').update(tx.verifier).digest('base64url'),code_challenge_method:'S256'}))url.searchParams.set(key,value)
 return url.href
}
export function statesMatch(value:string,cookie:string){if(!/^[A-Za-z0-9_-]{43}$/.test(value)||!/^[A-Za-z0-9_-]{43}$/.test(cookie))return false;return timingSafeEqual(Buffer.from(value),Buffer.from(cookie))}
/** Current Handshake provider signs with this client's secret. Algorithm is pinned;
 * no email fallback, unsigned token, caller-provided issuer or JWKS is accepted. */
export async function verifyIdentity(token:string,options:OidcOptions,nonce:string){
 validateOptions(options);const {payload}=await jwtVerify(token,new TextEncoder().encode(options.clientSecret),{algorithms:['HS256'],issuer:options.issuer,audience:options.clientId,requiredClaims:['iss','aud','sub','nonce','iat','exp'],maxTokenAge:'5m',clockTolerance:5})
 if(payload.nonce!==nonce||typeof payload.sub!=='string'||!payload.sub||payload.sub.length>256)throw new CloudError('identity_rejected',401)
 return payload.sub
}
export async function exchangeCode(code:string,tx:AuthTransaction,options:OidcOptions,fetcher:typeof fetch=fetch){
 validateOptions(options);if(!code||code.length>2048)throw new CloudError('identity_rejected',401)
 const res=await fetcher(options.issuer+'/api/auth/oauth2/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',code,client_id:options.clientId,client_secret:options.clientSecret,redirect_uri:options.origin+'/api/cloud/auth/callback',code_verifier:tx.verifier}),redirect:'error',signal:AbortSignal.timeout(15000),cache:'no-store'})
 if(!res.ok)throw new CloudError('identity_exchange_failed',401)
 const text=(await readBytes(res.body,65536)).toString('utf8')
 const result=JSON.parse(text);if(typeof result.id_token!=='string')throw new CloudError('identity_rejected',401);return verifyIdentity(result.id_token,options,tx.nonce)
}
