import {readCloudRequest} from '@/lib/cloud/api-context'
import {cloudHandler} from '@/lib/cloud/http';import {getCloudContext} from '@/lib/cloud/context';import {listJobs} from '@/lib/cloud/store'
export const dynamic='force-dynamic'
export const GET=cloudHandler(readCloudRequest,async ctx=>({jobs:await listJobs(ctx)}))
import {requestOperation} from '@/lib/cloud/admission'
export const POST=cloudHandler(getCloudContext,(ctx,input)=>requestOperation(ctx,input))
