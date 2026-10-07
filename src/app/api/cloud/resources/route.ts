import {cloudHandler} from '@/lib/cloud/http';import {getCloudContext} from '@/lib/cloud/context';import {createResource,listResources} from '@/lib/cloud/store';import {availableCapabilities,cloudConfiguration} from '@/lib/cloud/capabilities';import {CloudError} from '@/lib/cloud/types'
export const dynamic='force-dynamic'
export const GET=cloudHandler(getCloudContext,async ctx=>({resources:await listResources(ctx)}))
export const POST=cloudHandler(getCloudContext,async(ctx,input)=>{if(!availableCapabilities(cloudConfiguration()).length)throw new CloudError('app_provisioning_unavailable',503);return {resource:await createResource(ctx,input)}})
