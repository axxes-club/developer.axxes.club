import {cloudHandler} from '@/lib/cloud/http'
import {getCloudContext} from '@/lib/cloud/context'
import {issueCloudKey,listCloudKeys} from '@/lib/cloud/key-store'
export const dynamic='force-dynamic'
export const GET=cloudHandler(getCloudContext,async ctx=>({keys:await listCloudKeys(ctx)}))
export const POST=cloudHandler(getCloudContext,async(ctx,input)=>({key:await issueCloudKey(ctx,input)}))
