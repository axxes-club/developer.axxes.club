import type {AppContext} from '../context'
export type CloudContext=AppContext
export type ResourceKind='app'|'server'|'database'|'bucket'|'cluster'|'network'
export type JobState='queued'|'running'|'succeeded'|'failed'|'cancel_requested'|'reconciling'
export type CloudConfiguration={appAdapterVerified?:boolean;githubConfigured?:boolean;ownerPolicyVerified?:boolean;paymentVerified?:boolean;meteringVerified?:boolean;pricingVerified?:boolean}
export type Capability={key:'apps';name:string;paid:boolean}
export type CloudQuote={id:string;tenantId:string;resourceId:string;generation:number;amountMicroUsd:string;rateVersionId:string;expiresAt:string;inputHash:string}
export class CloudError extends Error{
 constructor(public readonly code:string,public readonly status=400){super(code);this.name='CloudError'}
}
