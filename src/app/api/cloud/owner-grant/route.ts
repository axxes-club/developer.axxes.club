import {z} from 'zod';import {cloudHandler} from '@/lib/cloud/http';import {getCloudContext} from '@/lib/cloud/context';import {grantOwnerProject} from '@/lib/cloud/admission'
export const POST=cloudHandler(getCloudContext,(ctx,input)=>grantOwnerProject(ctx,z.object({projectId:z.uuid()}).strict().parse(input).projectId))
