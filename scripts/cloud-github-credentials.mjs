import {mkdir,open,stat} from 'node:fs/promises'
import {dirname} from 'node:path'
/** Reserve private output before any irreversible manifest conversion. */
export async function reserveCredentialOutput(output){
 const parent=dirname(output);await mkdir(parent,{recursive:true,mode:0o700});const info=await stat(parent)
 if((info.mode&0o077)!==0||(info.mode&0o200)===0||info.uid!==process.getuid())throw Error('Credential output requires a private writable directory')
 const handle=await open(output,'wx',0o600)
 const persist=async value=>{const bytes=Buffer.from(JSON.stringify(value)+'\n');await handle.write(bytes,0,bytes.length,0);await handle.truncate(bytes.length);await handle.sync()}
 persist.close=()=>handle.close()
 return persist
}
/** A write retry must reuse converted credentials, never consume the code again. */
export function conversionCapture(convert,persist){
 let saved,convertedCode
 return async code=>{
  if(convertedCode&&code!==convertedCode)throw Error('Conversion already captured')
  if(!saved){saved=await convert(code);convertedCode=code}
  await persist(saved);return saved
 }
}
