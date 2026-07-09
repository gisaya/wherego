import { appsInToss } from '@apps-in-toss/framework/plugins';
import { router } from '@granite-js/plugin-router';
import { defineConfig } from '@granite-js/react-native/config';

export default defineConfig({
  scheme: 'intoss',
  appName: 'wherego',
  plugins: [
    appsInToss({
      brand: {
        displayName: '어디고',
        primaryColor: '#2B84FC',
        icon: 'https://static.toss.im/appsintoss/51165/be941510-6da6-4bba-982c-11824ab9a089.png',
      },
      permissions: [
        {
          name: 'geolocation',
          access: 'access',
        },
      ],
      navigationBar: {
        withBackButton: true,
        withHomeButton: true,
      },
    }),
    router(),
  ],
});
