import type {Pool} from 'pg'
import {z} from 'zod'
import {hostingPool,inHostingTransaction} from '../postgres'
import {verifyRepositoryAccess,githubUserApi} from './access'

/** Server-only integration boundary: token must come from current user's App OAuth
 * session. Never accept a token or tenant ID from a repository webhook payload.
 * No token is persisted. API injection is for verification tests only.
 */
export async function bindRepository(
 ctx:{tenant:{id:string};role:string;userId:string},
 input:{projectId:string;installationId:number;repositoryId:number;branch:string},
 userToken:string,
 pool:Pool=hostingPool(),
 api:(path:string)=>Promise<unknown>=githubUserApi(userToken),
){
 z.uuid().parse(input.projectId);z.string().min(1).parse(ctx.userId)
 // Match Git reference restrictions without executing git or trusting a path.
 const branch=z.string().min(1).max(1013).parse(input.branch)
 if(branch.includes('..')||branch.includes('@{')||/[\x00-\x20\x7f~^:?*\[\\]/.test(branch)||branch.startsWith('/')||branch.endsWith('/')||branch.endsWith('.')||branch==='@'||branch.split('/').some(p=>!p||p.startsWith('.')||p.endsWith('.lock')))throw new Error('Invalid branch')
 const verified=await verifyRepositoryAccess(ctx,input.installationId,input.repositoryId,api)
 return inHostingTransaction(pool,async client=>{
  const owned=await client.query('SELECT id FROM deploy_projects WHERE tenant_id=$1 AND id=$2 FOR UPDATE',[ctx.tenant.id,input.projectId])
  if(!owned.rows.length)throw new Error('Project access denied')
  await client.query(`INSERT INTO deploy_source_bindings(tenant_id,project_id,installation_id,repository_id,branch,verified_by)
    VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(tenant_id,project_id) DO UPDATE SET
    installation_id=EXCLUDED.installation_id,repository_id=EXCLUDED.repository_id,branch=EXCLUDED.branch,verified_by=EXCLUDED.verified_by,verified_at=statement_timestamp()`,
    [ctx.tenant.id,input.projectId,verified.installationId,verified.repositoryId,branch,ctx.userId])
  return verified
 })
}
