import {
  RESULT_PLACEHOLDER_IMAGE_URIS,
  STATIC_ASSET_BASE_URL,
  WHEREGO_LOGO_IMAGE_SOURCE,
} from './resultPlaceholder';

describe('result placeholder assets', () => {
  it('uses deployable HTTPS assets for every result theme', () => {
    const urls = Object.values(RESULT_PLACEHOLDER_IMAGE_URIS);

    expect(urls).toHaveLength(10);
    expect(new Set(urls).size).toBe(urls.length);
    urls.forEach((url) => {
      expect(url).toMatch(/^https:\/\/wherego-lake\.vercel\.app\/assets\/results\/fallback-.+\.jpg$/);
    });
  });

  it('uses the same static host for the logo', () => {
    expect(WHEREGO_LOGO_IMAGE_SOURCE).toEqual({
      uri: `${STATIC_ASSET_BASE_URL}/logo.png`,
    });
  });
});
