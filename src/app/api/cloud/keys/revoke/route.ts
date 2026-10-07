import {z} from 'zod'
import {cloudHandler} from '@/lib/cloud/http'
import {getCloudContext} from '@/lib/cloud/context'
import {revokeCloudKey} from '@/lib/cloud/key-store'
export const POST=cloudHandler(getCloudContext,async(ctx,input)=>{const value=z.object({id:z.uuid()}).strict().parse(input);return revokeCloudKey(ctx,value.id)})
