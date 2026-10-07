import {strict as assert} from 'node:assert'
import {createServer as httpsServer} from 'node:https'
import {request as httpRequest} from 'node:http'
import {spawn,execFileSync} from 'node:child_process'
import {mkdtemp,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {chromium,expect} from '@playwright/test'
import {withDeployDatabase} from '../tests/deploy/helpers/postgres'
import {applyFoundation,applyOwnerPolicy,freeOwnerId,tenantA,tenantB} from '../tests/deploy/helpers/fixtures'
import {createSession} from '../src/lib/cloud/session'
const origin='https://cloud.v2.axxes.app'
await withDeployDatabase(async pool=>{
 await applyFoundation(pool);await applyOwnerPolicy(pool)
 await pool.query('ALTER TABLE "user" ADD COLUMN name text')
 await pool.query("UPDATE \"user\" SET name='Cloud Owner' WHERE id=$1",[freeOwnerId])
 await pool.query("INSERT INTO \"user\"(id,name,email) VALUES('other-owner','Other Owner','other@fixture.test')")
 await pool.query("ALTER TABLE tenants ADD COLUMN name text,ADD COLUMN slug text,ADD COLUMN status text DEFAULT 'active',ADD COLUMN deleted_at timestamptz")
 await pool.query("UPDATE tenants SET name=CASE WHEN id=$1 THEN 'Organization A' ELSE 'Organization B' END,slug=CASE WHEN id=$1 THEN 'a' ELSE 'b' END",[tenantA])
 await pool.query('CREATE TABLE tenant_memberships(id uuid DEFAULT gen_random_uuid(),user_id text,tenant_id uuid,role text,is_primary boolean,deleted_at timestamptz)')
 await pool.query("INSERT INTO tenant_memberships(user_id,tenant_id,role,is_primary) VALUES($1,$2,'owner',true),($1,$3,'member',false),('other-owner',$3,'owner',true)",[freeOwnerId,tenantA,tenantB])
 await pool.query('CREATE TABLE platform_subject_policy(subject_kind text,subject_id text,state text,revision int);CREATE TABLE platform_organization_entitlements(tenant_id uuid,service_id text,allowed boolean);CREATE TABLE platform_entitlements(user_id text,tenant_id uuid,service_id text,allowed boolean)')
 for(const file of ['001-control-plane','002-account-controls'])await pool.query(await readFile('db/cloud/'+file+'.sql','utf8'))
 const schema=(await pool.query('SELECT current_schema() name')).rows[0].name
 const url=new URL(process.env.DEPLOY_TEST_DATABASE_URL!);url.searchParams.set('options','-c search_path='+schema+',public')
 const ownerToken=await createSession(freeOwnerId,pool),otherToken=await createSession('other-owner',pool)
 const dir=await mkdtemp(join(tmpdir(),'axxes-cloud-browser-'))
 execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',join(dir,'key.pem'),'-out',join(dir,'cert.pem'),'-days','1','-subj','/CN=cloud.v2.axxes.app'],{stdio:'ignore'})
 const app=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-p','3317','-H','127.0.0.1'],{env:{...process.env,DATABASE_URL:url.href,CLOUD_ORIGIN:origin,CLOUD_OIDC_CLIENT_SECRET:'browser-only-fixture-oidc-secret-at-least-32-characters',PLATFORM_ACCESS_POLICY_ENABLED:'true',CLOUD_APP_VERIFIED:'false'},stdio:['ignore','pipe','pipe']})
 app.stdout.on('data',()=>{});app.stderr.on('data',d=>process.stderr.write(d))
 const proxy=httpsServer({key:await readFile(join(dir,'key.pem')),cert:await readFile(join(dir,'cert.pem'))},(req,res)=>{
  const upstream=httpRequest({hostname:'127.0.0.1',port:3317,path:req.url,method:req.method,headers:req.headers},response=>{res.writeHead(response.statusCode??502,response.headers);response.pipe(res)})
  upstream.on('error',()=>{res.writeHead(502);res.end()});req.pipe(upstream)
 })
 let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined
 try{
  await new Promise<void>((resolve,reject)=>{proxy.once('error',reject);proxy.listen(443,'127.0.0.1',resolve)})
  let ready=false;for(let i=0;i<100;i++){try{const r=await fetch('http://127.0.0.1:3317/cloud/sign-in');if(r.ok){ready=true;break}}catch{};await new Promise(r=>setTimeout(r,100))}assert.ok(ready,'production Next server must start')
  browser=await chromium.launch({args:['--no-proxy-server','--host-resolver-rules=MAP cloud.v2.axxes.app 127.0.0.1']})
  const context=await browser.newContext({ignoreHTTPSErrors:true});const page=await context.newPage()
  await page.goto(origin);await expect(page.getByRole('heading',{name:'Your cloud. Your AXXES account.'})).toBeVisible()
  await context.addCookies([{name:'__Host-axxes-cloud',value:ownerToken,url:origin,secure:true,httpOnly:true,sameSite:'Lax'}])
  await page.goto(origin+'/cloud/projects');await page.getByLabel('New project').fill('Browser-owned project');await page.getByRole('button',{name:'Create project'}).click();await expect(page.getByRole('heading',{name:'Browser-owned project'})).toBeVisible()
  await page.goto(origin+'/cloud/settings');await page.getByLabel('Credential name').fill('Browser credential');await page.getByRole('button',{name:'Create read credential'}).click();const tokenField=page.getByLabel('New API credential');await expect(tokenField).toBeVisible();const apiToken=await tokenField.inputValue()
  assert.match(apiToken,/^axxes_cloud_/)
  const read=await page.evaluate(async token=>{const r=await fetch('/api/cloud/projects',{headers:{authorization:'Bearer '+token}});return {status:r.status,body:await r.json()}},apiToken);assert.equal(read.status,200);assert.equal(read.body.projects[0].name,'Browser-owned project')
  await page.reload();await expect(page.getByLabel('New API credential')).toHaveCount(0)
  await page.getByLabel('Organization').selectOption(tenantB);await expect(page.getByRole('heading',{name:'API credentials'})).toHaveCount(0)
  await page.goto(origin+'/cloud/projects');await expect(page.getByRole('heading',{name:'Browser-owned project'})).toHaveCount(0);await expect(page.getByRole('button',{name:'Create project'})).toHaveCount(0)
  await page.getByLabel('Organization').selectOption(tenantA);await expect(page.getByRole('button',{name:'Create project'})).toBeVisible()
  await page.goto(origin+'/cloud/settings');page.once('dialog',d=>void d.accept());await page.getByRole('button',{name:'Revoke',exact:true}).click();await expect(page.getByText('Revoked',{exact:true})).toBeVisible()
  const revoked=await page.evaluate(async token=>(await fetch('/api/cloud/projects',{headers:{authorization:'Bearer '+token}})).status,apiToken);assert.equal(revoked,401)
  const other=await browser.newContext({ignoreHTTPSErrors:true});await other.addCookies([{name:'__Host-axxes-cloud',value:otherToken,url:origin,secure:true,httpOnly:true,sameSite:'Lax'}]);const otherPage=await other.newPage();await otherPage.goto(origin+'/cloud/projects');await expect(otherPage.getByRole('heading',{name:'Browser-owned project'})).toHaveCount(0)
  await pool.query("INSERT INTO platform_subject_policy VALUES('user',$1,'suspended',1)",[freeOwnerId]);await page.goto(origin+'/cloud');await expect(page.getByRole('heading',{name:'Your cloud. Your AXXES account.'})).toBeVisible()
  await page.setViewportSize({width:390,height:844});await expect(page.getByRole('link',{name:'Continue with AXXES'})).toBeVisible()
  console.log('Cloud Linux browser checks passed: host entry, anonymous gate, project creation, tenant/role switch, key issue/use/revoke, suspension and mobile sign-in')
 }finally{await browser?.close();proxy.closeAllConnections();await new Promise<void>(resolve=>proxy.close(()=>resolve()));app.kill('SIGTERM');await new Promise<void>(resolve=>{if(app.exitCode!==null)resolve();else app.once('exit',()=>resolve())});await rm(dir,{recursive:true,force:true})}
})
