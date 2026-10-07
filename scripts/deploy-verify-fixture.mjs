import {execFileSync} from 'node:child_process'
const root=process.argv[2]
if(!/^https:\/\/(?:verify-v2---)?hosting-next-fixture-[a-z0-9.-]+\.run\.app$/.test(root??''))throw new Error('Pass private hosting-next-fixture run.app URL')
try{
 const token=execFileSync('gcloud',['auth','print-identity-token'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim()
 const headers={authorization:'Bearer '+token}
 const get=path=>fetch(root+path,{headers,signal:AbortSignal.timeout(30000)})
 const one=await get('/api/health');const first=await one.json();const two=await get('/api/health');const second=await two.json()
 if(one.status!==200||two.status!==200||!first.ok||first.timestamp===second.timestamp)throw Error()
 const page=await get('/');const html=await page.text()
 if(page.status!==200||!html.includes('AXXES hosting compatibility fixture'))throw Error()
 const asset=await get('/fixture.txt');if(asset.status!==200||(await asset.text()).trim()!=='AXXES public asset fixture')throw Error()
 const path=html.match(/src="([^" ]+\/[^" ]+\.js)"/);if(!path)throw Error()
 if((await get(path[1])).status!==200)throw Error()
 const anonymous=await fetch(root+'/api/health',{signal:AbortSignal.timeout(30000)});if(![401,403].includes(anonymous.status))throw Error()
 const streamed=await get('/api/stream');if(streamed.status!==200||!streamed.body)throw Error()
 const reader=streamed.body.getReader();const initial=await reader.read();const started=Date.now();let last=''
 while(true){const {done,value}=await reader.read();if(done)break;last+=new TextDecoder().decode(value)}
 if(new TextDecoder().decode(initial.value)!=='first\n'||last!=='last\n'||Date.now()-started<1000)throw Error()
 console.log(JSON.stringify({dynamicApi:true,serverRendering:true,publicAsset:true,frameworkStaticAsset:true,streaming:true,anonymousAccessDenied:true}))
}catch{console.error('Private runtime fixture verification failed');process.exitCode=1}
