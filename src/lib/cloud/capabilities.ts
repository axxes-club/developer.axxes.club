import {z} from 'zod'
import type {Capability,CloudConfiguration} from './types'
export const resourceSpec=z.object({kind:z.literal('app'),runtime:z.enum(['static','next-standalone']),region:z.literal('us-west1'),cpu:z.literal(1),memoryMiB:z.literal(512),minInstances:z.literal(0),maxInstances:z.literal(1)}).strict()
export type ResourceSpec=z.infer<typeof resourceSpec>
export function availableCapabilities(config:CloudConfiguration):Capability[]{
 if(!config.appAdapterVerified||!config.githubConfigured||!config.ownerPolicyVerified)return []
 return [{key:'apps',name:'Apps',paid:!!(config.paymentVerified&&config.meteringVerified&&config.pricingVerified)}]
}
/** Verification is a recorded operator release decision, never a customer toggle. */
export function cloudConfiguration():CloudConfiguration{
 return {appAdapterVerified:process.env.CLOUD_APP_VERIFIED==='true',githubConfigured:!!(process.env.CLOUD_GITHUB_CLIENT_ID&&process.env.CLOUD_GITHUB_CLIENT_SECRET&&process.env.CLOUD_GITHUB_APP_ID&&process.env.CLOUD_GITHUB_PRIVATE_KEY&&process.env.CLOUD_GITHUB_TOKEN_ENCRYPTION_KEY),ownerPolicyVerified:process.env.CLOUD_OWNER_POLICY_VERIFIED==='true',paymentVerified:process.env.CLOUD_PAYMENTS_VERIFIED==='true',meteringVerified:process.env.CLOUD_METERING_VERIFIED==='true',pricingVerified:process.env.CLOUD_PRICING_VERIFIED==='true'}
}
