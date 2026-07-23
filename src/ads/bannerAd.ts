export function shouldSuppressBannerAds({
  paidCreditsRemaining,
  reservedCreditSource,
}: {
  paidCreditsRemaining: number;
  reservedCreditSource: string | null;
}) {
  return paidCreditsRemaining > 0 || reservedCreditSource === 'paid';
}
