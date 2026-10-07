import {createSign} from 'node:crypto'
import {readBytes} from '../http'
import {CloudError} from '../types'

export function appJwt(appId:string,key:string,now=Date.now()){
 if(!/^[1-9][0-9]*$/.test(appId)||!key)throw new CloudError('github_app_unavailable',503)
 const header=Buffer.from(JSON.stringify({alg:'RS256',typ:'JWT'})).toString('base64url')
 const payload=Buffer.from(JSON.stringify({iat:Math.floor(now/1000)-60,exp:Math.floor(now/1000)+540,iss:appId})).toString('base64url')
 const input=header+'.'+payload
 const sign=createSign('RSA-SHA256')
 sign.update(input)
 return input+'.'+sign.sign(key,'base64url')
}

export async function githubJson(path:string,token:string,body?:unknown,fetcher:typeof fetch=fetch){
 const allowed=/^\/(?:app\/installations\/[1-9][0-9]*\/access_tokens|user\/installations(?:\?per_page=100(?:&page=[1-9][0-9]*)?)?|repositories\/[1-9][0-9]*|repos\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/(?:commits\/[A-Za-z0-9_%.-]+|compare\/[a-f0-9]{40}\.\.\.[a-f0-9]{40}))$/.test(path)
 const comparison=/^\/repos\/[^/]+\/[^/]+\/compare\/[a-f0-9]{40}\.\.\.[a-f0-9]{40}$/.test(path)
 if(!allowed||path.includes('..')&&!comparison)throw new CloudError('invalid_github_path')
 const response=await fetcher('https://api.github.com'+path,{
  method:body===undefined?'GET':'POST',
  headers:{authorization:'Bearer '+token,accept:'application/vnd.github+json','x-github-api-version':'2026-03-10','content-type':'application/json'},
  body:body===undefined?undefined:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(15000),cache:'no-store'
 })
 if(!response.ok)throw new CloudError('github_request_rejected',403)
 return JSON.parse((await readBytes(response.body,1024*1024,15000)).toString('utf8'))
}

export async function installationToken(installationId:number,repositoryId:number,fetcher:typeof fetch=fetch){
 if(!Number.isSafeInteger(installationId)||installationId<1||!Number.isSafeInteger(repositoryId)||repositoryId<1)throw new CloudError('invalid_github_binding')
 const jwt=appJwt(process.env.CLOUD_GITHUB_APP_ID??'',process.env.CLOUD_GITHUB_PRIVATE_KEY??'')
 const result=await githubJson(`/app/installations/${installationId}/access_tokens`,jwt,{repository_ids:[repositoryId],permissions:{contents:'read'}},fetcher)
 if(typeof result.token!=='string'||!result.token||result.token.length>16384)throw new CloudError('github_token_rejected',403)
 return result.token as string
}
