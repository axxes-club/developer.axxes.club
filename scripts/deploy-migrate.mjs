import {Pool} from 'pg'
import {readFile} from 'node:fs/promises'
if(!process.env.DATABASE_URL||process.argv[2]!=='--apply')throw new Error('Use DATABASE_URL and --apply for the explicitly authorized target')
const pool=new Pool({connectionString:process.env.DATABASE_URL,max:1,connectionTimeoutMillis:10000,statement_timeout:30000})
const client=await pool.connect()
try{
 for(const file of ['001-foundation.sql','002-source-intake.sql']){
  await client.query(await readFile(new URL('../db/deploy/'+file,import.meta.url),'utf8'))
  console.log('Applied owned hosting migration '+file)
 }
}catch{
 await client.query('ROLLBACK');console.error('Hosting migration failed; current migration rolled back');process.exitCode=1
}finally{client.release();await pool.end()}
