import {randomBytes,createHash} from 'node:crypto'
import {z} from 'zod'
import {CloudError} from './types'
const scopes=z.array(z.enum(['read','operate'])).min(1).max(2).refine(x=>new Set(x).size===x.length)
export function createCloudKey(requested:unknown){const permissions=scopes.parse(requested);const token='axxes_cloud_'+randomBytes(32).toString('base64url');return {token,hash:parseCloudKey(token),scopes:permissions}}
export function parseCloudKey(token:string){if(!/^axxes_cloud_[A-Za-z0-9_-]{43}$/.test(token))throw new CloudError('api_key_rejected',401);return createHash('sha256').update(token).digest('hex')}
export function checkCloudKeyScope(granted:unknown,operation:'read'|'operate'){if(!scopes.parse(granted).includes(operation))throw new CloudError('api_key_scope',403)}
