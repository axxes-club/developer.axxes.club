import {randomBytes} from 'node:crypto'
import type {Pool,PoolClient} from 'pg'
import {hostingPool} from '../deploy/postgres'
import {hashToken,type AuthTransaction} from './oidc'
import {CloudError} from './types'
export const SESSION_COOKIE='__Host-axxes-cloud'
export const TRANSACTION_COOKIE='__Host-cloud-oidc'
export async function persistAuthTransaction(tx:AuthTransaction,connection:Pool|PoolClient=hostingPool()){
 await connection.query("INSERT INTO cloud_oidc_transactions(state_hash,nonce,verifier,return_path,expires_at) VALUES($1,$2,$3,$4,statement_timestamp()+interval '5 minutes')",[hashToken(tx.state),tx.nonce,tx.verifier,tx.returnPath])
}
export async function consumeAuthTransaction(state:string,connection:Pool|PoolClient=hostingPool()):Promise<AuthTransaction>{
 const result=await connection.query('UPDATE cloud_oidc_transactions SET used_at=statement_timestamp() WHERE state_hash=$1 AND used_at IS NULL AND expires_at>statement_timestamp() RETURNING nonce,verifier,return_path',[hashToken(state)])
 if(result.rowCount!==1)throw new CloudError('identity_transaction_expired',401)
 return {state,nonce:result.rows[0].nonce,verifier:result.rows[0].verifier,returnPath:result.rows[0].return_path}
}
export async function createSession(userId:string,connection:Pool|PoolClient=hostingPool()){
 const token=randomBytes(32).toString('base64url');const result=await connection.query("INSERT INTO cloud_sessions(token_hash,user_id,expires_at) SELECT $1,id,statement_timestamp()+interval '8 hours' FROM \"user\" WHERE id=$2 RETURNING user_id",[hashToken(token),userId]);if(!result.rowCount)throw new CloudError('account_not_registered',403);return token
}
export async function revokeSession(token:string,connection:Pool|PoolClient=hostingPool()){await connection.query('DELETE FROM cloud_sessions WHERE token_hash=$1',[hashToken(token)])}
