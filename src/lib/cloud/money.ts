/** Display whole cents without converting financial integers to floating point. */
export function formatMicroUsd(amount: bigint): string {
  const negative = amount < 0n
  const cents = (negative ? -amount : amount) / 10000n
  return `${negative ? '-' : ''}$${cents / 100n}.${(cents % 100n).toString().padStart(2, '0')}`
}
