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
        icon: '',
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
