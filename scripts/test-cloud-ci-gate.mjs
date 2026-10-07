import test from 'node:test'
import assert from 'node:assert/strict'
import {verifiedMainCommit} from './cloud-ci-gate.mjs'
const sha='a'.repeat(40),good={head_sha:sha,head_branch:'main',event:'push',status:'completed',conclusion:'success',head_repository:{full_name:'axxes-club/developer.axxes.club'}}
test('only successful exact-commit main CI authorizes Cloud submission',()=>{
 assert.equal(verifiedMainCommit(sha,{workflow_runs:[good]}),true)
 for(const patch of [{status:'in_progress'},{conclusion:'failure'},{conclusion:'cancelled'},{head_sha:'b'.repeat(40)},{head_branch:'feature'},{event:'pull_request'},{head_repository:{full_name:'attacker/fork'}}])assert.equal(verifiedMainCommit(sha,{workflow_runs:[{...good,...patch}]}),false)
 assert.equal(verifiedMainCommit(sha,{workflow_runs:[]}),false);assert.equal(verifiedMainCommit('invalid',{workflow_runs:[good]}),false)
})
