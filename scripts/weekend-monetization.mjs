import { validAdConfig } from '../public/web/adsense.mjs';

// Public publisher ID verified on the user's robotupgrade.win site.
export const publisherId = 'ca-pub-2755307700705125';
export function monetizationConfig(env = process.env) {
  const enabled = env.WEB_ADSENSE_ENABLED === 'true';
  const config = { enabled, clientId: publisherId,
    hosts: (env.WEB_ADSENSE_HOSTS || 'wherego-lake.vercel.app').split(',').map(host => host.trim()),
    displaySlot: (env.WEB_ADSENSE_DISPLAY_SLOT || '').trim() };
  if (enabled && env.WEB_MEDIA_COMMERCIAL_USE_CONFIRMED !== 'true')
    throw new Error('Confirm commercial photo rights before enabling web ads');
  if (enabled && !validAdConfig(config)) throw new Error('Invalid web ad configuration');
  return config;
}
