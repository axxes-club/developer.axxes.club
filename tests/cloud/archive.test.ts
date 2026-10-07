import test from 'node:test';import assert from 'node:assert/strict';import {gzipSync} from 'node:zlib'
import {extractGitHubArchive,encodeTar,bundleSource} from '../../src/lib/cloud/github/archive'
test('source extraction strips one repository root and bundles files separately from trusted build controls',()=>{
 const archive=gzipSync(encodeTar(new Map([['repo-sha/package.json',{bytes:Buffer.from('{}'),mode:0o644}],['repo-sha/index.html',{bytes:Buffer.from('hello'),mode:0o644}]])))
 const files=extractGitHubArchive(archive);assert.equal(files.get('index.html')?.bytes.toString(),'hello')
 const output=bundleSource(files,'FROM trusted\n','source/**');assert.ok(output.length>0)
})
test('traversal, duplicate roots, links and decompression bombs cannot become build source',()=>{
 assert.throws(()=>encodeTar(new Map([['../escape',{bytes:Buffer.from('bad'),mode:0o644}]])))
 const roots=gzipSync(encodeTar(new Map([['a/index.html',{bytes:Buffer.from('a'),mode:0o644}],['b/index.html',{bytes:Buffer.from('b'),mode:0o644}]])));assert.throws(()=>extractGitHubArchive(roots),/archive_root/)
 assert.throws(()=>extractGitHubArchive(gzipSync(Buffer.alloc(10000)),{maxExtractedBytes:1024}),/archive_limit/)
 const linked=encodeTar(new Map([['repo/file',{bytes:Buffer.from('x'),mode:0o644}]]));linked[156]=50;linked.fill(32,148,156);const checksum=linked.subarray(0,512).reduce((a,b)=>a+b,0).toString(8).padStart(6,'0');linked.write(checksum+'\0 ',148,8,'ascii');assert.throws(()=>extractGitHubArchive(gzipSync(linked)),/archive_entry/)
})
