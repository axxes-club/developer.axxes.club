import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,writeFile,chmod,rm,readFile,stat} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {reserveCredentialOutput,conversionCapture} from './cloud-github-credentials.mjs'
test('output collision and unwritable directory fail before conversion',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'cloud-setup-test-'))
 try{const output=join(dir,'app.json');await writeFile(output,'existing',{mode:0o600});await assert.rejects(reserveCredentialOutput(output),{code:'EEXIST'});await chmod(dir,0o500);await assert.rejects(reserveCredentialOutput(join(dir,'new.json')),/private writable/)}finally{await chmod(dir,0o700);await rm(dir,{recursive:true,force:true})}
})
test('persistence failure retains converted credentials and retries without reconversion',async()=>{
 let conversions=0,writes=0;const secret={privateKey:'fixture-only-key'}
 const capture=conversionCapture(async()=>{conversions++;return secret},async value=>{assert.equal(value,secret);if(++writes===1)throw Error('disk unavailable')})
 await assert.rejects(capture('one-code'),/disk unavailable/);assert.equal(await capture('one-code'),secret);assert.equal(conversions,1);assert.equal(writes,2);await assert.rejects(capture('other-code'),/already captured/)
})
test('credentials persist only in a reserved private file',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'cloud-setup-test-'))
 try{const output=join(dir,'app.json');const persist=await reserveCredentialOutput(output);await persist({privateKey:'fixture-only-key'});assert.equal((await stat(output)).mode&0o777,0o600);assert.deepEqual(JSON.parse(await readFile(output,'utf8')),{privateKey:'fixture-only-key'});await persist.close()}finally{await rm(dir,{recursive:true,force:true})}
})
test('setup refuses an existing output before opening registration',async()=>{
 const {spawn}=await import('node:child_process');const dir=await mkdtemp(join(tmpdir(),'cloud-setup-test-'));const output=join(dir,'existing.json');await writeFile(output,'existing')
 try{const child=spawn(process.execPath,['scripts/cloud-github-app-setup.mjs',output]);let stdout='',stderr='';child.stdout.on('data',data=>stdout+=data);child.stderr.on('data',data=>stderr+=data);const timer=setTimeout(()=>child.kill('SIGTERM'),1500);const code=await new Promise(resolve=>child.once('exit',resolve));clearTimeout(timer);assert.notEqual(code,null,'preflight must exit before listener');assert.match(stderr,/EEXIST/);assert.ok(!stdout.includes('GitHub setup:'))}finally{await rm(dir,{recursive:true,force:true})}
})
