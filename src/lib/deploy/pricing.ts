export type HostingTierKey = 'launch' | 'team'
export type HostingTier = { key: HostingTierKey; feeMicroUsd: bigint; includedCreditMicroUsd: bigint; maxProjects: number; maxDeployers: number; published: false }
export const HOSTING_TIERS: Readonly<Record<HostingTierKey, Readonly<HostingTier>>> = Object.freeze({
  launch: Object.freeze({key:'launch',feeMicroUsd:15000000n,includedCreditMicroUsd:5000000n,maxProjects:3,maxDeployers:3,published:false}),
  team: Object.freeze({key:'team',feeMicroUsd:39000000n,includedCreditMicroUsd:15000000n,maxProjects:15,maxDeployers:10,published:false}),
})
export const RESOURCE_UNITS = ['vcpu_ms','gib_ms','request','egress_byte','build_ms','artifact_byte_ms','log_byte'] as const
export type ResourceUnit = typeof RESOURCE_UNITS[number]
export type RationalPrice = {numerator: bigint; denominator: bigint}
export type RateVersion = RationalPrice & { id: string; region: string; runtimeClass: string; unit: ResourceUnit; effectiveAt: Date }
export function nonnegative(value: bigint): void { if (typeof value !== 'bigint' || value<0n) throw new Error('Expected nonnegative bigint') }
function validate(price: RationalPrice): void { nonnegative(price.numerator); if(typeof price.denominator!=='bigint'||price.denominator<=0n) throw new Error('Invalid price denominator') }
function gcd(a: bigint,b: bigint): bigint { while(b!==0n){ const next=a%b; a=b; b=next }; return a }
function reduce(price: RationalPrice): RationalPrice { const divisor=gcd(price.numerator,price.denominator); return {numerator:price.numerator/divisor,denominator:price.denominator/divisor} }
/** Exact subtotal. Only invoice/summary lines call roundMicroUsd. */
export function priceQuantity(quantity: bigint, rate: RationalPrice): RationalPrice { nonnegative(quantity); validate(rate); return reduce({numerator:quantity*rate.numerator,denominator:rate.denominator}) }
export function sumPrices(prices: readonly RationalPrice[]): RationalPrice {
  return prices.reduce((total,price)=>{ validate(price); const divisor=gcd(total.denominator,price.denominator); const denominator=total.denominator/divisor*price.denominator
    return reduce({numerator:total.numerator*(price.denominator/divisor)+price.numerator*(total.denominator/divisor),denominator})
  },{numerator:0n,denominator:1n})
}
export function roundMicroUsd(price: RationalPrice): bigint { validate(price); return (2n*price.numerator+price.denominator)/(2n*price.denominator) }
