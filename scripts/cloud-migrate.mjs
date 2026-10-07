import {Pool} from 'pg';import {readFile} from 'node:fs/promises';
if(!process.env.DATABASE_URL||process.argv[2]!=='--apply')throw Error('Explicit DATABASE_URL and --apply required');
const pool=new Pool({connectionString:process.env.DATABASE_URL,max:1,connectionTimeoutMillis:10000,statement_timeout:30000});const c=await pool.connect();
try{for(const migration of ['001-control-plane','002-account-controls','003-release-bindings'])await c.query(await readFile(new URL('../db/cloud/'+migration+'.sql',import.meta.url),'utf8'));console.log('Applied owned cloud control-plane migration')}catch{await c.query('ROLLBACK');console.error('Cloud migration rolled back');process.exitCode=1}finally{c.release();await pool.end()}
