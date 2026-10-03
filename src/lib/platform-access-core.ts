export interface Sql {query(text:string,values?:unknown[]):Promise<{rows:Record<string,unknown>[]}>;}
export type AccessDecision={allowed:boolean,reason:'allowed'|'account_suspended'|'organization_suspended'|'membership_missing'|'service_denied',version:string};
export async function evaluateAccess(db:Sql,userId:string,organizationId?:string,serviceId?:string):Promise<AccessDecision>{
 const u=(await db.query(`SELECT u.id,coalesce(p.state,'active') AS state,coalesce(p.revision,0)::text AS version FROM "user" u LEFT JOIN platform_subject_policy p ON p.subject_kind='user' AND p.subject_id=u.id WHERE u.id=$1`,[userId])).rows[0];
 if(!u||u.state==='suspended')return {allowed:false,reason:'account_suspended',version:String(u?.version??'0')};
 const version=String(u.version);
 if(organizationId){
  const t=(await db.query(`SELECT status,deleted_at FROM tenants WHERE id=$1`,[organizationId])).rows[0];
  if(!t||t.deleted_at||['suspended','cancelled'].includes(String(t.status)))return {allowed:false,reason:'organization_suspended',version};
  const m=(await db.query(`SELECT id FROM tenant_memberships WHERE user_id=$1 AND tenant_id=$2 AND deleted_at IS NULL`,[userId,organizationId])).rows[0];
  if(!m)return {allowed:false,reason:'membership_missing',version};
  if(serviceId){const organizationPolicy=(await db.query(`SELECT allowed FROM platform_organization_entitlements WHERE tenant_id=$1 AND service_id=$2`,[organizationId,serviceId])).rows[0];if(organizationPolicy?.allowed===false)return {allowed:false,reason:'service_denied',version};const e=(await db.query(`SELECT allowed FROM platform_entitlements WHERE user_id=$1 AND tenant_id=$2 AND service_id=$3`,[userId,organizationId,serviceId])).rows[0];if(e?.allowed===false)return {allowed:false,reason:'service_denied',version};}
 }
 return {allowed:true,reason:'allowed',version};
}

export function createPlatformAccess(db:Sql,serviceId:string){return {allowed:async(userId:string,organizationId?:string)=>(await evaluateAccess(db,userId,organizationId,serviceId)).allowed};}
export function wrapPlatformAuth<T extends object>(base:T,check:(userId:string)=>Promise<boolean>,beforeRequest?:(r:Request)=>Promise<boolean>):T{
 const sessionAllowed=async(value:unknown)=>{if(!value||typeof value!=='object'||!('user' in value))return true;const user=(value as {user?:{id?:unknown}}).user;return typeof user?.id==='string'?check(user.id):false;};
 return new Proxy(base,{get(target,key,receiver){
  const value=Reflect.get(target,key,receiver);
  if(key==='api')return new Proxy(value,{get(api,method){const fn=Reflect.get(api,method);if(method!=='getSession')return fn;return async(...args:unknown[])=>{const session=await Reflect.apply(fn,api,args);return await sessionAllowed(session)?session:null;};}});
  if(key==='handler')return async(request:Request)=>{try{const path=new URL(request.url).pathname;if(!path.endsWith('/sign-out')){const session=await Reflect.apply(Reflect.get(Reflect.get(target,'api'),'getSession'),Reflect.get(target,'api'),[{headers:request.headers}]);if(!await sessionAllowed(session)||beforeRequest&&!await beforeRequest(request))return Response.json({code:'ACCOUNT_ACCESS_DENIED',message:'This account is not eligible for access.'},{status:401,headers:{'cache-control':'no-store'}});}return await Reflect.apply(value,target,[request]);}catch{return Response.json({code:'IDENTITY_UNAVAILABLE',message:'Sign-in service is temporarily unavailable.'},{status:503,headers:{'cache-control':'no-store'}});}};
  return value;
 }});
}
