import test from 'node:test'
import assert from 'node:assert/strict'
import {cloudBuildPlan,buildResult} from '../../src/lib/cloud/providers/builds'
const config={nodeImage:'node:24-bookworm-slim@sha256:'+'a'.repeat(64),dockerImage:'gcr.io/cloud-builders/docker@sha256:'+'b'.repeat(64),staticImage:'nginxinc/nginx-unprivileged:stable-alpine@sha256:'+'c'.repeat(64)}
const resource='11111111-1111-4111-8111-111111111111',job='22222222-2222-4222-8222-222222222222'
test('trusted build plans isolate source and credentials to a single resource',()=>{
 const plan=cloudBuildPlan({resourceId:resource,jobId:job,runtime:'next-standalone',sourceGeneration:'12',config})
 assert.equal(plan.build.source.storageSource.bucket,'axxes-source-11111111111141118111111111111111')
 assert.equal(plan.build.serviceAccount,'projects/axxes-customer-hosting/serviceAccounts/build-1111111111114111811111@axxes-customer-hosting.iam.gserviceaccount.com')
 assert.ok(plan.build.steps[0].args.includes('AXXES.Dockerfile'))
 assert.ok(!plan.dockerfile.includes('COPY . .'))
 assert.ok(plan.dockerfile.includes('USER node'))
 assert.deepEqual(plan.build.tags,['axxes-job-'+job])
 assert.throws(()=>cloudBuildPlan({resourceId:resource,jobId:job,runtime:'next-standalone',sourceGeneration:'12',config:{...config,nodeImage:'node:latest'}}))
})
test('static output is inspected and served by a fixed unprivileged runtime',()=>{
 const p=cloudBuildPlan({resourceId:resource,jobId:job,runtime:'static',sourceGeneration:'12',config})
 assert.ok(p.dockerfile.includes('test -f dist/index.html'))
 assert.ok(p.dockerfile.includes('find dist -type l'))
 assert.ok(p.dockerfile.includes('USER nginx'))
 assert.ok(p.dockerfile.includes('nginx-unprivileged'))
})
test('a successful build requires exactly the owned immutable image digest',()=>{
 const image='us-west1-docker.pkg.dev/axxes-customer-hosting/cloud-111111111111411181111111/app:job-'+job
 assert.equal(buildResult({status:'WORKING'},image).state,'pending')
 assert.equal(buildResult({status:'FAILURE',logUrl:'secret'},image).state,'failed')
 const result=buildResult({status:'SUCCESS',results:{images:[{name:image,digest:'sha256:'+'d'.repeat(64)}]}},image)
 assert.equal(result.image,image.split(':')[0]+'@sha256:'+'d'.repeat(64))
 assert.throws(()=>buildResult({status:'SUCCESS',results:{images:[{name:'foreign',digest:'sha256:'+'d'.repeat(64)}]}},image),/build_image/)
})
