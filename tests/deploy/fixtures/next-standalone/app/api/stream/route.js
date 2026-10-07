export const dynamic='force-dynamic'
export function GET(){
 const encoder=new TextEncoder()
 const stream=new ReadableStream({async start(controller){
  controller.enqueue(encoder.encode('first\n'))
  await new Promise(resolve=>setTimeout(resolve,1500))
  controller.enqueue(encoder.encode('last\n'));controller.close()
 }})
 return new Response(stream,{headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}})
}
