import {gzipSync,gunzipSync} from 'node:zlib';import {CloudError} from '../types'
export type SourceFile={bytes:Buffer;mode:number}
export type ArchiveLimits={maxCompressedBytes?:number;maxExtractedBytes?:number;maxFiles?:number}
function safePath(path:string){if(!path||path.startsWith('/')||path.includes('\\')||/^[A-Za-z]:/.test(path)||/[\x00-\x1f\x7f]/.test(path)||path.split('/').some(p=>p==='..'||p==='.')||path.length>255)throw new CloudError('archive_path');return path}
const field=(bytes:Buffer,start:number,end:number)=>new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(start,end)).split('\0')[0]
function octal(bytes:Buffer,start:number,end:number){const value=field(bytes,start,end).trim();if(!/^[0-7]+$/.test(value))throw new CloudError('archive_number');const result=parseInt(value,8);if(!Number.isSafeInteger(result))throw new CloudError('archive_number');return result}
function pax(bytes:Buffer){const values:Record<string,string>={};let offset=0;while(offset<bytes.length){const space=bytes.indexOf(32,offset);if(space<0)throw new CloudError('archive_pax');const length=Number(bytes.subarray(offset,space).toString('ascii'));if(!Number.isSafeInteger(length)||length<=space-offset+1||offset+length>bytes.length||bytes[offset+length-1]!==10)throw new CloudError('archive_pax');const line=new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(space+1,offset+length-1));const equal=line.indexOf('=');if(equal<1)throw new CloudError('archive_pax');values[line.slice(0,equal)]=line.slice(equal+1);offset+=length}return values}
export function extractGitHubArchive(input:Buffer,limits:ArchiveLimits={}):Map<string,SourceFile>{
 const maximum=limits.maxExtractedBytes??200*1024*1024;if(input.length>(limits.maxCompressedBytes??50*1024*1024))throw new CloudError('archive_limit')
 let tar:Buffer;try{tar=gunzipSync(input,{maxOutputLength:maximum})}catch{throw new CloudError('archive_limit')}
 const files=new Map<string,SourceFile>();let root:string|undefined;let offset=0;let pendingPath:string|undefined
 while(offset+512<=tar.length){const header=tar.subarray(offset,offset+512);if(header.every(v=>v===0)){if(!tar.subarray(offset).every(v=>v===0))throw new CloudError('archive_truncated');break}
  const checksum=octal(header,148,156);const actual=header.reduce((sum,v,i)=>sum+(i>=148&&i<156?32:v),0);if(actual!==checksum)throw new CloudError('archive_checksum')
  const size=octal(header,124,136);const type=String.fromCharCode(header[156]);const mode=octal(header,100,108);const prefix=field(header,345,500);let path=(prefix?prefix+'/':'')+field(header,0,100);offset+=512;if(size>maximum||offset+size>tar.length)throw new CloudError('archive_truncated');const body=tar.subarray(offset,offset+size);offset+=Math.ceil(size/512)*512
  if(type==='x'||type==='g'){if(size>16384)throw new CloudError('archive_pax');const metadata=pax(body);if(metadata.linkpath||type==='g'&&metadata.path)throw new CloudError('archive_entry');if(type==='x'){pendingPath=metadata.path;if(metadata.size&&Number(metadata.size)>maximum)throw new CloudError('archive_limit')}continue}
  if(!['0','\0','5'].includes(type)||mode&0o7000)throw new CloudError('archive_entry');path=safePath(pendingPath??path);pendingPath=undefined
  const parts=path.replace(/\/$/,'').split('/');if(!root)root=parts[0];if(parts[0]!==root)throw new CloudError('archive_root');const relative=parts.slice(1).join('/');if(type==='5'){if(size!==0)throw new CloudError('archive_entry');continue}if(!relative)throw new CloudError('archive_root')
  safePath(relative);if(relative.split('/').some(p=>p==='.git'||/^\.env(?:\.|$)/.test(p)))throw new CloudError('source_secret_file');if(files.has(relative))throw new CloudError('archive_duplicate');files.set(relative,{bytes:Buffer.from(body),mode:mode&0o755});if(files.size>(limits.maxFiles??20000))throw new CloudError('archive_limit')
 }
 if(offset>tar.length||pendingPath||files.size===0)throw new CloudError('archive_truncated');return files
}
export function encodeTar(files:Map<string,SourceFile>):Buffer{
 const chunks:Buffer[]=[]
 for(const [raw,file] of files){const path=safePath(raw);const header=Buffer.alloc(512);let name=path,prefix='';if(Buffer.byteLength(name)>100){const split=path.lastIndexOf('/');prefix=path.slice(0,split);name=path.slice(split+1);if(split<1||Buffer.byteLength(prefix)>155||Buffer.byteLength(name)>100)throw new CloudError('archive_path')}
  header.write(name,0,100,'utf8');header.write((file.mode&0o755).toString(8).padStart(7,'0')+'\0',100,8,'ascii');header.write('0000000\0',108,8,'ascii');header.write('0000000\0',116,8,'ascii');header.write(file.bytes.length.toString(8).padStart(11,'0')+'\0',124,12,'ascii');header.write('00000000000\0',136,12,'ascii');header.fill(32,148,156);header[156]=48;header.write('ustar\0',257,6,'ascii');header.write('00',263,2,'ascii');header.write(prefix,345,155,'utf8');const checksum=header.reduce((a,b)=>a+b,0).toString(8).padStart(6,'0');header.write(checksum+'\0 ',148,8,'ascii');chunks.push(header,file.bytes,Buffer.alloc((512-file.bytes.length%512)%512))
 }
 chunks.push(Buffer.alloc(1024));return Buffer.concat(chunks)
}
export function bundleSource(files:Map<string,SourceFile>,dockerfile:string,dockerignore:string){const bundle=new Map<string,SourceFile>();for(const [path,file] of files)bundle.set('source/'+safePath(path),file);bundle.set('AXXES.Dockerfile',{bytes:Buffer.from(dockerfile),mode:0o644});bundle.set('.dockerignore',{bytes:Buffer.from(dockerignore),mode:0o644});return gzipSync(encodeTar(bundle))}
