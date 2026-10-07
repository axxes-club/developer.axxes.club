import type {CloudContext} from './types'
import {CloudError} from './types'
export function requireCloudRole(ctx:CloudContext,operation:'read'|'operate'|'admin'){
 if(!ctx.userId||!ctx.tenant.id)throw new CloudError('unauthorized',401)
 const roles={read:['owner','admin','manager','member','viewer'],operate:['owner','admin','manager'],admin:['owner','admin']}
 if(!roles[operation].includes(ctx.role))throw new CloudError('forbidden',403)
}
