import test from 'node:test'
import assert from 'node:assert/strict'
import {createBuildPlan} from '../../src/lib/deploy/runtime/build-plan'
const node='node:24-bookworm-slim@sha256:'+'a'.repeat(64)
const nginx='nginx:stable-alpine@sha256:'+'b'.repeat(64)
const input={kind:'next-standalone' as const,nodeImage:node,builderImage:'gcr.io/cloud-builders/docker@sha256:'+'c'.repeat(64),buildServiceAccount:'customer-build@axxes-customer-hosting.iam.gserviceaccount.com',image:'us-west1-docker.pkg.dev/axxes-customer-hosting/project-123/app:abcdef',sourceBucket:'axxes-source-123',sourceGeneration:'1791354100000000',sourceObject:'source/abc.tar.gz'}
test('controlled Next build has immutable bases, unprivileged runtime and no user Dockerfile or deploy step',()=>{
 const plan=createBuildPlan(input)
 assert.match(plan.dockerfile,/USER node/);assert.match(plan.dockerfile,/\.next\/standalone/)
 assert.equal(plan.build.serviceAccount,'projects/axxes-customer-hosting/serviceAccounts/'+input.buildServiceAccount)
 assert.equal(plan.build.timeout,'600s')
 assert.equal(plan.build.source.storageSource.generation,input.sourceGeneration)
 assert.equal(plan.build.steps.length,1)
 assert.deepEqual(plan.build.steps[0].args,['build','--no-cache','-f','AXXES.Dockerfile','-t',input.image,'.'])
 assert.equal(JSON.stringify(plan).includes('gravy-meta'),false)
})
test('build inputs cannot escape dedicated project or introduce tags, commands or source paths',()=>{
 for(const patch of [{sourceGeneration:'0'},{nodeImage:'node:24'},{image:'us-west1-docker.pkg.dev/gravy-meta/shared/app:abc'},{sourceObject:'../secret'},{buildServiceAccount:'owner@gravy-meta.iam.gserviceaccount.com'},{kind:'dockerfile'},{sourceBucket:'AXXES;echo x'}])assert.throws(()=>createBuildPlan({...input,...patch} as typeof input))
})
