import { shouldSuppressBannerAds } from './bannerAd';

describe('shouldSuppressBannerAds', () => {
  it('removes banners while purchased credits remain', () => {
    expect(
      shouldSuppressBannerAds({
        paidCreditsRemaining: 3,
        reservedCreditSource: null,
      }),
    ).toBe(true);
  });

  it('keeps the final purchased recommendation banner-free after its credit is reserved', () => {
    expect(
      shouldSuppressBannerAds({
        paidCreditsRemaining: 0,
        reservedCreditSource: 'paid',
      }),
    ).toBe(true);
  });

  it('shows banners when no purchased benefit applies', () => {
    expect(
      shouldSuppressBannerAds({
        paidCreditsRemaining: 0,
        reservedCreditSource: 'base',
      }),
    ).toBe(false);
  });
});
