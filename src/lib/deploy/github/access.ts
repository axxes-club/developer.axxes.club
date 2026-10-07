import {z} from 'zod'
import {requireHostingAccess} from '../authorization'
const id=z.number().int().positive().safe()
const repository=z.object({id,full_name:z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/),default_branch:z.string().min(1).max(1013)})
const page=z.object({repositories:z.array(repository).max(100),total_count:z.number().int().nonnegative().safe()})
/** `api` must authenticate with the current user's GitHub App user token,
 * obtained by server-side OAuth. An app installation token cannot prove user access.
 * No caller-supplied tenant, URL, repository name, or payload verification flag is trusted.
 */
export async function verifyRepositoryAccess(ctx:{tenant:{id:string};role:string},installationId:number,repositoryId:number,api:(path:string)=>Promise<unknown>){
 requireHostingAccess(ctx,'inspect'); id.parse(installationId); id.parse(repositoryId)
 for(let number=1;number<=100;number++){
  const value=page.parse(await api(`/user/installations/${installationId}/repositories?per_page=100&page=${number}`))
  const match=value.repositories.find(repo=>repo.id===repositoryId)
  if(match) return {installationId,repositoryId,fullName:match.full_name,defaultBranch:match.default_branch}
  if(value.repositories.length<100 || number*100>=value.total_count) break
 }
 throw new Error('Repository access denied')
}
/** Token is retained only in the request closure; failures never include response bodies. */
export function githubUserApi(token:string,fetcher:typeof fetch=fetch){
 if(!token || /[\r\n]/.test(token)) throw new Error('GitHub authentication required')
 return async(path:string):Promise<unknown>=>{
  if(!/^\/user\/installations\/[1-9][0-9]*\/repositories\?per_page=100&page=[1-9][0-9]*$/.test(path)) throw new Error('Invalid GitHub API path')
  const response=await fetcher('https://api.github.com'+path,{headers:{authorization:`Bearer ${token}`,accept:'application/vnd.github+json','x-github-api-version':'2022-11-28'},redirect:'error',signal:AbortSignal.timeout(10000),cache:'no-store'})
  if(!response.ok) throw new Error('GitHub access verification failed')
  const reader=response.body?.getReader();if(!reader)throw new Error('Invalid GitHub response')
  const chunks:Uint8Array[]=[];let size=0
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>1024*1024){await reader.cancel();throw new Error('GitHub response too large')}chunks.push(value)}}finally{reader.releaseLock()}
  return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)))
 }
}
