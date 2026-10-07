/** Operator-only GitHub manifest bootstrap. Credentials never enter browser or stdout. */
import {createServer} from 'node:http'
import {randomBytes,timingSafeEqual,createPrivateKey} from 'node:crypto'
import {mkdir,writeFile} from 'node:fs/promises'
import {resolve,dirname} from 'node:path'
const target=process.argv[2]
if(!target)throw Error('Pass an absolute private output JSON path')
const output=resolve(target),state=randomBytes(32).toString('base64url'),port=43189
const host='127.0.0.1:'+port,origin='http://'+host
const manifest={name:'AXXES Cloud',url:'https://cloud.axxes.app',description:'Connect selected repositories to AXXES Cloud applications.',public:true,redirect_url:origin+'/callback',callback_urls:['https://cloud.axxes.app/api/cloud/github/callback'],hook_attributes:{url:'https://cloud.axxes.app/api/deploy/github/webhook',active:false},default_permissions:{contents:'read',metadata:'read'},default_events:[],request_oauth_on_install:false}
const escape=s=>s.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;')
let exchanging=false,complete=false
const server=createServer(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Security-Policy',"default-src 'none'; form-action https://github.com; frame-ancestors 'none'")
 if(req.method!=='GET'||req.headers.host!==host){res.writeHead(403);res.end();return}
 const url=new URL(req.url,origin)
 if(url.pathname==='/'+state){res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><title>AXXES Cloud GitHub setup</title><h1>AXXES Cloud</h1><p>Register the GitHub App under axxes-club, then install it on the repositories you choose. Permissions: read repository content and metadata. Webhooks remain disabled.</p><form method="post" action="https://github.com/organizations/axxes-club/settings/apps/new?state='+state+'"><input type="hidden" name="manifest" value="'+escape(JSON.stringify(manifest))+'"><button>Register on GitHub</button></form>');return}
 const returned=url.searchParams.get('state')??'',code=url.searchParams.get('code')??''
 if(url.pathname!=='/callback'||!/^[A-Za-z0-9_-]{43}$/.test(returned)||!timingSafeEqual(Buffer.from(returned),Buffer.from(state))||!/^[a-zA-Z0-9_-]{10,256}$/.test(code)||exchanging||complete){res.writeHead(400);res.end('Invalid or consumed setup callback');return}
 exchanging=true
 try{
  const response=await fetch('https://api.github.com/app-manifests/'+code+'/conversions',{method:'POST',headers:{accept:'application/vnd.github+json','x-github-api-version':'2026-03-10'},redirect:'error',signal:AbortSignal.timeout(15000)})
  if(!response.ok)throw Error('conversion rejected')
  const body=await response.text();if(body.length>1024*1024)throw Error('oversized response');const app=JSON.parse(body)
  if(!Number.isSafeInteger(app.id)||app.id<1||typeof app.client_id!=='string'||typeof app.client_secret!=='string'||!app.client_secret||typeof app.pem!=='string'||!app.pem||typeof app.webhook_secret!=='string'||!app.webhook_secret||!/^[a-z0-9-]+$/.test(app.slug))throw Error('invalid app response')
  createPrivateKey(app.pem)
  await mkdir(dirname(output),{recursive:true,mode:0o700})
  await writeFile(output,JSON.stringify({appId:app.id,slug:app.slug,clientId:app.client_id,clientSecret:app.client_secret,privateKey:app.pem,webhookSecret:app.webhook_secret,tokenEncryptionKey:randomBytes(32).toString('base64')})+'\n',{mode:0o600,flag:'wx'})
  complete=true;res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><title>App registered</title><h1>GitHub App registered</h1><p>Credentials saved privately. Install the App on your selected pilot repositories.</p><a href="https://github.com/apps/'+app.slug+'/installations/new">Install AXXES Cloud</a>')
  console.log('GitHub App registered; private configuration saved. App ID: '+app.id+'. Installation: https://github.com/apps/'+app.slug+'/installations/new')
 }catch{res.writeHead(502);res.end('Setup conversion failed. Credentials were not displayed. Check the private output before retrying.');console.error('GitHub App setup failed; sensitive response suppressed')}finally{exchanging=false}
})
server.listen(port,'127.0.0.1',()=>console.log('GitHub setup: '+origin+'/'+state))
setTimeout(()=>server.close(),60*60*1000).unref()
