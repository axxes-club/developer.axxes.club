import {Pool} from 'pg'
import {randomUUID} from 'node:crypto'
const [beneficiary,rawTenantId,issuedBy,...extra]=process.argv.slice(2)
const tenantId=(rawTenantId??'').toLowerCase()
if(extra.length||!['jose','bayamon','otto'].includes(beneficiary)||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(tenantId??'')||!issuedBy||!process.env.DATABASE_URL)throw new Error('Usage: DATABASE_URL=... node scripts/deploy-bind-exemption.mjs beneficiary verified-tenant-uuid issued-by')
const pool=new Pool({connectionString:process.env.DATABASE_URL,max:1,connectionTimeoutMillis:10000,statement_timeout:10000})
const client=await pool.connect()
try{
 await client.query('BEGIN')
 await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',['deploy-exemption:'+tenantId+':'+beneficiary])
 const owned=await client.query('SELECT id,name FROM tenants WHERE id=$1 AND deleted_at IS NULL',[tenantId])
 if(owned.rows.length!==1)throw new Error('Verified organization no longer exists')
 const existing=await client.query(`SELECT g.id FROM deploy_exemption_grants g LEFT JOIN deploy_exemption_revocations r ON r.grant_id=g.id
 WHERE g.tenant_id=$1 AND g.project_id IS NULL AND g.beneficiary=$2 AND g.starts_at<=statement_timestamp() AND (r.ends_at IS NULL OR r.ends_at>statement_timestamp()) LIMIT 1`,[tenantId,beneficiary])
 const id=existing.rows[0]?.id??randomUUID()
 if(!existing.rows.length)await client.query(`INSERT INTO deploy_exemption_grants(id,tenant_id,beneficiary,starts_at,issued_by,reason)
 VALUES($1,$2,$3,statement_timestamp(),$4,$5)`,[id,tenantId,beneficiary,issuedBy,'Owner explicitly approved free hosting for named beneficiary on 2026-10-07; verified stable tenant binding'])
 await client.query('COMMIT')
 console.log(JSON.stringify({grantId:id,tenantId,beneficiary,organization:owned.rows[0].name,reused:existing.rows.length>0}))
}catch{
 await client.query('ROLLBACK');console.error('Exemption binding failed; transaction rolled back');process.exitCode=1
}finally{client.release();await pool.end()}
