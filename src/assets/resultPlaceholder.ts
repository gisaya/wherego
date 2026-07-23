import type { ImageSourcePropType } from 'react-native';

export const STATIC_ASSET_BASE_URL = 'https://wherego-lake.vercel.app/assets';

export const WHEREGO_LOGO_IMAGE_SOURCE: ImageSourcePropType = {
  uri: `${STATIC_ASSET_BASE_URL}/logo.png`,
};

export const RESULT_PLACEHOLDER_IMAGE_URIS = {
  coast: `${STATIC_ASSET_BASE_URL}/results/fallback-coast.jpg`,
  nature: `${STATIC_ASSET_BASE_URL}/results/fallback-nature.jpg`,
  culture: `${STATIC_ASSET_BASE_URL}/results/fallback-culture.jpg`,
  outdoor: `${STATIC_ASSET_BASE_URL}/results/fallback-outdoor.jpg`,
  waterside: `${STATIC_ASSET_BASE_URL}/results/fallback-waterside.jpg`,
  garden: `${STATIC_ASSET_BASE_URL}/results/fallback-garden.jpg`,
  heritage: `${STATIC_ASSET_BASE_URL}/results/fallback-heritage.jpg`,
  indoor: `${STATIC_ASSET_BASE_URL}/results/fallback-indoor.jpg`,
  wellness: `${STATIC_ASSET_BASE_URL}/results/fallback-wellness.jpg`,
  activity: `${STATIC_ASSET_BASE_URL}/results/fallback-activity.jpg`,
} as const;

export type ResultImagePlaceholderTheme = keyof typeof RESULT_PLACEHOLDER_IMAGE_URIS;
