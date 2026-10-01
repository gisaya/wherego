export function shouldSuppressBannerAds({
  paidCreditsRemaining,
  reservedCreditSource,
  adFree = false,
}: {
  paidCreditsRemaining: number;
  reservedCreditSource: string | null;
  adFree?: boolean;
}) {
  return adFree || paidCreditsRemaining > 0 || reservedCreditSource === 'paid';
}
