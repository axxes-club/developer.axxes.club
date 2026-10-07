import test from 'node:test'
import assert from 'node:assert/strict'
import {verifyRepositoryAccess} from '../../src/lib/deploy/github/access'
const ctx={tenant:{id:'11111111-1111-4111-8111-111111111111'},role:'owner'}
test('binding requires selected repository visible through authenticated user installation access',async()=>{
 const calls:string[]=[]
 const api=async(path:string)=>{calls.push(path);return {repositories:[{id:34,full_name:'customer/site',default_branch:'main'}],total_count:1}}
 assert.deepEqual(await verifyRepositoryAccess(ctx,12,34,api),{installationId:12,repositoryId:34,fullName:'customer/site',defaultBranch:'main'})
 assert.equal(calls[0],'/user/installations/12/repositories?per_page=100&page=1')
 await assert.rejects(verifyRepositoryAccess(ctx,12,99,api),/Repository access denied/)
 await assert.rejects(verifyRepositoryAccess({...ctx,role:'manager'},12,34,api),/access denied/i)
 await assert.rejects(verifyRepositoryAccess(ctx,Number.MAX_SAFE_INTEGER+1,34,api))
})
test('selected repository may be on subsequent page; malformed responses fail closed',async()=>{
 const api=async(path:string)=>path.endsWith('page=1')?{repositories:Array.from({length:100},(_,i)=>({id:i+100,full_name:'x/site',default_branch:'main'})),total_count:101}:{repositories:[{id:34,full_name:'customer/site',default_branch:'main'}],total_count:101}
 assert.equal((await verifyRepositoryAccess(ctx,12,34,api)).repositoryId,34)
 await assert.rejects(verifyRepositoryAccess(ctx,12,34,async()=>({repositories:[{id:34,full_name:'https://evil.example',default_branch:'main'}]})))
})
