import {hostingPool} from '@/lib/deploy/postgres'
import {optionsFromEnvironment} from '@/lib/cloud/oidc'
export const dynamic='force-dynamic'
export async function GET(){
 try{
  optionsFromEnvironment()
  const migration=await hostingPool().query("SELECT version FROM cloud_schema_migrations WHERE version='001-control-plane'")
  if(migration.rowCount!==1)throw Error('migration unavailable')
  return Response.json({service:'AXXES Cloud',ready:true},{headers:{'cache-control':'no-store'}})
 }catch{
  return Response.json({service:'AXXES Cloud',ready:false},{status:503,headers:{'cache-control':'no-store'}})
 }
}
