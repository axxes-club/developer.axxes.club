import {z} from 'zod';import {cloudHandler} from '@/lib/cloud/http';import {getCloudContext} from '@/lib/cloud/context';import {grantOwnerApp} from '@/lib/cloud/admission'
export const POST=cloudHandler(getCloudContext,(ctx,input)=>grantOwnerApp(ctx,z.object({resourceId:z.uuid()}).strict().parse(input).resourceId))
